// src/app/api/admin/workspaces/[id]/route.ts
import { requirePlatformAdmin, requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { can } from "@/lib/platform-admin";
import { apiError, apiSuccess } from "@/lib/api-auth";
import { effectiveFeatures, FEATURE_KEYS, type FeatureKey } from "@/lib/feature-flags";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const VALID_PLANS = ["trial", "pro", "business"] as const;
const VALID_STATUSES = ["active", "suspended", "deleted"] as const;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  feature_flags: unknown;
  created_at: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  current_period_end: string | null;
};

function serializeWorkspace(w: WorkspaceRow) {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    plan: w.plan,
    status: w.status,
    featureFlags: (w.feature_flags ?? {}) as Partial<Record<FeatureKey, boolean>>,
    createdAt: w.created_at,
    trialEndsAt: w.trial_ends_at,
  };
}

async function loadWorkspace(admin: SupabaseClient<Database>, id: string): Promise<WorkspaceRow | null> {
  const { data } = await admin
    .from("workspaces")
    .select(
      "id, name, slug, plan, status, feature_flags, created_at, trial_ends_at, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end"
    )
    .eq("id", id)
    .maybeSingle();
  return data as WorkspaceRow | null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAbility(request, "read_customer_data");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const admin = adminClient();
  const workspace = await loadWorkspace(admin, id);
  if (!workspace) return apiError("NOT_FOUND", "Workspace não encontrado", 404);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: members }, { data: balance }, { data: ledger }, { count: waCount }, { data: dealsRows, count: dealsCount }] =
    await Promise.all([
      admin.from("workspace_members").select("member_user_id, email, role, status").eq("workspace_id", id),
      admin.from("telephony_balances").select("balance_cents, reserved_cents").eq("workspace_id", id).maybeSingle(),
      admin
        .from("telephony_ledger")
        .select("id, kind, amount_cents, balance_after_cents, description, created_at")
        .eq("workspace_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", id)
        .gte("timestamp", thirtyDaysAgo),
      admin
        .from("deals")
        .select("updated_at", { count: "exact" })
        .eq("workspace_id", id)
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

  const memberCounts = { accepted: 0, pending: 0, suspended: 0 };
  for (const m of members ?? []) {
    if (m.status === "accepted") memberCounts.accepted++;
    else if (m.status === "pending") memberCounts.pending++;
    else if (m.status === "suspended") memberCounts.suspended++;
  }

  // banned_until mora em auth.users, não em workspace_members -- sem isto a
  // tela mostraria "ativo" para quem já está bloqueado na conta.
  const memberList = await Promise.all(
    (members ?? []).map(async (m) => {
      let blocked = false;
      if (m.member_user_id) {
        const { data: target } = await admin.auth.admin.getUserById(m.member_user_id);
        const bannedUntil = target?.user?.banned_until;
        blocked = !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();
      }
      return {
        userId: m.member_user_id,
        email: m.email,
        role: m.role,
        memberStatus: m.status,
        blocked,
      };
    })
  );

  const { data: auditRows } = await admin
    .from("platform_audit_log")
    .select("id, actor_email, action, target_label, created_at")
    .eq("target_type", "workspace")
    .eq("target_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  return apiSuccess({
    workspace: serializeWorkspace(workspace),
    usage: {
      members: memberCounts,
      telephony: balance
        ? {
            balanceCents: balance.balance_cents,
            reservedCents: balance.reserved_cents,
            recentLedger: (ledger ?? []).map((l) => ({
              id: l.id,
              kind: l.kind,
              amountCents: l.amount_cents,
              balanceAfterCents: l.balance_after_cents,
              description: l.description,
              createdAt: l.created_at,
            })),
          }
        : null,
      whatsappMessages30d: waCount ?? 0,
      deals: {
        count: dealsCount ?? 0,
        lastActivityAt: dealsRows?.[0]?.updated_at ?? null,
      },
    },
    features: effectiveFeatures(workspace.plan, workspace.feature_flags as Partial<Record<FeatureKey, boolean>>),
    members: memberList,
    billing: {
      plan: workspace.plan,
      subscriptionStatus: workspace.subscription_status,
      stripeCustomerId: workspace.stripe_customer_id,
      stripeSubscriptionId: workspace.stripe_subscription_id,
      currentPeriodEnd: workspace.current_period_end,
    },
    audit: (auditRows ?? []).map((a) => ({
      id: a.id,
      actorEmail: a.actor_email,
      action: a.action,
      targetLabel: a.target_label,
      createdAt: a.created_at,
    })),
  });
}

