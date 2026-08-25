// Evolution API v2 driver. Contracts verified against evolution-api v2.3.7 source:
//   instance.router.ts, sendMessage.router.ts, webhook.router.ts,
//   whatsapp.baileys.service.ts (prepareMessage / connectionUpdate).

import {
  ConnectionStatus,
  CreateInstanceResult,
  InboundEvent,
  InboundMedia,
  InboundMessage,
  MessageType,
  OutboundMedia,
  QrResult,
  SendResult,
  WhatsAppConnection,
  WhatsAppDriver,
  WhatsAppGroup,
  isGroupJid,
  jidToPhone,
  phoneCandidates,
} from "./types";

/** Header name Evolution echoes back to us so the webhook can authenticate itself. */
export const WEBHOOK_SECRET_HEADER = "x-trinocrm-secret";

const WEBHOOK_EVENTS = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
];

function baseUrl(): string {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL is not set");
  return url.replace(/\/+$/, "");
}

function globalKey(): string {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY is not set");
  return key;
}

type Json = Record<string, unknown>;

async function call(
  path: string,
  init: { method?: string; body?: Json; apikey: string },
): Promise<Json> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: init.apikey,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body: keep the raw text for the error message below.
  }

  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object"
        ? JSON.stringify(parsed).slice(0, 500)
        : text.slice(0, 500);
    throw new Error(`Evolution ${init.method ?? "GET"} ${path} failed (${res.status}): ${detail}`);
  }

  return (parsed ?? {}) as Json;
}

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function webhookBlock(webhookUrl: string, webhookSecret: string) {
  return {
    enabled: true,
    url: webhookUrl,
    byEvents: false,
    // Inlines media bytes in messages.upsert so we don't need a second round trip.
    base64: true,
    headers: {
      "Content-Type": "application/json",
      [WEBHOOK_SECRET_HEADER]: webhookSecret,
    },
    events: WEBHOOK_EVENTS,
  };
}

function readQr(source: Json | null): QrResult {
  if (!source) return { base64: null, code: null, pairingCode: null };
  return {
    base64: asString(source.base64),
    code: asString(source.code),
    pairingCode: asString(source.pairingCode),
  };
}

/** Evolution reports `open` | `connecting` | `close`; anything else means unknown. */
function readState(raw: unknown): ConnectionStatus {
  const state = asString(raw);
  if (state === "open" || state === "connecting" || state === "close") return state;
  return "disconnected";
}

