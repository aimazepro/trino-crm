// Manutencao diaria da telefonia.
//
// Duas tarefas que nao podem depender de alguem lembrar:
//   1. Reconciliar chamada que nunca recebeu evento final -- senao a reserva
//      fica presa no saldo do cliente para sempre.
//   2. Expurgar gravacao vencida -- e obrigacao de LGPD, com prazo por conta.

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/telephony";
import { createTelephonyAdmin, credentialsOf } from "@/lib/telephony/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Falha fechada: CRON_SECRET ausente nunca pode significar "sem autenticacao".
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const admin = createTelephonyAdmin();
  const report: Record<string, unknown> = {};

  try {
    const { data: reconciled, error: recErr } = await admin.rpc(
      "telephony_reconcile_stale_calls",
      { p_older_than: "4 hours" },
    );
    report.reconciled = recErr ? `erro: ${recErr.message}` : reconciled;

    const { data: expired } = await admin
      .from("telephony_calls")
      .select("id, workspace_id, provider, provider_call_id")
      .eq("recording_status", "stored")
      .lt("recording_expires_at", new Date().toISOString())
      .limit(200);

    let purged = 0;
    const failures: string[] = [];

    for (const call of expired ?? []) {
      try {
        const { data: account } = await admin
          .from("telephony_accounts")
          .select("*")
          .eq("workspace_id", call.workspace_id)
          .maybeSingle();

        if (account && call.provider_call_id) {
          const provider = getProvider(call.provider);
          // Provedor sem API de exclusao ainda assim perde a referencia aqui:
          // sem recording_key, o proxy recusa servir o audio.
          if ("deleteRecording" in provider) {
            await (
              provider as unknown as {
                deleteRecording: (i: unknown) => Promise<void>;
              }
            ).deleteRecording({
              credentials: credentialsOf(account),
              providerCallId: call.provider_call_id,
            });
          }
        }

        await admin.rpc("telephony_mark_recording_deleted", { p_call_id: call.id });
        purged += 1;
      } catch (err) {
        failures.push(`${call.id}: ${err instanceof Error ? err.message : "erro"}`);
      }
    }

    report.recordingsPurged = purged;
    if (failures.length) report.purgeFailures = failures;

    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("cron/telephony-maintenance", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
