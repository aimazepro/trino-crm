// Processamento de evento de chamada.
//
// Vive fora da rota porque dois caminhos entram aqui: o webhook do provedor e o
// controle do provedor simulado. Os dois passam pela MESMA verificacao de
// assinatura e pelo MESMO registro de evento -- entao testar com o simulado
// exercita o codigo que vai rodar em producao, nao um atalho.

import { getProvider } from "./index";
import { createTelephonyAdmin } from "./db";
import type { CallStatus, NormalizedCallEvent } from "./types";

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/** Mapeia o evento normalizado para o status final do CDR. */
function statusFor(event: NormalizedCallEvent): CallStatus | null {
  switch (event.type) {
    case "ringing":
      return "ringing";
    case "answered":
      return "answered";
    case "failed":
      return "failed";
    case "completed":
      if (event.status) return event.status;
      return (event.durationSeconds ?? 0) > 0 ? "completed" : "no_answer";
    default:
      return null;
  }
}

export async function processWebhook(
  providerName: string,
  headers: Headers,
  rawBody: string,
): Promise<WebhookResult> {
  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return { status: 404, body: { error: "provedor desconhecido" } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "corpo inválido" } };
  }

  const events = provider.parseWebhook(parsed);
  if (events.length === 0) {
    return { status: 202, body: { ignored: true } };
  }

  const admin = createTelephonyAdmin();
  const processed: string[] = [];

  for (const event of events) {
    // A chamada e quem diz de qual workspace veio o evento -- e portanto qual
    // segredo usar para conferir a assinatura.
    const { data: call } = await admin
      .from("telephony_calls")
      .select("id, workspace_id, provider, recording_status")
      .eq("provider", providerName)
      .eq("provider_call_id", event.providerCallId)
      .maybeSingle();

    if (!call) {
      // Evento de chamada que nao e nossa. Nao e erro: outro sistema pode estar
      // na mesma conta do provedor.
      continue;
    }

    const { data: account } = await admin
      .from("telephony_accounts")
      .select("id, webhook_secret, recording_enabled, recording_retention_days")
      .eq("workspace_id", call.workspace_id)
      .maybeSingle();

    if (!account) continue;

    if (!provider.verifyWebhook(headers, rawBody, account.webhook_secret)) {
      return { status: 401, body: { error: "assinatura inválida" } };
    }

    // Registro cru primeiro: se o processamento explodir, o evento fica gravado
    // para reprocessar. A UNIQUE (provider, provider_event_id) faz a reentrega
    // virar no-op.
    const { error: dupe } = await admin.from("telephony_events").insert({
      workspace_id: call.workspace_id,
      call_id: call.id,
      provider: providerName,
      provider_event_id: event.providerEventId,
      event_type: event.type,
      payload: parsed as never,
    });
    if (dupe) {
      processed.push(`${event.providerEventId}:duplicate`);
      continue;
    }

    if (event.type === "recording_ready") {
      const retention = account.recording_retention_days ?? 180;
      await admin
        .from("telephony_calls")
        .update({
          recording_status: "stored",
          recording_key: event.recordingRef ?? null,
          recording_expires_at: new Date(
            Date.now() + retention * 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .eq("id", call.id);
      processed.push(`${event.providerEventId}:recording`);
    } else if (event.type === "completed" || event.type === "failed") {
      const { data: result, error } = await admin.rpc("telephony_finalize_call", {
        p_provider: providerName,
        p_provider_call_id: event.providerCallId,
        p_status: statusFor(event) ?? "completed",
        p_duration_seconds: event.durationSeconds ?? 0,
        p_answered_at: null,
        p_ended_at: event.occurredAt,
        p_hangup_cause: event.hangupCause ?? null,
      });

      if (error) {
        await admin
          .from("telephony_events")
          .update({ error: error.message })
          .eq("provider", providerName)
          .eq("provider_event_id", event.providerEventId);
        return { status: 500, body: { error: error.message } };
      }
      processed.push(`${event.providerEventId}:${JSON.stringify(result)}`);
    } else {
      const status = statusFor(event);
      if (status) {
        const patch: Record<string, string> = { status };
        if (event.type === "answered") patch.answered_at = event.occurredAt;
        await admin
          .from("telephony_calls")
          .update(patch as never)
          .eq("id", call.id);
      }
      processed.push(`${event.providerEventId}:${event.type}`);
    }

    await admin
      .from("telephony_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", providerName)
      .eq("provider_event_id", event.providerEventId);
  }

  return { status: 200, body: { processed: processed.length, details: processed } };
}
