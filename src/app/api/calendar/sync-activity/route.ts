// src/app/api/calendar/sync-activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { pushActivity } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { activityId, action } = await req.json();
  if (!activityId || (action !== "upsert" && action !== "delete")) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const result = await pushActivity(admin, activityId, action);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[calendar/sync-activity] push failed", err);
    // Never a hard failure for the caller — the CRM save already succeeded.
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
