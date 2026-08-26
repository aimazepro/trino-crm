// Lancamento de credito de telefonia.
//
// Enquanto nao existe gateway de pagamento no produto (/configuracoes/billing
// ainda e mockado), o dono lanca o credito manualmente e o ledger registra quem
// lancou. Quando o checkout existir, ele chama a MESMA RPC com a chave de
// idempotencia do pagamento -- nada aqui muda.

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  createTelephonyAdmin,
  getSessionUser,
  isWorkspaceOwner,
  resolveWorkspaceId,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";

const MAX_CREDIT_CENTS = 1_000_000; // R$ 10.000 por lancamento

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { amountCents?: number; description?: string; idempotencyKey?: string }
    | null;

  const amount = Number(body?.amountCents);
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }
  if (amount > MAX_CREDIT_CENTS) {
    return NextResponse.json({ error: "Valor acima do limite por lançamento." }, { status: 400 });
  }

  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);
    if (!(await isWorkspaceOwner(admin, workspaceId, user.id))) {
      return NextResponse.json(
        { error: "Só o dono da conta pode lançar créditos." },
        { status: 403 },
      );
    }

    const { data, error } = await admin.rpc("telephony_add_credit", {
      p_workspace_id: workspaceId,
      p_amount_cents: amount,
      p_description: body?.description?.slice(0, 200) ?? "Crédito lançado pelo dono",
      p_created_by: user.id,
      p_idempotency_key: body?.idempotencyKey ?? `manual:${randomUUID()}`,
      p_kind: "credit_purchase",
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = data as { ok: boolean; applied?: boolean; balance_cents?: number; reason?: string };
    if (!result.ok) {
      return NextResponse.json({ error: result.reason ?? "Falha no lançamento" }, { status: 409 });
    }

    return NextResponse.json({
      applied: result.applied ?? false,
      balanceCents: result.balance_cents ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/credits", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Extrato. Só gestor/dono enxerga movimentação financeira. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);
    if (!(await isWorkspaceOwner(admin, workspaceId, user.id))) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const { data } = await admin
      .from("telephony_ledger")
      .select("id, kind, amount_cents, balance_after_cents, description, created_at, call_id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);

    return NextResponse.json({
      entries: (data ?? []).map((e) => ({
        id: e.id,
        kind: e.kind,
        amountCents: e.amount_cents,
        balanceAfterCents: e.balance_after_cents,
        description: e.description,
        createdAt: e.created_at,
        callId: e.call_id,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/credits GET", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
