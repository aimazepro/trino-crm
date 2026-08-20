"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceInfo } from "@/lib/workspace";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { Automation, AutomationLabel, TriggerType } from "@/lib/crm-types";

interface AutomacoesContextType {
  automations: Automation[];
  automationLabels: AutomationLabel[];
  loading: boolean;
  addAutomation: (automation: Automation) => Promise<void>;
  updateAutomation: (id: string, fields: Partial<Automation>) => Promise<void>;
  deleteAutomation: (id: string) => Promise<void>;
  duplicateAutomation: (id: string) => Promise<Automation | null>;
  toggleAutomation: (id: string) => Promise<void>;
  addAutomationLabel: (label: AutomationLabel) => Promise<void>;
  deleteAutomationLabel: (id: string) => Promise<void>;
}

const AutomacoesContext = createContext<AutomacoesContextType | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAutomation(row: any): Automation {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    trigger: (row.trigger as TriggerType) ?? null,
    steps: row.steps ?? [],
    labelIds: row.label_ids ?? [],
    active: row.active ?? false,
    executionCount: row.execution_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLabel(row: any): AutomationLabel {
  return { id: row.id, name: row.name, color: row.color };
}

export function AutomacoesProvider({ children }: { children: ReactNode }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [automationLabels, setAutomationLabels] = useState<AutomationLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const workspace = useWorkspaceInfo();

  useEffect(() => {
    if (!workspace) return;
    async function load() {
      const [{ data: auts }, { data: lbls }] = await Promise.all([
        supabase.from("automations").select("*").order("created_at", { ascending: false }),
        supabase.from("automation_labels").select("*").order("created_at"),
      ]);

      setAutomations((auts ?? []).map(rowToAutomation));
      setAutomationLabels((lbls ?? []).map(rowToLabel));
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.workspaceId]);

  const addAutomation = useCallback(async (automation: Automation) => {
    if (!workspace) return;

    const { data, error } = await supabase.from("automations").insert({
      id: automation.id,
      workspace_id: workspace.workspaceId,
      name: automation.name,
      description: automation.description,
      trigger: automation.trigger,
      steps: automation.steps as unknown as Json,
      label_ids: automation.labelIds,
      active: automation.active,
      execution_count: automation.executionCount,
    }).select().single();

    if (!error && data) setAutomations((prev) => [rowToAutomation(data), ...prev]);
  }, [supabase, workspace]);

  const updateAutomation = useCallback(async (id: string, fields: Partial<Automation>) => {
    const patch: Database["public"]["Tables"]["automations"]["Update"] = { updated_at: new Date().toISOString() };
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.trigger !== undefined) patch.trigger = fields.trigger;
    if (fields.steps !== undefined) patch.steps = fields.steps as unknown as Json;
    if (fields.labelIds !== undefined) patch.label_ids = fields.labelIds;
    if (fields.active !== undefined) patch.active = fields.active;
    if (fields.executionCount !== undefined) patch.execution_count = fields.executionCount;

    const { data, error } = await supabase.from("automations").update(patch).eq("id", id).select().single();
    if (!error && data) setAutomations((prev) => prev.map((a) => a.id === id ? rowToAutomation(data) : a));
  }, [supabase]);

  const deleteAutomation = useCallback(async (id: string) => {
    await supabase.from("automations").delete().eq("id", id);
    setAutomations((prev) => prev.filter((a) => a.id !== id));
  }, [supabase]);

  const duplicateAutomation = useCallback(async (id: string): Promise<Automation | null> => {
    const src = automations.find((a) => a.id === id);
    if (!src || !workspace) return null;

    const { data, error } = await supabase.from("automations").insert({
      workspace_id: workspace.workspaceId,
      name: `${src.name} (cópia)`,
      description: src.description,
      trigger: src.trigger,
      steps: src.steps as unknown as Json,
      label_ids: src.labelIds,
      active: false,
      execution_count: 0,
    }).select().single();

    if (error || !data) return null;
    const copy = rowToAutomation(data);
    setAutomations((prev) => [copy, ...prev]);
    return copy;
  }, [automations, supabase, workspace]);

  const toggleAutomation = useCallback(async (id: string) => {
    const aut = automations.find((a) => a.id === id);
    if (!aut) return;
    await updateAutomation(id, { active: !aut.active });
  }, [automations, updateAutomation]);

  const addAutomationLabel = useCallback(async (label: AutomationLabel) => {
    if (!workspace) return;

    const { data, error } = await supabase.from("automation_labels").insert({
      workspace_id: workspace.workspaceId, name: label.name, color: label.color,
    }).select().single();

    if (!error && data) setAutomationLabels((prev) => [...prev, rowToLabel(data)]);
  }, [supabase, workspace]);

  const deleteAutomationLabel = useCallback(async (id: string) => {
    await supabase.from("automation_labels").delete().eq("id", id);
    setAutomationLabels((prev) => prev.filter((l) => l.id !== id));
  }, [supabase]);

  return (
    <AutomacoesContext.Provider value={{
      automations, automationLabels, loading,
      addAutomation, updateAutomation, deleteAutomation,
      duplicateAutomation, toggleAutomation,
      addAutomationLabel, deleteAutomationLabel,
    }}>
      {children}
    </AutomacoesContext.Provider>
  );
}

export function useAutomacoes() {
  const ctx = useContext(AutomacoesContext);
  if (!ctx) throw new Error("useAutomacoes must be used inside AutomacoesProvider");
  return ctx;
}

// ── Shared constants ──────────────────────────────────────────────────────────

export const TRIGGER_LABELS: Record<string, string> = {
  deal_created: "Negócio criado",
  stage_changed: "Etapa alterada",
  deal_won: "Negócio ganho",
  deal_lost: "Negócio perdido",
  deal_updated: "Negócio atualizado",
  activity_created: "Atividade criada",
  lead_recebido: "Lead recebido (API/formulário)",
};

export const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  deal_created: "Quando um novo negócio for criado",
  stage_changed: "Quando a etapa de um negócio mudar",
  deal_won: "Quando um negócio for marcado como ganho",
  deal_lost: "Quando um negócio for marcado como perdido",
  deal_updated: "Quando qualquer campo do negócio for alterado",
  activity_created: "Quando uma nova atividade for registrada",
  lead_recebido: "Quando um lead entrar pela API pública ou por um formulário externo",
};

