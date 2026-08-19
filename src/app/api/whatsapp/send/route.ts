import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAdmin,
  getSessionUser,
  loadConnection,
  resolveWorkspaceOwner,
} from "@/lib/whatsapp/connection";
import { getDriver, jidToPhone } from "@/lib/whatsapp";
import { putMedia } from "@/lib/whatsapp/storage";
import { toVoiceNote } from "@/lib/whatsapp/audio";
import { resolveConversationLinks } from "@/lib/whatsapp/linking";
import { applySignature } from "@/lib/whatsapp/types";
import type { MessageType, OutboundMedia, WhatsAppConnection } from "@/lib/whatsapp/types";

export const dynamic = "force-dynamic";

/** Guards the function against an oversized upload before anything is read. */
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
const MAX_TEXT_LENGTH = 4096;

/* eslint-disable @typescript-eslint/no-explicit-any */

function mediaKindFor(mimetype: string): OutboundMedia["kind"] {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype.startsWith("video/")) return "video";
  return "document";
}

const MESSAGE_TYPE_BY_KIND: Record<OutboundMedia["kind"], MessageType> = {
  image: "image",
  audio: "audio",
  video: "video",
  document: "document",
};

/** A number nobody can reach — worth its own status so the UI can say why. */
class UnreachableNumberError extends Error {}

/**
 * Replaces a guessed JID with the one WhatsApp confirms.
 *
 * Runs once per conversation, the first time we send to it. The provider is the
 * only source of truth here: it resolves both the missing country code and the
 * ninth digit, and it can hand back a JID that already belongs to another
 * conversation created from an inbound message — so the two are merged rather
 * than left as duplicate threads for the same person.
 */
async function verifyJid(
  admin: SupabaseClient,
  connection: WhatsAppConnection,
  row: { id: string; phone: string; remote_jid: string },
): Promise<{ id: string; phone: string }> {
  const jid = await getDriver(connection).resolveJid(row.phone);
  if (!jid) {
    throw new UnreachableNumberError(`O número ${row.phone} não tem WhatsApp.`);
  }

  if (jid === row.remote_jid) {
    await admin
      .from("whatsapp_conversations")
      .update({ jid_verified: true })
      .eq("id", row.id);
    return { id: row.id, phone: row.phone };
  }

  const phone = jidToPhone(jid);

  const { data: canonical } = await admin
    .from("whatsapp_conversations")
    .select("id, phone")
    .eq("connection_id", connection.id)
    .eq("remote_jid", jid)
    .maybeSingle();

  if (canonical && (canonical as any).id !== row.id) {
    await admin
      .from("whatsapp_messages")
      .update({ conversation_id: (canonical as any).id })
      .eq("conversation_id", row.id);
    await admin.from("whatsapp_conversations").delete().eq("id", row.id);
    return { id: (canonical as any).id, phone: (canonical as any).phone };
  }

  await admin
    .from("whatsapp_conversations")
    .update({ remote_jid: jid, phone, jid_verified: true })
    .eq("id", row.id);

  return { id: row.id, phone };
}

