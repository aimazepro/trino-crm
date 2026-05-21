import { createClient } from "@/lib/supabase/client";
import type { Deal, Pipeline, TriggerType } from "@/lib/crm-types";

// ── Internal types ─────────────────────────────────────────────────────────────

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

export interface RunCtx {
  userId: string;
  pipelines: Pipeline[];
}

// ── Condition evaluation ───────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// Extract first email/phone from JSONB array (supports string[] or {value:string}[])
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstEmail(emails: any[]): string {
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

// ── Action executor ────────────────────────────────────────────────────────────

async function executeAction(
  automationId: string,
  step: AutomationStep,
  deal: Deal,
  ctx: RunCtx,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  if (!step.action) return false;
  const { type, config } = step.action;

  try {
    switch (type) {

      // ── move_stage ─────────────────────────────────────────────────────────
      case "move_stage": {
        const stageId = config.stageId as string;
        if (stageId && stageId !== deal.stageId) {
          await supabase
            .from("deals")
            .update({ stage_id: stageId, days_in_stage: 0 })
            .eq("id", deal.id);
          await supabase.from("deal_history").insert({
            deal_id: deal.id,
            description: "Etapa alterada por automação",
            subtext: "",
          });
        }
        return true;
      }

      // ── mark_won ───────────────────────────────────────────────────────────
      case "mark_won": {
        if (deal.status !== "Ganho") {
          await supabase
            .from("deals")
            .update({ status: "Ganho", loss_reason: null })
            .eq("id", deal.id);
          await supabase.from("deal_history").insert({
            deal_id: deal.id,
            description: "Negócio marcado como Ganho por automação",
            subtext: "",
          });
        }
        return true;
      }

      // ── mark_lost ──────────────────────────────────────────────────────────
      case "mark_lost": {
        if (deal.status !== "Perdido") {
          await supabase
            .from("deals")
            .update({ status: "Perdido" })
            .eq("id", deal.id);
          await supabase.from("deal_history").insert({
            deal_id: deal.id,
            description: "Negócio marcado como Perdido por automação",
            subtext: "",
          });
        }
        return true;
      }

      // ── create_activity ────────────────────────────────────────────────────
      case "create_activity": {
        const daysAhead = Number(config.deadline ?? 1);
        await supabase.from("activities").insert({
          deal_id: deal.id,
          user_id: ctx.userId,
          title: interpolate((config.title as string) || "Atividade criada por automação", deal),
          type: (config.activityType as string) || "Tarefa",
          date: daysFromNow(daysAhead),
          description: null,
        });
        return true;
      }

      // ── create_note ────────────────────────────────────────────────────────
      case "create_note": {
        const content = interpolate(
          String(config.content ?? "Nota criada por automação"),
          deal
        );
        await supabase.from("deal_notes").insert({ deal_id: deal.id, content });
        return true;
      }

      // ── send_webhook ───────────────────────────────────────────────────────
      case "send_webhook": {
        const url = config.url as string;
        if (url) {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "automation_trigger",
              automation_id: automationId,
              deal: {
                id: deal.id,
                title: deal.title,
                value: deal.value,
                status: deal.status,
                pipelineId: deal.pipelineId,
                stageId: deal.stageId,
              },
              timestamp: new Date().toISOString(),
            }),
          }).catch((err) => console.warn("[Automation] webhook failed:", err));
        }
        return true;
      }

      // ── add_label ──────────────────────────────────────────────────────────
      case "add_label": {
        const labelName = config.labelName as string;
        if (labelName) {
          const { data: lbl } = await supabase
            .from("labels")
            .select("id")
            .eq("user_id", ctx.userId)
            .ilike("name", labelName)
            .maybeSingle();
          if (lbl && !deal.labels.includes(lbl.id)) {
            await supabase
              .from("deal_labels")
              .insert({ deal_id: deal.id, label_id: lbl.id });
          }
        }
        return true;
      }

      // ── create_deal ────────────────────────────────────────────────────────
      case "create_deal": {
        // Find target pipeline: explicit pipelineId in config or first different pipeline
        const targetPipelineId = config.pipelineId as string | undefined;
        const targetPipeline = targetPipelineId
          ? ctx.pipelines.find((p) => p.id === targetPipelineId)
          : ctx.pipelines.find((p) => p.id !== deal.pipelineId);
        const firstStage = targetPipeline?.stages[0];

        if (targetPipeline && firstStage) {
          const title = interpolate(
            (config.title as string) || deal.title,
            deal
          );
          const { data: newDeal } = await supabase.from("deals").insert({
            user_id: ctx.userId,
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
            await supabase.from("deal_history").insert({
              deal_id: newDeal.id,
              description: "Negócio criado por automação",
              subtext: `Originado de: ${deal.title}`,
            });
          }
        }
        return true;
      }

      // ── duplicate_deal ─────────────────────────────────────────────────────
      case "duplicate_deal": {
        const targetPipelineId = config.pipelineId as string | undefined;
        const targetPipeline = targetPipelineId
          ? ctx.pipelines.find((p) => p.id === targetPipelineId)
          : ctx.pipelines.find((p) => p.id === deal.pipelineId);
        const firstStage = targetPipeline?.stages[0];

        if (targetPipeline && firstStage) {
          const { data: dup } = await supabase.from("deals").insert({
            user_id: ctx.userId,
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
            await supabase.from("deal_labels").insert(
              deal.labels.map((lid) => ({ deal_id: dup.id, label_id: lid }))
            );
          }
          if (dup) {
            await supabase.from("deal_history").insert({
              deal_id: dup.id,
              description: "Negócio duplicado por automação",
              subtext: `Cópia de: ${deal.title}`,
            });
          }
        }
        return true;
      }

      // ── assign_owner ───────────────────────────────────────────────────────
      case "assign_owner": {
        const ownerMode = config.ownerMode as string;

        if (ownerMode === "fixed" && config.userId) {
          await supabase
            .from("deals")
            .update({ owner_id: config.userId as string })
            .eq("id", deal.id);

        } else if (ownerMode === "round_robin") {
          const ids = String(config.roundRobinIds ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

          if (ids.length > 0) {
            // Count deals per owner among the selected members
            const counts: Record<string, number> = {};
            for (const uid of ids) counts[uid] = 0;

            const { data: owned } = await supabase
              .from("deals")
              .select("owner_id")
              .in("owner_id", ids)
              .eq("user_id", ctx.userId);

            (owned ?? []).forEach((d: { owner_id: string }) => {
              if (d.owner_id in counts) counts[d.owner_id]++;
            });

            // Assign to the member with fewest deals
            const nextOwner = ids.reduce(
              (min, id) => (counts[id] < counts[min] ? id : min),
              ids[0]
            );
            await supabase
              .from("deals")
              .update({ owner_id: nextOwner })
              .eq("id", deal.id);
          }
        }
        return true;
      }

      // ── send_email ─────────────────────────────────────────────────────────
      // Queues the email for delivery when Gmail integration is connected.
      case "send_email": {
        let toEmail = "";
        if (deal.contactId) {
          const { data: contact } = await supabase
            .from("contacts")
            .select("emails")
            .eq("id", deal.contactId)
            .maybeSingle();
          toEmail = firstEmail(contact?.emails ?? []);
        }

        await supabase.from("automation_email_queue").insert({
          user_id: ctx.userId,
          deal_id: deal.id,
          automation_id: automationId,
          to_email: toEmail || null,
          subject: interpolate((config.subject as string) ?? "", deal),
          body: interpolate((config.body as string) ?? (config.content as string) ?? "", deal),
          template_id: (config.templateId as string) ?? null,
          status: "pending",
        });
        return true;
      }

      // ── send_whatsapp ──────────────────────────────────────────────────────
      // Queues the message for delivery when WhatsApp integration is connected.
      case "send_whatsapp": {
        let phone = "";
        if (deal.contactId) {
          const { data: contact } = await supabase
            .from("contacts")
            .select("phones")
            .eq("id", deal.contactId)
            .maybeSingle();
          phone = firstPhone(contact?.phones ?? []);
        }

        await supabase.from("automation_whatsapp_queue").insert({
          user_id: ctx.userId,
          deal_id: deal.id,
          automation_id: automationId,
          phone: phone || null,
          template_id: (config.templateId as string) ?? null,
          message: interpolate((config.message as string) ?? "", deal),
          status: "pending",
        });
        return true;
      }

      // ── start_sequence ─────────────────────────────────────────────────────
      // Enrolls the deal in a sequence for execution when sequences module is ready.
      case "start_sequence": {
        const sequenceId = config.sequenceId as string;

        // Avoid double-enrolling the same deal in the same sequence
        const { data: existing } = await supabase
          .from("sequence_enrollments")
          .select("id")
          .eq("deal_id", deal.id)
          .eq("sequence_id", sequenceId ?? "")
          .eq("status", "active")
          .maybeSingle();

        if (!existing) {
          await supabase.from("sequence_enrollments").insert({
            user_id: ctx.userId,
            deal_id: deal.id,
            automation_id: automationId,
            sequence_id: sequenceId ?? null,
            status: "active",
            current_step: 0,
          });
        }
        return true;
      }

      default:
        console.log(`[Automation] Unknown action type: "${type}"`);
        return true;
    }
  } catch (err) {
    console.error(`[Automation] executeAction "${type}" failed:`, err);
    return false;
  }
}

// ── Main entry point ───────────────────────────────────────────────────────────

export async function runAutomations(
  triggerType: TriggerType,
  deal: Deal,
  ctx: RunCtx
): Promise<void> {
  if (!ctx.userId) return;
  const supabase = createClient();

  try {
    const { data: automations } = await supabase
      .from("automations")
      .select("id, trigger, steps, execution_count")
      .eq("user_id", ctx.userId)
      .eq("active", true)
      .eq("trigger", triggerType);

    if (!automations?.length) return;

    for (const automation of automations as AutomationRow[]) {
      const steps = automation.steps as AutomationStep[];

      if (!conditionsPass(steps, deal, ctx.pipelines)) continue;

      const actionSteps = steps.filter((s) => s.type === "action");
      let executed = 0;

      for (const step of actionSteps) {
        const ok = await executeAction(automation.id, step, deal, ctx, supabase);
        if (ok) executed++;
      }

      if (executed > 0) {
        await supabase
          .from("automations")
          .update({ execution_count: (automation.execution_count ?? 0) + 1 })
          .eq("id", automation.id);
      }
    }
  } catch (err) {
    console.error("[Automation] runAutomations error:", err);
  }
}
