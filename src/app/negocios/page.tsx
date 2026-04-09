"use client";

import { useState, useEffect } from "react";
import { useCrm } from "@/contexts/crm-context";
import { PipelineSelector } from "@/components/kanban/pipeline-selector";
import { KanbanToolbar } from "@/components/kanban/kanban-toolbar";
import { PipelineModal } from "@/components/kanban/pipeline-modal";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { NewDealModal } from "@/components/pipeline/new-deal-modal";

export default function KanbanPage() {
  const { state } = useCrm();
  const [activePipelineId, setActivePipelineId] = useState<string>("");
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [showNewDealModal, setShowNewDealModal] = useState(false);

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
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      {/* Selector Line */}
      <div className="flex items-center justify-between mb-4 shrink-0">
         <PipelineSelector 
           activeId={activePipelineId} 
           onChange={setActivePipelineId} 
           onNew={() => setShowNewPipelineModal(true)} 
         />
      </div>

      {/* Toolbar Line */}
      <KanbanToolbar onNewDeal={() => setShowNewDealModal(true)} />

      {/* Main Drag-n-drop Board */}
      <div className="flex-1 overflow-x-auto pb-4 -mx-2 px-2 relative">
         <KanbanBoard pipelineId={activePipelineId} />
      </div>
      
      {/* Modals */}
      {showNewPipelineModal && (
        <PipelineModal 
          onClose={() => setShowNewPipelineModal(false)}
          onSuccess={(id) => { setActivePipelineId(id); setShowNewPipelineModal(false); }}
        />
      )}
      
      {showNewDealModal && (
        <NewDealModal
          activePipelineId={activePipelineId}
          onClose={() => setShowNewDealModal(false)}
        />
      )}
    </div>
  );
}
