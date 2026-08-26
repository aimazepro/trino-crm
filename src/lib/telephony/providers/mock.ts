// Provedor simulado.
//
// Existe para que TODO o resto -- reserva de saldo, CDR, debito idempotente,
// atividade na timeline, disposicao, /ligacoes -- seja exercitavel de ponta a
// ponta antes de existir contrato com qualquer operadora. Ele nao "finge" o
// fluxo: emite os mesmos webhooks assinados que um provedor real emitiria, no
// mesmo endpoint, e o pipeline inteiro roda de verdade.

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type {
  CreateExtensionInput,
  CreateExtensionResult,
  NormalizedCallEvent,
  OriginateInput,
  ProvisionAccountInput,
  ProvisionAccountResult,
  RecordingRef,
  TelephonyProvider,
  WebphoneToken,
} from "../types";

/** WAV de 1s em silencio, para a gravacao simulada ter um arquivo real tocavel. */
function silentWav(seconds = 1): string {
  const rate = 8000;
  const samples = rate * seconds;
  const buf = Buffer.alloc(44 + samples);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples, 40);
  buf.fill(128, 44); // silencio em PCM 8 bits unsigned
  return `data:audio/wav;base64,${buf.toString("base64")}`;
}

export function signMockPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export const mockProvider: TelephonyProvider = {
  name: "mock",
  canSelfProvision: true,

  async provisionAccount(input: ProvisionAccountInput): Promise<ProvisionAccountResult> {
    return {
      providerAccountId: `mockacct-${input.workspaceId.slice(0, 8)}`,
      credentials: { kind: "mock", createdAt: new Date().toISOString() },
      callerId: "1130000000",
    };
  },

  async createExtension(input: CreateExtensionInput): Promise<CreateExtensionResult> {
    // Ramal estavel por usuario: mesma pessoa reconecta e recebe o mesmo numero.
    const seed = parseInt(input.userId.replace(/\D/g, "").slice(0, 4) || "0", 10);
    const extension = input.preferredExtension ?? String(2000 + (seed % 8000));
    return {
      credentialId: `mockcred-${randomUUID()}`,
      extension,
      sipUsername: `mock_${extension}`,
      sipPassword: randomUUID().replace(/-/g, ""),
      sipServer: "sip.mock.local",
    };
  },

  async deleteExtension(): Promise<void> {
    // Nada a fazer no simulado.
  },

  async issueWebphoneToken(input): Promise<WebphoneToken> {
    return {
      token: `mocktoken-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      sipServer: input.sipServer || "sip.mock.local",
      wsServer: "wss://mock.local/ws",
      extension: input.extension,
    };
  },

  async originateCall(input: OriginateInput): Promise<{ providerCallId: string }> {
    // O ciclo de vida e dirigido pela rota /api/telephony/mock/advance, que o
    // softphone chama ao atender e ao desligar. Assim o teste e deterministico
    // em vez de depender de timer em ambiente serverless.
    return { providerCallId: `mockcall-${input.callRef}` };
  },

  async hangupCall(): Promise<void> {
    // O encerramento vira evento pela rota de controle do simulado.
  },

  async fetchRecording(): Promise<RecordingRef | null> {
    return { url: silentWav(1), contentType: "audio/wav" };
  },

  verifyWebhook(headers: Headers, rawBody: string, secret: string): boolean {
    const got = headers.get("x-telephony-signature") ?? "";
    const want = signMockPayload(rawBody, secret);
    const a = Buffer.from(got);
    const b = Buffer.from(want);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },

  parseWebhook(body: unknown): NormalizedCallEvent[] {
    const e = body as Record<string, unknown>;
    if (!e || typeof e !== "object" || !e.callId || !e.type) return [];
    return [
      {
        providerEventId: String(e.eventId ?? randomUUID()),
        providerCallId: String(e.callId),
        type: e.type as NormalizedCallEvent["type"],
        occurredAt: String(e.at ?? new Date().toISOString()),
        durationSeconds:
          typeof e.durationSeconds === "number" ? e.durationSeconds : undefined,
        status: e.status as NormalizedCallEvent["status"],
        hangupCause: e.hangupCause ? String(e.hangupCause) : undefined,
        recordingRef: e.recordingRef ? String(e.recordingRef) : undefined,
        raw: body,
      },
    ];
  },
};
