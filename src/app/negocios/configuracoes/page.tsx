"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, GripVertical, Plus, Trash2 } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { PipelineSelector } from "@/components/kanban/pipeline-selector";
import { PipelineModal } from "@/components/kanban/pipeline-modal";

interface StageRow {
  id: string;
  name: string;
  days: number;
}

export default function PipelineConfigPage() {
  const router = useRouter();
  const { state, updatePipeline } = useCrm();

  const [activePipelineId, setActivePipelineId] = useState(state.pipelines[0]?.id || "");
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [editPipelineId, setEditPipelineId] = useState<string | null>(null);

  const pipeline = state.pipelines.find(p => p.id === activePipelineId);

  const [stages, setStages] = useState<StageRow[]>(
    pipeline?.stages.map(s => ({ id: s.id, name: s.name, days: s.maxDays })) || []
  );
  const [newStageName, setNewStageName] = useState("");
  const [saving, setSaving] = useState(false);

  // Keep stages in sync when pipeline changes
  const lastPipelineId = useRef(activePipelineId);
  if (activePipelineId !== lastPipelineId.current) {
    lastPipelineId.current = activePipelineId;
    const newPipe = state.pipelines.find(p => p.id === activePipelineId);
    setStages(newPipe?.stages.map(s => ({ id: s.id, name: s.name, days: s.maxDays })) || []);
  }

  const handleDaysChange = (id: string, delta: number) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, days: Math.max(1, s.days + delta) } : s));
  };

  const handleNameChange = (id: string, name: string) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  const handleDelete = (id: string) => {
    setStages(prev => prev.filter(s => s.id !== id));
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    setStages(prev => [...prev, { id: `stage_${Date.now()}`, name: newStageName.trim(), days: 7 }]);
    setNewStageName("");
  };

  const handleSave = async () => {
    if (!pipeline || saving) return;
    setSaving(true);
    const formatted = stages.map((s, idx) => ({
      id: s.id,
      name: s.name,
      maxDays: s.days,
      order: idx,
    }));
    await updatePipeline(pipeline.id, { stages: formatted });
    setSaving(false);
  };

  // Drag-and-drop state
  const dragIndex = useRef<number | null>(null);

  const handleDragStart = (idx: number) => { dragIndex.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === idx) return;
    const updated = [...stages];
    const [moved] = updated.splice(dragIndex.current, 1);
    updated.splice(idx, 0, moved);
    dragIndex.current = idx;
    setStages(updated);
  };
  const handleDragEnd = () => { dragIndex.current = null; };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center gap-4 border-b border-zinc-100 bg-white px-6 py-3.5">
        <button
          onClick={() => router.push("/negocios")}
          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-zinc-900">Configurações do Pipeline</h1>

        <div className="w-[180px] ml-2">
          <PipelineSelector
            activeId={activePipelineId}
            onChange={id => setActivePipelineId(id)}
            onNew={() => setShowNewPipelineModal(true)}
            onEdit={id => setEditPipelineId(id)}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">

          {pipeline ? (
            <>
              <p className="text-sm font-semibold text-zinc-500 mb-5">
                Etapas de <span className="text-amber-500">{pipeline.name}</span>
              </p>

              <div className="space-y-2 mb-4">
                {stages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl px-4 py-3 shadow-sm group cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical size={16} className="text-zinc-300 shrink-0" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 shrink-0" />

                    <input
                      value={stage.name}
                      onChange={e => handleNameChange(stage.id, e.target.value)}
                      className="flex-1 text-sm font-medium text-zinc-800 bg-transparent outline-none border-b border-transparent focus:border-amber-400 transition-colors py-0.5"
                    />

                    <span className="text-xs font-medium text-zinc-400 shrink-0">Estag.</span>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleDaysChange(stage.id, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50 text-sm font-bold transition-colors"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-zinc-800">{stage.days}</span>
                      <button
                        onClick={() => handleDaysChange(stage.id, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50 text-sm font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs text-zinc-400 shrink-0">dias</span>

                    <button
                      onClick={() => handleDelete(stage.id)}
                      className="ml-1 p-1 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Nova Etapa */}
              <div className="flex gap-2 mb-6">
                <input
                  value={newStageName}
                  onChange={e => setNewStageName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddStage()}
                  placeholder="+ Nova Etapa"
                  className="flex-1 border border-dashed border-zinc-300 rounded-xl px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-400 focus:outline-none focus:border-amber-400 bg-white transition-colors"
                />
                {newStageName.trim() && (
                  <button
                    onClick={handleAddStage}
                    className="px-4 py-3 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors flex items-center gap-2"
                  >
                    <Plus size={15} /> Adicionar
                  </button>
                )}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </>
          ) : (
            <div className="text-center text-zinc-400 mt-20">
              <p className="text-sm">Nenhum pipeline encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {showNewPipelineModal && (
        <PipelineModal
          onClose={() => setShowNewPipelineModal(false)}
          onSuccess={id => { setActivePipelineId(id); setShowNewPipelineModal(false); }}
        />
      )}
      {editPipelineId && (
        <PipelineModal
          editPipelineId={editPipelineId}
          onClose={() => setEditPipelineId(null)}
          onSuccess={() => setEditPipelineId(null)}
        />
      )}
    </div>
  );
}
