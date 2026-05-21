"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, Plus, Settings, Edit2, Copy, Trash2, ArrowRight,
  Activity, Tag, ArrowRightLeft, ChevronDown,
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
  return "text-[#F1A80A] bg-[#FFF9EC]";
}

function triggerBadgeColor(trigger: string) {
  if (trigger === "deal_won") return "bg-amber-50 text-amber-700 border border-amber-100";
  if (trigger === "deal_created") return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (trigger === "stage_changed") return "bg-blue-50 text-blue-700 border border-blue-100";
  if (trigger === "deal_lost") return "bg-red-50 text-red-700 border border-red-100";
  if (trigger === "deal_updated") return "bg-purple-50 text-purple-700 border border-purple-100";
  return "bg-zinc-50 text-zinc-650 border border-zinc-100";
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
    <div className="flex flex-col min-h-full bg-[#F4F4F5] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-5 shrink-0 bg-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFF9EC] flex items-center justify-center text-[#F1A80A]">
            <Zap className="h-5 w-5 fill-[#F1A80A]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-950 tracking-tight">Automações</h1>
            <p className="text-[13px] text-zinc-400 font-medium">
              Automatize ações com base em eventos do seu CRM.
            </p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-[#F1A80A] hover:bg-[#D79405] text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Nova Automação
        </button>
      </div>

      <div className="flex-1 px-8 pb-8 space-y-6 max-w-6xl">
        {/* Stats */}
        <div className="bg-white border border-zinc-200/60 rounded-xl px-8 py-5 flex items-center gap-16 shadow-sm">
          <div>
            <p className="text-2xl font-bold text-zinc-950">{automations.length}</p>
            <p className="text-[12px] font-semibold text-zinc-400 mt-0.5">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-500">{totalActive}</p>
            <p className="text-[12px] font-semibold text-zinc-400 mt-0.5">Ativas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#F1A80A]">{totalExecutions}</p>
            <p className="text-[12px] font-semibold text-zinc-400 mt-0.5">Execuções totais</p>
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
                "px-4 py-2.5 text-[13px] font-bold transition-colors border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer",
                activeTab === tab.id
                  ? "border-[#F1A80A] text-[#F1A80A]"
                  : "border-transparent text-zinc-400 hover:text-zinc-700"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "text-[10px] rounded-full px-1.5 py-0.5 font-bold transition-colors",
                  activeTab === tab.id ? "bg-[#FFF9EC] text-[#F1A80A]" : "bg-zinc-150 text-zinc-400"
                )}>
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
  const isExchangeTemplate = (id: string) => {
    return [
      "tpl-inbound-vendas",
      "tpl-prospeccao-vendas",
      "tpl-social-selling",
      "tpl-rodizio-sdrs",
    ].includes(id);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {AUTOMATION_TEMPLATES.map((tpl) => (
        <div
          key={tpl.id}
          className="bg-white border border-zinc-200/60 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all duration-150"
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                triggerColor(tpl.triggerKey)
              )}
            >
              {isExchangeTemplate(tpl.id) ? (
                <ArrowRightLeft className="h-4 w-4 text-[#F1A80A]" />
              ) : (
                <Zap className="h-4 w-4 text-[#F1A80A]" />
              )}
            </div>
            <div>
              <p className="text-[14px] font-bold text-zinc-950 leading-snug">{tpl.name}</p>
              <span
                className={cn(
                  "inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1.5",
                  triggerBadgeColor(tpl.triggerKey)
                )}
              >
                {TRIGGER_LABELS[tpl.triggerKey]}
              </span>
            </div>
          </div>
          <p className="text-[12px] text-zinc-400 leading-relaxed flex-1 mt-2">{tpl.description}</p>
          <button
            onClick={() => onUse(tpl)}
            className="flex items-center gap-1 text-[13px] font-bold text-[#F1A80A] hover:text-[#D79405] transition-colors mt-3 w-fit cursor-pointer"
          >
            Usar este modelo <ChevronDown className="h-4 w-4 -rotate-90" />
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
          className="text-[13px] font-bold text-[#F1A80A] hover:text-[#D79405] cursor-pointer"
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
              "flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer",
              labelFilter === LABEL_FILTER_ALL
                ? "border-[#F1A80A] bg-[#FFF9EC] text-[#D79405]"
                : "border-zinc-200 bg-white text-zinc-650 hover:border-zinc-350"
            )}
          >
            <Tag className="h-3.5 w-3.5 text-zinc-400" />
            Todas as etiquetas
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
          {automationLabels.map((lbl) => (
            <button
              key={lbl.id}
              onClick={() => setLabelFilter(lbl.id)}
              className={cn(
                "flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer",
                labelFilter === lbl.id
                  ? "border-[#F1A80A] bg-[#FFF9EC] text-[#D79405]"
                  : "border-zinc-200 bg-white text-zinc-650 hover:border-zinc-350"
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
          className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
        >
          <Settings className="h-3.5 w-3.5 text-zinc-450" />
          Gerenciar etiquetas
        </button>
      </div>

      {/* List (Separate standalone cards) */}
      <div className="space-y-3">
        {automations.map((aut) => (
          <div
            key={aut.id}
            className="flex items-center gap-4 bg-white border border-zinc-200/60 rounded-xl px-5 py-4 shadow-sm hover:shadow transition-all duration-150"
          >
            {/* Toggle */}
            <button
              onClick={() => onToggle(aut.id)}
              className={cn(
                "relative w-10 h-[22px] rounded-full transition-colors shrink-0 cursor-pointer",
                aut.active ? "bg-[#F1A80A]" : "bg-zinc-350"
              )}
              style={{ width: 40, height: 22 }}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all",
                  aut.active ? "left-[18px]" : "left-0.5"
                )}
                style={{ width: 18, height: 18 }}
              />
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[14px] font-semibold text-zinc-950 truncate">{aut.name}</span>
                {aut.trigger && (
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      triggerBadgeColor(aut.trigger)
                    )}
                  >
                    {TRIGGER_LABELS[aut.trigger]}
                  </span>
                )}
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    aut.active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : "bg-zinc-50 text-zinc-450 border-zinc-150"
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
              <p className="text-[12px] text-zinc-400 mt-1 flex items-center gap-1 font-medium">
                <Activity className="h-3 w-3 text-zinc-300" />
                {aut.executionCount} execuções
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onEdit(aut.id)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Editar"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDuplicate(aut.id)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Duplicar"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(aut.id)}
                className={cn(
                  "p-2 rounded-lg transition-colors cursor-pointer",
                  deleteConfirmId === aut.id
                    ? "text-red-650 bg-red-50 hover:bg-red-100"
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
