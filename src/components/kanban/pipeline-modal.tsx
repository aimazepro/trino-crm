"use client";

import { useState } from "react";
import { X, GripVertical, Plus } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Pipeline, PipelineStage } from "@/lib/crm-types";

interface PipelineModalProps {
  onClose: () => void;
  onSuccess: (newId: string) => void;
  editPipelineId?: string; // If passed, modal is in EDIT mode
}

export function PipelineModal({ onClose, onSuccess, editPipelineId }: PipelineModalProps) {
  const { state, addPipeline, updatePipeline } = useCrm();
  const existingPipe = editPipelineId ? state.pipelines.find(p => p.id === editPipelineId) : null;
  
  const [name, setName] = useState(existingPipe?.name || "");
  const [stages, setStages] = useState<{ id: string; name: string; days: number }[]>(
    existingPipe ? existingPipe.stages.map(s => ({ id: s.id, name: s.name, days: s.maxDays })) : [
      { id: "1", name: "Prospecção", days: 7 },
      { id: "2", name: "Qualificação", days: 7 },
      { id: "3", name: "Proposta", days: 7 },
      { id: "4", name: "Negociação", days: 7 },
    ]
  );
  const [newStageName, setNewStageName] = useState("");

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    setStages([...stages, { id: Date.now().toString(), name: newStageName, days: 7 }]);
    setNewStageName("");
  };

  const removeStage = (id: string) => {
    setStages(stages.filter(s => s.id !== id));
  };

  const handleSave = () => {
    if (!name.trim() || stages.length === 0) return;
    
    const formattedStages = stages.map((s, idx) => ({
      id: s.id.includes('stage_') ? s.id : `stage_${Date.now()}_${idx}`,
      name: s.name,
      maxDays: s.days,
      order: idx
    }));

    if (existingPipe) {
      updatePipeline(existingPipe.id, { name, stages: formattedStages });
      onSuccess(existingPipe.id);
    } else {
      const newPipeline: Pipeline = {
        id: `pipe_${Date.now()}`,
        name,
        stages: formattedStages
      };
      addPipeline(newPipeline);
      onSuccess(newPipeline.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{existingPipe ? "Editar Pipeline" : "Novo Pipeline"}</h2>
            <p className="text-sm text-gray-500 mt-1">Configure o nome, etapas e tempo de estagnacao por etapa.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors mb-auto">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900 block">Nome do Pipeline</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Outbound, Enterprise..."
              className="w-full border border-amber-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 placeholder:text-gray-400"
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <div>
               <label className="text-sm font-semibold text-gray-900 block">Etapas</label>
               <p className="text-xs text-gray-500 mt-0.5">Defina os dias máximos por etapa. Negócios que ultrapassarem serão destacados em vermelho.</p>
            </div>

            <div className="space-y-2">
              {stages.map((stage, idx) => (
                <div key={stage.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm">
                  <div className="p-2 text-gray-300 cursor-grab"><GripVertical size={16}/></div>
                  <input 
                    value={stage.name}
                    onChange={(e) => {
                      const newStages = [...stages];
                      newStages[idx].name = e.target.value;
                      setStages(newStages);
                    }}
                    className="flex-1 bg-transparent text-sm border-none outline-none font-medium text-gray-700" 
                  />
                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 mr-1">
                     <input 
                       type="number" 
                       value={stage.days}
                       onChange={(e) => {
                         const newStages = [...stages];
                         newStages[idx].days = Number(e.target.value);
                         setStages(newStages);
                       }}
                       className="w-10 bg-transparent text-center text-sm font-medium outline-none hiding-arrows"
                     />
                     <span className="text-xs text-gray-500 font-medium mr-1">dias</span>
                  </div>
                  <button onClick={() => removeStage(stage.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors mr-1">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
               <input 
                 value={newStageName} 
                 onChange={e => setNewStageName(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleAddStage()}
                 placeholder="Nova etapa..."
                 className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-gray-300"
               />
               <button onClick={handleAddStage} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 shadow-sm flex items-center gap-1.5 shrink-0">
                  <Plus size={16} /> Adicionar
               </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 bg-gray-50 mt-auto border-t border-gray-100">
           <button 
             onClick={handleSave}
             disabled={!name.trim() || stages.length === 0}
             className="w-full py-3 bg-[#F8D595] hover:bg-[#F2C979] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-sm"
           >
             {existingPipe ? "Salvar Alterações" : "Criar Pipeline"}
           </button>
        </div>

      </div>
    </div>
  );
}
