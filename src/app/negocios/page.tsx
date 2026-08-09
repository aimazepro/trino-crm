"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Eye, Trophy, XCircle, Download, Plus, Settings as SettingsIcon, ChevronDown, Check } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { PipelineSelector } from "@/components/kanban/pipeline-selector";
import { PipelineModal } from "@/components/kanban/pipeline-modal";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { KanbanListView } from "@/components/kanban/kanban-list-view";
import { NewDealModal } from "@/components/pipeline/new-deal-modal";
import { CustomizeColumnsModal, DEFAULT_COLUMNS } from "@/components/deal/customize-columns-modal";
import { cn } from "@/lib/utils";
import { LeadStatus } from "@/lib/crm-types";

const STATUS_OPTIONS: { value: LeadStatus; label: string; icon: typeof Eye }[] = [
  { value: "Ativo", label: "Ativos", icon: Eye },
  { value: "Ganho", label: "Ganhos", icon: Trophy },
  { value: "Perdido", label: "Perdidos", icon: XCircle },
];

export default function KanbanPage() {
  const router = useRouter();
  const { state, loading } = useCrm();
  const [activePipelineId, setActivePipelineId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("trino_crm_view_mode");
      if (saved === "list" || saved === "kanban") return saved;
    }
    return "kanban";
  });
  const [statusFilter, setStatusFilter] = useState<LeadStatus>("Ativo");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Modals
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [editPipelineId, setEditPipelineId] = useState<string | null>(null);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [initialStageId, setInitialStageId] = useState<string | undefined>(undefined);
  const [showCustomizeColumnsModal, setShowCustomizeColumnsModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);

  useEffect(() => {
    const saved = localStorage.getItem("trino_crm_deals_list_columns");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleColumns(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved columns", e);
      }
    }
  }, []);

  const handleSaveColumns = (newCols: string[]) => {
    setVisibleColumns(newCols);
    localStorage.setItem("trino_crm_deals_list_columns", JSON.stringify(newCols));
    setShowCustomizeColumnsModal(false);
  };

  const openNewDealModal = (stageId?: string) => {
     setInitialStageId(stageId);
     setShowNewDealModal(true);
  };

  // set initial pipeline safely
  useEffect(() => {
    if (!activePipelineId && state.pipelines.length > 0) {
      setActivePipelineId(state.pipelines[0].id);
    }
  }, [state.pipelines, activePipelineId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state.pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 animate-in fade-in">
        <h2 className="text-xl font-bold mb-4">Nenhum Pipeline Encontrado</h2>
        <button 
          onClick={() => setShowNewPipelineModal(true)}
          className="px-6 py-2 bg-amber-500 text-white rounded-xl shadow-lg"
        >
          Criar Primeiro Pipeline
        </button>
        {showNewPipelineModal && (
          <PipelineModal 
            onClose={() => setShowNewPipelineModal(false)}
            onSuccess={(id) => { setActivePipelineId(id); setShowNewPipelineModal(false); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col animate-in fade-in duration-500">

      {/* Main Secondary Header (Title & Actions) */}
      <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-3.5">
         <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-zinc-900">Negócios</h1>

            <PipelineSelector
              activeId={activePipelineId}
              onChange={setActivePipelineId}
              onNew={() => setShowNewPipelineModal(true)}
              onEdit={(id) => setEditPipelineId(id)}
            />
         </div>

         {/* Toolbar */}
         <div className="flex items-center gap-2">
            
            {/* View Mode */}
            <div className="flex items-center rounded-lg border border-zinc-200 overflow-hidden">
               <button
                 onClick={() => { setViewMode("kanban"); localStorage.setItem("trino_crm_view_mode", "kanban"); }}
                 className={cn("flex items-center justify-center px-2.5 py-1.5 border-r border-zinc-200 transition-colors", viewMode === "kanban" ? "bg-zinc-100 text-zinc-800" : "bg-white text-zinc-400 hover:text-zinc-600")}
                 title="Visualização kanban"
               >
                 <LayoutGrid size={16} />
               </button>
               <button
                 onClick={() => { setViewMode("list"); localStorage.setItem("trino_crm_view_mode", "list"); }}
                 className={cn("flex items-center justify-center px-2.5 py-1.5 transition-colors", viewMode === "list" ? "bg-zinc-100 text-zinc-800" : "bg-white text-zinc-400 hover:text-zinc-600")}
                 title="Visualização em lista"
               >
                 <List size={16} />
               </button>
            </div>

            {/* Stage Filter */}
            <div className="relative" ref={statusMenuRef}>
              <button
                onClick={() => setShowStatusMenu(v => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                {(() => { const Icon = STATUS_OPTIONS.find(o => o.value === statusFilter)?.icon ?? Eye; return <Icon size={14} className="text-zinc-400 shrink-0" />; })()}
                {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
                <ChevronDown size={14} className="text-zinc-400" />
              </button>

              {showStatusMenu && (
                <div className="absolute left-0 top-full z-50 mt-2 w-40 rounded-xl border border-zinc-100 bg-white py-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  {STATUS_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const isActive = opt.value === statusFilter;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => { setStatusFilter(opt.value); setShowStatusMenu(false); }}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50"
                      >
                        <div className="flex w-4 shrink-0 justify-center">
                          {isActive && <Check size={14} className="text-zinc-900" />}
                        </div>
                        <Icon size={14} className={isActive ? "text-zinc-900" : "text-zinc-400"} />
                        <span className={cn(isActive ? "font-semibold text-zinc-900" : "font-medium text-zinc-600")}>
                          {opt.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Exportar */}
            <button disabled className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50 transition-colors disabled:opacity-50">
              <Download size={14} /> 
              Exportar
            </button>
            
            {/* Novo Negócio */}
            <button 
              onClick={() => openNewDealModal()}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-1.5 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 transition-all shadow-sm hover:shadow-md"
            >
              <Plus size={16} /> 
              Novo Negócio
            </button>

            {/* Configs */}
            <button
              onClick={() => {
                if (viewMode === "list") {
                  setShowCustomizeColumnsModal(true);
                } else {
                  router.push("/negocios/configuracoes");
                }
              }}
              title={viewMode === "list" ? "Personalizar colunas" : "Configurações"}
              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 hover:bg-zinc-50 transition-colors"
            >
              <SettingsIcon size={16} />
            </button>
         </div>
      </div>

      {/* Main Board / List View Area */}
      {viewMode === "kanban" ? (
        <div className="flex-1 overflow-hidden p-6">
          <div className="relative h-full">
            <KanbanBoard pipelineId={activePipelineId} onNewDeal={openNewDealModal} statusFilter={statusFilter} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden p-6">
          <KanbanListView pipelineId={activePipelineId} statusFilter={statusFilter} columns={visibleColumns} />
        </div>
      )}
      
      {/* Modals */}
      {showNewPipelineModal && (
        <PipelineModal 
          onClose={() => setShowNewPipelineModal(false)}
          onSuccess={(id) => { setActivePipelineId(id); setShowNewPipelineModal(false); }}
        />
      )}

      {editPipelineId && (
        <PipelineModal 
          editPipelineId={editPipelineId}
          onClose={() => setEditPipelineId(null)}
          onSuccess={() => setEditPipelineId(null)}
        />
      )}
      
      {showNewDealModal && (
        <NewDealModal
          activePipelineId={activePipelineId}
          initialStageId={initialStageId}
          onClose={() => setShowNewDealModal(false)}
        />
      )}

      {showCustomizeColumnsModal && (
        <CustomizeColumnsModal
          initialColumns={visibleColumns}
          onClose={() => setShowCustomizeColumnsModal(false)}
          onSave={handleSaveColumns}
        />
      )}

    </div>
  );
}
