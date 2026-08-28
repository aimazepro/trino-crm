"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Plus,
  ArrowRightLeft,
  ChevronRight,
  Tag,
  Settings,
  Edit2,
  Copy,
  Trash2,
  History,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RequireCapability } from "@/components/auth/require-capability";
import {
  useAutomacoes,
  TRIGGER_LABELS,
  AUTOMATION_TEMPLATES,
  AutomationTemplate,
} from "@/contexts/automacoes-context";
import type { Automation } from "@/lib/crm-types";

type Tab = "modelos" | "minhas" | "historico";

const LABEL_FILTER_ALL = "__all__";

function isHighlightTemplate(id: string) {
  return [
    "tpl-inbound-vendas",
    "tpl-prospeccao-vendas",
    "tpl-social-selling",
    "tpl-rodizio-sdrs",
  ].includes(id);
}

function AutomacoesPageContent() {
  const router = useRouter();
  const {
    automations,
    automationLabels,
    deleteAutomation,
    duplicateAutomation,
    toggleAutomation,
  } = useAutomacoes();
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
    <main className="flex-1 overflow-y-auto bg-zinc-50/40">
      <div className="p-8 max-w-5xl">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Automações
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Automatize ações com base em eventos do seu CRM.
            </p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nova Automação
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-white border border-zinc-200/70 shadow-xs">
          <div className="text-center px-4">
            <p className="text-2xl font-bold text-zinc-900">{automations.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Total</p>
          </div>
          <div className="text-center px-4">
            <p className="text-2xl font-bold text-green-600">{totalActive}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Ativas</p>
          </div>
          <div className="text-center px-4">
            <p className="text-2xl font-bold text-amber-500">{totalExecutions}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Execuções totais</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-zinc-200">
          <button
            onClick={() => setActiveTab("modelos")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
              activeTab === "modelos"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            )}
          >
            Modelos
          </button>
          <button
            onClick={() => setActiveTab("minhas")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer flex items-center gap-1.5",
              activeTab === "minhas"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            )}
          >
            Minhas Automações
            {automations.length > 0 && (
              <span
                className={cn(
                  "text-[10px] rounded-full px-1.5 py-0.5 font-bold transition-colors",
                  activeTab === "minhas"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-zinc-100 text-zinc-500"
                )}
              >
                {automations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("historico")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
              activeTab === "historico"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            )}
          >
            Histórico
          </button>
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
    </main>
  );
}

// ── Modelos Tab ──────────────────────────────────────────────────────────────

function ModelosTab({ onUse }: { onUse: (tpl: AutomationTemplate) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {AUTOMATION_TEMPLATES.map((tpl) => {
        const isHighlighted = isHighlightTemplate(tpl.id);
        return (
          <div
            key={tpl.id}
            className={cn(
              "flex flex-col rounded-xl p-5 hover:bg-zinc-50/50 transition-all",
              isHighlighted
                ? "bg-amber-50/50 ring-1 ring-amber-200/50"
                : "bg-white border border-zinc-200/80 shadow-xs"
            )}
          >
            <div className="flex-1">
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    isHighlighted ? "bg-amber-100" : "bg-amber-50"
                  )}
                >
                  {isHighlighted ? (
                    <ArrowRightLeft className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Zap className="h-5 w-5 text-amber-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 leading-tight">
                    {tpl.name}
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 mt-1">
                    {TRIGGER_LABELS[tpl.triggerKey]}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {tpl.description}
              </p>
            </div>
            <button
              onClick={() => onUse(tpl)}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Usar este modelo
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Minhas Automações Tab ────────────────────────────────────────────────────

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
      <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-xl border border-zinc-200/80">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
          <Zap className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-zinc-900">Nenhuma automação criada ainda.</p>
        <p className="text-xs text-zinc-400">Escolha um modelo pronto ou crie do zero.</p>
        <button
          onClick={onNew}
          className="mt-2 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-4 py-2 rounded-lg transition-colors cursor-pointer"
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setLabelFilter(LABEL_FILTER_ALL)}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer",
              labelFilter === LABEL_FILTER_ALL
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            )}
          >
            <Tag className="h-3.5 w-3.5 text-zinc-400" />
            Todas as etiquetas
          </button>
          {automationLabels.map((lbl) => (
            <button
              key={lbl.id}
              onClick={() => setLabelFilter(lbl.id)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer",
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
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
        >
          <Settings className="h-3.5 w-3.5" />
          Gerenciar etiquetas
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {automations.map((aut) => (
          <div
            key={aut.id}
            className="flex items-center justify-between gap-4 bg-white border border-zinc-200/80 rounded-xl px-5 py-4 shadow-xs hover:shadow-sm transition-all"
          >
            {/* Toggle + Name */}
            <div className="flex items-center gap-4 min-w-0">
              <button
                onClick={() => onToggle(aut.id)}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors shrink-0 cursor-pointer",
                  aut.active ? "bg-amber-500" : "bg-zinc-300"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                    aut.active ? "left-5" : "left-0.5"
                  )}
                />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-zinc-900 truncate">
                    {aut.name}
                  </h4>
                  {aut.trigger && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                      {TRIGGER_LABELS[aut.trigger] ?? aut.trigger}
                    </span>
                  )}
                </div>
                {aut.description && (
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {aut.description}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-zinc-400 mr-2 hidden sm:inline">
                {aut.executionCount} execuções
              </span>

              <button
                onClick={() => onEdit(aut.id)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Editar automação"
              >
                <Edit2 className="h-4 w-4" />
              </button>

              <button
                onClick={() => onDuplicate(aut.id)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Duplicar automação"
              >
                <Copy className="h-4 w-4" />
              </button>

              <button
                onClick={() => onDelete(aut.id)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors cursor-pointer",
                  deleteConfirmId === aut.id
                    ? "text-red-600 bg-red-50 hover:bg-red-100"
                    : "text-zinc-400 hover:text-red-500 hover:bg-zinc-100"
                )}
                title={deleteConfirmId === aut.id ? "Clique para confirmar exclusão" : "Excluir automação"}
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

// ── Histórico Tab ────────────────────────────────────────────────────────────

function HistoricoTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-xl border border-zinc-200/80 p-8 text-center">
      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500">
        <History className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-900">Histórico de Execuções</h3>
      <p className="text-xs text-zinc-400 max-w-sm">
        As execuções das suas automações em tempo real serão listadas aqui conforme novos eventos forem processados pelo motor.
      </p>
    </div>
  );
}

// Vendedor não gerencia automações. O banco já recusa (a RLS de `automations`
// exige is_ws_manager para insert/update/delete -- um insert como vendedor
// volta 42501), mas até agora a tela abria inteira e a recusa chegava como
// nada acontecendo. Este é o gate de cliente; a RLS continua sendo o que vale.
export default function AutomacoesPage() {
  return (
    <RequireCapability capability="gerenciar_automacoes">
      <AutomacoesPageContent />
    </RequireCapability>
  );
}
