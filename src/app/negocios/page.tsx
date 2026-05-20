"use client";

import { useState, useEffect } from "react";
import { Search, LayoutGrid, List, Eye, Trophy, XCircle, Download, Plus, Settings as SettingsIcon, HelpCircle, Bell, Filter } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { PipelineSelector } from "@/components/kanban/pipeline-selector";
import { PipelineModal } from "@/components/kanban/pipeline-modal";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { KanbanListView } from "@/components/kanban/kanban-list-view";
import { NewDealModal } from "@/components/pipeline/new-deal-modal";
import { ColumnsModal } from "@/components/kanban/columns-modal";
import { cn } from "@/lib/utils";

export default function KanbanPage() {
  const { state } = useCrm();
  const [activePipelineId, setActivePipelineId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  
  // Modals
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [editPipelineId, setEditPipelineId] = useState<string | null>(null);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [initialStageId, setInitialStageId] = useState<string | undefined>(undefined);
  const [showColumnsModal, setShowColumnsModal] = useState(false);

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
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500 bg-[#F4F4F5]">
      
      {/* Main Secondary Header (Title & Actions) */}
      <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-3.5">
         <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-zinc-900">Negócios</h1>
            
            <div className="w-[180px]">
              <PipelineSelector 
                activeId={activePipelineId} 
                onChange={setActivePipelineId} 
                onNew={() => setShowNewPipelineModal(true)}
                onEdit={(id) => setEditPipelineId(id)}
              />
            </div>
         </div>

         {/* Toolbar */}
         <div className="flex items-center gap-2">
            
            {/* View Mode */}
            <div className="flex items-center rounded-lg border border-zinc-200 overflow-hidden">
               <button 
                 onClick={() => setViewMode("kanban")}
                 className={cn("flex items-center justify-center px-2.5 py-1.5 border-r border-zinc-200 transition-colors", viewMode === "kanban" ? "bg-zinc-100 text-zinc-800" : "bg-white text-zinc-400 hover:text-zinc-600")}
                 title="Visualização kanban"
               >
                 <LayoutGrid size={16} />
               </button>
               <button 
                 onClick={() => setViewMode("list")}
                 className={cn("flex items-center justify-center px-2.5 py-1.5 transition-colors", viewMode === "list" ? "bg-zinc-100 text-zinc-800" : "bg-white text-zinc-400 hover:text-zinc-600")}
                 title="Visualização em lista"
               >
                 <List size={16} />
               </button>
            </div>

            {/* Stage Filters */}
            <button className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors border-zinc-300 bg-zinc-100 text-zinc-800">
               <Eye size={14} /> 
               Ativos
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors border-zinc-200 text-zinc-500 hover:bg-zinc-50">
               <Trophy size={14} /> 
               Ganhos
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors border-zinc-200 text-zinc-500 hover:bg-zinc-50">
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
              onClick={() => setShowColumnsModal(true)} 
              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 hover:bg-zinc-50 transition-colors"
            >
              <SettingsIcon size={16} />
            </button>
         </div>
      </div>

      {/* Main Board / List View Area */}
      <div className="flex-1 overflow-hidden relative">
         {viewMode === "kanban" ? (
           <div className="h-full overflow-x-auto overflow-y-hidden hide-scrollbar py-6 px-8">
              <KanbanBoard pipelineId={activePipelineId} onNewDeal={openNewDealModal} />
           </div>
         ) : (
           <div className="p-6">
             <KanbanListView pipelineId={activePipelineId} />
           </div>
         )}
      </div>
      
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

      {showColumnsModal && (
        <ColumnsModal onClose={() => setShowColumnsModal(false)} />
      )}
    </div>
  );
}
