// Provider-agnostic contract for WhatsApp messaging.
//
// Everything above this layer (API routes, UI) speaks only these types, so
// swapping Evolution for uazapi later is a new file plus a `provider` value,
// not a rewrite. Evolution is the only implementation today.

export type WhatsAppProvider = "evolution";

export type ConnectionStatus = "disconnected" | "connecting" | "open" | "close";

export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "unsupported";

/** A connection row with its secrets already decrypted. Never send to the browser. */
export interface WhatsAppConnection {
  id: string;
  userId: string;
  provider: WhatsAppProvider;
  instanceName: string;
  instanceId: string | null;
  instanceToken: string | null;
  webhookSecret: string;
  status: ConnectionStatus;
  phoneNumber: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
  qrCode: string | null;
  qrExpiresAt: string | null;
  lastError: string | null;
}

export interface QrResult {
  base64: string | null;
  code: string | null;
  pairingCode: string | null;
}

export interface CreateInstanceResult {
  instanceId: string | null;
  instanceToken: string | null;
  qr: QrResult;
}

export interface SendResult {
  waMessageId: string | null;
}

export interface OutboundMedia {
  /** Raw bytes; the driver encodes them however the provider wants. */
  data: Buffer;
  mimetype: string;
  filename: string;
  /** Drives which provider endpoint is used (audio has its own on Evolution). */
  kind: "image" | "audio" | "video" | "document";
  caption?: string;
}

/** Media attached to an inbound message, already downloaded. */
export interface InboundMedia {
  data: Buffer;
  mimetype: string;
  filename: string;
}

export interface InboundMessage {
  waMessageId: string;
  remoteJid: string;
  /** Digits only, no JID suffix. */
  phone: string;
  fromMe: boolean;
  pushName: string | null;
  type: MessageType;
  body: string | null;
  timestamp: string;
  /** Present only when the provider inlined the bytes in the webhook. */
  media: InboundMedia | null;
  /** Provider payload kept so media can be fetched later if it wasn't inlined. */
  raw: unknown;
}

/**
 * Normalized webhook event. `ignored` carries a reason so the ingestion route
 * can log why nothing was written instead of failing silently.
 */
export type InboundEvent =
  | { kind: "message"; message: InboundMessage }
  | { kind: "status"; waMessageId: string; status: "delivered" | "read" }
  | {
      kind: "connection";
      status: ConnectionStatus;
      phoneNumber: string | null;
      profileName: string | null;
      profilePicUrl: string | null;
    }
  | { kind: "qr"; qr: QrResult }
  | { kind: "ignored"; reason: string };

export interface WhatsAppDriver {
  /** Creates the provider-side instance and returns the first QR. */
  createInstance(webhookUrl: string, webhookSecret: string): Promise<CreateInstanceResult>;
  setWebhook(webhookUrl: string, webhookSecret: string): Promise<void>;
  getQr(): Promise<QrResult>;
  getStatus(): Promise<ConnectionStatus>;
  logout(): Promise<void>;
  deleteInstance(): Promise<void>;
  sendText(phone: string, text: string): Promise<SendResult>;
  sendMedia(phone: string, media: OutboundMedia): Promise<SendResult>;
  /** Fetches bytes for an inbound message whose media wasn't inlined. */
  fetchInboundMedia(raw: unknown): Promise<InboundMedia | null>;
  normalizeInbound(payload: unknown): InboundEvent;
}

/** Strips the JID suffix and any non-digit, e.g. "5538999225622@s.whatsapp.net". */
export function jidToPhone(jid: string): string {
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "");
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}
