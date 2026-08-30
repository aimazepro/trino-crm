// src/app/api/admin/workspaces/route.ts
import { requirePlatformAdmin, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";
import { logPlatformAction } from "@/lib/platform-audit";

export const dynamic = "force-dynamic";

const VALID_PLANS = ["trial", "pro", "business"] as const;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mesmo escaping usado em src/lib/api-lead-helpers.ts para ilike. */
function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const plan = url.searchParams.get("plan");
  const q = url.searchParams.get("q");

  const admin = adminClient();
  let query = admin
    .from("workspaces")
    .select("id, name, slug, plan, status, created_at, trial_ends_at")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (plan) query = query.eq("plan", plan);
  if (q) query = query.or(`name.ilike.%${escapeIlike(q)}%,slug.ilike.%${escapeIlike(q)}%`);

  const { data: workspaces, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  const ids = (workspaces ?? []).map((w) => w.id);
  const { data: members } = ids.length
    ? await admin.from("workspace_members").select("workspace_id").in("workspace_id", ids)
    : { data: [] as { workspace_id: string }[] };

  const memberCounts = new Map<string, number>();
  for (const m of members ?? []) {
    memberCounts.set(m.workspace_id, (memberCounts.get(m.workspace_id) ?? 0) + 1);
  }

  return apiSuccess({
    workspaces: (workspaces ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      plan: w.plan,
      status: w.status,
      memberCount: memberCounts.get(w.id) ?? 0,
      createdAt: w.created_at,
      trialEndsAt: w.trial_ends_at,
    })),
  });
}

interface CreateWorkspaceBody {
  name?: string;
  slug?: string;
  plan?: string;
  ownerEmail?: string;
  ownerPassword?: string;
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;

  let body: CreateWorkspaceBody;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
  }

  const name = (body.name ?? "").trim();
  const slug = (body.slug ?? "").trim().toLowerCase();
  const plan = body.plan ?? "trial";
  const ownerEmail = (body.ownerEmail ?? "").trim().toLowerCase();
  const ownerPassword = body.ownerPassword ?? "";

  if (!name) return apiError("VALIDATION_ERROR", "name é obrigatório", 400);
  if (!SLUG_RE.test(slug)) {
    return apiError("VALIDATION_ERROR", "slug precisa ser minúsculo, alfanumérico, separado por hífen", 400);
  }
  if (!VALID_PLANS.includes(plan as (typeof VALID_PLANS)[number])) {
    return apiError("VALIDATION_ERROR", `plan precisa ser um de: ${VALID_PLANS.join(", ")}`, 400);
  }
  if (!EMAIL_RE.test(ownerEmail)) return apiError("VALIDATION_ERROR", "ownerEmail inválido", 400);
  if (ownerPassword.length < 8) return apiError("VALIDATION_ERROR", "ownerPassword precisa ter 8+ caracteres", 400);

  const admin = adminClient();

  const { data: slugTaken } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (slugTaken) return apiError("SLUG_TAKEN", "Já existe um workspace com esse slug", 409);

  // Mesmo padrão de checar e-mail existente do POST /api/convites/aceitar:
  // listUsers() + find, não há um getUserByEmail direto na Admin API.
  const { data: existingList } = await admin.auth.admin.listUsers();
  const existingUser = existingList?.users.find((u) => u.email?.toLowerCase() === ownerEmail);
  if (existingUser) {
    return apiError(
      "EMAIL_EXISTS",
      "Já existe uma conta com esse e-mail — adicionar um usuário existente a um workspace novo não é suportado aqui",
      409
    );
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    // Backstop pro pre-check de listUsers() acima, que só olha os primeiros
    // 50 usuários (perPage default) -- além disso um e-mail existente escapa
    // do pre-check e só aparece aqui, no retorno do createUser.
    if (createErr?.code === "email_exists") {
      return apiError(
        "EMAIL_EXISTS",
        "Já existe uma conta com esse e-mail — adicionar um usuário existente a um workspace novo não é suportado aqui",
        409
      );
    }
    return apiError("INTERNAL_ERROR", createErr?.message ?? "Falha ao criar usuário", 500);
  }
  const ownerUserId = created.user.id;

  // workspaces.id não tem default no banco e carrega uma FK própria pra
  // auth.users(id) (confirmado via information_schema/pg_constraint antes de
  // escrever este arquivo -- o brief original não gerava id nenhum, o que
  // violaria essa FK). Mesma convenção do fluxo self-serve em
  // src/app/configuracoes/empresa/page.tsx: workspace.id === owner_user_id.
  const { data: workspace, error: wsErr } = await admin
    .from("workspaces")
    .insert({ id: ownerUserId, name, slug, plan, owner_user_id: ownerUserId, status: "active" })
    .select("id")
    .single();

  if (wsErr || !workspace) {
    // Não deixa o auth.users órfão sem workspace.
    await admin.auth.admin.deleteUser(ownerUserId);
    return apiError("INTERNAL_ERROR", wsErr?.message ?? "Falha ao criar workspace", 500);
  }

  const { error: memberErr } = await admin.from("workspace_members").insert({
    workspace_id: workspace.id,
    member_user_id: ownerUserId,
    email: ownerEmail,
    role: "admin",
    status: "accepted",
    accepted_at: new Date().toISOString(),
  });

  if (memberErr) {
    await admin.from("workspaces").delete().eq("id", workspace.id);
    await admin.auth.admin.deleteUser(ownerUserId);
    return apiError("INTERNAL_ERROR", memberErr.message, 500);
  }

  console.log(
    `[admin] workspace criado: ${workspace.id} (${slug}) por ${auth.ctx.via === "session" ? auth.ctx.email : "token"}`
  );

  // Log depois, não antes: a criação não é destrutiva (rollback acima apaga
  // workspace e usuário se algo falhar), então logar antes deixaria linha de
  // auditoria de um workspace que nunca chegou a existir de fato.
  const logged = await logPlatformAction(auth.ctx, {
    action: "workspace.create",
    targetType: "workspace",
    targetId: workspace.id,
    targetLabel: name,
    metadata: { slug, plan, ownerEmail },
  });
  if (!logged.ok) {
    // Aqui a ação já aconteceu quando o log é escrito (workspace, membro e
    // auth.users já estão commitados) -- diferente das rotas "log antes da
    // ação", onde falhar o log barra a ação antes dela existir. Aqui a única
    // forma de manter "ação sem rastro não acontece" verdadeiro é desfazer o
    // que já foi feito: mesmo rollback dos branches wsErr/memberErr acima.
    await admin.from("workspace_members").delete().eq("workspace_id", workspace.id);
    await admin.from("workspaces").delete().eq("id", workspace.id);
    await admin.auth.admin.deleteUser(ownerUserId);
    return apiError("INTERNAL_ERROR", logged.message, 500);
  }

  return apiSuccess({ workspaceId: workspace.id, ownerUserId }, undefined, 201);
}
