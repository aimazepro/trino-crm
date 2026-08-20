import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { transformDeal, transformPipeline } from "@/lib/crm-transforms";
import type { Deal, Pipeline, TriggerType } from "@/lib/crm-types";
import { isPrivateOrUnsafeUrl, hmacSha256 } from "@/lib/webhook-security";

type Admin = SupabaseClient<Database>;

// ── Internal types ─────────────────────────────────────────────────────────

interface ConditionRule {
  field: string;
  operator: string;
  value: string;
}

interface AutomationStep {
  id: string;
  type: "condition" | "action";
  condition?: { rules: ConditionRule[] };
  action?: { type: string; config: Record<string, unknown> };
}

interface AutomationRow {
  id: string;
  trigger: string;
  steps: AutomationStep[];
  execution_count: number;
}

interface RunCtx {
  workspaceId: string;
  pipelines: Pipeline[];
}

// ── Condition evaluation (ported verbatim from the old client-side engine) ──

function evaluateRule(rule: ConditionRule, deal: Deal, pipelines: Pipeline[]): boolean {
  const { field, operator, value } = rule;
  let dealValue: string | number = "";

  switch (field) {
    case "pipeline": {
      const p = pipelines.find((p) => p.id === deal.pipelineId);
      dealValue = p?.name ?? "";
      break;
    }
    case "stage": {
      const s = pipelines.flatMap((p) => p.stages).find((s) => s.id === deal.stageId);
      dealValue = s?.name ?? "";
      break;
    }
    case "status":
      dealValue = deal.status;
      break;
    case "value":
      dealValue = deal.value ?? 0;
      break;
    case "label":
      return deal.labels.includes(value);
    default:
      return true;
  }

  const dv = String(dealValue).toLowerCase();
  const rv = value.toLowerCase();

  switch (operator) {
    case "is": return dv === rv;
    case "is_not": return dv !== rv;
    case "contains": return dv.includes(rv);
    case "greater_than": return Number(dealValue) > Number(value);
    case "less_than": return Number(dealValue) < Number(value);
    default: return true;
  }
}

