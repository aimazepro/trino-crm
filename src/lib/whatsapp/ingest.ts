// Turns a normalized inbound event into rows. Called by the webhook route and,
// for the echo of our own sends, nothing else — the send route writes its own
// row first and the webhook then reconciles it by wa_message_id.

import type { SupabaseClient } from "@supabase/supabase-js";
import { updateConnection } from "./connection";
import { putMedia } from "./storage";
import { getDriver } from "./index";
import { resolveConversationLinks } from "./linking";
import type { InboundEvent, InboundMessage, WhatsAppConnection } from "./types";

/** How long a QR stays valid before the UI should ask for a fresh one. */
const QR_TTL_MS = 40_000;

const PREVIEW_BY_TYPE: Record<string, string> = {
  image: "📷 Imagem",
  audio: "🎤 Áudio",
  video: "🎬 Vídeo",
  document: "📄 Documento",
  sticker: "Figurinha",
  unsupported: "Mensagem não suportada",
};

function previewFor(message: Pick<InboundMessage, "type" | "body">): string {
  if (message.body) return message.body.slice(0, 200);
  return PREVIEW_BY_TYPE[message.type] ?? "";
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function findOrCreateConversation(
  admin: SupabaseClient,
  connection: WhatsAppConnection,
  message: InboundMessage,
): Promise<string> {
  const { data: existing } = await admin
    .from("whatsapp_conversations")
    .select("id, push_name")
    .eq("connection_id", connection.id)
    .eq("remote_jid", message.remoteJid)
    .maybeSingle();

  if (existing) {
    // Keep the display name fresh when the contact renames themselves.
    if (message.pushName && !message.fromMe && (existing as any).push_name !== message.pushName) {
      await admin
        .from("whatsapp_conversations")
        .update({ push_name: message.pushName })
        .eq("id", (existing as any).id);
    }
    return (existing as any).id;
  }

  const links = await resolveConversationLinks(admin, connection.userId, message.phone);

  const { data: created, error } = await admin
    .from("whatsapp_conversations")
    .insert({
      user_id: connection.userId,
      connection_id: connection.id,
      remote_jid: message.remoteJid,
      phone: message.phone,
      // WhatsApp is the one that produced this JID, so it needs no verification.
      jid_verified: true,
      contact_id: links.contactId,
      deal_id: links.dealId,
      owner_id: links.ownerId,
      push_name: message.fromMe ? null : message.pushName,
    })
    .select("id")
    .single();

  if (error) {
    // Two webhook deliveries can race on a brand-new conversation; the unique
    // index decides, and the loser reads the winner's row.
    const { data: raced } = await admin
      .from("whatsapp_conversations")
      .select("id")
      .eq("connection_id", connection.id)
      .eq("remote_jid", message.remoteJid)
      .maybeSingle();
    if (raced) return (raced as any).id;
    throw new Error(`could not create conversation: ${error.message}`);
  }

  return (created as any).id;
}

async function storeMessage(
  admin: SupabaseClient,
  connection: WhatsAppConnection,
  message: InboundMessage,
): Promise<void> {
  const conversationId = await findOrCreateConversation(admin, connection, message);

  // Our own outbound messages are already in the table; the webhook echo only
  // needs to confirm them, never duplicate them.
  const { data: known } = await admin
    .from("whatsapp_messages")
    .select("id, status")
    .eq("conversation_id", conversationId)
    .eq("wa_message_id", message.waMessageId)
    .maybeSingle();

  if (known) {
    if ((known as any).status === "pending") {
      await admin.from("whatsapp_messages").update({ status: "sent" }).eq("id", (known as any).id);
    }
    return;
  }

  let mediaPath: string | null = null;
  let mediaMime: string | null = null;
  let mediaFilename: string | null = null;

  if (message.type !== "text" && message.type !== "unsupported") {
    let media = message.media;
    if (!media) {
      // base64 inlining is best-effort on Evolution's side; fall back to pulling
      // the bytes rather than dropping the attachment.
      try {
        media = await getDriver(connection).fetchInboundMedia(message.raw);
      } catch (err) {
        console.error("whatsapp: media fetch failed", err);
        media = null;
      }
    }

    if (media) {
      try {
        mediaPath = await putMedia(admin, {
          ownerId: connection.userId,
          conversationId,
          data: media.data,
          mimetype: media.mimetype,
          filename: media.filename,
        });
        mediaMime = media.mimetype;
        mediaFilename = media.filename;
      } catch (err) {
        console.error("whatsapp: media upload failed", err);
      }
    }
  }

  const { error } = await admin.from("whatsapp_messages").insert({
    user_id: connection.userId,
    conversation_id: conversationId,
    wa_message_id: message.waMessageId,
    from_me: message.fromMe,
    type: message.type,
    body: message.body,
    media_path: mediaPath,
    media_mime: mediaMime,
    media_filename: mediaFilename,
    // Inbound messages are delivered by definition; ours start at sent and get
    // upgraded by messages.update.
    status: message.fromMe ? "sent" : "delivered",
    timestamp: message.timestamp,
  });

  // A duplicate here is the unique index doing its job on a redelivered webhook.
  if (error && !error.message.includes("duplicate key")) {
    throw new Error(`could not store message: ${error.message}`);
  }

  const patch: Record<string, any> = {
    last_message_at: message.timestamp,
    last_message_preview: previewFor(message),
    last_message_from_me: message.fromMe,
    updated_at: new Date().toISOString(),
  };

  if (!message.fromMe) {
    const { data: current } = await admin
      .from("whatsapp_conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .maybeSingle();
    patch.unread_count = ((current as any)?.unread_count ?? 0) + 1;
  } else {
    // Replying from the phone clears the badge, same as WhatsApp itself.
    patch.unread_count = 0;
    patch.manually_unread = false;
  }

  await admin.from("whatsapp_conversations").update(patch).eq("id", conversationId);
}

export async function handleInboundEvent(
  admin: SupabaseClient,
  connection: WhatsAppConnection,
  event: InboundEvent,
): Promise<void> {
  switch (event.kind) {
    case "message":
      await storeMessage(admin, connection, event.message);
      return;

    case "status": {
      // "read" must not be downgraded by a late-arriving "delivered".
      const query = admin
        .from("whatsapp_messages")
        .update({ status: event.status })
        .eq("user_id", connection.userId)
        .eq("wa_message_id", event.waMessageId)
        .eq("from_me", true);

      await (event.status === "read"
        ? query.in("status", ["pending", "sent", "delivered"])
        : query.in("status", ["pending", "sent"]));
      return;
    }

    case "connection":
      await updateConnection(admin, connection.id, {
        status: event.status,
        ...(event.phoneNumber ? { phone_number: event.phoneNumber } : {}),
        ...(event.profileName ? { profile_name: event.profileName } : {}),
        ...(event.profilePicUrl ? { profile_pic_url: event.profilePicUrl } : {}),
        // A live session has no QR to show.
        ...(event.status === "open" ? { qr_code: null, qr_expires_at: null, last_error: null } : {}),
      });
      return;

    case "qr":
      await updateConnection(admin, connection.id, {
        status: "connecting",
        qr_code: event.qr.base64,
        qr_expires_at: new Date(Date.now() + QR_TTL_MS).toISOString(),
      });
      return;

    case "ignored":
      return;
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