const MEDIA_TYPE_BY_MESSAGE_KEY: Record<string, MessageType> = {
  conversation: "text",
  extendedTextMessage: "text",
  imageMessage: "image",
  audioMessage: "audio",
  videoMessage: "video",
  documentMessage: "document",
  stickerMessage: "sticker",
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/ogg; codecs=opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

function extensionFor(mimetype: string): string {
  const normalized = mimetype.toLowerCase();
  if (EXTENSION_BY_MIME[normalized]) return EXTENSION_BY_MIME[normalized];
  const base = normalized.split(";")[0].trim();
  if (EXTENSION_BY_MIME[base]) return EXTENSION_BY_MIME[base];
  const subtype = base.split("/")[1];
  return subtype ? subtype.replace(/[^a-z0-9]/g, "") || "bin" : "bin";
}

/** Extracts the human-readable text, whichever envelope Evolution used. */
function readBody(message: Json): string | null {
  const conversation = asString(message.conversation);
  if (conversation) return conversation;

  const extended = asRecord(message.extendedTextMessage);
  if (extended) {
    const text = asString(extended.text);
    if (text) return text;
  }

  for (const key of ["imageMessage", "videoMessage", "documentMessage"]) {
    const node = asRecord(message[key]);
    const caption = node ? asString(node.caption) : null;
    if (caption) return caption;
  }

  return null;
}

function readMessageType(message: Json, declaredType: string | null): MessageType {
  for (const [key, type] of Object.entries(MEDIA_TYPE_BY_MESSAGE_KEY)) {
    if (message[key]) return type;
  }
  if (declaredType && MEDIA_TYPE_BY_MESSAGE_KEY[declaredType]) {
    return MEDIA_TYPE_BY_MESSAGE_KEY[declaredType];
  }
  return "unsupported";
}

function readInlinedMedia(message: Json, type: MessageType, waMessageId: string): InboundMedia | null {
  const base64 = asString(message.base64);
  if (!base64) return null;

  const node =
    asRecord(message.imageMessage) ??
    asRecord(message.audioMessage) ??
    asRecord(message.videoMessage) ??
    asRecord(message.documentMessage) ??
    asRecord(message.stickerMessage);

  const mimetype = (node && asString(node.mimetype)) || defaultMimeFor(type);
  const declaredName = node ? asString(node.fileName) : null;

  return {
    data: Buffer.from(base64, "base64"),
    mimetype,
    filename: declaredName ?? `${waMessageId}.${extensionFor(mimetype)}`,
  };
}

function defaultMimeFor(type: MessageType): string {
  switch (type) {
    case "image":
      return "image/jpeg";
    case "audio":
      return "audio/ogg";
    case "video":
      return "video/mp4";
    case "sticker":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export class EvolutionDriver implements WhatsAppDriver {
  private readonly instanceName: string;
  private readonly instanceToken: string | null;
  private readonly groupsEnabled: boolean;

  constructor(
    connection: Pick<WhatsAppConnection, "instanceName" | "instanceToken" | "groupsEnabled">,
  ) {
    this.instanceName = connection.instanceName;
    this.instanceToken = connection.instanceToken;
    this.groupsEnabled = connection.groupsEnabled;
  }

  /** Instance-scoped token when we have one, so a leak is limited to one workspace. */
  private key(): string {
    return this.instanceToken ?? globalKey();
  }

  async createInstance(webhookUrl: string, webhookSecret: string): Promise<CreateInstanceResult> {
    const result = await call("/instance/create", {
      method: "POST",
      apikey: globalKey(),
      body: {
        instanceName: this.instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        // Groups start disabled for every new connection; updateGroupsSetting()
        // flips this live once a workspace opts in from Configuracoes > WhatsApp.
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
        webhook: webhookBlock(webhookUrl, webhookSecret),
      },
    });

    const instance = asRecord(result.instance);
    // v2 returns the instance token as `hash` — a bare string in 2.3.x, an
    // object in some builds.
    const hash = result.hash;
    const token =
      asString(hash) ?? (asRecord(hash) ? asString(asRecord(hash)!.apikey) : null);

    return {
      instanceId: instance ? asString(instance.instanceId) : null,
      instanceToken: token,
      qr: readQr(asRecord(result.qrcode)),
    };
  }

  async setWebhook(webhookUrl: string, webhookSecret: string): Promise<void> {
    await call(`/webhook/set/${encodeURIComponent(this.instanceName)}`, {
      method: "POST",
      apikey: this.key(),
      body: { webhook: webhookBlock(webhookUrl, webhookSecret) },
    });
  }

  async getQr(): Promise<QrResult> {
    const result = await call(`/instance/connect/${encodeURIComponent(this.instanceName)}`, {
      apikey: this.key(),
    });
    // Already-connected instances answer with the instance block and no QR.
    return readQr(asRecord(result.qrcode) ?? result);
  }

  async getStatus(): Promise<ConnectionStatus> {
    const result = await call(
      `/instance/connectionState/${encodeURIComponent(this.instanceName)}`,
      { apikey: this.key() },
    );
    const instance = asRecord(result.instance);
    return readState(instance ? instance.state : result.state);
  }

  async logout(): Promise<void> {
    await call(`/instance/logout/${encodeURIComponent(this.instanceName)}`, {
      method: "DELETE",
      apikey: this.key(),
    });
  }

  async deleteInstance(): Promise<void> {
    await call(`/instance/delete/${encodeURIComponent(this.instanceName)}`, {
      method: "DELETE",
      apikey: globalKey(),
    });
  }

  async sendText(phone: string, text: string): Promise<SendResult> {
    const result = await call(`/message/sendText/${encodeURIComponent(this.instanceName)}`, {
      method: "POST",
      apikey: this.key(),
      body: { number: phone, text },
    });
    return { waMessageId: readSentMessageId(result) };
  }

  async sendMedia(phone: string, media: OutboundMedia): Promise<SendResult> {
    const base64 = media.data.toString("base64");

    // Audio has its own endpoint: it is what makes the message render as a
    // voice note rather than an attached file.
    if (media.kind === "audio") {
      const result = await call(
        `/message/sendWhatsAppAudio/${encodeURIComponent(this.instanceName)}`,
        { method: "POST", apikey: this.key(), body: { number: phone, audio: base64 } },
      );
      return { waMessageId: readSentMessageId(result) };
    }

    const result = await call(`/message/sendMedia/${encodeURIComponent(this.instanceName)}`, {
      method: "POST",
      apikey: this.key(),
      body: {
        number: phone,
        mediatype: media.kind,
        mimetype: media.mimetype,
        fileName: media.filename,
        ...(media.caption ? { caption: media.caption } : {}),
        media: base64,
      },
    });
    return { waMessageId: readSentMessageId(result) };
  }

  async updateGroupsSetting(enabled: boolean): Promise<void> {
    // Evolution's /settings/set replaces the whole settings block, so this
    // resends the same flags createInstance() set -- only groupsIgnore moves.
    await call(`/settings/set/${encodeURIComponent(this.instanceName)}`, {
      method: "POST",
      apikey: this.key(),
      body: {
        groupsIgnore: !enabled,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      },
    });
  }

  async fetchGroups(): Promise<WhatsAppGroup[]> {
    // getParticipants=false: the "avisar grupo" picker only needs the name,
    // and fetching every member of every group is the slow, heavy form of
    // this call.
    const result = (await call(
      `/group/fetchAllGroups/${encodeURIComponent(this.instanceName)}?getParticipants=false`,
      { apikey: this.key() },
    )) as unknown;

    if (!Array.isArray(result)) return [];

    const groups: WhatsAppGroup[] = [];
    for (const entry of result) {
      const record = asRecord(entry);
      const id = record ? asString(record.id) : null;
      if (!id || !isGroupJid(id)) continue;
      groups.push({
        id,
        subject: (record && asString(record.subject)) ?? id,
        participantsCount: typeof record?.size === "number" ? record.size : null,
      });
    }
    return groups.sort((a, b) => a.subject.localeCompare(b.subject, "pt-BR"));
  }

  async resolveJid(phone: string): Promise<string | null> {
    const numbers = phoneCandidates(phone);
    if (numbers.length === 0) return null;

    // Answers with a bare array, one entry per number asked about. The `jid` it
    // returns is authoritative and can differ from what we sent — WhatsApp
    // answers "5538999225622" with "553899225622@s.whatsapp.net" when the line
    // predates the ninth digit.
    const result = (await call(`/chat/whatsappNumbers/${encodeURIComponent(this.instanceName)}`, {
      method: "POST",
      apikey: this.key(),
      body: { numbers },
    })) as unknown;

    if (!Array.isArray(result)) return null;

    for (const entry of result) {
      const record = asRecord(entry);
      if (record?.exists === true) {
        const jid = asString(record.jid);
        if (jid) return jid;
      }
    }
    return null;
  }

  async fetchInboundMedia(raw: unknown): Promise<InboundMedia | null> {
    const payload = asRecord(raw);
    if (!payload) return null;

    const result = await call(
      `/chat/getBase64FromMediaMessage/${encodeURIComponent(this.instanceName)}`,
      { method: "POST", apikey: this.key(), body: { message: payload } },
    );

    const base64 = asString(result.base64);
    if (!base64) return null;

    const mimetype = asString(result.mimetype) ?? "application/octet-stream";
    const filename = asString(result.fileName) ?? `media.${extensionFor(mimetype)}`;
    return { data: Buffer.from(base64, "base64"), mimetype, filename };
  }

  normalizeInbound(payload: unknown): InboundEvent {
    const envelope = asRecord(payload);
    if (!envelope) return { kind: "ignored", reason: "payload is not an object" };

    const event = asString(envelope.event);
    const data = envelope.data;

    switch (event) {
      case "qrcode.updated": {
        const record = asRecord(data);
        return { kind: "qr", qr: readQr(record ? asRecord(record.qrcode) ?? record : null) };
      }

      case "connection.update": {
        const record = asRecord(data);
        return {
          kind: "connection",
          status: readState(record?.state),
          phoneNumber: record ? phoneFromWuid(record.wuid) : null,
          profileName: record ? asString(record.profileName) : null,
          profilePicUrl: record ? asString(record.profilePictureUrl) : null,
        };
      }

      case "messages.update":
        return normalizeStatusUpdate(data);

      case "messages.upsert":
        return normalizeUpsert(data, this.groupsEnabled);

      default:
        return { kind: "ignored", reason: `unhandled event "${event ?? "unknown"}"` };
    }
  }
}

function phoneFromWuid(wuid: unknown): string | null {
  const value = asString(wuid);
  return value ? jidToPhone(value) : null;
}

/** sendText/sendMedia answer with a Baileys WebMessageInfo. */
function readSentMessageId(result: Json): string | null {
  const key = asRecord(result.key);
  return key ? asString(key.id) : null;
}

function normalizeStatusUpdate(data: unknown): InboundEvent {
  // Evolution sends either one update or an array of them.
  const record = asRecord(Array.isArray(data) ? data[0] : data);
  if (!record) return { kind: "ignored", reason: "messages.update without payload" };

  const waMessageId = asString(record.keyId) ?? asString(asRecord(record.key)?.id);
  if (!waMessageId) return { kind: "ignored", reason: "messages.update without message id" };

  const status = (asString(record.status) ?? "").toUpperCase();
  if (status === "READ" || status === "PLAYED") return { kind: "status", waMessageId, status: "read" };
  if (status === "DELIVERY_ACK") return { kind: "status", waMessageId, status: "delivered" };

  return { kind: "ignored", reason: `status "${status}" needs no write` };
}

function normalizeUpsert(data: unknown, groupsEnabled: boolean): InboundEvent {
  const record = asRecord(Array.isArray(data) ? data[0] : data);
  if (!record) return { kind: "ignored", reason: "messages.upsert without payload" };

  const key = asRecord(record.key);
  const remoteJid = key ? asString(key.remoteJid) : null;
  const waMessageId = key ? asString(key.id) : null;
  if (!remoteJid || !waMessageId) {
    return { kind: "ignored", reason: "messages.upsert without key.remoteJid/key.id" };
  }

  // Belt and braces: updateGroupsSetting() flips groupsIgnore on the Evolution
  // side too, but a config change there (or a message that raced the toggle)
  // must not leak a group into the inbox while it's off.
  if (isGroupJid(remoteJid) && !groupsEnabled) {
    return { kind: "ignored", reason: "group message (groups disabled)" };
  }
  if (remoteJid === "status@broadcast") return { kind: "ignored", reason: "status broadcast" };

  const message = asRecord(record.message);
  if (!message) return { kind: "ignored", reason: "messages.upsert without message body" };

  const type = readMessageType(message, asString(record.messageType));
  const seconds = typeof record.messageTimestamp === "number" ? record.messageTimestamp : null;

  const inbound: InboundMessage = {
    waMessageId,
    remoteJid,
    phone: jidToPhone(remoteJid),
    fromMe: key?.fromMe === true,
    pushName: asString(record.pushName),
    type,
    body: readBody(message),
    timestamp: new Date(seconds ? seconds * 1000 : Date.now()).toISOString(),
    media: type === "text" || type === "unsupported" ? null : readInlinedMedia(message, type, waMessageId),
    raw: record,
  };

  return { kind: "message", message: inbound };
}