interface PatchWorkspaceBody {
  name?: string;
  slug?: string;
  plan?: string;
  status?: string;
  featureFlags?: Partial<Record<FeatureKey, boolean>>;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Gate mínimo aqui; cada campo tem a sua própria exigência logo abaixo,
  // porque plano e suspensão não são a mesma permissão (§5 do spec).
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: PatchWorkspaceBody;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
  }

  const touchesBilling = body.plan !== undefined;
  const touchesControls =
    body.status !== undefined || body.featureFlags !== undefined || body.name !== undefined || body.slug !== undefined;

  if (touchesBilling && !can(auth.ctx.role, "billing")) {
    return apiError("FORBIDDEN", `Papel '${auth.ctx.role}' não pode mudar plano`, 403);
  }
  if (touchesControls && !can(auth.ctx.role, "block")) {
    return apiError("FORBIDDEN", `Papel '${auth.ctx.role}' não pode mudar status ou features`, 403);
  }

  const admin = adminClient();
  const current = await loadWorkspace(admin, id);
  if (!current) return apiError("NOT_FOUND", "Workspace não encontrado", 404);

  const update: Database["public"]["Tables"]["workspaces"]["Update"] = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return apiError("VALIDATION_ERROR", "name não pode ser vazio", 400);
    update.name = name;
  }
  if (body.slug !== undefined) {
    const slug = body.slug.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      return apiError("VALIDATION_ERROR", "slug precisa ser minúsculo, alfanumérico, separado por hífen", 400);
    }
    if (slug !== current.slug) {
      const { data: taken } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
      if (taken) return apiError("SLUG_TAKEN", "Já existe um workspace com esse slug", 409);
    }
    update.slug = slug;
  }
  if (body.plan !== undefined) {
    if (!VALID_PLANS.includes(body.plan as (typeof VALID_PLANS)[number])) {
      return apiError("VALIDATION_ERROR", `plan precisa ser um de: ${VALID_PLANS.join(", ")}`, 400);
    }
    update.plan = body.plan;
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
      return apiError("VALIDATION_ERROR", `status precisa ser um de: ${VALID_STATUSES.join(", ")}`, 400);
    }
    update.status = body.status;
  }
  if (body.featureFlags !== undefined) {
    const flags = body.featureFlags;
    if (typeof flags !== "object" || flags === null || Array.isArray(flags)) {
      return apiError("VALIDATION_ERROR", "featureFlags precisa ser um objeto", 400);
    }
    for (const [key, value] of Object.entries(flags)) {
      if (!FEATURE_KEYS.includes(key as FeatureKey)) {
        return apiError("VALIDATION_ERROR", `featureFlags: chave desconhecida '${key}'`, 400);
      }
      if (typeof value !== "boolean") {
        return apiError("VALIDATION_ERROR", `featureFlags.${key} precisa ser um boolean`, 400);
      }
    }
    // Merge raso: manda só o que muda, o resto do objeto guardado continua.
    const currentFlags = (current.feature_flags ?? {}) as Partial<Record<FeatureKey, boolean>>;
    update.feature_flags = { ...currentFlags, ...flags };
  }

  if (Object.keys(update).length === 0) {
    return apiSuccess({ workspace: serializeWorkspace(current) });
  }

  const { data: updated, error } = await admin
    .from("workspaces")
    .update(update)
    .eq("id", id)
    .select(
      "id, name, slug, plan, status, feature_flags, created_at, trial_ends_at, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end"
    )
    .single();

  if (error || !updated) return apiError("INTERNAL_ERROR", error?.message ?? "Falha ao atualizar workspace", 500);

  console.log(
    `[admin] workspace atualizado: ${id} (${Object.keys(update).join(", ")}) por ${auth.ctx.via === "session" ? auth.ctx.email : "token"}`
  );

  return apiSuccess({ workspace: serializeWorkspace(updated as WorkspaceRow) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAbility(request, "block");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const admin = adminClient();
  const current = await loadWorkspace(admin, id);
  if (!current) return apiError("NOT_FOUND", "Workspace não encontrado", 404);

  const { data: updated, error } = await admin
    .from("workspaces")
    .update({ status: "deleted" })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error || !updated) return apiError("INTERNAL_ERROR", error?.message ?? "Falha ao apagar workspace", 500);

  console.log(`[admin] workspace apagado (soft): ${id} por ${auth.ctx.via === "session" ? auth.ctx.email : "token"}`);

  return apiSuccess({ workspace: { id: updated.id, status: updated.status } });
}
