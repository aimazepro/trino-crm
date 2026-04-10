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
  const [showColumnsModal, setShowColumnsModal] = useState(false);

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
    <div className="flex flex-col h-[calc(100vh-20px)] overflow-hidden animate-in fade-in duration-500 bg-gray-50/30 -mt-6 -mx-8 px-8">
      
      {/* Main Secondary Header (Title & Actions) */}
      <div className="flex items-center justify-between py-5 shrink-0">
         <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Negócios</h1>
            <div className="w-px h-6 bg-gray-200"></div>
            
            <div className="w-48">
              <PipelineSelector 
                activeId={activePipelineId} 
                onChange={setActivePipelineId} 
                onNew={() => setShowNewPipelineModal(true)}
                onEdit={(id) => setEditPipelineId(id)}
              />
            </div>
         </div>

         {/* Toolbar */}
         <div className="flex items-center gap-3">
            {/* View Toggles */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200 shadow-sm">
               <button 
                 onClick={() => setViewMode("kanban")}
                 className={cn("p-1.5 rounded-md transition-colors", viewMode === "kanban" ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600")}
               >
                 <LayoutGrid size={16}/>
               </button>
               <button 
                 onClick={() => setViewMode("list")}
                 className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600")}
               >
                 <List size={16}/>
               </button>
            </div>

            <div className="w-px h-6 bg-gray-200"></div>

            {/* Stage Filters */}
            <div className="flex bg-white rounded-lg border border-gray-200 shadow-sm p-0.5">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 font-bold text-xs rounded-md shadow-sm">
                <Eye size={14} className="text-gray-500" />
                Ativos
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 text-gray-500 font-medium text-xs rounded-md hover:bg-gray-50 transition-colors">
                <Trophy size={14} className="text-gray-400" />
                Ganhos
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 text-gray-500 font-medium text-xs rounded-md hover:bg-gray-50 transition-colors">
                <XCircle size={14} className="text-gray-400" />
                Perdidos
              </button>
            </div>

            <div className="w-px h-6 bg-gray-200"></div>

            <button className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
              <Download size={14} className="text-gray-400" />
              Exportar
            </button>
            
            <button 
              onClick={() => setShowNewDealModal(true)}
              className="flex items-center gap-2 px-5 py-1.5 bg-amber-500 text-white font-bold text-sm rounded-lg shadow-sm shadow-amber-500/20 hover:bg-amber-600 transition-colors whitespace-nowrap"
            >
              <Plus size={16} />
              Novo Negócio
            </button>

            <button onClick={() => setShowColumnsModal(true)} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors border border-gray-200 hover:bg-gray-50 rounded-lg bg-white shadow-sm ml-1">
              <SettingsIcon size={18} />
            </button>
         </div>
      </div>

      {/* Main Board / List View Area */}
      <div className="flex-1 overflow-hidden relative">
         {viewMode === "kanban" ? (
           <div className="h-full overflow-x-auto overflow-y-hidden hide-scrollbar pb-4 -mx-4 px-4">
              <KanbanBoard pipelineId={activePipelineId} />
           </div>
         ) : (
           <KanbanListView pipelineId={activePipelineId} />
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
          onClose={() => setShowNewDealModal(false)}
        />
      )}

      {showColumnsModal && (
        <ColumnsModal onClose={() => setShowColumnsModal(false)} />
      )}
    </div>
  );
}
