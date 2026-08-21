"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  X,
  Tag,
  Settings,
  CheckCircle2,
  Zap,
  Play,
  Check,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAutomacoes,
  TRIGGER_LABELS,
  TRIGGER_DESCRIPTIONS,
  CONDITION_FIELD_LABELS,
  CONDITION_OPERATOR_LABELS,
  ACTION_LABELS,
  ACTION_DESCRIPTIONS,
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

// Funnel Icon matching user SVG
function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("lucide lucide-funnel", className)}
      aria-hidden="true"
    >
      <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
    </svg>
  );
}

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

function useEmailTemplates(): { id: string; name: string }[] {
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
        .from("email_templates")
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
  "deal_updated_any",
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
  "notify_whatsapp_group",
  "start_sequence",
];

const CONDITION_FIELDS: AutomationConditionField[] = [
  "stage",
  "pipeline",
  "status",
  "value",
  "owner",
  "label",
  "title",
];

const CONDITION_OPERATORS: { value: AutomationConditionOperator; label: string }[] = [
  { value: "is", label: "é" },
  { value: "is_not", label: "não é" },
  { value: "contains", label: "contém" },
  { value: "not_contains", label: "não contém" },
  { value: "changed_to", label: "mudou para" },
  { value: "is_empty", label: "está vazio" },
  { value: "is_not_empty", label: "não está vazio" },
  { value: "greater_than", label: "maior que" },
  { value: "less_than", label: "menor que" },
];

