"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, Plus, Settings, Edit2, Copy, Trash2, ArrowRight,
  Activity, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAutomacoes,
  TRIGGER_LABELS,
  AUTOMATION_TEMPLATES,
  AutomationTemplate,
} from "@/contexts/automacoes-context";
import type { Automation } from "@/lib/crm-types";

type Tab = "modelos" | "minhas" | "historico";

const LABEL_FILTER_ALL = "__all__";

// Template icon color based on trigger
function triggerColor(trigger: string) {
  if (trigger === "deal_won") return "text-amber-500 bg-amber-50";
  if (trigger === "deal_created") return "text-emerald-500 bg-emerald-50";
  if (trigger === "stage_changed") return "text-blue-500 bg-blue-50";
  if (trigger === "deal_lost") return "text-red-500 bg-red-50";
  if (trigger === "deal_updated") return "text-purple-500 bg-purple-50";
  return "text-zinc-500 bg-zinc-100";
}

function triggerBadgeColor(trigger: string) {
  if (trigger === "deal_won") return "bg-amber-100 text-amber-700";
  if (trigger === "deal_created") return "bg-emerald-100 text-emerald-700";
  if (trigger === "stage_changed") return "bg-blue-100 text-blue-700";
  if (trigger === "deal_lost") return "bg-red-100 text-red-700";
  if (trigger === "deal_updated") return "bg-purple-100 text-purple-700";
  return "bg-zinc-100 text-zinc-600";
}

