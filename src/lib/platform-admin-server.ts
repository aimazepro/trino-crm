// src/lib/platform-admin-server.ts
//
// Metade "impura" de platform-admin.ts: cookie, sessão, service-role client.
// getPlatformAdminFromSession() não recebe Request de propósito -- Server
// Components (src/app/admin/layout.tsx) não têm um Request de entrada pra
// ler header nenhum, só cookies via next/headers.

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  matchesAdminAllowlist,
  tokenMatches,
  can,
  isPlatformRole,
  type PlatformRole,
  type PlatformAbility,
} from "@/lib/platform-admin";

export interface PlatformAdminContext {
  via: "session" | "token";
  email: string | null;
  /** null quando via = "token" (chamada de máquina não tem usuário). */
  userId: string | null;
  role: PlatformRole;
}

/** Service-role client. Factory local, mesmo padrão já usado por módulo em
 * src/lib/whatsapp/connection.ts e src/lib/telephony/db.ts -- não um helper
 * compartilhado entre domínios. */
export function adminClient(): SupabaseClient<Database> {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Duas fontes de verdade, nesta ordem:
 *
 * 1. PLATFORM_ADMIN_EMAILS (env) -- chave-mestra, papel `owner` implícito.
 *    Existe pra que apagar ou suspender a última linha da tabela por engano
 *    não tranque o dono de fora do próprio painel. Por isso vem primeiro:
 *    uma linha `suspended` na tabela não pode derrubar o e-mail da env.
 * 2. platform_admins -- operadores de verdade, com papel próprio. Só linha
 *    com status 'active' entra.
 */
export async function getPlatformAdminFromSession(): Promise<PlatformAdminContext | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Só leitura de sessão aqui -- refresh de token é responsabilidade
        // do proxy, não há nada pra persistir de volta.
        setAll: () => {},
      },
    }
  );
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;
  const userId = data.user?.id ?? null;
  if (!email || !userId) return null;

  if (matchesAdminAllowlist(email, process.env.PLATFORM_ADMIN_EMAILS)) {
    return { via: "session", email, userId, role: "owner" };
  }

  const { data: row } = await adminClient()
    .from("platform_admins")
    .select("role, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row || row.status !== "active" || !isPlatformRole(row.role)) return null;
  return { via: "session", email, userId, role: row.role };
}

/** Bearer token primeiro (sem round-trip de cookie/DB), sessão depois. Uso
 * em Route Handlers de /api/admin/*, que têm um Request de verdade. */
export async function getPlatformAdmin(request: Request): Promise<PlatformAdminContext | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match && tokenMatches(match[1].trim(), process.env.PLATFORM_ADMIN_API_TOKEN)) {
    // O token é a chave da máquina: mesmo alcance do owner, sem usuário
    // associado. Quem tiver o token já pode tudo por outros caminhos.
    return { via: "token", email: null, userId: null, role: "owner" };
  }
  return getPlatformAdminFromSession();
}

/** Wrapper de conveniência pras rotas: um `if (!auth.ok) return auth.response`
 * por handler, igual o padrão de authenticateApiRequest em src/lib/api-auth.ts. */
export async function requirePlatformAdmin(
  request: Request
): Promise<{ ok: true; ctx: PlatformAdminContext } | { ok: false; response: NextResponse }> {
  const ctx = await getPlatformAdmin(request);
  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Não autenticado como admin da plataforma" } },
        { status: 401 }
      ),
    };
  }
  return { ok: true, ctx };
}

/** Gate por habilidade (ver ROLE_ABILITIES em src/lib/platform-admin.ts).
 * 401 = não é operador; 403 = é operador, mas o papel não alcança a ação.
 * Distinguir os dois importa: 403 é o que prova, em teste, que o papel está
 * sendo checado no servidor e não só escondido na UI. */
export async function requirePlatformAbility(
  request: Request,
  ability: PlatformAbility
): Promise<{ ok: true; ctx: PlatformAdminContext } | { ok: false; response: NextResponse }> {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth;
  if (!can(auth.ctx.role, ability)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `Papel '${auth.ctx.role}' não pode executar esta ação`,
          },
        },
        { status: 403 }
      ),
    };
  }
  return auth;
}
