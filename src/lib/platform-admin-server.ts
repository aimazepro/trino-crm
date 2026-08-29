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
import { matchesAdminAllowlist, tokenMatches } from "@/lib/platform-admin";

export interface PlatformAdminContext {
  via: "session" | "token";
  email: string | null;
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
  if (!matchesAdminAllowlist(email, process.env.PLATFORM_ADMIN_EMAILS)) return null;
  return { via: "session", email };
}

/** Bearer token primeiro (sem round-trip de cookie/DB), sessão depois. Uso
 * em Route Handlers de /api/admin/*, que têm um Request de verdade. */
export async function getPlatformAdmin(request: Request): Promise<PlatformAdminContext | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match && tokenMatches(match[1].trim(), process.env.PLATFORM_ADMIN_API_TOKEN)) {
    return { via: "token", email: null };
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
