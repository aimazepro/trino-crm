// Controle do provedor simulado.
//
// O softphone chama esta rota ao atender e ao desligar. Ela monta o payload,
// ASSINA com o segredo real da conta e entra pelo mesmo processWebhook que o
// provedor de verdade usaria. Nao e um atalho: reserva, CDR, debito idempotente,
// atividade na timeline e ledger rodam exatamente como em producao.

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { signMockPayload } from "@/lib/telephony/providers/mock";
import { processWebhook } from "@/lib/telephony/webhook";
import {
  createTelephonyAdmin,
  getSessionUser,
  loadAccount,
  resolveWorkspaceId,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { callId?: string; action?: string; durationSeconds?: number }
    | null;

  if (!body?.callId || !body.action) {
    return NextResponse.json({ error: "Informe callId e action" }, { status: 400 });
  }

  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    const account = await loadAccount(admin, workspaceId);
    if (!account) return NextResponse.json({ error: "Conta não configurada" }, { status: 409 });
    if (account.provider !== "mock") {
      return NextResponse.json(
        { error: "Esta rota só existe para o provedor simulado." },
        { status: 409 },
      );
    }

    const { data: call } = await admin
      .from("telephony_calls")
      .select("id, provider_call_id")
      .eq("id", body.callId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!call?.provider_call_id) {
      return NextResponse.json({ error: "Chamada não encontrada" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const duration = Math.max(0, Math.min(Number(body.durationSeconds ?? 0), 7200));

    const payload =
      body.action === "answer"
        ? { eventId: randomUUID(), callId: call.provider_call_id, type: "answered", at: now }
        : body.action === "recording"
          ? {
              eventId: randomUUID(),
              callId: call.provider_call_id,
              type: "recording_ready",
              at: now,
              recordingRef: `mockrec-${call.provider_call_id}`,
            }
          : {
              eventId: randomUUID(),
              callId: call.provider_call_id,
              type: "completed",
              at: now,
              durationSeconds: duration,
              status: duration > 0 ? "completed" : "no_answer",
              hangupCause: duration > 0 ? "normal" : "no-answer",
            };

    const rawBody = JSON.stringify(payload);
    const headers = new Headers({
      "content-type": "application/json",
      "x-telephony-signature": signMockPayload(rawBody, account.webhook_secret),
    });

    const result = await processWebhook("mock", headers, rawBody);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/mock/advance", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
