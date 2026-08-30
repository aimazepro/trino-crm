// src/app/api/admin/accounts/route.ts
//
// Visão por CONTA (auth.users), não por workspace -- /api/admin/workspaces
// só mostra quem já está vinculado a um workspace via workspace_members.
// Uma conta que se cadastrou (POST /login em modo signup) mas nunca criou ou
// aceitou um workspace fica "órfã": tem linha em auth.users, zero em
// workspace_members, e não aparecia em lugar nenhum do painel admin.
// Reproduzido ao vivo 2026-08-30: agenciapixeo@gmail.com, conta confirmada,
// já logou, 0 vínculo.
import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformAbility(request, "read_customer_data");
  if (!auth.ok) return auth.response;

  const admin = adminClient();
  const url = new URL(request.url);

  // ?group=workspace é a visão do painel v2: workspace no topo, membros
  // aninhados, contas sem workspace num balde à parte. Sem o parâmetro, a
  // resposta antiga (lista plana de contas) continua igual -- /admin/contas
  // ainda consome ela até ser aposentada.
  if (url.searchParams.get("group") === "workspace") {
    return groupedResponse(admin);
  }

  // Só 5 contas no banco hoje -- um listUsers() sem paginar cobre o cenário
  // atual. perPage bem acima do total real como margem, não como solução
  // definitiva: se a base crescer muito além disso, isso vira uma correção
  // real (loop de páginas), não só subir o número.
  const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (usersErr) return apiError("INTERNAL_ERROR", usersErr.message, 500);

  const { data: members, error: membersErr } = await admin
    .from("workspace_members")
    .select("member_user_id, role, status, workspaces(id, name, slug, status)");
  if (membersErr) return apiError("INTERNAL_ERROR", membersErr.message, 500);

  const membershipsByUser = new Map<
    string,
    { workspaceId: string; name: string; slug: string | null; workspaceStatus: string; role: string; memberStatus: string }[]
  >();
  for (const m of members ?? []) {
    // Mesmo cuidado de src/proxy.ts: embed to-one às vezes vem tipado como
    // array pelo gerador do Supabase.
    const rawWs = m.workspaces as
      | { id: string; name: string; slug: string | null; status: string }
      | { id: string; name: string; slug: string | null; status: string }[]
      | null;
    const ws = Array.isArray(rawWs) ? rawWs[0] : rawWs;
    // member_user_id é nullable no schema (generated types), mas toda linha
    // de workspace_members em uso real tem um -- sem essa guarda o Map fica
    // tipado como aceitar null e o TS reclama do .get/.set abaixo.
    if (!ws || !m.member_user_id) continue;
    const list = membershipsByUser.get(m.member_user_id) ?? [];
    list.push({
      workspaceId: ws.id,
      name: ws.name,
      slug: ws.slug,
      workspaceStatus: ws.status,
      role: m.role,
      memberStatus: m.status,
    });
    membershipsByUser.set(m.member_user_id, list);
  }

  const now = Date.now();
  const accounts = (usersPage?.users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      createdAt: u.created_at,
      emailConfirmedAt: u.email_confirmed_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      blocked: !!u.banned_until && new Date(u.banned_until).getTime() > now,
      workspaces: membershipsByUser.get(u.id) ?? [],
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return apiSuccess({ accounts });
}

type AdminDb = ReturnType<typeof adminClient>;

async function groupedResponse(admin: AdminDb) {
  const [usersRes, workspacesRes, membersRes] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin
      .from("workspaces")
      .select("id, name, slug, plan, status, subscription_status, created_at, trial_ends_at")
      .order("created_at", { ascending: false }),
    admin.from("workspace_members").select("workspace_id, member_user_id, email, role, status"),
  ]);

  if (usersRes.error) return apiError("INTERNAL_ERROR", usersRes.error.message, 500);
  if (workspacesRes.error) return apiError("INTERNAL_ERROR", workspacesRes.error.message, 500);
  if (membersRes.error) return apiError("INTERNAL_ERROR", membersRes.error.message, 500);

  const now = Date.now();
  const userById = new Map(
    (usersRes.data?.users ?? []).map((u) => [
      u.id,
      {
        email: u.email ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        emailConfirmedAt: u.email_confirmed_at ?? null,
        createdAt: u.created_at,
        blocked: !!u.banned_until && new Date(u.banned_until).getTime() > now,
      },
    ])
  );

  const linkedUserIds = new Set<string>();
  const membersByWorkspace = new Map<
    string,
    { userId: string | null; email: string; role: string; memberStatus: string; blocked: boolean; lastSignInAt: string | null }[]
  >();

  for (const m of membersRes.data ?? []) {
    if (m.member_user_id) linkedUserIds.add(m.member_user_id);
    const account = m.member_user_id ? userById.get(m.member_user_id) : undefined;
    const list = membersByWorkspace.get(m.workspace_id) ?? [];
    list.push({
      userId: m.member_user_id,
      email: m.email,
      role: m.role,
      memberStatus: m.status,
      blocked: account?.blocked ?? false,
      lastSignInAt: account?.lastSignInAt ?? null,
    });
    membersByWorkspace.set(m.workspace_id, list);
  }

  const workspaces = (workspacesRes.data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    plan: w.plan,
    status: w.status,
    subscriptionStatus: w.subscription_status,
    createdAt: w.created_at,
    trialEndsAt: w.trial_ends_at,
    members: (membersByWorkspace.get(w.id) ?? []).sort((a, b) => a.email.localeCompare(b.email)),
  }));

  // Órfã = tem linha em auth.users e zero vínculo em workspace_members. É o
  // buraco que o v1 não mostrava e que 79f7114 abriu: cadastro que nunca
  // virou cliente.
  const orphans = (usersRes.data?.users ?? [])
    .filter((u) => !linkedUserIds.has(u.id))
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      createdAt: u.created_at,
      emailConfirmedAt: u.email_confirmed_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      blocked: !!u.banned_until && new Date(u.banned_until).getTime() > now,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return apiSuccess({ workspaces, orphans });
}
