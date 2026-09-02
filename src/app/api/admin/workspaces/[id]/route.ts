// src/app/api/admin/workspaces/[id]/route.ts
import { requirePlatformAdmin, requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { can } from "@/lib/platform-admin";
import { apiError, apiSuccess } from "@/lib/api-auth";
import { logPlatformAction } from "@/lib/platform-audit";
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

  // ?preview=delete: contagem real do que a remoção definitiva destrói.
  // Mesma habilidade da remoção -- ninguém que não pode apagar precisa ver
  // o inventário do que seria apagado.
  if (new URL(request.url).searchParams.get("preview") === "delete") {
    if (!can(auth.ctx.role, "hard_delete")) {
      return apiError("FORBIDDEN", `Papel '${auth.ctx.role}' não pode apagar em definitivo`, 403);
    }
    const { data: preview, error: previewErr } = await admin.rpc("platform_deletion_preview", {
      p_workspace_id: id,
    });
    if (previewErr) return apiError("INTERNAL_ERROR", previewErr.message, 500);
    return apiSuccess({ preview, slug: workspace.slug });
  }

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
    return apiError("FORBIDDEN", `Papel '${auth.ctx.role}' não pode modificar esse workspace`, 403);
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

  // A ação sai do VALOR do status, não da presença do campo. Escolher por
  // "body.status !== undefined" fazia REATIVAR um workspace ser gravado como
  // 'workspace.suspend' -- e a tela de auditoria mostra o nome cru da ação,
  // que é o único registro permanente do que aconteceu.
  // Ações deste handler: 'workspace.suspend' (suspended/deleted),
  // 'workspace.reactivate' (active), 'workspace.update' (sem status no corpo).
  const action =
    body.status === undefined
      ? "workspace.update"
      : body.status === "active"
        ? "workspace.reactivate"
        : "workspace.suspend";

  const logged = await logPlatformAction(auth.ctx, {
    action,
    targetType: "workspace",
    targetId: id,
    targetLabel: current.name,
    metadata: { fields: Object.keys(update), from: { plan: current.plan, status: current.status }, to: update },
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);

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
  const { id } = await params;
  const url = new URL(request.url);
  const hard = url.searchParams.get("hard") === "1";

  const auth = hard
    ? await requirePlatformAbility(request, "hard_delete")
    : await requirePlatformAbility(request, "block");
  if (!auth.ok) return auth.response;

  const admin = adminClient();
  const current = await loadWorkspace(admin, id);
  if (!current) return apiError("NOT_FOUND", "Workspace não encontrado", 404);

  if (hard) {
    // Trava 2: digitação. Sem "tem certeza? [OK]".
    const confirm = url.searchParams.get("confirm");
    if (!confirm || confirm !== current.slug) {
      return apiError(
        "CONFIRMATION_REQUIRED",
        "confirm precisa ser exatamente o slug do workspace",
        400
      );
    }

    // Pré-condição antes de qualquer auditoria: existe um dono? O log tem que
    // descrever o que aconteceu, então nada que possa impedir a destruição pode
    // ficar depois dele. Se falhar aqui, a auditoria nunca é gravada.
    const { data: ws } = await admin
      .from("workspaces")
      .select("owner_user_id")
      .eq("id", id)
      .maybeSingle();
    if (!ws?.owner_user_id) {
      return apiError("INTERNAL_ERROR", "Workspace sem dono — remoção manual necessária", 500);
    }

    // Trava 5: a contagem tem escopo de WORKSPACE
    // (platform_deletion_preview(p_workspace_id)), mas a execução tem escopo
    // de USUÁRIO (deleteUser(owner_user_id)). Se esse dono também for membro
    // de outro workspace, o delete leva calado a membership, os e-mails, as
    // assinaturas, os dashboards e o ramal dele lá, e ainda anula
    // deals.owner_id num cliente que ninguém decidiu tocar -- nada disso
    // aparece no preview nem no log.
    // Enquanto essas duas coisas não coincidirem, a única resposta honesta é
    // recusar. Vem ANTES da auditoria: uma requisição recusada não é uma ação.
    const { data: otherMemberships, error: otherErr } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("member_user_id", ws.owner_user_id)
      .neq("workspace_id", id);

    // Fail-closed, mesmo espírito da trava de propriedade em
    // /api/admin/accounts/[id]: checagem que não rodou não é checagem que passou.
    if (otherErr) {
      return apiError(
        "INTERNAL_ERROR",
        "A verificação de vínculos do dono em outros workspaces não pôde ser concluída e nada será apagado para sua proteção",
        500
      );
    }

    const otherWorkspaceIds = [...new Set((otherMemberships ?? []).map((m) => m.workspace_id))];
    if (otherWorkspaceIds.length > 0) {
      return apiError(
        "OWNER_IN_OTHER_WORKSPACES",
        `O dono deste workspace também é membro de ${otherWorkspaceIds.length} outro(s) workspace(s). ` +
          `A remoção definitiva apaga a CONTA dele, o que destruiria os dados dele nesses outros workspaces sem que ninguém tivesse decidido isso. ` +
          `Remova esses vínculos primeiro (ou transfira a posse deste workspace) e tente de novo.`,
        409
      );
    }

    // Trava 1: contagem real, medida agora.
    const { data: preview, error: previewErr } = await admin.rpc("platform_deletion_preview", {
      p_workspace_id: id,
    });
    if (previewErr) return apiError("INTERNAL_ERROR", previewErr.message, 500);

    // Trava 3: auditoria com a contagem junto, ANTES de executar -- é o
    // único jeito de o log dizer o que foi perdido depois que não existe mais.
    const logged = await logPlatformAction(auth.ctx, {
      action: "workspace.delete_hard",
      targetType: "workspace",
      targetId: id,
      targetLabel: `${current.name} (${current.slug})`,
      metadata: { preview },
    });
    if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);

    // Apagar o dono em auth.users cascateia para workspaces e para as 43
    // tabelas abaixo dele (§8.1). É intencional aqui, e só aqui.
    const { error: delErr } = await admin.auth.admin.deleteUser(ws.owner_user_id);
    if (delErr) return apiError("INTERNAL_ERROR", delErr.message, 500);

    return apiSuccess({ id, deleted: "hard", preview });
  }

  const logged = await logPlatformAction(auth.ctx, {
    action: "workspace.delete_soft",
    targetType: "workspace",
    targetId: id,
    targetLabel: current.name,
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);

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
