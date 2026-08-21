import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // email_templates.user_id doesn't exist post-Phase-1 (workspace_id only).
  const ctx = await getWorkspaceContext(supabase);
  if (!ctx) return NextResponse.json({ templates: [] });

  const { data: templates } = await supabase
    .from("email_templates")
    .select("id, name, subject, body")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ templates: templates ?? [] });
}