function defaultConfig(type: ActionType): Record<string, string | number | boolean> {
  switch (type) {
    case "create_deal":
      return {
        pipelineId: "",
        stageId: "",
        title: "[OPP] - {contact.name}",
        copyAll: true,
        copyNotes: false,
        ownerMode: "round_robin",
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
      return { copyNotes: false, ownerMode: "keep" };
    case "create_note":
      return { content: "" };
    case "send_webhook":
      return { url: "" };
    case "send_email":
      return { templateId: "" };
    case "send_whatsapp":
      return { templateId: "" };
    case "notify_whatsapp_group":
      return { groupName: "", message: "Novo lead recebido: {deal.title}" };
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
      name: tpl ? tpl.name : "",
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
    const groupId = crypto.randomUUID();
    const step: AutomationStep = {
      id: crypto.randomUUID(),
      type: "condition",
      condition: {
        rules: [{ field: "pipeline", operator: "is", value: "", logic: "AND", groupId }],
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
        type: "create_activity",
        config: defaultConfig("create_activity"),
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
    <div className="flex h-full bg-white">
      {/* Canvas Area */}
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <Link
            className="mt-1 text-zinc-400 hover:text-zinc-600 transition-colors"
            href="/automacoes"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <input
              placeholder="Nome da automação"
              className="w-full text-xl font-semibold text-zinc-900 placeholder-zinc-300 outline-none border-b border-transparent focus:border-amber-300 pb-1 bg-transparent"
              type="text"
              value={automation.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
            <input
              placeholder="Descrição opcional"
              className="w-full mt-1 text-sm text-zinc-500 placeholder-zinc-300 outline-none border-b border-transparent focus:border-amber-200 pb-0.5 bg-transparent"
              type="text"
              value={automation.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
            <div className="mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-3.5 w-3.5 text-zinc-400" />
                {automation.labelIds.map((lid) => {
                  const lbl = automationLabels.find((l) => l.id === lid);
                  if (!lbl) return null;
                  return (
                    <span
                      key={lid}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-zinc-700 bg-zinc-100 border border-zinc-200"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: lbl.color }}
                      />
                      {lbl.name}
                      <button
                        type="button"
                        onClick={() => toggleLabel(lid)}
                        className="text-zinc-400 hover:text-red-500 transition-colors ml-0.5 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                <div className="relative" ref={labelPickerRef}>
                  <button
                    type="button"
                    onClick={() => setLabelPickerOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 hover:border-amber-400 hover:text-amber-600 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar etiqueta
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform",
                        labelPickerOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {labelPickerOpen && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      {automationLabels.length === 0 ? (
                        <p className="text-[12px] text-zinc-400 text-center py-4 px-3">
                          Nenhuma etiqueta criada ainda.
                        </p>
                      ) : (
                        <div className="py-1 max-h-48 overflow-y-auto">
                          {automationLabels.map((lbl) => (
                            <button
                              key={lbl.id}
                              type="button"
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
                                <CheckCircle2 className="h-4 w-4 text-amber-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="border-t border-zinc-100 flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setLabelPickerOpen(false);
                            router.push("/configuracoes/etiquetas-automacoes");
                          }}
                          className="flex-1 flex items-center gap-1 px-3 py-2 text-[12px] font-bold text-amber-600 hover:bg-amber-50 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" /> Nova etiqueta
                        </button>
                        <div className="w-px h-6 bg-zinc-100" />
                        <button
                          type="button"
                          onClick={() => {
                            setLabelPickerOpen(false);
                            router.push("/configuracoes/etiquetas-automacoes");
                          }}
                          className="px-3 py-2 text-[12px] font-bold text-zinc-500 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
                        >
                          <Settings className="h-3.5 w-3.5" /> Gerenciar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
          >
            {saved ? "Salvo!" : "Salvar"}
          </button>
        </div>

        {/* Canvas Steps */}
        <div className="space-y-0">
          {/* Trigger Card */}
          <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/30 p-4 relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                <Zap className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Gatilho
              </span>
            </div>
            {!automation.trigger ? (
              <button
                type="button"
                onClick={() => setSelection({ kind: "trigger" })}
                className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-amber-200 py-4 text-sm text-amber-500 hover:border-amber-300 hover:text-amber-600 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Selecionar gatilho
              </button>
            ) : (
              <div
                onClick={() => setSelection({ kind: "trigger" })}
                className="flex items-center gap-3 rounded-lg bg-white border border-amber-200 p-3 cursor-pointer hover:border-amber-300 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-800">
                    {TRIGGER_LABELS[automation.trigger]}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {TRIGGER_DESCRIPTIONS[automation.trigger]}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-300" />
              </div>
            )}
          </div>

          {/* Trigger Connector */}
          <div className="flex flex-col items-center py-2">
            <div className="w-0.5 h-6 bg-zinc-200"></div>
            <div className="h-2 w-2 rounded-full bg-zinc-300"></div>
          </div>

          {/* Steps List */}
          <div className="space-y-0">
            {automation.steps.map((step, idx) => {
              const isSelected =
                selection?.kind === "step" && selection.stepId === step.id;
              if (step.type === "action") actionIndex++;
              const curActionIdx = step.type === "action" ? actionIndex : 0;

              return (
                <div key={step.id}>
                  {/* Step Inserter Buttons */}
                  <div className="flex flex-col items-center py-1">
                    <div className="w-0.5 h-4 bg-zinc-200"></div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => addConditionStep(idx)}
                        className="h-5 px-2 rounded-full bg-blue-50 border border-blue-200 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition-colors text-[9px] font-bold cursor-pointer"
                        title="Inserir condição"
                      >
                        +SE
                      </button>
                      <button
                        type="button"
                        onClick={() => addActionStep(idx)}
                        className="h-5 px-2 rounded-full bg-amber-50 border border-amber-200 text-amber-400 hover:bg-amber-100 hover:text-amber-600 transition-colors text-[9px] font-bold cursor-pointer"
                        title="Inserir ação"
                      >
                        +AÇÃO
                      </button>
                    </div>
                    <div className="w-0.5 h-4 bg-zinc-200"></div>
                  </div>

                  {/* Step Body */}
                  {step.type === "condition" ? (
                    <div
                      onClick={() =>
                        setSelection({ kind: "step", stepId: step.id })
                      }
                      className={cn(
                        "rounded-xl border-2 p-4 cursor-pointer transition-colors bg-white",
                        isSelected
                          ? "border-blue-500 shadow-xs"
                          : "border-zinc-200 hover:border-zinc-300"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100">
                          <FunnelIcon className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                          Condicao
                        </span>
                        <div className="flex-1"></div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStep(step.id);
                          }}
                          className="text-zinc-300 hover:text-red-400 transition-colors p-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">
                          {(step.condition?.rules ?? []).length === 0 ? (
                            <span>
                              <span className="font-medium">???</span> é{" "}
                              <span className="font-medium"></span>
                            </span>
                          ) : (
                            <span>
                              {(step.condition?.rules ?? []).map((r, rIdx) => {
                                const fLabel =
                                  CONDITION_FIELD_LABELS[r.field] || "???";
                                const oLabel =
                                  CONDITION_OPERATOR_LABELS[r.operator] || "é";
                                const vLabel = r.value || "";
                                const logicLabel = r.logic || "AND";
                                return (
                                  <span key={rIdx}>
                                    {rIdx > 0 && (
                                      <span className="font-bold text-zinc-900 mx-1.5">
                                        {logicLabel}
                                      </span>
                                    )}
                                    <span>
                                      <span className="font-medium">
                                        {fLabel}
                                      </span>{" "}
                                      {oLabel}{" "}
                                      <span className="font-medium">
                                        {vLabel}
                                      </span>
                                    </span>
                                  </span>
                                );
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() =>
                        setSelection({ kind: "step", stepId: step.id })
                      }
                      className="relative"
                    >
                      <div className="rounded-xl bg-white border border-zinc-200 shadow-xs">
                        <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50/50 rounded-t-xl">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 shrink-0">
                            {curActionIdx}
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <Play className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                            <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                              Ação
                            </span>
                            <span className="text-xs text-zinc-400">
                              {step.action
                                ? ACTION_LABELS[step.action.type]
                                : "Criar novo negócio"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteStep(step.id);
                            }}
                            className="text-zinc-300 hover:text-red-400 transition-colors p-1 cursor-pointer"
                            title="Remover ação"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div
                          className="p-4 space-y-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <InlineActionForm
                            step={step}
                            onChange={(fn) => updateStep(step.id, fn)}
                            pipelines={crmState.pipelines}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Add Buttons and End of Flow */}
          <div className="flex flex-col items-center mt-2">
            <div className="w-0.5 h-4 bg-zinc-200"></div>
            <div className="h-2 w-2 rounded-full bg-zinc-300"></div>
            <div className="w-0.5 h-4 bg-zinc-200"></div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addConditionStep()}
                className="flex items-center gap-1.5 rounded-full border-2 border-dashed border-blue-200 px-3 py-1.5 text-xs text-blue-400 hover:border-blue-300 hover:text-blue-500 transition-colors cursor-pointer"
              >
                <FunnelIcon className="h-3.5 w-3.5" /> Condicao
              </button>
              <button
                type="button"
                onClick={() => addActionStep()}
                className="flex items-center gap-1.5 rounded-full border-2 border-dashed border-amber-200 px-3 py-1.5 text-xs text-amber-400 hover:border-amber-300 hover:text-amber-500 transition-colors cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" /> Acao
              </button>
            </div>
            <div className="w-0.5 h-4 bg-zinc-200 mt-2"></div>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-xs text-zinc-500 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
              Fim do fluxo
            </div>
          </div>
        </div>
      </div>

      {/* Right Configuration Drawer Panel */}
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
            onAddCondition={() => addConditionStep()}
            onAddAction={() => addActionStep()}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Dropdowns (Screenshots 2, 3, 4, 5)
// ─────────────────────────────────────────────────────────────────────────────

// Field Dropdown with Search & Category (Screenshots 3 & 5)
function FieldDropdownSelect({
  value,
  onChange,
}: {
  value: AutomationConditionField;
  onChange: (v: AutomationConditionField) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const items = CONDITION_FIELDS.map((f) => ({
    id: f,
    label: CONDITION_FIELD_LABELS[f],
  })).filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = CONDITION_FIELD_LABELS[value];

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0 w-full cursor-pointer"
      >
        <span
          className={cn(
            "min-w-0 truncate flex-1 text-left",
            selectedLabel ? "text-zinc-800 font-medium" : "text-zinc-400"
          )}
        >
          {selectedLabel || "Campo..."}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg z-50 p-2 space-y-2">
          {/* Search Box */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg">
            <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-xs text-zinc-800 outline-none w-full placeholder:text-zinc-400"
              autoFocus
            />
          </div>

          {/* Group Header */}
          <div className="px-2 pt-1 pb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              NEGÓCIO
            </span>
          </div>

          {/* Items List */}
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {items.map((item) => {
              const isSelected = value === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-between",
                    isSelected
                      ? "bg-blue-600 text-white font-medium"
                      : "text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  <span>{item.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              );
            })}
            {items.length === 0 && (
              <p className="text-xs text-zinc-400 py-2 text-center">
                Nenhum campo encontrado
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Operator Dropdown with Blue highlight and Checkmark (Screenshot 2)
function OperatorDropdownSelect({
  value,
  onChange,
}: {
  value: AutomationConditionOperator;
  onChange: (v: AutomationConditionOperator) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedItem = CONDITION_OPERATORS.find((o) => o.value === value);

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0 w-full cursor-pointer"
      >
        <span className="min-w-0 truncate flex-1 text-left text-zinc-800 font-medium">
          {selectedItem?.label || "é"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
          {CONDITION_OPERATORS.map((op) => {
            const isSelected = op.value === value;
            return (
              <button
                key={op.value}
                type="button"
                onClick={() => {
                  onChange(op.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between",
                  isSelected
                    ? "bg-blue-600 text-white font-medium"
                    : "text-zinc-800 hover:bg-zinc-50"
                )}
              >
                <span>{op.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Stage Selector Grouped by Pipeline with Search (Screenshot 4)
function StageDropdownSelect({
  value,
  pipelines,
  onChange,
}: {
  value: string;
  pipelines: Pipeline[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allStages = pipelines.flatMap((p) =>
    p.stages.map((s) => ({ ...s, pipelineName: p.name }))
  );
  const selectedStage = allStages.find(
    (s) => s.id === value || s.name === value
  );

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0 w-full cursor-pointer"
      >
        <span
          className={cn(
            "min-w-0 truncate flex-1 text-left",
            selectedStage ? "text-zinc-800 font-medium" : "text-zinc-400"
          )}
        >
          {selectedStage
            ? `${selectedStage.name} (${selectedStage.pipelineName})`
            : "Selecionar etapa..."}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg z-50 p-2 space-y-2">
          {/* Search Box */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg">
            <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-xs text-zinc-800 outline-none w-full placeholder:text-zinc-400"
              autoFocus
            />
          </div>

          {/* Grouped by Pipeline */}
          <div className="max-h-56 overflow-y-auto space-y-2">
            {pipelines.map((pipeline) => {
              const filteredStages = pipeline.stages.filter((st) =>
                st.name.toLowerCase().includes(search.toLowerCase())
              );
              if (filteredStages.length === 0) return null;

              return (
                <div key={pipeline.id} className="space-y-0.5">
                  <div className="px-2 pt-1 pb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {pipeline.name}
                    </span>
                  </div>
                  {filteredStages.map((st) => {
                    const isSelected = value === st.name || value === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          onChange(st.name);
                          setOpen(false);
                          setSearch("");
                        }}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-between",
                          isSelected
                            ? "bg-blue-600 text-white font-medium"
                            : "text-zinc-700 hover:bg-zinc-50"
                        )}
                      >
                        <span className="truncate">{st.name}</span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-white shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Pipeline / Generic Dropdown with Search & Selection Highlight
function SearchableSelect({
  value,
  placeholder,
  options,
  onChange,
  disabled,
}: {
  value: string;
  placeholder?: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-400 cursor-not-allowed"
      >
        <span className="min-w-0 truncate flex-1 text-left">
          {placeholder || "Selecionar..."}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
      </button>
    );
  }

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0 w-full cursor-pointer"
      >
        <span
          className={cn(
            "min-w-0 truncate flex-1 text-left",
            selectedOption ? "text-zinc-800 font-medium" : "text-zinc-400"
          )}
        >
          {selectedOption ? selectedOption.label : placeholder || "Selecionar..."}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg z-50 p-2 space-y-2">
          {options.length > 5 && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg">
              <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-zinc-800 outline-none w-full placeholder:text-zinc-400"
                autoFocus
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filtered.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-between",
                    isSelected
                      ? "bg-blue-600 text-white font-medium"
                      : "text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-white shrink-0 ml-1" />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-zinc-400 py-2 text-center">
                Nenhum item encontrado
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline Action Form (Matching pasted HTML)
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
  const emailTemplates = useEmailTemplates();

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
    <div className="space-y-3">
      {/* Action Type */}
      <div>
        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
          Tipo de ação
        </label>
        <SearchableSelect
          value={actionType}
          options={ACTION_TYPES.map((t) => ({
            value: t,
            label: ACTION_LABELS[t],
          }))}
          onChange={(v) => setActionType(v as ActionType)}
        />
      </div>

      {actionType === "create_deal" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                Pipeline destino
              </label>
              <SearchableSelect
                value={(config.pipelineId as string) ?? ""}
                placeholder="Selecionar pipeline..."
                options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
                onChange={(v) => patchConfig({ pipelineId: v, stageId: "" })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                Etapa destino
              </label>
              <SearchableSelect
                value={(config.stageId as string) ?? ""}
                placeholder="Selecionar etapa..."
                disabled={!config.pipelineId}
                options={(selectedPipeline?.stages ?? []).map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
                onChange={(v) => patchConfig({ stageId: v })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
              Título do negócio
            </label>
            <input
              placeholder="[OPP] - {contact.name}"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              type="text"
              value={(config.title as string) ?? ""}
              onChange={(e) => patchConfig({ title: e.target.value })}
            />
            <p className="mt-1 text-xs text-zinc-400">
              Use {"{contact.name}"} para o nome do contato e {"{deal.title}"} para o título original.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              className="rounded border-zinc-300 text-amber-500 focus:ring-amber-400 accent-amber-500"
              type="checkbox"
              checked={!!config.copyAll}
              onChange={(e) => patchConfig({ copyAll: e.target.checked })}
            />
            <span className="text-xs text-zinc-600">
              Copiar contato, empresa, valor e campos personalizados do negócio original
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              className="rounded border-zinc-300 text-amber-500 focus:ring-amber-400 accent-amber-500"
              type="checkbox"
              checked={!!config.copyNotes}
              onChange={(e) => patchConfig({ copyNotes: e.target.checked })}
            />
            <span className="text-xs text-zinc-600">
              Copiar notas do negócio original
            </span>
          </label>

          <OwnerModeField
            label="Proprietário do novo negócio"
            mode={(config.ownerMode as string) ?? "round_robin"}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                Tipo
              </label>
              <SearchableSelect
                value={(config.activityType as string) ?? "Ligação"}
                options={["Ligação", "Email", "Reunião", "Tarefa", "WhatsApp"].map(
                  (t) => ({ value: t, label: t })
                )}
                onChange={(v) => patchConfig({ activityType: v })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                Prazo (dias)
              </label>
              <input
                min="0"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                type="number"
                value={(config.deadline as number) ?? 1}
                onChange={(e) =>
                  patchConfig({ deadline: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
              Título
            </label>
            <input
              placeholder="Ex: Ligar para o cliente"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              type="text"
              value={(config.title as string) ?? ""}
              onChange={(e) => patchConfig({ title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
              Observações (opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Observações da atividade..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
              value={(config.notes as string) ?? ""}
              onChange={(e) => patchConfig({ notes: e.target.value })}
            />
          </div>
        </>
      )}

      {actionType === "move_stage" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
              Pipeline
            </label>
            <SearchableSelect
              value={(config.pipelineId as string) ?? ""}
              placeholder="Selecionar pipeline..."
              options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(v) => patchConfig({ pipelineId: v, stageId: "" })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
              Etapa
            </label>
            <SearchableSelect
              value={(config.stageId as string) ?? ""}
              placeholder="Selecionar etapa..."
              disabled={!config.pipelineId}
              options={(selectedPipeline?.stages ?? []).map((s) => ({
                value: s.id,
                label: s.name,
              }))}
              onChange={(v) => patchConfig({ stageId: v })}
            />
          </div>
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
        <div className="flex items-center gap-2 text-xs text-zinc-500 py-1">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Nenhuma configuração adicional necessária.
        </div>
      )}

      {actionType === "mark_lost" && (
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
            Motivo da perda (opcional)
          </label>
          <input
            value={(config.lossReason as string) ?? ""}
            onChange={(e) => patchConfig({ lossReason: e.target.value })}
            placeholder="Ex: Preço, Concorrência..."
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>
      )}

      {actionType === "add_label" && (
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
            Etiqueta
          </label>
          <input
            value={(config.labelName as string) ?? ""}
            onChange={(e) => patchConfig({ labelName: e.target.value })}
            placeholder="Nome da etiqueta..."
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>
      )}

      {actionType === "duplicate_deal" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              className="rounded border-zinc-300 text-amber-500 focus:ring-amber-400 accent-amber-500"
              type="checkbox"
              checked={!!config.copyNotes}
              onChange={(e) => patchConfig({ copyNotes: e.target.checked })}
            />
            <span className="text-xs text-zinc-600">
              Copiar notas do negócio original
            </span>
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

      {actionType === "create_note" && (
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
            Conteúdo da nota
          </label>
          <textarea
            value={(config.content as string) ?? ""}
            onChange={(e) => patchConfig({ content: e.target.value })}
            placeholder="Texto da nota automática..."
            rows={3}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
          />
        </div>
      )}

      {actionType === "send_webhook" && (
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
            URL do webhook
          </label>
          <input
            value={(config.url as string) ?? ""}
            onChange={(e) => patchConfig({ url: e.target.value })}
            placeholder="https://seu-endpoint.com/webhook"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <p className="text-[11px] text-zinc-400 mt-1">
            Será enviado um POST com os dados do evento.
          </p>
        </div>
      )}

      {actionType === "send_email" && (
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
            Template de email
          </label>
          <SearchableSelect
            value={(config.templateId as string) ?? ""}
            placeholder="Selecionar template..."
            options={emailTemplates.map((t) => ({
              value: t.id,
              label: t.name,
            }))}
            onChange={(v) => patchConfig({ templateId: v })}
          />
          <p className="mt-1 text-xs text-zinc-400">
            O email sera enviado via Gmail do vendedor responsavel pelo negocio. Variaveis como {"{{contact_name}}"} serao substituidas automaticamente.
          </p>
        </div>
      )}

      {actionType === "send_whatsapp" && (
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
            Template WhatsApp
          </label>
          <SearchableSelect
            value={(config.templateId as string) ?? ""}
            placeholder="Selecionar template..."
            options={whatsappTemplates.map((t) => ({
              value: t.id,
              label: t.name,
            }))}
            onChange={(v) => patchConfig({ templateId: v })}
          />
          <p className="mt-1 text-xs text-zinc-400">
            A mensagem sera enviada via WhatsApp do vendedor responsavel pelo negocio. Variaveis como {"{{contact_name}}"} serao substituidas automaticamente.
          </p>
        </div>
      )}

      {actionType === "notify_whatsapp_group" && (
        <>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
              Nome do grupo
            </label>
            <input
              placeholder="Ex: Vendas - Geral"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              type="text"
              value={(config.groupName as string) ?? ""}
              onChange={(e) => patchConfig({ groupName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
              Mensagem de aviso
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Chegou novo lead: {deal.title}"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
              value={(config.message as string) ?? ""}
              onChange={(e) => patchConfig({ message: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner Mode Field (Matches pasted HTML)
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
      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {tabOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange({ ownerMode: opt.id })}
            className={cn(
              "px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer",
              mode === opt.id
                ? "bg-amber-50 border-amber-300 text-amber-900 font-semibold"
                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "fixed" && (
        <SearchableSelect
          value={userId}
          placeholder="Selecionar usuário..."
          options={teamUsers.map((u) => ({ value: u.id, label: u.name }))}
          onChange={(v) => onChange({ userId: v })}
        />
      )}

      {mode === "round_robin" && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">
            Selecione os membros que participarão do rodízio:
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 p-2 bg-white">
            {teamUsers.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedRrIds.includes(u.id)}
                  onChange={() => toggleRrUser(u.id)}
                  className="rounded border-zinc-300 text-amber-500 focus:ring-amber-400 accent-amber-500"
                />
                <span className="text-sm text-zinc-800">{u.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {mode === "custom_field" && (
        <SearchableSelect
          value={customFieldId}
          placeholder="Selecionar campo personalizado..."
          options={customFields.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(v) => onChange({ customFieldId: v })}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right Drawer Panels (Screenshots 1, 2 & HTML)
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
        Selecione o evento que vai disparar esta automacao.
      </p>
      <div className="space-y-2">
        {TRIGGER_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              "w-full text-left rounded-xl border-2 p-3.5 transition-colors cursor-pointer",
              value === t
                ? "border-amber-400 bg-amber-50/40 shadow-xs"
                : "border-zinc-100 hover:border-zinc-200 bg-white"
            )}
          >
            <p className="text-sm font-semibold text-zinc-800">
              {TRIGGER_LABELS[t]}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
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
        Configurar Acao
      </h3>
      <p className="text-xs text-zinc-400 mb-4">
        Configure os parametros desta acao.
      </p>
      <div className="space-y-2">
        {ACTION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              "w-full text-left rounded-lg p-3 transition-colors cursor-pointer border text-left",
              value === t
                ? "bg-amber-50 border-amber-300 text-amber-900 shadow-xs"
                : "bg-white border-zinc-100 hover:border-zinc-200 text-zinc-700"
            )}
          >
            <p className="text-xs font-semibold text-zinc-700">
              {ACTION_LABELS[t]}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {ACTION_DESCRIPTIONS[t]}
            </p>
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

  // Group rules into cards if grouped, or split by card
  // If groupId is present, group rules by groupId, else each rule or pair
  const groups: { id: string; rules: { rule: AutomationConditionRule; index: number }[] }[] = [];
  rules.forEach((r, index) => {
    const gId = r.groupId || "default";
    let g = groups.find((grp) => grp.id === gId);
    if (!g) {
      g = { id: gId, rules: [] };
      groups.push(g);
    }
    g.rules.push({ rule: r, index });
  });

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

  function toggleLogic(idx: number) {
    onChange((s) => ({
      ...s,
      condition: {
        rules: (s.condition?.rules ?? []).map((r, i) =>
          i === idx ? { ...r, logic: r.logic === "OR" ? "AND" : "OR" } : r
        ),
      },
    }));
  }

  function addRuleToGroup(groupId: string) {
    onChange((s) => ({
      ...s,
      condition: {
        rules: [
          ...(s.condition?.rules ?? []),
          { field: "stage", operator: "is", value: "", logic: "AND", groupId },
        ],
      },
    }));
  }

  function addNewGroup() {
    const newGId = crypto.randomUUID();
    onChange((s) => ({
      ...s,
      condition: {
        rules: [
          ...(s.condition?.rules ?? []),
          { field: "stage", operator: "is", value: "", logic: "AND", groupId: newGId },
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

  function removeGroup(groupId: string) {
    onChange((s) => {
      const remaining = (s.condition?.rules ?? []).filter((r) => r.groupId !== groupId);
      if (remaining.length === 0) {
        onDelete();
      }
      return {
        ...s,
        condition: {
          rules: remaining,
        },
      };
    });
  }

  const allStages = pipelines.flatMap((p) =>
    p.stages.map((s) => ({ ...s, pipelineName: p.name }))
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-700 mb-1">Condicao</h3>
      <p className="text-xs text-zinc-400 mb-4">
        A automacao so continua se estas condicoes forem verdadeiras.
      </p>

      <div className="space-y-3">
        {groups.map((grp) => (
          <div
            key={grp.id}
            className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3"
          >
            <div>
              {grp.rules.map(({ rule, index }, rIndexInGroup) => (
                <div key={index}>
                  {/* Logic Connector Button between rules (AND/OR toggle on click) */}
                  {rIndexInGroup > 0 && (
                    <div className="flex items-center justify-center my-2">
                      <button
                        type="button"
                        onClick={() => toggleLogic(index)}
                        className="rounded-full bg-zinc-200 px-3 py-0.5 text-[10px] font-bold text-zinc-600 hover:bg-zinc-300 transition-colors cursor-pointer"
                        title="Clique para alternar entre AND e OR"
                      >
                        {rule.logic || "AND"}
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    {/* Field selector with search and categories */}
                    <FieldDropdownSelect
                      value={rule.field}
                      onChange={(f) => updateRule(index, { field: f, value: "" })}
                    />

                    {/* Operator selector + X remove button */}
                    <div className="flex items-center gap-2">
                      <OperatorDropdownSelect
                        value={rule.operator}
                        onChange={(op) => updateRule(index, { operator: op })}
                      />

                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        className="shrink-0 text-zinc-300 hover:text-red-400 transition-colors cursor-pointer p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Value Field */}
                    {rule.operator !== "is_empty" &&
                      rule.operator !== "is_not_empty" && (
                        <div>
                          {rule.field === "pipeline" ? (
                            <SearchableSelect
                              value={rule.value}
                              placeholder="Selecionar funil..."
                              options={pipelines.map((p) => ({
                                value: p.name,
                                label: p.name,
                              }))}
                              onChange={(v) => updateRule(index, { value: v })}
                            />
                          ) : rule.field === "stage" ? (
                            <StageDropdownSelect
                              value={rule.value}
                              pipelines={pipelines}
                              onChange={(v) => updateRule(index, { value: v })}
                            />
                          ) : rule.field === "status" ? (
                            <SearchableSelect
                              value={rule.value}
                              placeholder="Selecionar status..."
                              options={[
                                { value: "Ativo", label: "Ativo" },
                                { value: "Ganho", label: "Ganho" },
                                { value: "Perdido", label: "Perdido" },
                              ]}
                              onChange={(v) => updateRule(index, { value: v })}
                            />
                          ) : (
                            <input
                              placeholder="Valor..."
                              className="flex-1 min-w-0 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-amber-400"
                              type="text"
                              value={rule.value}
                              onChange={(e) =>
                                updateRule(index, { value: e.target.value })
                              }
                            />
                          )}
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {/* Card Footer: Add rule inside card + Trash delete group */}
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => addRuleToGroup(grp.id)}
                className="text-xs text-amber-500 hover:text-amber-600 font-medium cursor-pointer"
              >
                + Adicionar regra
              </button>
              <div className="flex-1"></div>
              <button
                type="button"
                onClick={() => removeGroup(grp.id)}
                className="text-xs text-red-400 hover:text-red-500 cursor-pointer p-1"
                title="Excluir condição"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}

        {/* + AND button outside cards to add another card */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={addNewGroup}
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
  onAddCondition: () => void;
  onAddAction: () => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-700 mb-1">Próximo passo</h3>
      <p className="text-xs text-zinc-400 mb-4">
        Adicione uma condição ou ação ao fluxo.
      </p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={onAddCondition}
          className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer shadow-xs"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <FunnelIcon className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-zinc-950">Condição</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Continuar apenas se as condições forem atendidas
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={onAddAction}
          className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 bg-white hover:border-amber-300 hover:bg-amber-50/50 transition-colors cursor-pointer shadow-xs"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <Play className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
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
