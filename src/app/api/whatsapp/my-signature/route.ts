import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

/**
 * Liga/desliga a assinatura do PRÓPRIO usuário. Rota separada de
 * /api/whatsapp/settings de propósito: aquela é do dono da conta e controla QR,
 * desconexão e grupos. Esta é preferência pessoal e todo membro pode usar.
 *
 * Não existe parâmetro de nome: a assinatura deriva de workspace_members.name.
 */
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );

  const ctx = await getWorkspaceContext(supabase);
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("whatsapp_member_settings")
    .upsert(
      { workspace_id: ctx.workspaceId, user_id: ctx.userId, signature_enabled: body.enabled, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,user_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: member } = await supabase
    .from("workspace_members")
    .select("name, email")
    .eq("workspace_id", ctx.workspaceId)
    .eq("member_user_id", ctx.userId)
    .maybeSingle();

  return NextResponse.json({
    enabled: body.enabled,
    name: member?.name?.trim() || member?.email?.split("@")[0] || null,
  });
}