export const CONDITION_FIELD_LABELS: Record<string, string> = {
  stage: "Etapa do negócio",
  pipeline: "Funil do negócio",
  status: "Status do negócio",
  value: "Valor do negócio",
  owner: "Proprietário",
  label: "Etiqueta",
};

export const CONDITION_OPERATOR_LABELS: Record<string, string> = {
  is: "é",
  is_not: "não é",
  contains: "contém",
  greater_than: "maior que",
  less_than: "menor que",
};

export const ACTION_LABELS: Record<string, string> = {
  create_deal: "Criar novo negócio",
  create_activity: "Criar atividade",
  move_stage: "Mover para etapa",
  assign_owner: "Atribuir responsável",
  mark_won: "Marcar como ganho",
  mark_lost: "Marcar como perdido",
  add_label: "Adicionar etiqueta",
  duplicate_deal: "Duplicar negócio",
  create_note: "Criar nota",
  send_webhook: "Enviar webhook",
  send_email: "Enviar email",
  send_whatsapp: "Enviar WhatsApp",
  start_sequence: "Iniciar sequência",
};

export const ACTION_DESCRIPTIONS: Record<string, string> = {
  create_deal: "Cria um negócio em outro pipeline",
  create_activity: "Cria uma atividade vinculada ao negócio",
  move_stage: "Move o negócio para outra etapa",
  assign_owner: "Define um responsável para o negócio",
  mark_won: "Fecha o negócio como ganho.",
  mark_lost: "Fecha o negócio como perdido",
  add_label: "Adiciona uma etiqueta ao negócio",
  duplicate_deal: "Cria uma cópia do negócio",
  create_note: "Registra uma nota no negócio",
  send_webhook: "Envia um POST para uma URL externa",
  send_email: "Envia um email via Gmail do vendedor",
  send_whatsapp: "Envia uma mensagem WhatsApp usando template",
  start_sequence: "Inscreve o negócio numa sequência de atividades",
};

