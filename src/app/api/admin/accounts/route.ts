// src/app/api/admin/accounts/route.ts
//
// Visão por CONTA (auth.users), não por workspace -- /api/admin/workspaces
// só mostra quem já está vinculado a um workspace via workspace_members.
// Uma conta que se cadastrou (POST /login em modo signup) mas nunca criou ou
// aceitou um workspace fica "órfã": tem linha em auth.users, zero em
// workspace_members, e não aparecia em lugar nenhum do painel admin.
// Reproduzido ao vivo 2026-08-30: agenciapixeo@gmail.com, conta confirmada,
// já logou, 0 vínculo.
import { requirePlatformAdmin, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;

  const admin = adminClient();

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
