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
  signatureEnabled: boolean;
  signatureName: string | null;
  /** Off by default: group traffic is filtered out at the source (Evolution's
   *  own groupsIgnore) unless a workspace opts in from Configuracoes > WhatsApp. */
  groupsEnabled: boolean;
}

/**
 * Prefixes the sender's name the way Chatwoot and the Evolution panel do, so a
 * workspace sharing one number still reads as people rather than a switchboard.
 * Returns the text untouched when the signature is off or has no name to use.
 */
export function applySignature(
  text: string,
  connection: Pick<WhatsAppConnection, "signatureEnabled" | "signatureName" | "profileName">,
): string {
  if (!connection.signatureEnabled) return text;
  const name = (connection.signatureName ?? connection.profileName ?? "").trim();
  if (!name) return text;
  return `*${name}*:\n${text}`;
}

/** Label the conversation list falls back to when a message has no text body. */
const PREVIEW_BY_TYPE: Record<MessageType, string> = {
  text: "",
  image: "📷 Imagem",
  audio: "🎤 Áudio",
  video: "🎬 Vídeo",
  document: "📄 Documento",
  sticker: "Figurinha",
  unsupported: "Mensagem não suportada",
};

/**
 * What the conversation list shows as the last-message preview. A media
 * message with no caption used to fall back to the raw stored filename
 * ("audio-1787783822175.webm") — this is the one place both send and ingest
 * go through now, so neither can regress back to that.
 */
export function previewFor(type: MessageType, body?: string | null): string {
  if (body) return body.slice(0, 200);
  return PREVIEW_BY_TYPE[type] ?? "";
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

/** A group the connected number belongs to, for the "avisar grupo" action. */
export interface WhatsAppGroup {
  /** Provider JID (e.g. "123456789-987654321@g.us") -- also the send target. */
  id: string;
  subject: string;
  participantsCount: number | null;
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
  /** Groups the connected number belongs to, for the "avisar grupo" action. */
  fetchGroups(): Promise<WhatsAppGroup[]>;
  /** Pushes the groups-enabled choice to the provider (Evolution's groupsIgnore). */
  updateGroupsSetting(enabled: boolean): Promise<void>;
  /**
   * Asks the provider which JID actually owns a phone number, or null when no
   * candidate is registered on WhatsApp. Never guess this: Brazilian numbers
   * from before the ninth-digit change are registered without it, and only
   * WhatsApp knows which form is real.
   */
  resolveJid(phone: string): Promise<string | null>;
  /** Fetches bytes for an inbound message whose media wasn't inlined. */
  fetchInboundMedia(raw: unknown): Promise<InboundMedia | null>;
  normalizeInbound(payload: unknown): InboundEvent;
}

/** Country code assumed for numbers stored without one. */
const DEFAULT_COUNTRY_CODE = "55";

/**
 * Every form of a number worth asking the provider about, best guess first.
 *
 * CRM contacts are typed the way people say them out loud — "38 99922-5622" —
 * so the country code has to be added, and Brazilian mobiles may or may not
 * carry the ninth digit depending on when the line was registered. Both forms
 * go in one request and the provider says which exists.
 */
export function phoneCandidates(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];

  // 12 or more digits already carry a country code; shorter is a local number.
  const e164 = digits.length >= 12 ? digits : `${DEFAULT_COUNTRY_CODE}${digits}`;
  const candidates = [e164];

  if (e164.startsWith(DEFAULT_COUNTRY_CODE)) {
    const national = e164.slice(2);
    const ddd = national.slice(0, 2);
    const line = national.slice(2);
    if (line.length === 9 && line.startsWith("9")) {
      candidates.push(`${DEFAULT_COUNTRY_CODE}${ddd}${line.slice(1)}`);
    } else if (line.length === 8) {
      candidates.push(`${DEFAULT_COUNTRY_CODE}${ddd}9${line}`);
    }
  }

  // Last resort: the number exactly as stored. An international contact saved
  // as "12125551234" is 11 digits and looks local, so the guess above would
  // bury a country code under another one; asking for the raw form too costs
  // nothing and is the only thing that reaches them.
  candidates.push(digits);

  return [...new Set(candidates)];
}

/** Strips the JID suffix and any non-digit, e.g. "5538999225622@s.whatsapp.net". */
export function jidToPhone(jid: string): string {
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "");
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}
