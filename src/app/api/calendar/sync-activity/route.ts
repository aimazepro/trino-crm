// src/app/api/calendar/sync-activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { pushActivity } from "@/lib/calendar-sync";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { activityId, action } = await req.json();
  if (!activityId || (action !== "upsert" && action !== "delete")) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not authenticated" }, { status: 401 });

  const workspaceCtx = await getWorkspaceContext(supabase);
  if (!workspaceCtx) return NextResponse.json({ ok: false, error: "not authenticated" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Ownership check — activities has no per-user "creator" column (Phase 1 multi-tenancy
  // replaced it with workspace_id + assignee_id), so the boundary is workspace membership:
  // the caller may only push an activity that belongs to their own workspace. 404 (not 403)
  // so the response doesn't confirm another tenant's activity ID exists.
  const { data: activity } = await admin
    .from("activities")
    .select("workspace_id")
    .eq("id", activityId)
    .maybeSingle();
  if (!activity || activity.workspace_id !== workspaceCtx.workspaceId) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  try {
    const result = await pushActivity(admin, activityId, action);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[calendar/sync-activity] push failed", err);
    // Never a hard failure for the caller — the CRM save already succeeded.
    // Don't relay the raw upstream error text to the browser.
    return NextResponse.json({ ok: false, error: "sync failed" });
  }
}
