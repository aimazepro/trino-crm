// src/app/api/admin/dashboard/route.ts
import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { can } from "@/lib/platform-admin";
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Forma que a RPC platform_dashboard_stats() devolve. */
type DashboardStats = {
  workspaces: { total: number; active: number; suspended: number; deleted: number; trial: number };
  trialsExpiring: { id: string; name: string; slug: string | null; trialEndsAt: string }[];
  stalled: { id: string; name: string; slug: string | null; lastActivityAt: string }[];
  orphanAccounts: { id: string; email: string | null; createdAt: string }[];
  telephony: { balanceCents: number; reservedCents: number };
  telephonySpentMonthCents: number;
};

export async function GET(request: Request) {
  const auth = await requirePlatformAbility(request, "read_aggregates");
  if (!auth.ok) return auth.response;

  const { data, error } = await adminClient().rpc("platform_dashboard_stats");
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  const stats = data as unknown as DashboardStats;

  // A RPC continua como está (security definer, escopo global de propósito) --
  // a poda é aqui, no que sai pra cada papel.
  //
  // "read_aggregates" promete NÚMERO SOMADO, mas três dos cartões vinham com
  // nominata: trialsExpiring e stalled trazem name/slug de cada workspace e
  // orphanAccounts traz o e-mail de cada pessoa. Isso é dado de cliente, e
  // 'billing' -- cujo papel inteiro em §5 é "vê dados ❌ (só agregados)" --
  // recebia a lista completa só por ter o cartão do dashboard.
  //
  // Quem não tem "read_customer_data" leva a contagem e uma lista vazia: o
  // número (quantos trials vencem, quantas contas pararam) É agregado e é
  // exatamente o que o papel precisa pra cobrar; quem são elas, não.
  // Os *Count acompanham a lista SEMPRE, inclusive pra quem vê tudo, pra a
  // UI não ter que decidir entre "lista vazia" e "não pode ver".
  const counts = {
    trialsExpiringCount: stats.trialsExpiring?.length ?? 0,
    stalledCount: stats.stalled?.length ?? 0,
    orphanAccountsCount: stats.orphanAccounts?.length ?? 0,
  };

  if (!can(auth.ctx.role, "read_customer_data")) {
    return apiSuccess({
      ...stats,
      ...counts,
      trialsExpiring: [],
      stalled: [],
      orphanAccounts: [],
    });
  }

  return apiSuccess({ ...stats, ...counts });
}
