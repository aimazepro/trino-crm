// Adaptador API4COM.
//
// ATENCAO -- CONTRATO NAO VERIFICADO CONTRA CONTA REAL.
// Escrito a partir da documentacao publica (https://developers.api4com.com/),
// que expoe: base https://api.api4com.com/api/v1, autenticacao por token,
// Dialer.doCall para originar, Users.create/list para ramais e um Webphone
// proprio (Kazoo, SIP sobre WSS).
//
// O que PRECISA ser conferido no dia em que a conta existir -- e onde este
// arquivo vai falhar alto em vez de errar em silencio:
//   1. Nome exato dos campos de doCall (aqui: from/to/callerId/record)
//   2. Formato do id de chamada devolvido pela originacao
//   3. Catalogo de eventos de webhook -- a doc publica cita answer e hangup,
//      mas NAO cita ringing; se for so isso, o CDR nao tera answered_at proprio
//   4. Como a assinatura de webhook e enviada (cabecalho e algoritmo)
//   5. Se existe API de subconta por cliente. A doc mostra Account.signup, mas
//      nao documenta hierarquia de revenda -- isso muda o modelo multi-tenant
//
// Enquanto (5) nao for confirmado, a conta do workspace usa credencial propria
// informada pelo dono, e nao provisionamento automatico.

import { createHmac, timingSafeEqual } from "crypto";
import type {
  CreateExtensionInput,
  CreateExtensionResult,
  NormalizedCallEvent,
  OriginateInput,
  ProvisionAccountResult,
  RecordingRef,
  TelephonyProvider,
  WebphoneToken,
} from "../types";

const BASE = process.env.API4COM_BASE_URL ?? "https://api.api4com.com/api/v1";

function tokenOf(credentials: Record<string, unknown>): string {
  const token = credentials.apiToken ?? credentials.token;
  if (!token || typeof token !== "string") {
    throw new Error("API4COM: token da conta ausente. Configure em /configuracoes/telefone.");
  }
  return token;
}

async function call4com(
  credentials: Record<string, unknown>,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenOf(credentials)}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API4COM ${path} respondeu ${res.status}: ${text.slice(0, 300)}`);
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export const api4comProvider: TelephonyProvider = {
  name: "api4com",
  // Sem hierarquia de revenda documentada, o dono informa a credencial da
  // propria conta em vez de o CRM criar contas sozinho.
  canSelfProvision: false,

  async provisionAccount(): Promise<ProvisionAccountResult> {
    throw new Error(
      "API4COM: provisionamento automatico de subconta nao e documentado publicamente. " +
        "Informe o token da conta em /configuracoes/telefone.",
    );
  },

  async createExtension(input: CreateExtensionInput): Promise<CreateExtensionResult> {
    const body = {
      name: input.userName ?? `Usuario ${input.userId.slice(0, 8)}`,
      extension: input.preferredExtension,
    };
    const out = (await call4com(input.credentials, "/users", {
      method: "POST",
      body: JSON.stringify(body),
    })) as Record<string, unknown>;

    const extension = String(out.extension ?? out.ramal ?? body.extension ?? "");
    if (!extension) {
      throw new Error("API4COM: resposta de criacao de usuario sem ramal");
    }

    return {
      credentialId: String(out.id ?? out.userId ?? extension),
      extension,
      sipUsername: String(out.sipUsername ?? out.username ?? extension),
      sipPassword: String(out.sipPassword ?? out.password ?? ""),
      sipServer: String(out.sipServer ?? process.env.API4COM_SIP_SERVER ?? "sip.api4com.com"),
    };
  },

  async deleteExtension(input): Promise<void> {
    await call4com(input.credentials, `/users/${encodeURIComponent(input.credentialId)}`, {
      method: "DELETE",
    });
  },

  async issueWebphoneToken(input): Promise<WebphoneToken> {
    // O webphone da API4COM registra por credencial SIP. Nao ha JWT efemero
    // documentado, entao a credencial vai para o browser com validade curta
    // controlada pelo CRM -- e por isso que a rota /token exige sessao e ramal
    // ativo a cada emissao.
    return {
      token: input.sipPassword,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      sipServer: input.sipServer,
      wsServer: process.env.API4COM_WSS_URL ?? undefined,
      extension: input.extension,
    };
  },

  async originateCall(input: OriginateInput): Promise<{ providerCallId: string }> {
    const out = (await call4com(input.credentials, "/calls", {
      method: "POST",
      body: JSON.stringify({
        from: input.extension,
        to: input.toNumber,
        callerId: input.callerId ?? undefined,
        record: input.record,
        // Referencia nossa, para casar o webhook com a linha do CDR.
        externalId: input.callRef,
      }),
    })) as Record<string, unknown>;

    const id = out?.id ?? out?.callId ?? out?.uuid;
    if (!id) throw new Error("API4COM: originacao sem id de chamada na resposta");
    return { providerCallId: String(id) };
  },

  async hangupCall(input): Promise<void> {
    await call4com(input.credentials, `/calls/${encodeURIComponent(input.providerCallId)}`, {
      method: "DELETE",
    });
  },

  async fetchRecording(input): Promise<RecordingRef | null> {
    const out = (await call4com(
      input.credentials,
      `/calls/${encodeURIComponent(input.providerCallId)}/recording`,
    )) as Record<string, unknown> | null;
    if (!out) return null;
    const url = out.url ?? out.recordingUrl;
    if (!url) return null;
    return { url: String(url), contentType: String(out.contentType ?? "audio/mpeg") };
  },

  verifyWebhook(headers: Headers, rawBody: string, secret: string): boolean {
    const got = headers.get("x-api4com-signature") ?? headers.get("x-telephony-signature") ?? "";
    if (!got) return false;
    const want = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(got);
    const b = Buffer.from(want);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },

  parseWebhook(body: unknown): NormalizedCallEvent[] {
    const e = body as Record<string, unknown>;
    if (!e || typeof e !== "object") return [];

    const callId = e.callId ?? e.call_id ?? e.uuid ?? e.id;
    if (!callId) return [];

    const rawType = String(e.event ?? e.type ?? "").toLowerCase();
    const type: NormalizedCallEvent["type"] =
      rawType.includes("answer") ? "answered"
      : rawType.includes("ring") ? "ringing"
      : rawType.includes("hangup") || rawType.includes("complete") ? "completed"
      : rawType.includes("record") ? "recording_ready"
      : rawType.includes("fail") ? "failed"
      : "initiated";

    const duration =
      typeof e.duration === "number" ? e.duration
      : typeof e.billsec === "number" ? e.billsec
      : typeof e.durationSeconds === "number" ? e.durationSeconds
      : undefined;

    return [
      {
        providerEventId: String(e.eventId ?? e.event_id ?? `${callId}:${rawType}:${e.timestamp ?? ""}`),
        providerCallId: String(callId),
        type,
        occurredAt: String(e.timestamp ?? e.at ?? new Date().toISOString()),
        durationSeconds: duration,
        hangupCause: e.hangupCause ? String(e.hangupCause) : undefined,
        recordingRef: e.recordingUrl ? String(e.recordingUrl) : undefined,
        raw: body,
      },
    ];
  },
};