async function resolveConversation(
  admin: SupabaseClient,
  connection: WhatsAppConnection,
  input: { conversationId?: string; phone?: string },
): Promise<{ id: string; phone: string } | null> {
  if (input.conversationId) {
    const { data } = await admin
      .from("whatsapp_conversations")
      .select("id, phone, remote_jid, jid_verified")
      // Scoped to the workspace so a forged id can't send from someone else's number.
      .eq("id", input.conversationId)
      .eq("user_id", connection.userId)
      .maybeSingle();

    if (!data) return null;
    const row = data as any;
    if (row.jid_verified) return { id: row.id, phone: row.phone };
    return verifyJid(admin, connection, row);
  }

  const requested = (input.phone ?? "").replace(/\D/g, "");
  if (!requested) return null;

  // Asked before any row is written, so a conversation started from the CRM is
  // keyed by the same JID the webhook will use for the replies.
  const jid = await getDriver(connection).resolveJid(requested);
  if (!jid) {
    throw new UnreachableNumberError(`O número ${requested} não tem WhatsApp.`);
  }
  const phone = jidToPhone(jid);

  const { data: existing } = await admin
    .from("whatsapp_conversations")
    .select("id, phone")
    .eq("connection_id", connection.id)
    .eq("remote_jid", jid)
    .maybeSingle();

  if (existing) return { id: (existing as any).id, phone: (existing as any).phone };

  const links = await resolveConversationLinks(admin, connection.userId, phone);

  const { data: created, error } = await admin
    .from("whatsapp_conversations")
    .insert({
      user_id: connection.userId,
      connection_id: connection.id,
      remote_jid: jid,
      phone,
      jid_verified: true,
      contact_id: links.contactId,
      deal_id: links.dealId,
      owner_id: links.ownerId,
    })
    .select("id, phone")
    .single();

  if (error) throw new Error(error.message);
  return { id: (created as any).id, phone: (created as any).phone };
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdmin();
  const ownerId = await resolveWorkspaceOwner(admin, user.id);
  const connection = await loadConnection(admin, ownerId);

  if (!connection || connection.status !== "open") {
    return NextResponse.json(
      { error: "WhatsApp não está conectado. Conecte em Configurações > WhatsApp." },
      { status: 409 },
    );
  }

  let conversationId: string | undefined;
  let phoneInput: string | undefined;
  let text: string | null = null;
  let media: (OutboundMedia & { bytes: Buffer }) | null = null;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    conversationId = (form.get("conversationId") as string) || undefined;
    phoneInput = (form.get("phone") as string) || undefined;
    const caption = (form.get("caption") as string) || undefined;
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
    }
    if (file.size > MAX_MEDIA_BYTES) {
      return NextResponse.json({ error: "Arquivo maior que 16 MB" }, { status: 413 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimetype = file.type || "application/octet-stream";
    media = {
      bytes,
      data: bytes,
      mimetype,
      filename: file.name || "arquivo",
      kind: mediaKindFor(mimetype),
      caption,
    };
  } else {
    const body = (await req.json().catch(() => null)) as any;
    conversationId = body?.conversationId;
    phoneInput = body?.phone;
    text = typeof body?.text === "string" ? body.text.trim() : null;

    if (!text) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "Mensagem longa demais" }, { status: 400 });
    }
  }

  let conversation: { id: string; phone: string } | null;
  try {
    conversation = await resolveConversation(admin, connection, {
      conversationId,
      phone: phoneInput,
    });
  } catch (err) {
    // No message row is written for these: nothing was ever addressable, so a
    // failed bubble in the thread would imply a send that never had a target.
    if (err instanceof UnreachableNumberError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : "Falha ao abrir a conversa";
    console.error("whatsapp/send: resolve", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  const messageType: MessageType = media ? MESSAGE_TYPE_BY_KIND[media.kind] : "text";

  // Signed before the row is written, so the thread shows what the customer
  // actually received rather than a cleaner version of it.
  if (text) text = applySignature(text, connection);
  if (media?.caption) media.caption = applySignature(media.caption, connection);

  const body = media ? media.caption ?? null : text;

  // Our own copy of an outgoing attachment, so the thread renders it without
  // waiting for the webhook echo.
  let mediaPath: string | null = null;
  if (media) {
    try {
      mediaPath = await putMedia(admin, {
        ownerId: connection.userId,
        conversationId: conversation.id,
        data: media.bytes,
        mimetype: media.mimetype,
        filename: media.filename,
      });
    } catch (err) {
      console.error("whatsapp/send: media upload failed", err);
    }
  }

  // Written before the network call so a provider timeout still leaves a
  // visible message the user can see failed, rather than silence.
  const { data: pending, error: insertError } = await admin
    .from("whatsapp_messages")
    .insert({
      user_id: connection.userId,
      conversation_id: conversation.id,
      from_me: true,
      type: messageType,
      body,
      media_path: mediaPath,
      media_mime: media?.mimetype ?? null,
      media_filename: media?.filename ?? null,
      status: "pending",
      sent_by: user.id,
      timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  const messageId = (pending as any).id;

  try {
    const driver = getDriver(connection);
    const target = jidToPhone(conversation.phone);

    // Storage keeps the original — the browser that recorded it can always play
    // that back — while WhatsApp gets the Opus its voice notes require.
    let outbound = media;
    if (media && media.kind === "audio") {
      const note = await toVoiceNote(media.bytes, media.filename);
      if (note) outbound = { ...media, data: note.data, bytes: note.data, mimetype: note.mimetype };
    }

    const result = outbound
      ? await driver.sendMedia(target, outbound)
      : await driver.sendText(target, text!);

    await admin
      .from("whatsapp_messages")
      .update({ status: "sent", wa_message_id: result.waMessageId })
      .eq("id", messageId);

    await admin
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body ?? media?.filename ?? "",
        last_message_from_me: true,
        unread_count: 0,
        manually_unread: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);

    return NextResponse.json({ id: messageId, conversationId: conversation.id, status: "sent" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no envio";
    console.error("whatsapp/send", message);

    await admin
      .from("whatsapp_messages")
      .update({ status: "failed", error: message.slice(0, 500) })
      .eq("id", messageId);

    return NextResponse.json(
      { id: messageId, conversationId: conversation.id, status: "failed", error: message },
      { status: 502 },
    );
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
