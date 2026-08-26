// Retrato completo da telefonia do workspace numa chamada so: conta, meu ramal,
// ramais do time, saldo e tarifa. A pagina /configuracoes/telefone monta tudo a
// partir daqui, igual /api/whatsapp/status faz para o WhatsApp.

import { NextResponse } from "next/server";
import {
  createTelephonyAdmin,
  ensureAccount,
  getSessionUser,
  isPaidPlan,
  listExtensions,
  publicExtension,
  resolveWorkspaceId,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);
    const account = await ensureAccount(admin, workspaceId);

    const [{ data: workspace }, { data: members }, { data: balance }, { data: rates }] =
      await Promise.all([
        admin.from("workspaces").select("plan, owner_user_id").eq("id", workspaceId).maybeSingle(),
        admin
          .from("workspace_members")
          .select("member_user_id, name, email, role, status")
          .eq("workspace_id", workspaceId)
          .eq("status", "accepted"),
        admin
          .from("telephony_balances")
          .select("balance_cents, reserved_cents")
          .eq("workspace_id", workspaceId)
          .maybeSingle(),
        admin
          .from("telephony_rates")
          .select("destination_type, price_cents_per_minute, workspace_id")
          .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`),
      ]);

    const extensions = await listExtensions(admin, workspaceId);
    const byUser = new Map(extensions.map((e) => [e.user_id, e]));
    const ownerId = workspace?.owner_user_id ?? null;

    // Tarifa do workspace ganha da global.
    const rateMap: Record<string, number> = {};
    for (const r of rates ?? []) {
      const current = rateMap[r.destination_type];
      if (current === undefined || r.workspace_id !== null) {
        rateMap[r.destination_type] = r.price_cents_per_minute;
      }
    }

    const team = (members ?? [])
      .filter((m) => m.member_user_id)
      .map((m) => {
        const ext = byUser.get(m.member_user_id as string);
        return {
          userId: m.member_user_id as string,
          name: m.name ?? m.email,
          email: m.email,
          role: m.member_user_id === ownerId ? "Dono" : m.role,
          isOwner: m.member_user_id === ownerId,
          extension: ext ? publicExtension(ext) : null,
        };
      })
      .sort((a, b) => Number(b.isOwner) - Number(a.isOwner));

    const mine = byUser.get(user.id);

    return NextResponse.json({
      provider: account.provider,
      status: account.status,
      callerId: account.caller_id,
      recordingEnabled: account.recording_enabled,
      recordingRetentionDays: account.recording_retention_days,
      consentMode: account.consent_mode,
      consentText: account.consent_text,
      isOwner: user.id === ownerId,
      plan: workspace?.plan ?? null,
      paidPlan: isPaidPlan(workspace?.plan),
      balanceCents: balance?.balance_cents ?? 0,
      reservedCents: balance?.reserved_cents ?? 0,
      rates: rateMap,
      myExtension: mine ? publicExtension(mine) : null,
      team,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/status", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
