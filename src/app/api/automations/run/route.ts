// Drains automation_events. pg_cron calls this once a minute (Task 13); the
// deals/activities triggers (Task 2) are the only producer. Same claim +
// reap-stuck shape as /api/whatsapp/queue/route.ts.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdmin } from "@/lib/whatsapp/connection";
import { runAutomationsServer } from "@/lib/automation-engine";
import type { Database } from "@/lib/supabase/database.types";
import type { TriggerType } from "@/lib/crm-types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 20;
const STUCK_AFTER_MINUTES = 15;

function authorized(req: NextRequest): boolean {
  const expected = process.env.AUTOMATION_DISPATCH_SECRET ?? "";
  if (!expected) {
    console.error("automations/run: AUTOMATION_DISPATCH_SECRET não está definido — fila parada");
    return false;
  }
  const presented = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

async function reapStuck(admin: SupabaseClient<Database>): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString();
  await admin
    .from("automation_events")
    .update({ status: "failed", error: "Processamento interrompido antes de concluir." })
    .eq("status", "processing")
    .lt("created_at", cutoff);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdmin();
  await reapStuck(admin);

  const { data: events, error } = await admin.rpc("claim_pending_automation_events", { p_limit: BATCH_SIZE });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!events || events.length === 0) return NextResponse.json({ processed: 0, failed: 0 });

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await runAutomationsServer(
        admin,
        event.trigger as TriggerType,
        event.deal_id,
        event.workspace_id,
        event.id,
      );
      await admin.from("automation_events").update({ status: "done" }).eq("id", event.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("automations/run", event.id, message);
      await admin.from("automation_events")
        .update({ status: "failed", error: message.slice(0, 500), attempts: event.attempts + 1 })
        .eq("id", event.id);
      failed++;
    }
  }

  return NextResponse.json({ processed, failed });
}
