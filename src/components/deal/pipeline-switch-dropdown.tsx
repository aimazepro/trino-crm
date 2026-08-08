"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowRight, ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Deal, Pipeline } from "@/lib/crm-types";

interface PipelineSwitchDropdownProps {
  deal: Deal;
  pipelines: Pipeline[];
  onMoveStage: (stageId: string) => void;
  onMovePipeline: (pipelineId: string, stageId: string) => void;
}

export function PipelineSwitchDropdown({ deal, pipelines, onMoveStage, onMovePipeline }: PipelineSwitchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pipeline" | "stage">("pipeline");
  const [pickedPipelineId, setPickedPipelineId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const currentPipeline = pipelines.find(p => p.id === deal.pipelineId);
  const canMove = deal.status === "Ativo";

  const close = () => {
    setOpen(false);
    setStep("pipeline");
    setPickedPipelineId(null);
    setPendingStageId(null);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startStageStep = (pipelineId: string) => {
    setPickedPipelineId(pipelineId);
    const isSamePipeline = pipelineId === deal.pipelineId;
    setPendingStageId(isSamePipeline ? deal.stageId : (pipelines.find(p => p.id === pipelineId)?.stages[0]?.id ?? null));
    setStep("stage");
  };

  const handleSave = () => {
    if (!pickedPipelineId || !pendingStageId) return;
    if (pickedPipelineId === deal.pipelineId) {
      onMoveStage(pendingStageId);
    } else {
      onMovePipeline(pickedPipelineId, pendingStageId);
    }
    close();
  };

  const filteredPipelines = query.trim()
    ? pipelines.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : pipelines;

  const pickedPipeline = pipelines.find(p => p.id === pickedPipelineId);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => canMove && setOpen(v => !v)}
        disabled={!canMove}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-zinc-400 hover:text-amber-600 hover:bg-amber-50 transition-colors group disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400"
      >
        <span className="font-medium text-zinc-500 group-hover:text-amber-600">{currentPipeline?.name}</span>
        <ArrowRight size={12} className="h-3 w-3 text-zinc-400 group-hover:text-amber-600" />
        <span>{currentPipeline?.stages.find(s => s.id === deal.stageId)?.name}</span>
        <ChevronDown size={12} className="h-3 w-3 ml-0.5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-zinc-200 rounded-xl z-50 p-1 normal-case font-medium shadow-lg">
          {step === "pipeline" ? (
            <>
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-zinc-100 mb-1">
                <Search size={13} className="text-zinc-400 shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar funil..."
                  className="flex-1 text-xs outline-none bg-transparent"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredPipelines.map(p => (
                  <button
                    key={p.id}
                    onClick={() => startStageStep(p.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs font-semibold hover:bg-zinc-50 rounded-lg transition-colors flex items-center justify-between",
                      p.id === deal.pipelineId ? "text-amber-600 bg-amber-50/50 font-bold" : "text-zinc-700"
                    )}
                  >
                    <span>{p.name}</span>
                    {p.id === deal.pipelineId && <Check size={14} className="text-amber-500" />}
                  </button>
                ))}
                {filteredPipelines.length === 0 && (
                  <p className="px-3 py-4 text-xs text-zinc-400 text-center">Nenhum funil encontrado</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {pickedPipeline?.name}
              </div>
              <div className="max-h-60 overflow-y-auto mb-1">
                {pickedPipeline?.stages.map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => setPendingStageId(stage.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs font-semibold hover:bg-zinc-50 rounded-lg transition-colors flex items-center justify-between",
                      stage.id === pendingStageId ? "text-amber-600 bg-amber-50/50 font-bold" : "text-zinc-700"
                    )}
                  >
                    <span>{stage.name}</span>
                    {stage.id === pendingStageId && <Check size={14} className="text-amber-500" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 px-2 py-1.5 border-t border-zinc-100">
                <button onClick={() => setStep("pipeline")} className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:bg-zinc-50 rounded-lg">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!pendingStageId}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
