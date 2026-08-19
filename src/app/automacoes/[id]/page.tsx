"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Trash2, Plus, ChevronDown, X, Tag, Settings, CheckCircle2, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAutomacoes,
  TRIGGER_LABELS,
  TRIGGER_DESCRIPTIONS,
  CONDITION_FIELD_LABELS,
  CONDITION_OPERATOR_LABELS,
  ACTION_LABELS,
  AUTOMATION_TEMPLATES,
} from "@/contexts/automacoes-context";
import { useCrm } from "@/contexts/crm-context";
import { createClient } from "@/lib/supabase/client";
import type {
  Automation,
  AutomationStep,
  AutomationConditionRule,
  AutomationConditionField,
  AutomationConditionOperator,
  ActionType,
  TriggerType,
  Pipeline,
} from "@/lib/crm-types";

type AssignableUser = { id: string; name: string };
type CustomFieldOption = { id: string; name: string };

function useTeamUsers(): AssignableUser[] {
  const [users, setUsers] = useState<AssignableUser[]>([]);
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const selfName = (user.user_metadata?.full_name as string | undefined) || user.email || "Você";
      const list: AssignableUser[] = [{ id: user.id, name: selfName }];
      const { data } = await supabase
        .from("team_members")
        .select("member_user_id, name, email, owner_user_id, status")
        .or(`owner_user_id.eq.${user.id},member_user_id.eq.${user.id}`)
        .eq("status", "accepted");
      (data ?? []).forEach((m) => {
        if (m.member_user_id && m.member_user_id !== user.id) {
          list.push({ id: m.member_user_id, name: m.name || m.email });
        }
      });
      if (!cancelled) setUsers(list);
    })();
    return () => { cancelled = true; };
  }, []);
  return users;
}

/** The saved WhatsApp templates, so the action can point at one that exists. */
function useWhatsAppTemplates(): { id: string; name: string }[] {
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at");
      if (!cancelled) setTemplates(data ?? []);
    })();
    return () => { cancelled = true; };
  }, []);
  return templates;
}

