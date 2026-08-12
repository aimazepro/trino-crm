// src/app/api/calendar/sync-now/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { pullForUser, pushActivity } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not authenticated" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const pull = await pullForUser(admin, user.id);

  const { data: unsynced } = await admin
    .from("activities")
    .select("id")
    .eq("assignee_id", user.id)
    .is("google_event_id", null);

  let pushed = 0;
  for (const row of unsynced ?? []) {
    const result = await pushActivity(admin, row.id, "upsert");
    if (result.ok && !result.skipped) pushed++;
  }

  return NextResponse.json({ ok: true, pulled: pull.changed, pushed });
}
