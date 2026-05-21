"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useCrm } from "@/contexts/crm-context";
import { DealSidebar } from "@/components/deal/deal-sidebar";
import { DealTabs } from "@/components/deal/deal-tabs";
import { LossReasonModal } from "@/components/deal/loss-reason-modal";
import { ArrowLeft, ArrowRight, Check, ChevronDown, MoreVertical, Trophy, CircleX, CircleCheck, Trash2, Play, Edit2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { state, markDealStatus, moveDeal, deleteDeal, updateDealFields } = useCrm();
  
  const [showLossModal, setShowLossModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showStageDropdown, setShowStageDropdown] = useState(false);

  const deal = state.deals.find(d => d.id === id);
  const pipeline = state.pipelines.find(p => p.id === deal?.pipelineId);
  const company = state.companies.find(c => c.id === deal?.companyId);

  const [titleValue, setTitleValue] = useState("");

  useEffect(() => {
    if (deal) {
      setTitleValue(deal.title);
    }
  }, [deal?.title]);

  if (!deal || !pipeline) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full animate-in fade-in">
        <h2 className="text-xl font-bold mb-4">Negócio não encontrado</h2>
        <Link href="/negocios" className="px-6 py-2 bg-amber-500 text-white rounded-xl">
          Voltar para o Kanban
        </Link>
      </div>
    );
  }

  const handleTitleBlur = () => {
    if (titleValue.trim() && titleValue !== deal.title) {
      updateDealFields(deal.id, { title: titleValue });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      setTitleValue(deal.title);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in bg-white overflow-hidden">
      
      {/* Header Profile Area */}
      <div className="flex items-center gap-3 bg-white px-6 py-4 border-b border-zinc-100 shrink-0">
        <Link href="/negocios" className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        
        <div className="flex-1 min-w-0">
          <input 
            type="text"
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="text-base font-semibold text-zinc-800 truncate bg-transparent outline-none border-b border-transparent hover:border-zinc-200 focus:border-amber-400 w-full transition-colors"
          />
          
          {/* Pipeline & Process stage selection dropdown */}
          <div className="relative inline-block">
            <button
              onClick={() => setShowStageDropdown(!showStageDropdown)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-zinc-400 hover:text-amber-600 hover:bg-amber-50 transition-colors group"
            >
              <span className="font-medium text-zinc-500 group-hover:text-amber-600">{pipeline.name}</span>
              <ArrowRight size={12} className="h-3 w-3 text-zinc-400 group-hover:text-amber-600" />
              <span>{pipeline.stages.find(s => s.id === deal.stageId)?.name}</span>
              <ChevronDown size={12} className="h-3 w-3 ml-0.5" />
            </button>
            
            {showStageDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowStageDropdown(false)} />
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-zinc-200 rounded-xl z-50 p-1 normal-case font-medium">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Alterar Processo ({pipeline.name})
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {pipeline.stages.map((stage) => (
                      <button
                        key={stage.id}
                        onClick={() => {
                          if (deal.status === "Ativo") {
                            moveDeal(deal.id, stage.id);
                          }
                          setShowStageDropdown(false);
                        }}
                        disabled={deal.status !== "Ativo"}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs font-semibold hover:bg-zinc-50 rounded-lg transition-colors flex items-center justify-between",
                          stage.id === deal.stageId ? "text-amber-600 bg-amber-50/50 font-bold" : "text-zinc-700",
                          deal.status !== "Ativo" && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span>{stage.name}</span>
                        {stage.id === deal.stageId && <Check size={14} className="text-amber-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Owner Info */}
        <div className="relative flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/avatar_joao.png" alt="Owner" className="h-7 w-7 rounded-full object-cover" />
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-zinc-700 leading-tight">João Paulo Olivera</p>
              <p className="text-xs text-zinc-400">Proprietário</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {deal.status === "Ativo" && (
            <>
              <button 
                onClick={() => setShowLossModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors bg-white"
              >
                <CircleX size={16} className="h-4 w-4" /> Perdido
              </button>
              <button 
                onClick={() => markDealStatus(deal.id, "Ganho")}
                className="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600 transition-colors"
              >
                <CircleCheck size={16} className="h-4 w-4" /> Ganho
              </button>
            </>
          )}

          {deal.status !== "Ativo" && (
            <>
              <div className={cn(
                 "px-3 py-1.5 font-medium text-sm rounded-lg flex items-center gap-1.5 border", 
                 deal.status === "Ganho" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
              )}>
                 {deal.status === "Ganho" ? <Trophy size={16} className="h-4 w-4" /> : <CircleX size={16} className="h-4 w-4" />}
                 NEGÓCIO {deal.status.toUpperCase()}
              </div>
              <button 
                onClick={() => markDealStatus(deal.id, "Ativo")}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors bg-white"
              >
                <Play size={16} className="h-4 w-4" /> Reabrir
              </button>
            </>
          )}
        </div>

        {/* More Actions Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)} 
            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 hover:bg-zinc-50 transition-colors"
          >
             <MoreVertical size={16} />
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-zinc-200 rounded-xl z-50 p-1">
              <button 
                onClick={() => {
                  deleteDeal(deal.id);
                  router.push("/negocios");
                }} 
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-bold"
              >
                <Trash2 size={16} /> Excluir negócio
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Visual Pipeline Stages Strip */}
      <div className="bg-white px-6 py-3 border-b border-zinc-100 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
           {pipeline.stages.map((stage) => {
              const isActive = stage.id === deal.stageId;
              const canMove = deal.status === "Ativo";
              return (
                <button
                  key={stage.id}
                  onClick={() => canMove && moveDeal(deal.id, stage.id)}
                  disabled={!canMove}
                  className={cn(
                    "flex-1 min-w-[80px] rounded-lg px-3 py-1.5 text-xs font-medium transition-all text-center truncate",
                    isActive 
                      ? "bg-zinc-900 text-white" 
                      : "bg-white text-zinc-400 border border-zinc-200 hover:border-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {stage.name}
                </button>
              )
           })}
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex overflow-hidden w-full relative">
         <DealSidebar dealId={deal.id} />
         <DealTabs dealId={deal.id} />
      </div>

      {showLossModal && (
        <LossReasonModal 
          onConfirm={(reason) => {
            markDealStatus(deal.id, "Perdido", reason);
            setShowLossModal(false);
          }}
          onCancel={() => setShowLossModal(false)}
        />
      )}

    </div>
  );
}
