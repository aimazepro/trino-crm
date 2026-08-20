// Drains sequence_enrollments, advancing one step per enrollment per run.
// Replaces supabase/functions/process-sequences (Deno). Fixes two bugs found
// while migrating:
//   1. The Deno version inserted with `user_id`, dropped by the Phase 1 rename
//      -- every insert here was failing silently the same way Task 0's bug did.
//   2. step.note is JSON (parseSequenceStepNote), not a raw string -- the Deno
//      version used it unparsed as the email subject/body and WhatsApp text.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdmin } from "@/lib/whatsapp/connection";
import { queueEmail, queueWhatsApp } from "@/lib/automation-engine";
import { parseSequenceStepNote } from "@/lib/sequence-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 50;

function authorized(req: NextRequest): boolean {
  const expected = process.env.AUTOMATION_DISPATCH_SECRET ?? "";
  if (!expected) {
    console.error("automations/sequences: AUTOMATION_DISPATCH_SECRET não está definido — fila parada");
    return false;
  }
  const presented = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdmin();
  const { data: claimed, error } = await admin.rpc("claim_due_sequence_enrollments", { p_limit: BATCH_SIZE });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!claimed || claimed.length === 0) return NextResponse.json({ processed: 0 });

  let processed = 0;
  const now = new Date();

  for (const enrollment of claimed) {
    try {
      const { data: seq } = await admin
        .from("sequences")
        .select("*, sequence_steps(*)")
        .eq("id", enrollment.sequence_id ?? "")
        .maybeSingle();

      if (!seq) {
        await admin.from("sequence_enrollments").update({ status: "active" }).eq("id", enrollment.id);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const steps = ((seq as any).sequence_steps ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);
      const currentStep = enrollment.current_step ?? 0;

      if (currentStep >= steps.length) {
        await admin.from("sequence_enrollments")
          .update({ status: "completed", updated_at: now.toISOString() })
          .eq("id", enrollment.id);
        continue;
      }

      const step = steps[currentStep];
      const enrolledAt = new Date(enrollment.enrolled_at ?? now);
      const targetDate = new Date(enrolledAt.getTime() + step.day_offset * 86400000);

      if (now < targetDate) {
        // Not due yet -- put it back so the next tick reconsiders it.
        await admin.from("sequence_enrollments").update({ status: "active" }).eq("id", enrollment.id);
        continue;
      }

      const parsed = parseSequenceStepNote(step.note ?? "", step.day_offset);

      if (step.step_type === "Email") {
        await queueEmail(admin, {
          workspaceId: enrollment.workspace_id,
          dealId: enrollment.deal_id ?? "",
          automationId: enrollment.automation_id,
          toEmail: null,
          subject: parsed.title || "Sequência de email",
          body: parsed.notes || "",
          templateId: parsed.emailTemplateId || null,
        });
      } else if (step.step_type === "WhatsApp") {
        await queueWhatsApp(admin, {
          workspaceId: enrollment.workspace_id,
          dealId: enrollment.deal_id ?? "",
          automationId: enrollment.automation_id,
          phone: null,
          templateId: null,
          message: parsed.notes || parsed.title || "",
        });
      } else {
        await admin.from("activities").insert({
          workspace_id: enrollment.workspace_id,
          deal_id: enrollment.deal_id ?? "",
          type: step.step_type,
          title: parsed.title || step.step_type,
          date: targetDate.toISOString(),
          description: parsed.notes || null,
        });
      }

      const nextStep = currentStep + 1;
      const completed = nextStep >= steps.length;
      await admin.from("sequence_enrollments")
        .update({
          current_step: nextStep,
          status: completed ? "completed" : "active",
          updated_at: now.toISOString(),
        })
        .eq("id", enrollment.id);

      processed++;
    } catch (e) {
      console.error("automations/sequences", enrollment.id, e);
      await admin.from("sequence_enrollments").update({ status: "active" }).eq("id", enrollment.id);
    }
  }

  return NextResponse.json({ processed });
}
