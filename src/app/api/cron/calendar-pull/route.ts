// src/app/api/cron/calendar-pull/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { pullForUser } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  // Fail closed: an unset CRON_SECRET must never mean "no auth required" — that would
  // ship this as a public endpoint anyone can hammer to burn Calendar API quota and
  // trigger writes for every connected user until the env var is set.
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: integrations, error } = await admin
    .from("integrations")
    .select("user_id")
    .eq("provider", "google_calendar")
    .eq("active", true)
    .eq("sync_type", "bidirecional");

  if (error) {
    console.error("[cron/calendar-pull] failed to list integrations", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let processed = 0;
  let failed = 0;
  for (const integ of integrations ?? []) {
    try {
      await pullForUser(admin, integ.user_id);
      processed++;
    } catch (err) {
      failed++;
      console.error("[cron/calendar-pull] pull failed for user", integ.user_id, err);
    }
  }

  return NextResponse.json({ ok: true, processed, failed });
}
