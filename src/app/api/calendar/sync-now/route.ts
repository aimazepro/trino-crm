// src/app/api/calendar/sync-now/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { pullForUser, pushActivity } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Backfill is capped and scoped to incomplete activities — this button can be clicked
// repeatedly by hand, and an unbounded loop over every never-synced activity a user has
// ever created is both a timeout risk and a flood of "sendUpdates=all" guest emails for
// long-past activities nobody needs re-invited to.
const BACKFILL_LIMIT = 25;

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

  try {
    const pull = await pullForUser(admin, user.id);

    const { data: unsynced } = await admin
      .from("activities")
      .select("id")
      .eq("assignee_id", user.id)
      .eq("completed", false)
      .is("google_event_id", null)
      .order("date", { ascending: true })
      .limit(BACKFILL_LIMIT);

    let pushed = 0;
    for (const row of unsynced ?? []) {
      try {
        const result = await pushActivity(admin, row.id, "upsert");
        if (result.ok && !result.skipped) pushed++;
      } catch (err) {
        console.error("[calendar/sync-now] backfill push failed for activity", row.id, err);
      }
    }

    return NextResponse.json({ ok: true, pulled: pull.changed, pushed });
  } catch (err) {
    console.error("[calendar/sync-now] failed", err);
    return NextResponse.json({ ok: false, error: "sync failed" }, { status: 500 });
  }
}
