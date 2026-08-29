// Originacao e listagem de chamadas.
//
// Quem origina e o SERVIDOR, nao o SDK do navegador. O provedor toca o ramal do
// vendedor e so entao disca o destino. Isso da tres coisas de graca: o id da
// chamada no provedor ja na resposta (matching trivial com o CDR), a checagem
// de saldo ANTES de gastar, e o mesmo caminho servindo o modo callback.

import { NextResponse } from "next/server";
import { getProvider } from "@/lib/telephony";
import { classifyDestination, toE164BR } from "@/lib/telephony/phone";
import {
  createTelephonyAdmin,
  credentialsOf,
  getRequesterRole,
  getSessionUser,
  loadAccount,
  loadExtensionForUser,
  resolveWorkspaceId,
} from "@/lib/telephony/server";
import { assertFeatureEnabled } from "@/lib/feature-flags-server";

export const dynamic = "force-dynamic";

/** Rota que gasta dinheiro do cliente precisa de teto. 20 originacoes por minuto por usuario. */
const MAX_CALLS_PER_MINUTE = 20;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    toNumber?: string;
    dealId?: string | null;
    contactId?: string | null;
    scriptId?: string | null;
  } | null;

  if (!body?.toNumber) {
    return NextResponse.json({ error: "Informe o número de destino" }, { status: 400 });
  }

  const e164 = toE164BR(body.toNumber);
  if (!e164) {
    return NextResponse.json({ error: "Número de destino inválido" }, { status: 400 });
  }

  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    const featureCheck = await assertFeatureEnabled(admin, workspaceId, "voip");
    if (!featureCheck.ok) return featureCheck.response;

    const account = await loadAccount(admin, workspaceId);
    if (!account || account.status !== "active") {
      return NextResponse.json(
        { error: "Telefonia não está ativa neste workspace." },
        { status: 409 },
      );
    }

    const ext = await loadExtensionForUser(admin, workspaceId, user.id);
    if (!ext || ext.status !== "active") {
      return NextResponse.json(
        { error: "Você não tem ramal vinculado. Peça ao dono da conta." },
        { status: 403 },
      );
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("telephony_calls")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .gte("started_at", since);
    if ((count ?? 0) >= MAX_CALLS_PER_MINUTE) {
      return NextResponse.json(
        { error: "Muitas ligações seguidas. Aguarde um minuto." },
        { status: 429 },
      );
    }

    const destinationType = classifyDestination(e164);

    const { data: started, error: startErr } = await admin.rpc("telephony_start_call", {
      p_workspace_id: workspaceId,
      p_user_id: user.id,
      p_extension_id: ext.id,
      p_provider: account.provider,
      p_to_number: e164,
      p_from_number: account.caller_id,
      p_destination_type: destinationType,
      p_deal_id: body.dealId ?? null,
      p_contact_id: body.contactId ?? null,
      p_script_id: body.scriptId ?? null,
    });

    if (startErr) {
      return NextResponse.json({ error: startErr.message }, { status: 500 });
    }

    const start = started as {
      ok: boolean;
      reason?: string;
      call_id?: string;
      rate_cents_per_minute?: number;
      mode?: string;
      balance_cents?: number;
      required_cents?: number;
    };

    if (!start.ok) {
      if (start.reason === "insufficient_balance") {
        return NextResponse.json(
          {
            error: "Saldo insuficiente para ligar. Adicione créditos.",
            reason: start.reason,
            balanceCents: start.balance_cents,
            requiredCents: start.required_cents,
          },
          { status: 402 },
        );
      }
      return NextResponse.json({ error: start.reason ?? "Falha ao abrir a chamada" }, { status: 409 });
    }

    const callId = start.call_id!;

    try {
      const provider = getProvider(account.provider);
      const { providerCallId } = await provider.originateCall({
        credentials: credentialsOf(account),
        providerAccountId: account.provider_account_id ?? "",
        extension: ext.extension,
        sipUsername: ext.sip_username ?? ext.extension,
        toNumber: e164,
        callerId: account.caller_id,
        callRef: callId,
        record: account.recording_enabled,
        callbackNumber: ext.dial_mode === "callback" ? ext.callback_number : null,
      });

      await admin.rpc("telephony_attach_provider_call", {
        p_call_id: callId,
        p_provider_call_id: providerCallId,
      });

      return NextResponse.json({
        callId,
        providerCallId,
        provider: account.provider,
        rateCentsPerMinute: start.rate_cents_per_minute ?? 0,
        mode: start.mode,
        dialMode: ext.dial_mode,
        extension: ext.extension,
        toNumber: e164,
        consentMode: account.consent_mode,
        consentText: account.consent_text,
        recording: account.recording_enabled,
      });
    } catch (providerErr) {
      // O provedor recusou: solta a reserva na hora, senao o saldo fica preso
      // ate a reconciliacao diaria.
      const message = providerErr instanceof Error ? providerErr.message : "falha no provedor";
      const { data: call } = await admin
        .from("telephony_calls")
        .select("reserved_cents")
        .eq("id", callId)
        .maybeSingle();

      if (call && call.reserved_cents > 0) {
        const { data: bal } = await admin
          .from("telephony_balances")
          .select("reserved_cents")
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        await admin
          .from("telephony_balances")
          .update({
            reserved_cents: Math.max(0, (bal?.reserved_cents ?? 0) - call.reserved_cents),
          })
          .eq("workspace_id", workspaceId);
      }

      await admin
        .from("telephony_calls")
        .update({
          status: "failed",
          hangup_cause: message.slice(0, 200),
          finalized_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
        })
        .eq("id", callId);

      console.error("telephony/calls originate", message);
      return NextResponse.json({ error: `Falha ao ligar: ${message}` }, { status: 502 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/calls POST", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** CDR do workspace. Alimenta /ligacoes e a aba Ligações do negócio. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const dealId = url.searchParams.get("dealId");
  const contactId = url.searchParams.get("contactId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    // admin = service role, ignora a RLS de telephony_calls -- sem este corte
    // aqui, todo vendedor recebia o CDR do workspace inteiro em vez de só o
    // que ele mesmo discou/atendeu. gerente e admin continuam vendo tudo,
    // igual à policy "telephony_calls: select" do banco.
    const role = await getRequesterRole();
    const isManager = role === "admin" || role === "gerente";

    let query = admin
      .from("telephony_calls")
      // Literal unico: o PostgREST infere o tipo das colunas a partir da string,
      // e concatenacao apaga essa inferencia.
      .select("id, user_id, contact_id, deal_id, direction, to_number, from_number, status, started_at, answered_at, ended_at, duration_seconds, billed_cents, recording_status, disposition, notes, hangup_cause, billing_mode, analysis, analyzed_at, transcript")
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: false })
      .limit(limit);

    // user_id é nullable (ligação sem usuário atribuído). .eq() nunca casa
    // com NULL, então isso já exclui essas ligações "órfãs" pra não-gerente
    // -- coerente com a policy, que também não deixaria elas aparecerem.
    if (!isManager) query = query.eq("user_id", user.id);

    if (dealId) query = query.eq("deal_id", dealId);
    if (contactId) query = query.eq("contact_id", contactId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      calls: (data ?? []).map((c) => ({
        id: c.id,
        userId: c.user_id,
        contactId: c.contact_id,
        dealId: c.deal_id,
        direction: c.direction,
        toNumber: c.to_number,
        fromNumber: c.from_number,
        status: c.status,
        startedAt: c.started_at,
        answeredAt: c.answered_at,
        endedAt: c.ended_at,
        durationSeconds: c.duration_seconds,
        billedCents: c.billed_cents,
        billingMode: c.billing_mode,
        hasRecording: c.recording_status === "stored",
        disposition: c.disposition,
        notes: c.notes,
        hangupCause: c.hangup_cause,
        analysis: c.analysis,
        analyzedAt: c.analyzed_at,
        hasTranscript: Boolean(c.transcript && c.transcript.trim()),
        transcript: c.transcript,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/calls GET", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