export interface AutomationTemplate {
  id: string;
  name: string;
  triggerKey: TriggerType;
  description: string;
  steps: Automation["steps"];
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "tpl-inbound-vendas", name: "Inbound pra Vendas", triggerKey: "deal_won",
    description: "Ao ganhar um negócio no pipeline Inbound, cria automaticamente uma oportunidade no pipeline Negociação na etapa Reunião Realizada.",
    steps: [
      { id: "cond-1", type: "condition", condition: { rules: [{ field: "pipeline", operator: "is", value: "Inbound" }] } },
      { id: "act-1", type: "action", action: { type: "create_deal", config: { title: "[OPP] - {contact.name}", ownerMode: "keep", copyAll: true } } },
    ],
  },
  {
    id: "tpl-prospeccao-vendas", name: "Prospecção pra Vendas", triggerKey: "deal_won",
    description: "Ao ganhar um negócio no pipeline Prospecção, cria automaticamente uma oportunidade no pipeline Negociação na etapa Reunião Realizada.",
    steps: [
      { id: "cond-1", type: "condition", condition: { rules: [{ field: "pipeline", operator: "is", value: "Prospecção" }] } },
      { id: "act-1", type: "action", action: { type: "create_deal", config: { title: "[OPP] - {contact.name}", ownerMode: "keep", copyAll: true } } },
    ],
  },
  {
    id: "tpl-social-selling", name: "Social Selling pra Vendas", triggerKey: "deal_won",
    description: "Ao ganhar um negócio no pipeline Social Selling, cria automaticamente uma oportunidade no pipeline Negociação na etapa Reunião Realizada.",
    steps: [
      { id: "cond-1", type: "condition", condition: { rules: [{ field: "pipeline", operator: "is", value: "Social Selling" }] } },
      { id: "act-1", type: "action", action: { type: "create_deal", config: { title: "[OPP] - {contact.name}", ownerMode: "keep", copyAll: true } } },
    ],
  },
  {
    id: "tpl-rodizio-sdrs", name: "Rodízio SDRs", triggerKey: "deal_created",
    description: "Distribui automaticamente os novos negócios do pipeline Inbound entre os SDRs da equipe, em rodizio igualitário.",
    steps: [{ id: "act-1", type: "action", action: { type: "assign_owner", config: { ownerMode: "round_robin" } } }],
  },
  {
    id: "tpl-atividade-etapa", name: "Criar atividade ao mudar de etapa", triggerKey: "stage_changed",
    description: "Quando um negócio mudar de etapa, cria automaticamente uma atividade de acompanhamento.",
    steps: [{ id: "act-1", type: "action", action: { type: "create_activity", config: { activityType: "Ligação", deadline: 1, title: "" } } }],
  },
  {
    id: "tpl-webhook-ganho", name: "Notificar via webhook ao ganhar negócio", triggerKey: "deal_won",
    description: "Envia um POST para uma URL externa sempre que um negócio for marcado como ganho.",
    steps: [{ id: "act-1", type: "action", action: { type: "send_webhook", config: { url: "" } } }],
  },
  {
    id: "tpl-mover-atualizar", name: "Mover negócio ao atualizar campo", triggerKey: "deal_updated",
    description: "Move o negócio para uma etapa específica quando um campo for atualizado.",
    steps: [{ id: "act-1", type: "action", action: { type: "move_stage", config: { stageId: "" } } }],
  },
  {
    id: "tpl-responsavel-criado", name: "Atribuir responsável ao criar negócio", triggerKey: "deal_created",
    description: "Quando um novo negócio for criado, define automaticamente um responsável.",
    steps: [{ id: "act-1", type: "action", action: { type: "assign_owner", config: { ownerMode: "fixed", userId: "" } } }],
  },
  {
    id: "tpl-nota-perdido", name: "Criar nota ao perder negócio", triggerKey: "deal_lost",
    description: "Registra automaticamente uma nota de análise quando um negócio for perdido.",
    steps: [{ id: "act-1", type: "action", action: { type: "create_note", config: { content: "Negócio perdido. Motivo: {loss_reason}" } } }],
  },
  {
    id: "tpl-ganho-etapa-final", name: "Marcar como ganho ao atingir etapa final", triggerKey: "stage_changed",
    description: "Marca o negócio como ganho automaticamente quando ele chegar em uma etapa específica.",
    steps: [{ id: "act-1", type: "action", action: { type: "mark_won", config: {} } }],
  },
  {
    id: "tpl-etiqueta-condicao", name: "Adicionar etiqueta com condição", triggerKey: "deal_updated",
    description: "Adiciona uma etiqueta ao negócio quando ele atender condições específicas (funil, etapa, status).",
    steps: [{ id: "act-1", type: "action", action: { type: "add_label", config: { labelName: "" } } }],
  },
  {
    id: "tpl-duplicar-ganho", name: "Duplicar negócio ao ganhar", triggerKey: "deal_won",
    description: "Quando um negócio for ganho, duplica ele em outro funil para acompanhamento (ex: CS, Contrato).",
    steps: [{ id: "act-1", type: "action", action: { type: "duplicate_deal", config: {} } }],
  },
];
