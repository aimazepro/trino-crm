// src/app/api/admin/workspaces/[id]/route.ts
import { requirePlatformAdmin, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";
import { effectiveFeatures, type FeatureKey } from "@/lib/feature-flags";
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
    .select("id, name, slug, plan, status, feature_flags, created_at, trial_ends_at")
    .eq("id", id)
    .maybeSingle();
  return data as WorkspaceRow | null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const admin = adminClient();
  const workspace = await loadWorkspace(admin, id);
  if (!workspace) return apiError("NOT_FOUND", "Workspace não encontrado", 404);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: members }, { data: balance }, { data: ledger }, { count: waCount }, { data: dealsRows, count: dealsCount }] =
    await Promise.all([
      admin.from("workspace_members").select("status").eq("workspace_id", id),
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
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: PatchWorkspaceBody;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
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
    // Merge raso: manda só o que muda, o resto do objeto guardado continua.
    const currentFlags = (current.feature_flags ?? {}) as Partial<Record<FeatureKey, boolean>>;
    update.feature_flags = { ...currentFlags, ...body.featureFlags };
  }

  if (Object.keys(update).length === 0) {
    return apiSuccess({ workspace: serializeWorkspace(current) });
  }

  const { data: updated, error } = await admin
    .from("workspaces")
    .update(update)
    .eq("id", id)
    .select("id, name, slug, plan, status, feature_flags, created_at, trial_ends_at")
    .single();

  if (error || !updated) return apiError("INTERNAL_ERROR", error?.message ?? "Falha ao atualizar workspace", 500);

  console.log(
    `[admin] workspace atualizado: ${id} (${Object.keys(update).join(", ")}) por ${auth.ctx.via === "session" ? auth.ctx.email : "token"}`
  );

  return apiSuccess({ workspace: serializeWorkspace(updated as WorkspaceRow) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
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
