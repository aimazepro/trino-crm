"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Eye, Trophy, XCircle, Download, Plus, Settings as SettingsIcon } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { PipelineSelector } from "@/components/kanban/pipeline-selector";
import { PipelineModal } from "@/components/kanban/pipeline-modal";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { KanbanListView } from "@/components/kanban/kanban-list-view";
import { NewDealModal } from "@/components/pipeline/new-deal-modal";
import { CustomizeColumnsModal, DEFAULT_COLUMNS } from "@/components/deal/customize-columns-modal";
import { cn } from "@/lib/utils";
import { LeadStatus } from "@/lib/crm-types";

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

            {/* Stage Filters */}
            <button
               onClick={() => setStatusFilter("Ativo")}
               className={cn(
                 "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                 statusFilter === "Ativo"
                   ? "border-zinc-300 bg-zinc-100 text-zinc-800"
                   : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 bg-white"
               )}
             >
                <Eye size={14} /> 
                Ativos
             </button>
             <button
               onClick={() => setStatusFilter("Ganho")}
               className={cn(
                 "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                 statusFilter === "Ganho"
                   ? "border-zinc-300 bg-zinc-100 text-zinc-800"
                   : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 bg-white"
               )}
             >
                <Trophy size={14} /> 
                Ganhos
             </button>
             <button
               onClick={() => setStatusFilter("Perdido")}
               className={cn(
                 "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                 statusFilter === "Perdido"
                   ? "border-zinc-300 bg-zinc-100 text-zinc-800"
                   : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 bg-white"
               )}
             >
                <XCircle size={14} /> 
                Perdidos
             </button>

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
