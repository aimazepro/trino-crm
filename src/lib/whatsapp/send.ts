import type { Database } from "@/lib/supabase/database.types";
// Sending a message, independent of who asked for it.
//
// Two callers share this: the salesperson typing in /conversas, and the
// automation queue. They must behave identically — same JID resolution, same
// conversation row, same signature, same message written to the thread — or an
// automated message becomes an invisible send the salesperson never sees in the
// history. Everything HTTP-shaped (auth, status codes, uploads) stays in the
// routes; this file only knows Supabase and the driver.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDriver, isGroupJid, jidToPhone } from "@/lib/whatsapp";
import { putMedia } from "@/lib/whatsapp/storage";
import { toPlayable, toVoiceNote, withExtension } from "@/lib/whatsapp/audio";
import { resolveConversationLinks } from "@/lib/whatsapp/linking";
import { loadSenderSignature } from "@/lib/whatsapp/sender-identity";
import { applySignature, previewFor } from "@/lib/whatsapp/types";
import type { MessageType, OutboundMedia, WhatsAppConnection } from "@/lib/whatsapp/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const MAX_TEXT_LENGTH = 4096;

/** A number nobody can reach — worth its own type so the caller can say why. */
export class UnreachableNumberError extends Error {}

/** The conversation id does not exist, or belongs to another workspace. */
export class ConversationNotFoundError extends Error {}

const MESSAGE_TYPE_BY_KIND: Record<OutboundMedia["kind"], MessageType> = {
  image: "image",
  audio: "audio",
  video: "video",
  document: "document",
};

export interface SendInput {
  /** Either an existing conversation, or a raw phone number to open one. */
  conversationId?: string;
  phone?: string;
  text?: string | null;
  media?: (OutboundMedia & { bytes: Buffer }) | null;
  /** Who clicked send. Null for the automation queue: nobody did. */
  sentBy: string | null;
}

export interface SendOutcome {
  messageId: string;
  conversationId: string;
  status: "sent" | "failed";
  error?: string;
}

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
  admin: SupabaseClient<Database>,
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

export async function resolveConversation(
  admin: SupabaseClient<Database>,
  connection: WhatsAppConnection,
  input: { conversationId?: string; phone?: string },
): Promise<{ id: string; phone: string; remoteJid: string } | null> {
  if (input.conversationId) {
    const { data } = await admin
      .from("whatsapp_conversations")
      .select("id, phone, remote_jid, jid_verified")
      // Scoped to the workspace so a forged id can't send from someone else's number.
      .eq("id", input.conversationId)
      .eq("workspace_id", connection.userId)
      .maybeSingle();

    if (!data) return null;
    const row = data as any;
    if (row.jid_verified) return { id: row.id, phone: row.phone, remoteJid: row.remote_jid };
    const verified = await verifyJid(admin, connection, row);
    return { ...verified, remoteJid: row.remote_jid };
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
    .select("id, phone, remote_jid")
    .eq("connection_id", connection.id)
    .eq("remote_jid", jid)
    .maybeSingle();

  if (existing) {
    return {
      id: (existing as any).id,
      phone: (existing as any).phone,
      remoteJid: (existing as any).remote_jid,
    };
  }

  const links = await resolveConversationLinks(admin, connection.userId, phone);

  const { data: created, error } = await admin
    .from("whatsapp_conversations")
    .insert({
      workspace_id: connection.userId,
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
  return { id: (created as any).id, phone: (created as any).phone, remoteJid: jid };
}

/**
 * Sends one message and records it in the thread.
 *
 * A provider failure is not thrown: the message row is already written, so the
 * outcome carries `failed` and the caller decides what to do with it. Only the
 * failures that happen *before* a row exists — an unreachable number, a missing
 * conversation — are thrown, because there is nothing in the thread to explain.
 */
export async function sendWhatsAppMessage(
  admin: SupabaseClient<Database>,
  connection: WhatsAppConnection,
  input: SendInput,
): Promise<SendOutcome> {
  const conversation = await resolveConversation(admin, connection, {
    conversationId: input.conversationId,
    phone: input.phone,
  });

  if (!conversation) {
    throw new ConversationNotFoundError("Conversa não encontrada");
  }

  const media = input.media ?? null;
  const messageType: MessageType = media ? MESSAGE_TYPE_BY_KIND[media.kind] : "text";

  // Signed before the row is written, so the thread shows what the customer
  // actually received rather than a cleaner version of it.
  let text = input.text ?? null;
  const sender = await loadSenderSignature(admin, connection.userId, input.sentBy);
  if (text) text = applySignature(text, connection, sender);
  if (media?.caption) media.caption = applySignature(media.caption, connection, sender);

  const body = media ? media.caption ?? null : text;

  // Our own copy of an outgoing attachment, so the thread renders it without
  // waiting for the webhook echo.
  //
  // Audio is re-encoded first. Storing the raw recording looked cheaper and was
  // the bug: Chrome records WebM/Opus, which Safari refuses outright and which
  // Chrome itself plays with no duration, so a sent voice note came back as
  // "Erro" in one browser and "0:00 / 0:00" in the other.
  let mediaPath: string | null = null;
  let storedMime = media?.mimetype ?? null;
  let storedFilename = media?.filename ?? null;
  if (media) {
    let stored: { data: Buffer; mimetype: string; filename: string } = {
      data: media.bytes,
      mimetype: media.mimetype,
      filename: media.filename,
    };

    if (media.kind === "audio") {
      const playable = await toPlayable(media.bytes, media.filename);
      if (playable) {
        stored = {
          data: playable.data,
          mimetype: playable.mimetype,
          filename: withExtension(media.filename, playable.extension),
        };
      }
    }

    storedMime = stored.mimetype;
    storedFilename = stored.filename;

    try {
      mediaPath = await putMedia(admin, {
        ownerId: connection.userId,
        conversationId: conversation.id,
        data: stored.data,
        mimetype: stored.mimetype,
        filename: stored.filename,
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
      workspace_id: connection.userId,
      conversation_id: conversation.id,
      from_me: true,
      type: messageType,
      body,
      media_path: mediaPath,
      media_mime: storedMime,
      media_filename: storedFilename,
      status: "pending",
      sent_by: input.sentBy,
      timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);
  const messageId = (pending as any).id;

  try {
    const driver = getDriver(connection);
    // A group JID has to reach the provider intact -- jidToPhone would mangle
    // it into digits that mean nothing. Individual chats still go by number,
    // the way resolveJid expects.
    const target = isGroupJid(conversation.remoteJid)
      ? conversation.remoteJid
      : jidToPhone(conversation.phone);

    // WhatsApp gets the Opus its voice notes require, encoded from the original
    // recording rather than from the mp4 we stored: one generation of loss
    // instead of two.
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
        last_message_preview: previewFor(messageType, body),
        last_message_from_me: true,
        unread_count: 0,
        manually_unread: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);

    return { messageId, conversationId: conversation.id, status: "sent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no envio";
    console.error("whatsapp/send", message);

    await admin
      .from("whatsapp_messages")
      .update({ status: "failed", error: message.slice(0, 500) })
      .eq("id", messageId);

    return { messageId, conversationId: conversation.id, status: "failed", error: message };
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