function conditionsPass(steps: AutomationStep[], deal: Deal, pipelines: Pipeline[]): boolean {
  const conds = steps.filter((s) => s.type === "condition");
  if (conds.length === 0) return true;
  for (const step of conds) {
    if (!step.condition) continue;
    for (const rule of step.condition.rules) {
      if (!evaluateRule(rule, deal, pipelines)) return false;
    }
  }
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function interpolate(template: string, deal: Deal): string {
  return template
    .replace(/\{loss_reason\}/g, deal.lossReason ?? "")
    .replace(/\{deal\.title\}/g, deal.title ?? "")
    .replace(/\{deal\.value\}/g, String(deal.value ?? 0))
    .replace(/\{contact\.name\}/g, deal.title ?? "");
}

// Exported so the email-queue worker (Task 11) can resolve a null to_email the
// same way the send_email action does, instead of a second implementation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function firstEmail(emails: any[]): string {
  if (!emails?.length) return "";
  const e = emails[0];
  return typeof e === "string" ? e : (e?.value ?? e?.email ?? "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstPhone(phones: any[]): string {
  if (!phones?.length) return "";
  const p = phones[0];
  return typeof p === "string" ? p : (p?.value ?? p?.phone ?? p?.number ?? "");
}

// ── Queue helpers ────────────────────────────────────────────────────────
// Exported so the sequences worker (Task 11) enqueues through the same code
// path as the motor's send_email/send_whatsapp actions, instead of a second
// hand-rolled insert.

export async function queueEmail(admin: Admin, params: {
  workspaceId: string;
  dealId: string;
  automationId: string | null;
  toEmail: string | null;
  subject: string;
  body: string;
  templateId?: string | null;
}): Promise<void> {
  await admin.from("automation_email_queue").insert({
    workspace_id: params.workspaceId,
    deal_id: params.dealId,
    automation_id: params.automationId,
    to_email: params.toEmail,
    subject: params.subject,
    body: params.body,
    template_id: params.templateId ?? null,
    status: "pending",
  });
}

export async function queueWhatsApp(admin: Admin, params: {
  workspaceId: string;
  dealId: string;
  automationId: string | null;
  phone: string | null;
  message: string;
  templateId?: string | null;
}): Promise<void> {
  await admin.from("automation_whatsapp_queue").insert({
    workspace_id: params.workspaceId,
    deal_id: params.dealId,
    automation_id: params.automationId,
    phone: params.phone,
    template_id: params.templateId ?? null,
    message: params.message,
    status: "pending",
  });
}

// ── Per-step logging ─────────────────────────────────────────────────────

async function logStep(
  admin: Admin,
  runId: string,
  stepId: string,
  actionType: string,
  status: "success" | "failed",
  error: string | null,
  responseCode: number | null,
): Promise<void> {
  await admin.from("automation_run_steps").insert({
    run_id: runId,
    step_id: stepId,
    action_type: actionType,
    status,
    error,
    response_code: responseCode,
  });
}

// ── Action executor ──────────────────────────────────────────────────────

async function executeAction(
  admin: Admin,
  runId: string,
  automationId: string,
  step: AutomationStep,
  deal: Deal,
  ctx: RunCtx,
): Promise<boolean> {
  if (!step.action) return false;
  const { type, config } = step.action;

  try {
    switch (type) {

      case "move_stage": {
        const stageId = config.stageId as string;
        if (stageId && stageId !== deal.stageId) {
          await admin.from("deals").update({ stage_id: stageId, days_in_stage: 0 }).eq("id", deal.id);
          await admin.from("deal_history").insert({
            deal_id: deal.id, description: "Etapa alterada por automação", subtext: "",
          });
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "mark_won": {
        if (deal.status !== "Ganho") {
          await admin.from("deals").update({ status: "Ganho", loss_reason: null }).eq("id", deal.id);
          await admin.from("deal_history").insert({
            deal_id: deal.id, description: "Negócio marcado como Ganho por automação", subtext: "",
          });
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "mark_lost": {
        if (deal.status !== "Perdido") {
          await admin.from("deals").update({ status: "Perdido" }).eq("id", deal.id);
          await admin.from("deal_history").insert({
            deal_id: deal.id, description: "Negócio marcado como Perdido por automação", subtext: "",
          });
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "create_activity": {
        const daysAhead = Number(config.deadline ?? 1);
        await admin.from("activities").insert({
          deal_id: deal.id,
          workspace_id: ctx.workspaceId,
          title: interpolate((config.title as string) || "Atividade criada por automação", deal),
          type: (config.activityType as string) || "Tarefa",
          date: daysFromNow(daysAhead),
          description: null,
        });
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "create_note": {
        const content = interpolate(String(config.content ?? "Nota criada por automação"), deal);
        await admin.from("deal_notes").insert({ deal_id: deal.id, content });
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "send_webhook": {
        const url = config.url as string;
        if (!url) {
          await logStep(admin, runId, step.id, type, "success", null, null);
          return true;
        }
        if (isPrivateOrUnsafeUrl(url)) {
          await logStep(admin, runId, step.id, type, "failed", "URL de destino bloqueada (privada ou não-HTTPS).", null);
          return false;
        }

        const bodyString = JSON.stringify({
          event: "automation_trigger",
          automation_id: automationId,
          deal: {
            id: deal.id, title: deal.title, value: deal.value, status: deal.status,
            pipelineId: deal.pipelineId, stageId: deal.stageId,
          },
          timestamp: new Date().toISOString(),
        });

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const secret = config.secret as string | undefined;
        if (secret) headers["X-Signature"] = `sha256=${hmacSha256(secret, bodyString)}`;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(url, { method: "POST", headers, body: bodyString, signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            await logStep(admin, runId, step.id, type, "success", null, res.status);
            return true;
          }
          await logStep(admin, runId, step.id, type, "failed", `HTTP ${res.status}`, res.status);
          return false;
        } catch (err) {
          await logStep(admin, runId, step.id, type, "failed", err instanceof Error ? err.message : String(err), null);
          return false;
        }
      }

      case "add_label": {
        const labelName = config.labelName as string;
        if (labelName) {
          const { data: lbl } = await admin.from("labels").select("id")
            .eq("workspace_id", ctx.workspaceId)
            .ilike("name", labelName)
            .maybeSingle();
          if (lbl && !deal.labels.includes(lbl.id)) {
            await admin.from("deal_labels").insert({ deal_id: deal.id, label_id: lbl.id });
          }
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "create_deal": {
        const targetPipelineId = config.pipelineId as string | undefined;
        const targetPipeline = targetPipelineId
          ? ctx.pipelines.find((p) => p.id === targetPipelineId)
          : ctx.pipelines.find((p) => p.id !== deal.pipelineId);
        const firstStage = targetPipeline?.stages[0];

        if (targetPipeline && firstStage) {
          const title = interpolate((config.title as string) || deal.title, deal);
          const { data: newDeal } = await admin.from("deals").insert({
            workspace_id: ctx.workspaceId,
            title,
            value: config.copyAll ? deal.value : (Number(config.value ?? 0) || 0),
            contact_id: deal.contactId || null,
            company_id: config.copyAll ? (deal.companyId || null) : null,
            pipeline_id: targetPipeline.id,
            stage_id: firstStage.id,
            status: "Ativo",
            days_in_stage: 0,
          }).select("id").single();

          if (newDeal) {
            await admin.from("deal_history").insert({
              deal_id: newDeal.id, description: "Negócio criado por automação", subtext: `Originado de: ${deal.title}`,
            });
          }
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "duplicate_deal": {
        const targetPipelineId = config.pipelineId as string | undefined;
        const targetPipeline = targetPipelineId
          ? ctx.pipelines.find((p) => p.id === targetPipelineId)
          : ctx.pipelines.find((p) => p.id === deal.pipelineId);
        const firstStage = targetPipeline?.stages[0];

        if (targetPipeline && firstStage) {
          const { data: dup } = await admin.from("deals").insert({
            workspace_id: ctx.workspaceId,
            title: `${deal.title} (cópia)`,
            value: deal.value,
            contact_id: deal.contactId || null,
            company_id: deal.companyId || null,
            pipeline_id: targetPipeline.id,
            stage_id: firstStage.id,
            status: "Ativo",
            days_in_stage: 0,
          }).select("id").single();

          if (dup && deal.labels.length > 0) {
            await admin.from("deal_labels").insert(deal.labels.map((lid) => ({ deal_id: dup.id, label_id: lid })));
          }
          if (dup) {
            await admin.from("deal_history").insert({
              deal_id: dup.id, description: "Negócio duplicado por automação", subtext: `Cópia de: ${deal.title}`,
            });
          }
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "assign_owner": {
        const ownerMode = config.ownerMode as string;

        if (ownerMode === "fixed" && config.userId) {
          await admin.from("deals").update({ owner_id: config.userId as string }).eq("id", deal.id);
        } else if (ownerMode === "round_robin") {
          const ids = String(config.roundRobinIds ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          if (ids.length > 0) {
            const counts: Record<string, number> = {};
            for (const uid of ids) counts[uid] = 0;

            const { data: owned } = await admin.from("deals").select("owner_id")
              .eq("workspace_id", ctx.workspaceId)
              .in("owner_id", ids);
            (owned ?? []).forEach((d: { owner_id: string | null }) => {
              if (d.owner_id && d.owner_id in counts) counts[d.owner_id]++;
            });

            const nextOwner = ids.reduce((min, id) => (counts[id] < counts[min] ? id : min), ids[0]);
            await admin.from("deals").update({ owner_id: nextOwner }).eq("id", deal.id);
          }
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "send_email": {
        let toEmail = "";
        if (deal.contactId) {
          const { data: contact } = await admin.from("contacts").select("emails").eq("id", deal.contactId).maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toEmail = firstEmail((contact?.emails ?? []) as any[]);
        }
        await queueEmail(admin, {
          workspaceId: ctx.workspaceId,
          dealId: deal.id,
          automationId,
          toEmail: toEmail || null,
          subject: interpolate((config.subject as string) ?? "", deal),
          body: interpolate((config.body as string) ?? (config.content as string) ?? "", deal),
          templateId: (config.templateId as string) ?? null,
        });
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "send_whatsapp": {
        let phone = "";
        if (deal.contactId) {
          const { data: contact } = await admin.from("contacts").select("phones").eq("id", deal.contactId).maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          phone = firstPhone((contact?.phones ?? []) as any[]);
        }

        const templateId = (config.templateId as string) || null;
        let message = interpolate((config.message as string) ?? "", deal);

        if (!message && templateId) {
          const { data: template } = await admin.from("whatsapp_templates").select("message").eq("id", templateId).maybeSingle();
          message = template?.message ?? "";
        }

        await queueWhatsApp(admin, {
          workspaceId: ctx.workspaceId,
          dealId: deal.id,
          automationId,
          phone: phone || null,
          templateId,
          message,
        });
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "start_sequence": {
        const sequenceId = config.sequenceId as string;
        const { data: existing } = await admin.from("sequence_enrollments")
          .select("id")
          .eq("deal_id", deal.id)
          .eq("sequence_id", sequenceId ?? "")
          .eq("status", "active")
          .maybeSingle();

        if (!existing) {
          await admin.from("sequence_enrollments").insert({
            workspace_id: ctx.workspaceId,
            deal_id: deal.id,
            automation_id: automationId,
            sequence_id: sequenceId ?? null,
            status: "active",
            current_step: 0,
          });
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      default:
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
    }
  } catch (err) {
    await logStep(admin, runId, step.id, type, "failed", err instanceof Error ? err.message : String(err), null);
    return false;
  }
}

// ── Re-entrancy guard ────────────────────────────────────────────────────
// The outbox triggers (20260820100100_automation_event_triggers.sql) fire on
// ANY write to deals/activities, including the writes this engine's own
// actions make through the admin client. An action like move_stage or
// assign_owner can therefore re-trigger the same automation, or another one,
// which can form a closed cycle (see stock templates in
// automacoes-context.tsx: deal_updated->move_stage->stage_changed->mark_won
// ->deal_won->create_deal->deal_created->assign_owner(round_robin, writes
// owner_id)->deal_updated->...). There is no depth/session marker to detect
// this properly yet (that's the future direction -- see the design doc), so
// this is a bounded mitigation: cap how many times one (automation, deal)
// pair may run inside a rolling window, and stop executing once past it.
const LOOP_GUARD_WINDOW_HOURS = 1;
// Matches /api/automations/run's BATCH_SIZE -- a reasonable ceiling for "this
// deal/automation pair is clearly looping, not doing legitimate repeated work".
const LOOP_GUARD_MAX_RUNS = 20;

// ── Main entry point ─────────────────────────────────────────────────────
// Called once per claimed automation_events row (Task 6). Re-reads the deal
// fresh rather than trusting a snapshot from whoever wrote the triggering row.

export async function runAutomationsServer(
  admin: Admin,
  triggerType: TriggerType,
  dealId: string,
  workspaceId: string,
  eventId: string | null,
): Promise<void> {
  const { data: dealRow } = await admin
    .from("deals")
    .select("*, deal_labels(label_id)")
    .eq("id", dealId)
    .maybeSingle();
  if (!dealRow) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deal = transformDeal(dealRow as any);

  const { data: pipelineRows } = await admin
    .from("pipelines")
    .select("*, pipeline_stages(*)")
    .eq("workspace_id", workspaceId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelines: Pipeline[] = (pipelineRows ?? []).map((row: any) => transformPipeline(row));

  const { data: automations } = await admin
    .from("automations")
    .select("id, trigger, steps, execution_count")
    .eq("active", true)
    .eq("trigger", triggerType)
    .eq("workspace_id", workspaceId);
  if (!automations?.length) return;

  for (const automation of automations as unknown as AutomationRow[]) {
    const steps = automation.steps as AutomationStep[];
    if (!conditionsPass(steps, deal, pipelines)) continue;

    const since = new Date(Date.now() - LOOP_GUARD_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { count: recentRunCount } = await admin
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .eq("automation_id", automation.id)
      .eq("deal_id", dealId)
      .gt("started_at", since);

    if ((recentRunCount ?? 0) >= LOOP_GUARD_MAX_RUNS) {
      // Loop guard tripped: this (automation, deal) pair has already run at
      // or above the cap within the window -- almost certainly a re-entrant
      // cycle through the outbox triggers, not legitimate repeated work.
      // Skip execution entirely (no steps run, no deal/activity writes) and
      // leave a visible marker in the run log rather than looping silently.
      // This degenerate row also counts toward the query above on the next
      // pass, which is intentional: it keeps this pair suppressed for the
      // rest of the window instead of flapping in and out of the cap.
      await admin.from("automation_runs").insert({
        workspace_id: workspaceId,
        automation_id: automation.id,
        event_id: eventId,
        trigger: triggerType,
        deal_id: dealId,
        status: "failed",
        finished_at: new Date().toISOString(),
      });
      continue;
    }

    const { data: run } = await admin
      .from("automation_runs")
      .insert({
        workspace_id: workspaceId,
        automation_id: automation.id,
        event_id: eventId,
        trigger: triggerType,
        deal_id: dealId,
        status: "running",
      })
      .select("id")
      .single();
    if (!run) continue;

    const actionSteps = steps.filter((s) => s.type === "action");
    let executed = 0;
    let failed = 0;
    for (const step of actionSteps) {
      const ok = await executeAction(admin, run.id, automation.id, step, deal, { workspaceId, pipelines });
      if (ok) executed++; else failed++;
    }

    await admin
      .from("automation_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: failed === 0 ? "success" : executed > 0 ? "partial" : "failed",
      })
      .eq("id", run.id);

    if (executed > 0) {
      await admin
        .from("automations")
        .update({ execution_count: (automation.execution_count ?? 0) + 1 })
        .eq("id", automation.id);
    }
  }
}
