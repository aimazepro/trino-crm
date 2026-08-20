import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getWorkspaceContext } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/** Admin creates a pending invite and gets back a copyable /convite/<token> link. No email is sent. */
export async function POST(req: NextRequest) {
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
  if (ctx.role !== "admin") return NextResponse.json({ error: "Só administradores convidam" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role === "gerente" || body?.role === "admin" ? body.role : "vendedor";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: ctx.workspaceId,
      email,
      role,
      status: "pending",
      invite_token: token,
      invite_expires_at: expiresAt,
    })
    .select("id, email, role, status, invite_token")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Falha ao criar convite" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  return NextResponse.json({
    member: data,
    inviteUrl: `${appUrl.replace(/\/$/, "")}/convite/${token}`,
  });
}
