"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Plus,
  ChevronDown,
  X,
  Tag,
  Settings,
  CheckCircle2,
  ChevronRight,
  Zap,
} from "lucide-react";
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
import { useWorkspace } from "@/lib/workspace";
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
  const { workspaceId } = useWorkspace();
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const selfName =
        (user.user_metadata?.full_name as string | undefined) ||
        user.email ||
        "Você";
      const list: AssignableUser[] = [{ id: user.id, name: selfName }];
      const { data } = await supabase
        .from("workspace_members")
        .select("member_user_id, name, email")
        .eq("workspace_id", workspaceId)
        .eq("status", "accepted");
      (data ?? []).forEach((m) => {
        if (m.member_user_id && m.member_user_id !== user.id) {
          list.push({ id: m.member_user_id, name: m.name || m.email });
        }
      });
      if (!cancelled) setUsers(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);
  return users;
}

function useWhatsAppTemplates(): { id: string; name: string }[] {
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const { workspaceId } = useWorkspace();
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("created_at");
      if (!cancelled) setTemplates(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);
  return templates;
}

function useDealCustomFields(): CustomFieldOption[] {
  const [fields, setFields] = useState<CustomFieldOption[]>([]);
  const { workspaceId } = useWorkspace();
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("custom_fields")
        .select("id, label, entity")
        .eq("workspace_id", workspaceId)
        .eq("entity", "deal")
        .order("sort_order", { ascending: true });
      if (!cancelled) {
        setFields((data ?? []).map((f) => ({ id: f.id, name: f.label })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);
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
  "lead_recebido",
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
  "stage",
  "pipeline",
  "status",
  "value",
  "owner",
  "label",
];

const CONDITION_OPERATORS: { value: AutomationConditionOperator; label: string }[] = [
  { value: "is", label: "é" },
  { value: "is_not", label: "não é" },
  { value: "contains", label: "contém" },
  { value: "greater_than", label: "maior que" },
  { value: "less_than", label: "menor que" },
];

function conditionSummary(step: AutomationStep): string {
  const rules = step.condition?.rules ?? [];
  if (!rules.length) return "Funil do negócio é ...";
  return rules
    .map((r) => {
      const field = CONDITION_FIELD_LABELS[r.field] ?? "Campo";
      const op = CONDITION_OPERATOR_LABELS[r.operator] ?? r.operator;
      return `${field} ${op} ${r.value || "..."}`;
    })
    .join(" AND ");
}

function defaultConfig(type: ActionType): Record<string, string | number | boolean> {
  switch (type) {
    case "create_deal":
      return {
        pipelineId: "",
        stageId: "",
        title: "[OPP] - {contact.name}",
        copyAll: true,
        ownerMode: "keep",
      };
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

export default function AutomationBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { automations, addAutomation, updateAutomation, automationLabels } =
    useAutomacoes();
  const { state: crmState } = useCrm();

  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isNew = rawId === "nova";
  const templateId = searchParams.get("template");

  const buildFresh = useCallback((): Automation => {
    const tpl = templateId
      ? AUTOMATION_TEMPLATES.find((t) => t.id === templateId)
      : null;
    return {
      id: isNew ? crypto.randomUUID() : rawId ?? crypto.randomUUID(),
      name: tpl ? tpl.name : "Nome da automação",
      description: "",
      trigger: tpl ? tpl.triggerKey : "deal_won",
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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        labelPickerRef.current &&
        !labelPickerRef.current.contains(e.target as Node)
      ) {
        setLabelPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateField = <K extends keyof Automation>(
    key: K,
    val: Automation[K]
  ) => setAutomation((p) => ({ ...p, [key]: val }));

  const updateStep = (
    id: string,
    fn: (s: AutomationStep) => AutomationStep
  ) =>
    setAutomation((p) => ({
      ...p,
      steps: p.steps.map((s) => (s.id === id ? fn(s) : s)),
    }));

  const deleteStep = (id: string) => {
    setAutomation((p) => ({ ...p, steps: p.steps.filter((s) => s.id !== id) }));
    setSelection(null);
  };

  function addConditionStep(atIndex?: number) {
    const step: AutomationStep = {
      id: crypto.randomUUID(),
      type: "condition",
      condition: {
        rules: [{ field: "pipeline", operator: "is", value: "" }],
      },
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
      action: {
        type: "create_deal",
        config: defaultConfig("create_deal"),
      },
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

  let actionIndex = 0;
  const selectedStep =
    selection?.kind === "step"
      ? automation.steps.find((s) => s.id === selection.stepId)
      : null;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
        {/* Top Header */}
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

          {/* Label Tag Button */}
          <div className="relative" ref={labelPickerRef}>
            <button
              onClick={() => setLabelPickerOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-1.5 bg-white hover:border-zinc-350 transition-colors cursor-pointer shadow-sm"
            >
              <Tag className="h-3.5 w-3.5 text-zinc-400" />
              {automation.labelIds.length > 0
                ? `${automation.labelIds.length} etiqueta${
                    automation.labelIds.length > 1 ? "s" : ""
                  }`
                : "+ Adicionar etiqueta"}
              <ChevronDown className="h-3.5 w-3.5 opacity-65" />
            </button>

            {labelPickerOpen && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden">
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
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: lbl.color }}
                        />
                        <span className="flex-1 text-[13px] font-medium text-zinc-800">
                          {lbl.name}
                        </span>
                        {automation.labelIds.includes(lbl.id) && (
                          <CheckCircle2 className="h-4 w-4 text-[#F1A80A]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div className="border-t border-zinc-100 flex items-center">
                  <button
                    onClick={() => {
                      setLabelPickerOpen(false);
                      router.push("/configuracoes/etiquetas-automacoes");
                    }}
                    className="flex-1 flex items-center gap-1 px-3 py-2.5 text-[12px] font-bold text-[#F1A80A] hover:bg-amber-50 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Nova etiqueta
                  </button>
                  <div className="w-px h-6 bg-zinc-100" />
                  <button
                    onClick={() => {
                      setLabelPickerOpen(false);
                      router.push("/configuracoes/etiquetas-automacoes");
                    }}
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
            className="px-5 py-2 rounded-lg text-[13px] font-bold transition-colors shrink-0 cursor-pointer shadow-sm bg-[#F1A80A] hover:bg-[#D79405] text-white"
          >
            {saved ? "Salvo!" : "Salvar"}
          </button>
        </div>

        {/* Builder Body: Canvas + Drawer */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas */}
          <div
            className="flex-1 overflow-y-auto p-8 flex flex-col items-center"
            onClick={() => setSelection(null)}
          >
            <div className="w-full max-w-lg space-y-0">
              {/* Trigger Block */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setSelection({ kind: "trigger" });
                }}
                className={cn(
                  "relative rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md border-dashed border-2 px-5 py-4",
                  selection?.kind === "trigger"
                    ? "border-[#F1A80A] bg-[#FFF9EC]/40"
                    : "border-amber-300/80 bg-[#FFF9EC]/20"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#F1A80A] mb-1.5 flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 fill-[#F1A80A] text-[#F1A80A]" />
                      GATILHO
                    </div>
                    {automation.trigger ? (
                      <>
                        <p className="text-[14px] font-bold text-zinc-950">
                          {TRIGGER_LABELS[automation.trigger]}
                        </p>
                        <p className="text-[12px] text-zinc-400 mt-1 font-semibold">
                          {TRIGGER_DESCRIPTIONS[automation.trigger]}
                        </p>
                      </>
                    ) : (
                      <p className="text-[13px] text-zinc-400 font-semibold">
                        Selecionar gatilho...
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-400 ml-2 shrink-0" />
                </div>
              </div>

              {/* Steps */}
              {automation.steps.map((step, idx) => {
                const isSelected =
                  selection?.kind === "step" && selection.stepId === step.id;
                if (step.type === "action") actionIndex++;
                const curActionIdx = step.type === "action" ? actionIndex : 0;

                return (
                  <div key={step.id}>
                    {/* Connector */}
                    <div className="flex flex-col items-center py-0.5">
                      <div className="w-px h-3 bg-zinc-200" />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addConditionStep(idx);
                          }}
                          className="flex items-center gap-0.5 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100/60 border border-blue-150 px-2 py-0.5 rounded-full transition-colors shadow-sm cursor-pointer"
                        >
                          +SE
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addActionStep(idx);
                          }}
                          className="flex items-center gap-0.5 text-[10px] font-black text-[#F1A80A] bg-[#FFF9EC] hover:bg-[#FFF9EC]/80 border border-amber-150 px-2 py-0.5 rounded-full transition-colors shadow-sm cursor-pointer"
                        >
                          +AÇÃO
                        </button>
                      </div>
                      <div className="w-px h-3 bg-zinc-200" />
                    </div>

                    {/* Step Card */}
                    {step.type === "condition" ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelection({ kind: "step", stepId: step.id });
                        }}
                        className={cn(
                          "relative rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md border-2 px-5 py-4",
                          isSelected
                            ? "border-blue-400 bg-blue-50/20"
                            : "border-blue-200 bg-white"
                        )}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStep(step.id);
                          }}
                          className="absolute top-3.5 right-3.5 p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors z-10 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1.5 flex items-center gap-1">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="text-blue-500"
                          >
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                          </svg>
                          CONDICAO
                        </div>
                        <p className="text-[13px] text-zinc-800 font-semibold">
                          {conditionSummary(step)}
                        </p>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelection({ kind: "step", stepId: step.id });
                        }}
                        className={cn(
                          "relative rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md border-2 px-4 pt-4 pb-4",
                          isSelected
                            ? "border-[#F1A80A] bg-[#FFF9EC]/20"
                            : "border-2 border-zinc-200 bg-white"
                        )}
                      >
                        <span className="absolute -top-2.5 -left-2 w-[22px] h-[22px] rounded-md bg-[#F1A80A] text-white text-[11px] font-black flex items-center justify-center z-10 shadow-sm">
                          {curActionIdx}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStep(step.id);
                          }}
                          className="absolute top-3.5 right-3.5 p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors z-10 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="flex items-center gap-2 mb-3.5 pr-6">
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="text-[#F1A80A] shrink-0"
                          >
                            <polygon points="5 3 19 12 5 21" />
                          </svg>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#F1A80A]">
                            AÇÃO
                          </span>
                          <span className="text-[13px] font-medium text-zinc-400">
                            {step.action
                              ? ACTION_LABELS[step.action.type]
                              : "Criar novo negócio"}
                          </span>
                        </div>

                        {isSelected && (
                          <InlineActionForm
                            step={step}
                            onChange={(fn) => updateStep(step.id, fn)}
                            pipelines={crmState.pipelines}
                          />
                        )}
                      </div>
                    )}

                    {idx === automation.steps.length - 1 && (
                      <div className="flex flex-col items-center py-0.5">
                        <div className="w-px h-3 bg-zinc-200" />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addConditionStep();
                            }}
                            className="flex items-center gap-0.5 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100/60 border border-blue-150 px-2 py-0.5 rounded-full transition-colors shadow-sm cursor-pointer"
                          >
                            +SE
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addActionStep();
                            }}
                            className="flex items-center gap-0.5 text-[10px] font-black text-[#F1A80A] bg-[#FFF9EC] hover:bg-[#FFF9EC]/80 border border-amber-150 px-2 py-0.5 rounded-full transition-colors shadow-sm cursor-pointer"
                          >
                            +AÇÃO
                          </button>
                        </div>
                        <div className="w-px h-3 bg-zinc-200" />
                      </div>
                    )}
                  </div>
                );
              })}

              {automation.steps.length === 0 && (
                <div className="flex flex-col items-center py-0.5">
                  <div className="w-px h-3 bg-zinc-200" />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addConditionStep();
                      }}
                      className="flex items-center gap-0.5 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100/60 border border-blue-150 px-2 py-0.5 rounded-full transition-colors shadow-sm cursor-pointer"
                    >
                      +SE
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addActionStep();
                      }}
                      className="flex items-center gap-0.5 text-[10px] font-black text-[#F1A80A] bg-[#FFF9EC] hover:bg-[#FFF9EC]/80 border border-amber-150 px-2 py-0.5 rounded-full transition-colors shadow-sm cursor-pointer"
                    >
                      +AÇÃO
                    </button>
                  </div>
                  <div className="w-px h-3 bg-zinc-200" />
                </div>
              )}

              {/* End of Flow */}
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

          {/* Right Config Drawer Panel */}
          <div className="w-80 shrink-0 bg-zinc-50/50 border-l border-zinc-200 overflow-y-auto p-6">
            {selection?.kind === "trigger" && (
              <TriggerPanel
                value={automation.trigger}
                onChange={(t) => {
                  updateField("trigger", t);
                  setSelection(null);
                }}
              />
            )}

            {selection?.kind === "step" && selectedStep?.type === "condition" && (
              <ConditionPanel
                step={selectedStep}
                onDelete={() => deleteStep(selectedStep.id)}
                onChange={(fn) => updateStep(selectedStep.id, fn)}
                pipelines={crmState.pipelines}
              />
            )}

            {selection?.kind === "step" && selectedStep?.type === "action" && (
              <ActionTypePanel
                value={selectedStep.action?.type ?? "create_deal"}
                onChange={(t) =>
                  updateStep(selectedStep.id, (s) => ({
                    ...s,
                    action: { type: t, config: defaultConfig(t) },
                  }))
                }
              />
            )}

            {selection === null && (
              <NextStepPanel
                onAddCondition={(e) => {
                  e.stopPropagation();
                  addConditionStep();
                }}
                onAddAction={(e) => {
                  e.stopPropagation();
                  addActionStep();
                }}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline Action Form
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
  const actionType = step.action?.type ?? "create_deal";
  const config = step.action?.config ?? {};
  const whatsappTemplates = useWhatsAppTemplates();

  function setActionType(t: ActionType) {
    onChange((s) => ({ ...s, action: { type: t, config: defaultConfig(t) } }));
  }

  function patchConfig(patch: Record<string, string | number | boolean>) {
    onChange((s) => ({
      ...s,
      action: {
        type: s.action?.type ?? "create_deal",
        config: { ...(s.action?.config ?? {}), ...patch },
      },
    }));
  }

  const selectedPipeline = pipelines.find((p) => p.id === config.pipelineId);

  return (
    <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <Field label="Tipo de ação">
        <DropdownSelect
          value={actionType}
          label={ACTION_LABELS[actionType]}
          onChange={(v) => setActionType(v as ActionType)}
        >
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACTION_LABELS[t]}
            </option>
          ))}
        </DropdownSelect>
      </Field>

      <div className="border-t border-zinc-100 pt-3 space-y-3">
        {actionType === "create_deal" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Pipeline destino">
                <DropdownSelect
                  value={(config.pipelineId as string) ?? ""}
                  label={selectedPipeline?.name}
                  placeholder="Selecionar pipeline..."
                  onChange={(v) => patchConfig({ pipelineId: v, stageId: "" })}
                >
                  <option value="">Selecionar pipeline...</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </DropdownSelect>
              </Field>
              <Field label="Etapa destino">
                <DropdownSelect
                  value={(config.stageId as string) ?? ""}
                  label={
                    (selectedPipeline?.stages ?? []).find(
                      (s) => s.id === config.stageId
                    )?.name
                  }
                  placeholder="Selecionar etapa..."
                  onChange={(v) => patchConfig({ stageId: v })}
                >
                  <option value="">Selecionar etapa...</option>
                  {(selectedPipeline?.stages ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </DropdownSelect>
              </Field>
            </div>
            <Field label="Título do negócio">
              <input
                value={(config.title as string) ?? ""}
                onChange={(e) => patchConfig({ title: e.target.value })}
                placeholder="[OPP] - {contact.name}"
                className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-400 bg-white"
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
              Copiar contato, empresa, valor e campos personalizados
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

        {actionType === "create_activity" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tipo">
                <DropdownSelect
                  value={(config.activityType as string) ?? "Ligação"}
                  label={(config.activityType as string) ?? "Ligação"}
                  onChange={(v) => patchConfig({ activityType: v })}
                >
                  {["Ligação", "Email", "Reunião", "Tarefa", "WhatsApp"].map(
                    (t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    )
                  )}
                </DropdownSelect>
              </Field>
              <Field label="Prazo (dias)">
                <input
                  type="number"
                  min={0}
                  value={(config.deadline as number) ?? 1}
                  onChange={(e) =>
                    patchConfig({ deadline: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-400 bg-white"
                />
              </Field>
            </div>
            <Field label="Título">
              <input
                value={(config.title as string) ?? ""}
                onChange={(e) => patchConfig({ title: e.target.value })}
                placeholder="Ex: Ligar para o cliente"
                className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-400 bg-white"
              />
            </Field>
            <Field label="Observações (opcional)">
              <textarea
                value={(config.notes as string) ?? ""}
                onChange={(e) => patchConfig({ notes: e.target.value })}
                placeholder="Observações da atividade..."
                rows={3}
                className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-400 resize-none bg-white"
              />
            </Field>
          </>
        )}

        {actionType === "move_stage" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Pipeline">
              <DropdownSelect
                value={(config.pipelineId as string) ?? ""}
                label={selectedPipeline?.name}
                placeholder="Selecionar pipeline..."
                onChange={(v) => patchConfig({ pipelineId: v, stageId: "" })}
              >
                <option value="">Selecionar pipeline...</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </DropdownSelect>
            </Field>
            <Field label="Etapa">
              <DropdownSelect
                value={(config.stageId as string) ?? ""}
                label={
                  (selectedPipeline?.stages ?? []).find(
                    (s) => s.id === config.stageId
                  )?.name
                }
                placeholder="Selecionar etapa..."
                onChange={(v) => patchConfig({ stageId: v })}
              >
                <option value="">Selecionar etapa...</option>
                {(selectedPipeline?.stages ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </DropdownSelect>
            </Field>
          </div>
        )}

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

        {actionType === "mark_won" && (
          <div className="flex items-center gap-2 text-[13px] text-zinc-500">
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
            Nenhuma configuração adicional necessária.
          </div>
        )}

        {actionType === "mark_lost" && (
          <Field label="Motivo da perda (opcional)">
            <input
              value={(config.lossReason as string) ?? ""}
              onChange={(e) => patchConfig({ lossReason: e.target.value })}
              placeholder="Ex: Preço, Concorrência..."
              className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-400 bg-white"
            />
          </Field>
        )}

        {actionType === "add_label" && (
          <Field label="Etiqueta">
            <input
              value={(config.labelName as string) ?? ""}
              onChange={(e) => patchConfig({ labelName: e.target.value })}
              placeholder="Nome da etiqueta..."
              className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-400 bg-white"
            />
          </Field>
        )}

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

        {actionType === "create_note" && (
          <Field label="Conteúdo da nota">
            <textarea
              value={(config.content as string) ?? ""}
              onChange={(e) => patchConfig({ content: e.target.value })}
              placeholder="Texto da nota automática..."
              rows={4}
              className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-400 resize-none bg-white"
            />
          </Field>
        )}

        {actionType === "send_webhook" && (
          <>
            <Field label="URL do webhook">
              <input
                value={(config.url as string) ?? ""}
                onChange={(e) => patchConfig({ url: e.target.value })}
                placeholder="https://seu-endpoint.com/webhook"
                className="w-full px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-400 bg-white"
              />
            </Field>
            <p className="text-[12px] text-zinc-400">
              Será enviado um POST com os dados do evento.
            </p>
          </>
        )}

        {actionType === "send_email" && (
          <>
            <Field label="Template de email">
              <DropdownSelect
                value={(config.templateId as string) ?? ""}
                placeholder="Selecionar template..."
                onChange={(v) => patchConfig({ templateId: v })}
              >
                <option value="">Selecionar template...</option>
              </DropdownSelect>
            </Field>
            <p className="text-[11px] text-zinc-400">
              O email será enviado via Gmail do vendedor responsável pelo negócio.
            </p>
          </>
        )}

        {actionType === "send_whatsapp" && (
          <>
            <Field label="Template WhatsApp">
              <DropdownSelect
                value={(config.templateId as string) ?? ""}
                label={
                  whatsappTemplates.find((t) => t.id === config.templateId)?.name
                }
                placeholder="Selecionar template..."
                onChange={(v) => patchConfig({ templateId: v })}
              >
                <option value="">Selecionar template...</option>
                {whatsappTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </DropdownSelect>
            </Field>
            {whatsappTemplates.length === 0 && (
              <p className="text-[11px] text-amber-600">
                Nenhum template salvo. Crie um em Configurações &gt; Templates WhatsApp.
              </p>
            )}
          </>
        )}

        {actionType === "start_sequence" && (
          <Field label="Sequência">
            <DropdownSelect
              value={(config.sequenceId as string) ?? ""}
              placeholder="Selecionar sequência..."
              onChange={(v) => patchConfig({ sequenceId: v })}
            >
              <option value="">Selecionar sequência...</option>
            </DropdownSelect>
          </Field>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner Mode Field
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

  const selectedRrIds = roundRobinIds
    ? roundRobinIds.split(",").filter(Boolean)
    : [];

  function toggleRrUser(uid: string) {
    const next = selectedRrIds.includes(uid)
      ? selectedRrIds.filter((id) => id !== uid)
      : [...selectedRrIds, uid];
    onChange({ roundRobinIds: next.join(",") });
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <div className="flex gap-1.5 flex-wrap">
        {tabOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange({ ownerMode: opt.id })}
            className={cn(
              "text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer",
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
        <DropdownSelect
          value={userId}
          label={teamUsers.find((u) => u.id === userId)?.name}
          placeholder="Selecionar usuário..."
          onChange={(v) => onChange({ userId: v })}
        >
          <option value="">Selecionar usuário...</option>
          {teamUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </DropdownSelect>
      )}

      {mode === "round_robin" && (
        <div className="space-y-1.5">
          <p className="text-[12px] text-zinc-500">
            Selecione os membros que participarão do rodízio:
          </p>
          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
            {teamUsers.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
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
        <DropdownSelect
          value={customFieldId}
          label={customFields.find((f) => f.id === customFieldId)?.name}
          placeholder="Selecionar campo personalizado..."
          onChange={(v) => onChange({ customFieldId: v })}
        >
          <option value="">Selecionar campo personalizado...</option>
          {customFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </DropdownSelect>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right Drawer Panels
// ─────────────────────────────────────────────────────────────────────────────

function TriggerPanel({
  value,
  onChange,
}: {
  value: TriggerType | null;
  onChange: (t: TriggerType) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-700 mb-1">
        Configurar Gatilho
      </h3>
      <p className="text-xs text-zinc-400 mb-4">
        Selecione o evento que vai disparar esta automação.
      </p>
      <div className="space-y-1">
        {TRIGGER_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer",
              value === t
                ? "border-amber-400 bg-amber-50 shadow-xs"
                : "border-transparent hover:bg-white text-zinc-800"
            )}
          >
            <p className="text-[13px] font-semibold text-zinc-900">
              {TRIGGER_LABELS[t]}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {TRIGGER_DESCRIPTIONS[t]}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionTypePanel({
  value,
  onChange,
}: {
  value: ActionType;
  onChange: (t: ActionType) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-700 mb-1">
        Configurar Ação
      </h3>
      <p className="text-xs text-zinc-400 mb-4">
        Escolha o que deve acontecer quando o evento for disparado.
      </p>
      <div className="space-y-1">
        {ACTION_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer border",
              value === t
                ? "bg-amber-50 border-amber-300 text-amber-900 shadow-xs"
                : "hover:bg-white border-transparent text-zinc-700"
            )}
          >
            <p className="text-[13px] font-semibold">{ACTION_LABELS[t]}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConditionPanel({
  step,
  onDelete,
  onChange,
  pipelines,
}: {
  step: AutomationStep;
  onDelete: () => void;
  onChange: (fn: (s: AutomationStep) => AutomationStep) => void;
  pipelines: Pipeline[];
}) {
  const rules = step.condition?.rules ?? [];
  const allStages = pipelines.flatMap((p) =>
    p.stages.map((s) => ({ ...s, pipelineName: p.name }))
  );

  function updateRule(
    idx: number,
    patch: Partial<AutomationConditionRule>
  ) {
    onChange((s) => ({
      ...s,
      condition: {
        rules: (s.condition?.rules ?? []).map((r, i) =>
          i === idx ? { ...r, ...patch } : r
        ),
      },
    }));
  }

  function addRule() {
    onChange((s) => ({
      ...s,
      condition: {
        rules: [
          ...(s.condition?.rules ?? []),
          { field: "pipeline", operator: "is", value: "" },
        ],
      },
    }));
  }

  function removeRule(idx: number) {
    onChange((s) => ({
      ...s,
      condition: {
        rules: (s.condition?.rules ?? []).filter((_, i) => i !== idx),
      },
    }));
  }

  function getFieldLabel(field: AutomationConditionField) {
    return CONDITION_FIELD_LABELS[field] || "Campo...";
  }

  function getOperatorLabel(op: AutomationConditionOperator) {
    return CONDITION_OPERATORS.find((o) => o.value === op)?.label || "é";
  }

  function getValueLabel(rule: AutomationConditionRule) {
    if (rule.field === "pipeline") {
      return (
        pipelines.find((p) => p.name === rule.value || p.id === rule.value)
          ?.name || rule.value || "Selecionar funil..."
      );
    }
    if (rule.field === "stage") {
      return (
        allStages.find((s) => s.name === rule.value || s.id === rule.value)
          ?.name || rule.value || "Selecionar etapa..."
      );
    }
    if (rule.field === "status") {
      return rule.value || "Selecionar status...";
    }
    return rule.value;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-700 mb-1">Condicao</h3>
      <p className="text-xs text-zinc-400 mb-4">
        A automacao so continua se estas condicoes forem verdadeiras.
      </p>

      <div className="space-y-3">
        {/* Card of conditions */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
          <div>
            {rules.map((rule, idx) => (
              <div key={idx}>
                {idx > 0 && (
                  <div className="flex items-center justify-center my-2">
                    <button
                      type="button"
                      className="rounded-full bg-zinc-200 px-3 py-0.5 text-[10px] font-bold text-zinc-600 hover:bg-zinc-300 transition-colors"
                    >
                      AND
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {/* Field selector */}
                  <DropdownSelect
                    value={rule.field}
                    label={getFieldLabel(rule.field)}
                    placeholder="Campo..."
                    onChange={(v) =>
                      updateRule(idx, {
                        field: v as AutomationConditionField,
                        value: "",
                      })
                    }
                  >
                    <option value="">Campo...</option>
                    {CONDITION_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {CONDITION_FIELD_LABELS[f]}
                      </option>
                    ))}
                  </DropdownSelect>

                  {/* Operator row + delete button */}
                  <div className="flex items-center gap-2">
                    <DropdownSelect
                      value={rule.operator}
                      label={getOperatorLabel(rule.operator)}
                      onChange={(v) =>
                        updateRule(idx, {
                          operator: v as AutomationConditionOperator,
                        })
                      }
                    >
                      {CONDITION_OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </DropdownSelect>

                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="shrink-0 text-zinc-300 hover:text-red-400 transition-colors p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Value field */}
                  <div>
                    {rule.field === "pipeline" ? (
                      <DropdownSelect
                        value={rule.value}
                        label={getValueLabel(rule)}
                        placeholder="Selecionar funil..."
                        onChange={(v) => updateRule(idx, { value: v })}
                      >
                        <option value="">Selecionar funil...</option>
                        {pipelines.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </DropdownSelect>
                    ) : rule.field === "stage" ? (
                      <DropdownSelect
                        value={rule.value}
                        label={getValueLabel(rule)}
                        placeholder="Selecionar etapa..."
                        onChange={(v) => updateRule(idx, { value: v })}
                      >
                        <option value="">Selecionar etapa...</option>
                        {allStages.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name} ({s.pipelineName})
                          </option>
                        ))}
                      </DropdownSelect>
                    ) : rule.field === "status" ? (
                      <DropdownSelect
                        value={rule.value}
                        label={getValueLabel(rule)}
                        placeholder="Selecionar status..."
                        onChange={(v) => updateRule(idx, { value: v })}
                      >
                        <option value="">Selecionar status...</option>
                        <option value="Ativo">Ativo</option>
                        <option value="Ganho">Ganho</option>
                        <option value="Perdido">Perdido</option>
                      </DropdownSelect>
                    ) : (
                      <input
                        placeholder="Valor..."
                        value={rule.value}
                        onChange={(e) => updateRule(idx, { value: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-amber-400 text-zinc-800"
                        type="text"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add rule & delete group card */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={addRule}
              className="text-xs text-amber-500 hover:text-amber-600 font-medium cursor-pointer"
            >
              + Adicionar regra
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-500 p-1 cursor-pointer"
              title="Excluir condição"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Add Group button (+ AND) */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={addRule}
            className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-bold text-zinc-500 hover:bg-amber-100 hover:text-amber-600 transition-colors cursor-pointer"
          >
            + AND
          </button>
        </div>
      </div>
    </div>
  );
}

function NextStepPanel({
  onAddCondition,
  onAddAction,
}: {
  onAddCondition: (e: React.MouseEvent) => void;
  onAddAction: (e: React.MouseEvent) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-700 mb-1">Próximo passo</h3>
      <p className="text-xs text-zinc-400 mb-4">
        Adicione uma condição ou ação ao fluxo.
      </p>
      <div className="space-y-2">
        <button
          onClick={onAddCondition}
          className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer shadow-xs"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-blue-500"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-zinc-950">Condição</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Continuar apenas se as condições forem atendidas
            </p>
          </div>
        </button>
        <button
          onClick={onAddAction}
          className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 bg-white hover:border-amber-300 hover:bg-[#FFF9EC]/50 transition-colors cursor-pointer shadow-xs"
        >
          <div className="w-8 h-8 rounded-lg bg-[#FFF9EC] border border-amber-100 flex items-center justify-center shrink-0">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-[#F1A80A]"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-zinc-950">Ação</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Executar uma ação no negócio
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared DropdownSelect & Field
// ─────────────────────────────────────────────────────────────────────────────

function DropdownSelect({
  value,
  label,
  placeholder,
  onChange,
  children,
}: {
  value: string;
  label?: string;
  placeholder?: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
      >
        {children}
      </select>
      <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0 w-full">
        <span
          className={cn(
            "min-w-0 truncate flex-1 text-left",
            label ? "text-zinc-800 font-medium" : "text-zinc-400"
          )}
        >
          {label || placeholder || "Selecionar..."}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}
