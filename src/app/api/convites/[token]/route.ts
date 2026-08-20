import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

/** Public lookup so the /convite/[token] page can show which workspace + whether the token is still good. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: member } = await supabase
    .from("workspace_members")
    .select("email, status, invite_expires_at, workspace_id")
    .eq("invite_token", token)
    .maybeSingle();

  if (!member) return NextResponse.json({ valid: false, reason: "not_found" }, { status: 404 });
  if (member.status !== "pending") return NextResponse.json({ valid: false, reason: "used" }, { status: 409 });
  if (member.invite_expires_at && new Date(member.invite_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ valid: false, reason: "expired" }, { status: 410 });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", member.workspace_id)
    .maybeSingle();

  return NextResponse.json({ valid: true, email: member.email, workspaceName: workspace?.name ?? "TrinoCRM" });
}
