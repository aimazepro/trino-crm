import { createClient } from "@/lib/supabase/client";
import type { Deal, Pipeline, TriggerType } from "@/lib/crm-types";

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
  userId: string;
  pipelines: Pipeline[];
}

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

async function executeAction(
  step: AutomationStep,
  deal: Deal,
  ctx: RunCtx,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  if (!step.action) return false;
  const { type, config } = step.action;

  try {
    switch (type) {
      case "move_stage": {
        const stageId = config.stageId as string;
        if (stageId && stageId !== deal.stageId) {
          await supabase.from("deals").update({ stage_id: stageId, days_in_stage: 0 }).eq("id", deal.id);
        }
        return true;
      }
      case "mark_won": {
        if (deal.status !== "Ganho") {
          await supabase.from("deals").update({ status: "Ganho", loss_reason: null }).eq("id", deal.id);
        }
        return true;
      }
      case "mark_lost": {
        if (deal.status !== "Perdido") {
          await supabase.from("deals").update({ status: "Perdido" }).eq("id", deal.id);
        }
        return true;
      }
      case "create_activity": {
        const daysAhead = Number(config.deadline ?? 1);
        const date = new Date();
        date.setDate(date.getDate() + daysAhead);
        await supabase.from("activities").insert({
          deal_id: deal.id,
          user_id: ctx.userId,
          title: (config.title as string) || "Atividade criada por automação",
          type: (config.activityType as string) || "Tarefa",
          date: date.toISOString().split("T")[0],
          description: null,
        });
        return true;
      }
      case "create_note": {
        const raw = String(config.content ?? "Nota criada por automação");
        const content = raw
          .replace(/\{loss_reason\}/g, deal.lossReason ?? "")
          .replace(/\{deal\.title\}/g, deal.title ?? "");
        await supabase.from("deal_notes").insert({ deal_id: deal.id, content });
        return true;
      }
      case "send_webhook": {
        const url = config.url as string;
        if (url) {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "automation", deal }),
          }).catch((err) => console.warn("[Automation] webhook failed:", err));
        }
        return true;
      }
      case "add_label": {
        const labelName = config.labelName as string;
        if (labelName) {
          const { data: lbl } = await supabase
            .from("labels")
            .select("id")
            .eq("user_id", ctx.userId)
            .eq("name", labelName)
            .maybeSingle();
          if (lbl && !deal.labels.includes(lbl.id)) {
            await supabase.from("deal_labels").insert({ deal_id: deal.id, label_id: lbl.id });
          }
        }
        return true;
      }
      case "create_deal": {
        const targetPipelineId = config.pipelineId as string;
        const targetPipeline = targetPipelineId
          ? ctx.pipelines.find((p) => p.id === targetPipelineId)
          : ctx.pipelines.find((p) => p.id !== deal.pipelineId);
        const firstStage = targetPipeline?.stages[0];
        if (targetPipeline && firstStage) {
          const title = String(config.title ?? deal.title)
            .replace(/\{contact\.name\}/g, deal.title);
          await supabase.from("deals").insert({
            user_id: ctx.userId,
            title,
            value: deal.value,
            contact_id: deal.contactId || null,
            company_id: deal.companyId || null,
            pipeline_id: targetPipeline.id,
            stage_id: firstStage.id,
            status: "Ativo",
            days_in_stage: 0,
          });
        }
        return true;
      }
      case "duplicate_deal": {
        await supabase.from("deals").insert({
          user_id: ctx.userId,
          title: `${deal.title} (cópia)`,
          value: deal.value,
          contact_id: deal.contactId || null,
          company_id: deal.companyId || null,
          pipeline_id: deal.pipelineId,
          stage_id: deal.stageId,
          status: "Ativo",
          days_in_stage: 0,
        });
        return true;
      }
      case "assign_owner": {
        const ownerMode = config.ownerMode as string;
        if (ownerMode === "fixed" && config.userId) {
          await supabase.from("deals").update({ owner_id: config.userId }).eq("id", deal.id);
        }
        return true;
      }
      default:
        console.log(`[Automation] Action "${type}" not yet implemented`);
        return true;
    }
  } catch (err) {
    console.error(`[Automation] executeAction "${type}" failed:`, err);
    return false;
  }
}

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
        const ok = await executeAction(step, deal, ctx, supabase);
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