export default function AutomacoesPage() {
  const router = useRouter();
  const { automations, automationLabels, deleteAutomation, duplicateAutomation, toggleAutomation } =
    useAutomacoes();
  const [activeTab, setActiveTab] = useState<Tab>("modelos");
  const [labelFilter, setLabelFilter] = useState(LABEL_FILTER_ALL);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const totalActive = automations.filter((a) => a.active).length;
  const totalExecutions = automations.reduce((sum, a) => sum + a.executionCount, 0);

  function handleUseTemplate(tpl: AutomationTemplate) {
    const newId = crypto.randomUUID();
    router.push(`/automacoes/${newId}?template=${tpl.id}`);
  }

  function handleNew() {
    router.push(`/automacoes/nova`);
  }

  function handleEdit(id: string) {
    router.push(`/automacoes/${id}`);
  }

  function handleDuplicate(id: string) {
    duplicateAutomation(id);
  }

  function handleDelete(id: string) {
    if (deleteConfirmId === id) {
      deleteAutomation(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  }

  const filteredAutomations =
    labelFilter === LABEL_FILTER_ALL
      ? automations
      : automations.filter((a) => a.labelIds.includes(labelFilter));

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Automações</h1>
            <p className="text-[13px] text-zinc-400 font-medium">
              Automatize ações com base em eventos do seu CRM.
            </p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Automação
        </button>
      </div>

      <div className="flex-1 p-8 space-y-6 max-w-6xl">
        {/* Stats */}
        <div className="bg-white border border-zinc-200 rounded-xl px-6 py-5 flex items-center gap-10 shadow-sm">
          <div>
            <p className="text-2xl font-bold text-zinc-900">{automations.length}</p>
            <p className="text-[12px] font-medium text-zinc-400">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-500">{totalActive}</p>
            <p className="text-[12px] font-medium text-zinc-400">Ativas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-500">{totalExecutions}</p>
            <p className="text-[12px] font-medium text-zinc-400">Execuções totais</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-200">
          {(
            [
              { id: "modelos", label: "Modelos" },
              {
                id: "minhas",
                label: "Minhas Automações",
                count: automations.length || undefined,
              },
              { id: "historico", label: "Histórico" },
            ] as { id: Tab; label: string; count?: number }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-[13px] font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5",
                activeTab === tab.id
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-[11px] bg-zinc-100 text-zinc-500 rounded-full px-1.5 py-0.5 font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "modelos" && <ModelosTab onUse={handleUseTemplate} />}
        {activeTab === "minhas" && (
          <MinhasTab
            automations={filteredAutomations}
            allAutomations={automations}
            automationLabels={automationLabels}
            labelFilter={labelFilter}
            setLabelFilter={setLabelFilter}
            deleteConfirmId={deleteConfirmId}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onToggle={toggleAutomation}
            onNew={handleNew}
          />
        )}
        {activeTab === "historico" && <HistoricoTab />}
      </div>
    </div>
  );
}

// ── Modelos tab ──────────────────────────────────────────────────────────────

function ModelosTab({ onUse }: { onUse: (tpl: AutomationTemplate) => void }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {AUTOMATION_TEMPLATES.map((tpl) => (
        <div
          key={tpl.id}
          className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                triggerColor(tpl.triggerKey)
              )}
            >
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-zinc-900 leading-snug">{tpl.name}</p>
              <span
                className={cn(
                  "inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1",
                  triggerBadgeColor(tpl.triggerKey)
                )}
              >
                {TRIGGER_LABELS[tpl.triggerKey]}
              </span>
            </div>
          </div>
          <p className="text-[12px] text-zinc-500 leading-relaxed flex-1">{tpl.description}</p>
          <button
            onClick={() => onUse(tpl)}
            className="flex items-center gap-1 text-[13px] font-semibold text-amber-600 hover:text-amber-700 transition-colors"
          >
            Usar este modelo <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Minhas Automações tab ────────────────────────────────────────────────────

interface MinhasTabProps {
  automations: Automation[];
  allAutomations: Automation[];
  automationLabels: ReturnType<typeof useAutomacoes>["automationLabels"];
  labelFilter: string;
  setLabelFilter: (v: string) => void;
  deleteConfirmId: string | null;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onNew: () => void;
}

function MinhasTab({
  automations,
  allAutomations,
  automationLabels,
  labelFilter,
  setLabelFilter,
  deleteConfirmId,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
  onNew,
}: MinhasTabProps) {
  const router = useRouter();

  if (allAutomations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Zap className="h-10 w-10 text-zinc-300" />
        <p className="text-[14px] text-zinc-400 font-medium">Nenhuma automação criada ainda.</p>
        <button
          onClick={onNew}
          className="text-[13px] font-semibold text-amber-600 hover:text-amber-700"
        >
          Criar minha primeira automação
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLabelFilter(LABEL_FILTER_ALL)}
            className={cn(
              "flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors",
              labelFilter === LABEL_FILTER_ALL
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            )}
          >
            <Tag className="h-3.5 w-3.5" />
            Todas as etiquetas
          </button>
          {automationLabels.map((lbl) => (
            <button
              key={lbl.id}
              onClick={() => setLabelFilter(lbl.id)}
              className={cn(
                "flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                labelFilter === lbl.id
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              )}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: lbl.color }}
              />
              {lbl.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => router.push("/configuracoes/etiquetas-automacoes")}
          className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Gerenciar etiquetas
        </button>
      </div>

      {/* List */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm divide-y divide-zinc-100">
        {automations.map((aut) => (
          <div key={aut.id} className="flex items-center gap-4 px-5 py-4">
            {/* Toggle */}
            <button
              onClick={() => onToggle(aut.id)}
              className={cn(
                "relative w-10 h-5.5 rounded-full transition-colors shrink-0",
                aut.active ? "bg-amber-500" : "bg-zinc-300"
              )}
              style={{ width: 40, height: 22 }}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all",
                  aut.active ? "left-[18px]" : "left-0.5"
                )}
                style={{ width: 18, height: 18 }}
              />
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold text-zinc-900 truncate">{aut.name}</span>
                {aut.trigger && (
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                      triggerBadgeColor(aut.trigger)
                    )}
                  >
                    {TRIGGER_LABELS[aut.trigger]}
                  </span>
                )}
                <span
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full",
                    aut.active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-zinc-100 text-zinc-500"
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      aut.active ? "bg-emerald-500" : "bg-zinc-400"
                    )}
                  />
                  {aut.active ? "Ativa" : "Inativa"}
                </span>
              </div>
              <p className="text-[12px] text-zinc-400 mt-0.5 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {aut.executionCount} execuções
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onEdit(aut.id)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                title="Editar"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDuplicate(aut.id)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                title="Duplicar"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(aut.id)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  deleteConfirmId === aut.id
                    ? "text-red-600 bg-red-50 hover:bg-red-100"
                    : "text-zinc-400 hover:text-red-500 hover:bg-red-50"
                )}
                title={deleteConfirmId === aut.id ? "Clique novamente para confirmar" : "Excluir"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Histórico tab ────────────────────────────────────────────────────────────

function HistoricoTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Activity className="h-10 w-10 text-zinc-300" />
      <p className="text-[14px] text-zinc-400 font-medium">Nenhuma execução registrada ainda.</p>
    </div>
  );
}