function useDealCustomFields(): CustomFieldOption[] {
  const [fields, setFields] = useState<CustomFieldOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("custom_fields")
        .select("id, label, entity")
        .eq("user_id", user.id)
        .eq("entity", "deal")
        .order("sort_order", { ascending: true });
      if (!cancelled) {
        setFields((data ?? []).map((f) => ({ id: f.id, name: f.label })));
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return fields;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRIGGER_TYPES: TriggerType[] = [
  "deal_created",
  "stage_changed",
  "deal_won",
  "deal_lost",
  "deal_updated",
  "activity_created",
];

const ACTION_TYPES: ActionType[] = [
  "create_deal",
  "create_activity",
  "move_stage",
  "assign_owner",
  "mark_won",
  "mark_lost",
  "add_label",
  "duplicate_deal",
  "create_note",
  "send_webhook",
  "send_email",
  "send_whatsapp",
  "start_sequence",
];

const CONDITION_FIELDS: AutomationConditionField[] = [
  "stage", "pipeline", "status", "value", "owner", "label",
];

const CONDITION_OPERATORS: { value: AutomationConditionOperator; label: string }[] = [
  { value: "is", label: "é" },
  { value: "is_not", label: "não é" },
  { value: "contains", label: "contém" },
  { value: "greater_than", label: "maior que" },
  { value: "less_than", label: "menor que" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function conditionSummary(step: AutomationStep): string {
  const rules = step.condition?.rules ?? [];
  if (!rules.length) return "??? é";
  return rules
    .map((r) => {
      const field = CONDITION_FIELD_LABELS[r.field] ?? "???";
      const op = CONDITION_OPERATOR_LABELS[r.operator] ?? r.operator;
      return `${field} ${op} ${r.value || "..."}`;
    })
    .join(" AND ");
}

function defaultConfig(type: ActionType): Record<string, string | number | boolean> {
  switch (type) {
    case "create_deal":
      return { pipelineId: "", stageId: "", title: "[OPP] - {contact.name}", copyAll: true, ownerMode: "keep" };
    case "create_activity":
      return { activityType: "Ligação", deadline: 1, title: "", notes: "" };
    case "move_stage":
      return { pipelineId: "", stageId: "" };
    case "assign_owner":
      return { ownerMode: "fixed", userId: "" };
    case "mark_lost":
      return { lossReason: "" };
    case "add_label":
      return { labelName: "" };
    case "duplicate_deal":
      return { ownerMode: "keep" };
    case "create_note":
      return { content: "" };
    case "send_webhook":
      return { url: "" };
    case "send_email":
      return { templateId: "" };
    case "send_whatsapp":
      return { templateId: "" };
    case "start_sequence":
      return { sequenceId: "" };
    default:
      return {};
  }
}

type SelectionState =
  | { kind: "trigger" }
  | { kind: "step"; stepId: string }
  | null;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AutomacaoEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { automations, addAutomation, updateAutomation, automationLabels } = useAutomacoes();
  const { state: crmState } = useCrm();

  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isNew = rawId === "nova";
  const templateId = searchParams.get("template");

  const buildFresh = useCallback((): Automation => {
    const tpl = templateId ? AUTOMATION_TEMPLATES.find((t) => t.id === templateId) : null;
    return {
      id: isNew ? crypto.randomUUID() : (rawId ?? crypto.randomUUID()),
      name: tpl ? tpl.name : "Nome da automação",
      description: "",
      trigger: tpl ? tpl.triggerKey : null,
      steps: tpl ? JSON.parse(JSON.stringify(tpl.steps)) : [],
      labelIds: [],
      active: false,
      executionCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [isNew, rawId, templateId]);

  const [automation, setAutomation] = useState<Automation>(() => {
    if (!isNew) {
      const found = automations.find((a) => a.id === rawId);
      if (found) return JSON.parse(JSON.stringify(found));
    }
    return buildFresh();
  });

  const [selection, setSelection] = useState<SelectionState>({ kind: "trigger" });
  const [saved, setSaved] = useState(false);
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const labelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNew && automation.id !== rawId) {
      const found = automations.find((a) => a.id === rawId);
      if (found) setAutomation(JSON.parse(JSON.stringify(found)));
    }
  }, [automations, rawId, isNew, automation.id]);

  // Close label picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
        setLabelPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Mutation helpers ────────────────────────────────────────────────────────

  const updateField = <K extends keyof Automation>(key: K, val: Automation[K]) =>
    setAutomation((p) => ({ ...p, [key]: val }));

  const updateStep = (id: string, fn: (s: AutomationStep) => AutomationStep) =>
    setAutomation((p) => ({ ...p, steps: p.steps.map((s) => (s.id === id ? fn(s) : s)) }));

  const deleteStep = (id: string) => {
    setAutomation((p) => ({ ...p, steps: p.steps.filter((s) => s.id !== id) }));
    setSelection(null);
  };

  function addConditionStep(atIndex?: number) {
    const step: AutomationStep = {
      id: crypto.randomUUID(),
      type: "condition",
      condition: { rules: [{ field: "pipeline", operator: "is", value: "" }] },
    };
    setAutomation((p) => {
      const steps = [...p.steps];
      if (atIndex !== undefined) steps.splice(atIndex, 0, step);
      else steps.push(step);
      return { ...p, steps };
    });
    setSelection({ kind: "step", stepId: step.id });
  }

  function addActionStep(atIndex?: number) {
    const step: AutomationStep = {
      id: crypto.randomUUID(),
      type: "action",
      action: { type: "create_activity", config: defaultConfig("create_activity") },
    };
    setAutomation((p) => {
      const steps = [...p.steps];
      if (atIndex !== undefined) steps.splice(atIndex, 0, step);
      else steps.push(step);
      return { ...p, steps };
    });
    setSelection({ kind: "step", stepId: step.id });
  }

  const toggleLabel = (labelId: string) => {
    setAutomation((p) => {
      const labelIds = p.labelIds.includes(labelId)
        ? p.labelIds.filter((id) => id !== labelId)
        : [...p.labelIds, labelId];
      return { ...p, labelIds };
    });
  };

  function handleSave() {
    if (isNew || !automations.find((a) => a.id === automation.id)) {
      addAutomation({ ...automation, active: true });
    } else {
      updateAutomation(automation.id, automation);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Count actions to label them with step numbers
  let actionIndex = 0;
  const selectedStep = selection?.kind === "step"
    ? automation.steps.find((s) => s.id === selection.stepId)
    : null;

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-8 pt-8 pb-5 bg-transparent shrink-0">
        <button
          onClick={() => router.push("/automacoes")}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 transition-colors cursor-pointer bg-white border border-zinc-200 shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <input
            value={automation.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="text-[18px] font-black text-zinc-950 bg-transparent border-none outline-none w-full placeholder:text-zinc-300"
            placeholder="Nome da automação"
          />
          <input
            value={automation.description}
            onChange={(e) => updateField("description", e.target.value)}
            className="text-[12px] text-zinc-400 bg-transparent border-none outline-none w-full placeholder:text-zinc-300 mt-0.5"
            placeholder="Descrição opcional"
          />
        </div>

        {/* Label picker */}
        <div className="relative" ref={labelPickerRef}>
          <button
            onClick={() => setLabelPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-1.5 bg-white hover:border-zinc-350 transition-colors cursor-pointer shadow-sm"
          >
            <Tag className="h-3.5 w-3.5 text-zinc-400" />
            {automation.labelIds.length > 0
              ? `${automation.labelIds.length} etiqueta${automation.labelIds.length > 1 ? "s" : ""}`
              : "+ Adicionar etiqueta"}
            <ChevronDown className="h-3.5 w-3.5 opacity-65" />
          </button>

          {labelPickerOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {automationLabels.length === 0 ? (
                <p className="text-[12px] text-zinc-400 text-center py-4 px-3">
                  Nenhuma etiqueta criada ainda.
                </p>
              ) : (
                <div className="py-1">
                  {automationLabels.map((lbl) => (
                    <button
                      key={lbl.id}
                      onClick={() => toggleLabel(lbl.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 text-left cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: lbl.color }} />
                      <span className="flex-1 text-[13px] font-medium text-zinc-800">{lbl.name}</span>
                      {automation.labelIds.includes(lbl.id) && (
                        <CheckCircle2 className="h-4 w-4 text-[#F1A80A]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="border-t border-zinc-100 flex items-center">
                <button
                  onClick={() => { setLabelPickerOpen(false); router.push("/configuracoes/etiquetas-automacoes"); }}
                  className="flex-1 flex items-center gap-1 px-3 py-2.5 text-[12px] font-bold text-[#F1A80A] hover:bg-amber-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Nova etiqueta
                </button>
                <div className="w-px h-6 bg-zinc-100" />
                <button
                  onClick={() => { setLabelPickerOpen(false); router.push("/configuracoes/etiquetas-automacoes"); }}
                  className="px-3 py-2.5 text-[12px] font-bold text-zinc-500 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" /> Gerenciar
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          className={cn(
            "px-5 py-2 rounded-lg text-[13px] font-bold transition-colors shrink-0 cursor-pointer shadow-sm",
            saved ? "bg-emerald-500 text-white" : "bg-[#F1A80A] hover:bg-[#D79405] text-white"
          )}
        >
          {saved ? "Salvo!" : "Salvar"}
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Canvas */}
        <div
          className="flex-1 overflow-y-auto p-8 flex flex-col items-center"
          onClick={() => setSelection(null)}
        >
          <div className="w-full max-w-lg space-y-0">

            {/* GATILHO block */}
            <CanvasBlock
              variant="trigger"
              selected={selection?.kind === "trigger"}
              onClick={(e) => { e.stopPropagation(); setSelection({ kind: "trigger" }); }}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-[#F1A80A] mb-1.5 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 fill-[#F1A80A] text-[#F1A80A]" />
                GATILHO
              </div>
              {automation.trigger ? (
                <>
                  <p className="text-[14px] font-bold text-zinc-950">{TRIGGER_LABELS[automation.trigger]}</p>
                  <p className="text-[12px] text-zinc-400 mt-1 font-semibold">{TRIGGER_DESCRIPTIONS[automation.trigger]}</p>
                </>
              ) : (
                <p className="text-[13px] text-zinc-400 font-semibold">Selecionar gatilho...</p>
              )}
            </CanvasBlock>

            {/* Steps */}
            {automation.steps.map((step, idx) => {
              const isSelected = selection?.kind === "step" && selection.stepId === step.id;
              if (step.type === "action") actionIndex++;
              const curActionIdx = step.type === "action" ? actionIndex : 0;

              return (
                <div key={step.id}>
                  <FlowConnector
                    onAddCondition={(e) => { e.stopPropagation(); addConditionStep(idx); }}
                    onAddAction={(e) => { e.stopPropagation(); addActionStep(idx); }}
                  />

                  {step.type === "condition" ? (
                    <CanvasBlock
                      variant="condition"
                      selected={isSelected}
                      onDelete={(e) => { e.stopPropagation(); deleteStep(step.id); }}
                      onClick={(e) => { e.stopPropagation(); setSelection({ kind: "step", stepId: step.id }); }}
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1.5 flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-500">
                          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                        CONDICAO
                      </div>
                      <p className="text-[13px] text-zinc-800 font-semibold">{conditionSummary(step)}</p>
                    </CanvasBlock>
                  ) : (
                    /* ACTION BLOCK — expanded inline when selected */
                    <CanvasBlock
                      variant="action"
                      selected={isSelected}
                      actionNum={curActionIdx}
                      actionLabel={step.action ? ACTION_LABELS[step.action.type] : "Selecionar ação..."}
                      onDelete={(e) => { e.stopPropagation(); deleteStep(step.id); }}
                      onClick={(e) => { e.stopPropagation(); setSelection({ kind: "step", stepId: step.id }); }}
                    >
                      {isSelected && (
                        <InlineActionForm
                          step={step}
                          onChange={(fn) => updateStep(step.id, fn)}
                          pipelines={crmState.pipelines}
                        />
                      )}
                    </CanvasBlock>
                  )}

                  {idx === automation.steps.length - 1 && (
                    <FlowConnector
                      onAddCondition={(e) => { e.stopPropagation(); addConditionStep(); }}
                      onAddAction={(e) => { e.stopPropagation(); addActionStep(); }}
                    />
                  )}
                </div>
              );
            })}

            {automation.steps.length === 0 && (
              <FlowConnector
                onAddCondition={(e) => { e.stopPropagation(); addConditionStep(); }}
                onAddAction={(e) => { e.stopPropagation(); addActionStep(); }}
              />
            )}

            {/* End of flow */}
            <div className="flex justify-center pt-1">
              <div className="flex items-center gap-2 text-[12px] text-zinc-400 font-medium">
                <div className="w-4 h-4 rounded-full border-2 border-zinc-300 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                </div>
                Fim do fluxo
              </div>
            </div>

          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 shrink-0 border-l border-zinc-200 bg-white overflow-y-auto">
          {selection?.kind === "trigger" && (
            <TriggerPanel
              value={automation.trigger}
              onChange={(t) => { updateField("trigger", t); setSelection(null); }}
            />
          )}

          {selection?.kind === "step" && selectedStep?.type === "condition" && (
            <ConditionPanel
              step={selectedStep}
              onChange={(fn) => updateStep(selectedStep.id, fn)}
              pipelines={crmState.pipelines}
            />
          )}

          {selection?.kind === "step" && selectedStep?.type === "action" && (
            <ActionTypePanel
              value={selectedStep.action?.type ?? "create_activity"}
              onChange={(t) => updateStep(selectedStep.id, (s) => ({
                ...s,
                action: { type: t, config: defaultConfig(t) },
              }))}
            />
          )}

          {selection === null && (
            <NextStepPanel
              onAddCondition={(e) => { e.stopPropagation(); addConditionStep(); }}
              onAddAction={(e) => { e.stopPropagation(); addActionStep(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas Block
// ─────────────────────────────────────────────────────────────────────────────

interface CanvasBlockProps {
  variant: "trigger" | "condition" | "action";
  selected: boolean;
  actionNum?: number;
  actionLabel?: string;
  onClick: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}

function CanvasBlock({ variant, selected, actionNum, actionLabel, onClick, onDelete, children }: CanvasBlockProps) {
  const borders = {
    trigger: selected
      ? "border-dashed border-2 border-[#F1A80A] bg-[#FFF9EC]/40"
      : "border-dashed border-2 border-amber-300/80 bg-[#FFF9EC]/20",
    condition: selected
      ? "border-2 border-blue-400 bg-blue-50/20"
      : "border-2 border-blue-200 bg-white",
    action: selected
      ? "border-2 border-[#F1A80A] bg-[#FFF9EC]/10"
      : "border-2 border-zinc-200 bg-white",
  }[variant];

  const isAction = variant === "action";

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative border-2 rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md",
        borders,
        isAction ? "px-4 pt-4 pb-4" : "px-5 py-4"
      )}
    >
      {isAction && actionNum !== undefined && (
        <span className="absolute -top-2.5 -left-2 w-[22px] h-[22px] rounded-md bg-[#F1A80A] text-white text-[11px] font-black flex items-center justify-center z-10 shadow-sm">
          {actionNum}
        </span>
      )}

      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-3.5 right-3.5 p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors z-10 cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* Action header row */}
      {isAction && (
        <div className="flex items-center gap-2 mb-3.5 pr-6">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-[#F1A80A] shrink-0">
            <polygon points="5 3 19 12 5 21" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#F1A80A]">AÇÃO</span>
          <span className="text-[13px] font-medium text-zinc-400">{actionLabel}</span>
        </div>
      )}

      {variant === "trigger" ? (
        <div className="flex items-center justify-between w-full">
          <div className="flex-1">
            {children}
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-400 ml-2 shrink-0" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow Connector
// ─────────────────────────────────────────────────────────────────────────────

function FlowConnector({
  onAddCondition,
  onAddAction,
}: {
  onAddCondition: (e: React.MouseEvent) => void;
  onAddAction: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex flex-col items-center py-0.5">
      <div className="w-px h-3 bg-zinc-200" />
      <div className="flex items-center gap-2">
        <button
          onClick={onAddCondition}
          className="flex items-center gap-0.5 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100/60 border border-blue-150 px-2 py-0.5 rounded-full transition-colors shadow-sm cursor-pointer"
        >
          +SE
        </button>
        <button
          onClick={onAddAction}
          className="flex items-center gap-0.5 text-[10px] font-black text-[#F1A80A] bg-[#FFF9EC] hover:bg-[#FFF9EC]/80 border border-amber-150 px-2 py-0.5 rounded-full transition-colors shadow-sm cursor-pointer"
        >
          +AÇÃO
        </button>
      </div>
      <div className="w-px h-3 bg-zinc-200" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline Action Form (inside the canvas block when selected)
// ─────────────────────────────────────────────────────────────────────────────

function InlineActionForm({
  step,
  onChange,
  pipelines,
}: {
  step: AutomationStep;
  onChange: (fn: (s: AutomationStep) => AutomationStep) => void;
  pipelines: Pipeline[];
}) {
  const actionType = step.action?.type ?? "create_activity";
  const config = step.action?.config ?? {};
  const whatsappTemplates = useWhatsAppTemplates();

  function setActionType(t: ActionType) {
    onChange((s) => ({ ...s, action: { type: t, config: defaultConfig(t) } }));
  }

  function patchConfig(patch: Record<string, string | number | boolean>) {
    onChange((s) => ({
      ...s,
      action: {
        type: s.action?.type ?? "create_activity",
        config: { ...(s.action?.config ?? {}), ...patch },
      },
    }));
  }

  const selectedPipeline = pipelines.find((p) => p.id === config.pipelineId);

  return (
    <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>

      {/* TIPO DE AÇÃO */}
      <Field label="Tipo de ação">
        <Select value={actionType} onChange={(v) => setActionType(v as ActionType)}>
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>{ACTION_LABELS[t]}</option>
          ))}
        </Select>
      </Field>

      <div className="border-t border-zinc-100 pt-3 space-y-3">

        {/* ── Criar novo negócio ── */}
        {actionType === "create_deal" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Pipeline destino">
                <Select
                  value={(config.pipelineId as string) ?? ""}
                  onChange={(v) => patchConfig({ pipelineId: v, stageId: "" })}
                >
                  <option value="">Selecionar pipeline...</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Etapa destino">
                <Select
                  value={(config.stageId as string) ?? ""}
                  onChange={(v) => patchConfig({ stageId: v })}
                >
                  <option value="">Selecionar etapa...</option>
                  {(selectedPipeline?.stages ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Título do negócio">
              <input
                value={(config.title as string) ?? ""}
                onChange={(e) => patchConfig({ title: e.target.value })}
                placeholder="[OPP] - {contact.name}"
                className="w-full px-3 py-2 text-[13px] border border-zinc-200 rounded-lg outline-none focus:border-amber-400"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Use {"{contact.name}"} para o nome do contato e {"{deal.title}"} para o título original.
              </p>
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={!!config.copyAll}
                onChange={(e) => patchConfig({ copyAll: e.target.checked })}
                className="w-4 h-4 rounded accent-amber-500"
              />
              Copiar contato, empresa, valor e campos personalizados do negócio original
            </label>
            <OwnerModeField
              label="Proprietário do novo negócio"
              mode={(config.ownerMode as string) ?? "keep"}
              userId={(config.userId as string) ?? ""}
              roundRobinIds={(config.roundRobinIds as string) ?? ""}
              customFieldId={(config.customFieldId as string) ?? ""}
              showKeep
              onChange={(patch) => patchConfig(patch)}
            />
          </>
        )}

        {/* ── Criar atividade ── */}
        {actionType === "create_activity" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tipo">
                <Select
                  value={(config.activityType as string) ?? "Ligação"}
                  onChange={(v) => patchConfig({ activityType: v })}
                >
                  {["Ligação", "Email", "Reunião", "Tarefa", "WhatsApp"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Prazo (dias)">
                <input
                  type="number"
                  min={0}
                  value={(config.deadline as number) ?? 1}
                  onChange={(e) => patchConfig({ deadline: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-[13px] border border-zinc-200 rounded-lg outline-none focus:border-amber-400"
                />
              </Field>
            </div>
            <Field label="Título">
              <input
                value={(config.title as string) ?? ""}
                onChange={(e) => patchConfig({ title: e.target.value })}
                placeholder="Ex: Ligar para o cliente"
                className="w-full px-3 py-2 text-[13px] border border-zinc-200 rounded-lg outline-none focus:border-amber-400"
              />
            </Field>
            <Field label="Observações (opcional)">
              <textarea
                value={(config.notes as string) ?? ""}
                onChange={(e) => patchConfig({ notes: e.target.value })}
                placeholder="Observações da atividade..."
                rows={3}
                className="w-full px-3 py-2 text-[13px] border border-zinc-200 rounded-lg outline-none focus:border-amber-400 resize-none"
              />
            </Field>
          </>
        )}

        {/* ── Mover para etapa ── */}
        {actionType === "move_stage" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Pipeline">
              <Select
                value={(config.pipelineId as string) ?? ""}
                onChange={(v) => patchConfig({ pipelineId: v, stageId: "" })}
              >
                <option value="">Selecionar pipeline...</option>
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Etapa">
              <Select
                value={(config.stageId as string) ?? ""}
                onChange={(v) => patchConfig({ stageId: v })}
              >
                <option value="">Selecionar etapa...</option>
                {(selectedPipeline?.stages ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
        )}

        {/* ── Atribuir responsável ── */}
        {actionType === "assign_owner" && (
          <OwnerModeField
            label="Responsável"
            mode={(config.ownerMode as string) ?? "fixed"}
            userId={(config.userId as string) ?? ""}
            roundRobinIds={(config.roundRobinIds as string) ?? ""}
            customFieldId={(config.customFieldId as string) ?? ""}
            showKeep={false}
            onChange={(patch) => patchConfig(patch)}
          />
        )}

        {/* ── Marcar como ganho ── */}
        {actionType === "mark_won" && (
          <div className="flex items-center gap-2 text-[13px] text-zinc-500">
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
            Nenhuma configuração adicional necessária.
          </div>
        )}

        {/* ── Marcar como perdido ── */}
        {actionType === "mark_lost" && (
          <Field label="Motivo da perda (opcional)">
            <input
              value={(config.lossReason as string) ?? ""}
              onChange={(e) => patchConfig({ lossReason: e.target.value })}
              placeholder="Ex: Preço, Concorrência..."
              className="w-full px-3 py-2 text-[13px] border border-zinc-200 rounded-lg outline-none focus:border-amber-400"
            />
          </Field>
        )}

        {/* ── Adicionar etiqueta ── */}
        {actionType === "add_label" && (
          <Field label="Etiqueta">
            <input
              value={(config.labelName as string) ?? ""}
              onChange={(e) => patchConfig({ labelName: e.target.value })}
              placeholder="Nome da etiqueta..."
              className="w-full px-3 py-2 text-[13px] border border-zinc-200 rounded-lg outline-none focus:border-amber-400"
            />
          </Field>
        )}

        {/* ── Duplicar negócio ── */}
        {actionType === "duplicate_deal" && (
          <OwnerModeField
            label="Proprietário do novo negócio"
            mode={(config.ownerMode as string) ?? "keep"}
            userId={(config.userId as string) ?? ""}
            roundRobinIds={(config.roundRobinIds as string) ?? ""}
            customFieldId={(config.customFieldId as string) ?? ""}
            showKeep
            onChange={(patch) => patchConfig(patch)}
          />
        )}

        {/* ── Criar nota ── */}
        {actionType === "create_note" && (
          <Field label="Conteúdo da nota">
            <textarea
              value={(config.content as string) ?? ""}
              onChange={(e) => patchConfig({ content: e.target.value })}
              placeholder="Texto da nota automática..."
              rows={4}
              className="w-full px-3 py-2 text-[13px] border border-zinc-200 rounded-lg outline-none focus:border-amber-400 resize-none"
            />
          </Field>
        )}

        {/* ── Enviar webhook ── */}
        {actionType === "send_webhook" && (
          <>
            <Field label="URL do webhook">
              <input
                value={(config.url as string) ?? ""}
                onChange={(e) => patchConfig({ url: e.target.value })}
                placeholder="https://seu-endpoint.com/webhook"
                className="w-full px-3 py-2 text-[13px] border border-zinc-200 rounded-lg outline-none focus:border-amber-400"
              />
            </Field>
            <p className="text-[12px] text-zinc-400">Será enviado um POST com os dados do evento.</p>
          </>
        )}

        {/* ── Enviar email ── */}
        {actionType === "send_email" && (
          <>
            <Field label="Template de email">
              <Select
                value={(config.templateId as string) ?? ""}
                onChange={(v) => patchConfig({ templateId: v })}
              >
                <option value="">Selecionar template...</option>
              </Select>
            </Field>
            <p className="text-[11px] text-zinc-400">
              O email será enviado via Gmail do vendedor responsável pelo negócio. Variáveis como {"{contact_name}"} serão substituídas automaticamente.
            </p>
          </>
        )}

        {/* ── Enviar WhatsApp ── */}
        {actionType === "send_whatsapp" && (
          <>
            <Field label="Template WhatsApp">
              <Select
                value={(config.templateId as string) ?? ""}
                onChange={(v) => patchConfig({ templateId: v })}
              >
                <option value="">Selecionar template...</option>
                {whatsappTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
            {whatsappTemplates.length === 0 && (
              <p className="text-[11px] text-amber-600">
                Nenhum template salvo. Crie um em Configurações &gt; Templates WhatsApp.
              </p>
            )}
            <p className="text-[11px] text-zinc-400">
              A mensagem sai pelo número WhatsApp conectado do workspace. Variáveis como {"{{nome_contato}}"} são substituídas na hora do envio.
            </p>
          </>
        )}

        {/* ── Iniciar sequência ── */}
        {actionType === "start_sequence" && (
          <>
            <Field label="Sequência">
              <Select
                value={(config.sequenceId as string) ?? ""}
                onChange={(v) => patchConfig({ sequenceId: v })}
              >
                <option value="">Selecionar sequência...</option>
              </Select>
            </Field>
            <p className="text-[11px] text-zinc-400">
              Todas as atividades da sequência serão criadas automaticamente para o negócio.
            </p>
          </>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner Mode Field (shared by create_deal, assign_owner, duplicate_deal)
// ─────────────────────────────────────────────────────────────────────────────

function OwnerModeField({
  label,
  mode,
  userId,
  roundRobinIds,
  customFieldId,
  showKeep,
  onChange,
}: {
  label: string;
  mode: string;
  userId: string;
  roundRobinIds: string;
  customFieldId: string;
  showKeep: boolean;
  onChange: (patch: Record<string, string | number | boolean>) => void;
}) {
  const teamUsers = useTeamUsers();
  const customFields = useDealCustomFields();
  const tabOptions = [
    ...(showKeep ? [{ id: "keep", label: "Manter original" }] : []),
    { id: "fixed", label: "Valor fixo" },
    { id: "round_robin", label: "Rodízio" },
    { id: "custom_field", label: "Campo personalizado" },
  ];

  // Parse roundRobinIds as comma-separated string of user ids
  const selectedRrIds = roundRobinIds ? roundRobinIds.split(",").filter(Boolean) : [];

  function toggleRrUser(uid: string) {
    const next = selectedRrIds.includes(uid)
      ? selectedRrIds.filter((id) => id !== uid)
      : [...selectedRrIds, uid];
    onChange({ roundRobinIds: next.join(",") });
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
      <div className="flex gap-1.5 flex-wrap">
        {tabOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange({ ownerMode: opt.id })}
            className={cn(
              "text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors",
              mode === opt.id
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "fixed" && (
        <Select value={userId} onChange={(v) => onChange({ userId: v })}>
          <option value="">Selecionar usuário...</option>
          {teamUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      )}

      {mode === "round_robin" && (
        <div className="space-y-1.5">
          <p className="text-[12px] text-zinc-500">Selecione os membros que participarão do rodízio:</p>
          <div className="border border-zinc-200 rounded-lg overflow-hidden">
            {teamUsers.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-zinc-50"
              >
                <input
                  type="checkbox"
                  checked={selectedRrIds.includes(u.id)}
                  onChange={() => toggleRrUser(u.id)}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span className="text-[13px] text-zinc-800">{u.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {mode === "custom_field" && (
        <Select value={customFieldId} onChange={(v) => onChange({ customFieldId: v })}>
          <option value="">Selecionar campo personalizado...</option>
          {customFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Select>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right panel: Trigger
// ─────────────────────────────────────────────────────────────────────────────

function TriggerPanel({ value, onChange }: { value: TriggerType | null; onChange: (t: TriggerType) => void }) {
  return (
    <div className="p-5">
      <h3 className="text-[13px] font-bold text-zinc-900 mb-1">Configurar Gatilho</h3>
      <p className="text-[12px] text-zinc-400 mb-4">Selecione o evento que vai disparar esta automação.</p>
      <div className="space-y-0.5">
        {TRIGGER_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg border transition-colors",
              value === t ? "border-amber-400 bg-amber-50" : "border-transparent hover:bg-zinc-50"
            )}
          >
            <p className="text-[13px] font-semibold text-zinc-900">{TRIGGER_LABELS[t]}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">{TRIGGER_DESCRIPTIONS[t]}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right panel: Action Type Picker
// ─────────────────────────────────────────────────────────────────────────────

function ActionTypePanel({ value, onChange }: { value: ActionType; onChange: (t: ActionType) => void }) {
  return (
    <div className="p-5">
      <h3 className="text-[13px] font-bold text-zinc-900 mb-1">Configurar Ação</h3>
      <div className="space-y-0.5 mt-3">
        {ACTION_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg transition-colors",
              value === t ? "bg-amber-50 border border-amber-200 text-amber-800" : "hover:bg-zinc-50 text-zinc-700"
            )}
          >
            <p className="text-[13px] font-semibold">{ACTION_LABELS[t]}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right panel: Condition
// ─────────────────────────────────────────────────────────────────────────────

function ConditionPanel({ step, onChange, pipelines }: {
  step: AutomationStep;
  onChange: (fn: (s: AutomationStep) => AutomationStep) => void;
  pipelines: Pipeline[];
}) {
  const rules = step.condition?.rules ?? [];

  // Collect all stages across all pipelines for "stage" field
  const allStages = pipelines.flatMap((p) => p.stages.map((s) => ({ ...s, pipelineName: p.name })));

  function updateRule(idx: number, patch: Partial<AutomationConditionRule>) {
    onChange((s) => ({
      ...s,
      condition: { rules: (s.condition?.rules ?? []).map((r, i) => i === idx ? { ...r, ...patch } : r) },
    }));
  }

  function addRule() {
    onChange((s) => ({
      ...s,
      condition: { rules: [...(s.condition?.rules ?? []), { field: "pipeline", operator: "is", value: "" }] },
    }));
  }

  function removeRule(idx: number) {
    onChange((s) => ({
      ...s,
      condition: { rules: (s.condition?.rules ?? []).filter((_, i) => i !== idx) },
    }));
  }

  function renderValueInput(rule: AutomationConditionRule, idx: number) {
    if (rule.field === "pipeline") {
      return (
        <Select value={rule.value} onChange={(v) => updateRule(idx, { value: v })}>
          <option value="">Selecionar funil...</option>
          {pipelines.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </Select>
      );
    }
    if (rule.field === "stage") {
      return (
        <Select value={rule.value} onChange={(v) => updateRule(idx, { value: v })}>
          <option value="">Selecionar etapa...</option>
          {allStages.map((s) => (
            <option key={s.id} value={s.name}>{s.name} ({s.pipelineName})</option>
          ))}
        </Select>
      );
    }
    if (rule.field === "status") {
      return (
        <Select value={rule.value} onChange={(v) => updateRule(idx, { value: v })}>
          <option value="">Selecionar status...</option>
          <option value="Ativo">Ativo</option>
          <option value="Ganho">Ganho</option>
          <option value="Perdido">Perdido</option>
        </Select>
      );
    }
    return (
      <input
        value={rule.value}
        onChange={(e) => updateRule(idx, { value: e.target.value })}
        placeholder="Valor..."
        className="w-full px-3 py-2 text-[13px] border border-zinc-200 rounded-lg outline-none focus:border-blue-400"
      />
    );
  }

  return (
    <div className="p-5">
      <h3 className="text-[13px] font-bold text-zinc-900 mb-1">Condição</h3>
      <p className="text-[12px] text-zinc-400 mb-4">A automação só continua se estas condições forem verdadeiras.</p>
      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <div key={idx}>
            {idx > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-zinc-100" />
                <span className="text-[11px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">AND</span>
                <div className="flex-1 h-px bg-zinc-100" />
              </div>
            )}
            <div className="flex items-start gap-1.5">
              <div className="flex-1 space-y-1.5">
                <Select
                  value={rule.field}
                  onChange={(v) => updateRule(idx, { field: v as AutomationConditionField, value: "" })}
                >
                  <option value="">Campo...</option>
                  {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{CONDITION_FIELD_LABELS[f]}</option>)}
                </Select>
                <Select value={rule.operator} onChange={(v) => updateRule(idx, { operator: v as AutomationConditionOperator })}>
                  {CONDITION_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                </Select>
                {renderValueInput(rule, idx)}
              </div>
              {rules.length > 1 && (
                <button onClick={() => removeRule(idx)} className="mt-1 p-1.5 rounded text-zinc-300 hover:text-red-500 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button onClick={addRule} className="mt-3 text-[12px] font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
        <Plus className="h-3.5 w-3.5" /> Adicionar regra
      </button>
      <div className="flex justify-center mt-3">
        <button onClick={addRule} className="text-[12px] font-bold text-zinc-400 hover:text-zinc-600 border border-zinc-200 rounded-full px-4 py-1 hover:border-zinc-300 transition-colors">
          + AND
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right panel: Next Step
// ─────────────────────────────────────────────────────────────────────────────

function NextStepPanel({ onAddCondition, onAddAction }: {
  onAddCondition: (e: React.MouseEvent) => void;
  onAddAction: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="p-5">
      <h3 className="text-[13px] font-bold text-zinc-950 mb-1">Próximo passo</h3>
      <p className="text-[12px] text-zinc-400 mb-4">Adicione uma condição ou ação ao fluxo.</p>
      <div className="space-y-2">
        <button
          onClick={onAddCondition}
          className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-500">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-zinc-950">Condição</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Continuar apenas se as condições forem atendidas</p>
          </div>
        </button>
        <button
          onClick={onAddAction}
          className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 hover:border-amber-300 hover:bg-[#FFF9EC]/50 transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-[#FFF9EC] border border-amber-100 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#F1A80A]">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-zinc-950">Ação</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Executar uma ação no negócio</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none px-3 py-2 pr-8 text-[13px] border border-zinc-200 rounded-lg outline-none focus:border-amber-400 bg-white cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">{label}</p>
      {children}
    </div>
  );
}
