"use client";

import { use } from "react";
import Link from "next/link";
import { useCrm } from "@/contexts/crm-context";
import { DealSidebar } from "@/components/deal/deal-sidebar";
import { DealTabs } from "@/components/deal/deal-tabs";
import { ArrowLeft, Check, ChevronDown, MoreVertical, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, markDealStatus, moveDeal } = useCrm();
  
  const deal = state.deals.find(d => d.id === id);
  const pipeline = state.pipelines.find(p => p.id === deal?.pipelineId);
  const company = state.companies.find(c => c.id === deal?.companyId);

  if (!deal || !pipeline) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full animate-in fade-in">
        <h2 className="text-xl font-bold mb-4">Negócio não encontrado</h2>
        <Link href="/negocios" className="px-6 py-2 bg-amber-500 text-white rounded-xl shadow-sm">
          Voltar para o Kanban
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] -mt-2 -mx-2 animate-in fade-in bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      
      {/* Header Profile Area */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/negocios" className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </Link>
          
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 font-bold flex items-center justify-center text-sm shadow-sm border border-gray-200">
                {company ? company.name.charAt(0).toUpperCase() : deal.title.charAt(0).toUpperCase()}
             </div>
             <div>
               <h1 className="text-lg font-bold text-gray-900 leading-none mb-1">{deal.title}</h1>
               <div className="flex items-center gap-1 text-[11px] font-bold text-gray-500 tracking-wide uppercase">
                 {pipeline.name} <ChevronDown size={12} className="opacity-50" />
               </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           {/* Owner Avatar */}
           <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
             <div className="text-right hidden sm:block">
               <div className="text-xs font-bold text-gray-900">João Paulo</div>
               <div className="text-[10px] text-gray-400 font-medium tracking-wider">Proprietário</div>
             </div>
             <img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" alt="User" className="w-8 h-8 rounded-full border border-gray-200 shadow-sm" />
           </div>

           {deal.status === "Ativo" && (
             <>
               <button 
                 onClick={() => markDealStatus(deal.id, "Perdido")}
                 className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 font-bold text-xs rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors bg-white shadow-sm"
               >
                 <XCircle size={14} /> Perdido
               </button>
               <button 
                 onClick={() => markDealStatus(deal.id, "Ganho")}
                 className="flex items-center gap-1.5 px-3 py-1.5 border border-green-500 bg-[#25D366] text-white font-bold text-xs rounded-lg hover:bg-[#1DA851] transition-colors shadow-sm shadow-[#25D366]/20"
               >
                 <Check size={14} /> Ganho
               </button>
             </>
           )}

           {deal.status !== "Ativo" && (
             <div className={cn(
                "px-3 py-1.5 font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 border", 
                deal.status === "Ganho" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
             )}>
                {deal.status === "Ganho" ? <Trophy size={14} /> : <XCircle size={14} />}
                NEGÓCIO {deal.status.toUpperCase()}
             </div>
           )}

           <button className="p-1.5 text-gray-400 hover:text-gray-700 border border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-lg transition-colors ml-1">
              <MoreVertical size={16} />
           </button>
        </div>
      </div>

      {/* Visual Pipeline Stages Strip */}
      <div className="flex border-b border-gray-100 bg-gray-50/50 shrink-0 overflow-x-auto hide-scrollbar p-2 px-4 gap-1">
         {pipeline.stages.map((stage) => {
            const isActive = stage.id === deal.stageId;
            // Only allow clicking to move if the deal is Ativo
            const canMove = deal.status === "Ativo";
            return (
              <button
                key={stage.id}
                onClick={() => canMove && moveDeal(deal.id, stage.id)}
                className={cn(
                  "flex-1 min-w-[120px] py-2 px-2 text-[11px] font-bold tracking-widest uppercase rounded-lg border transition-all text-center truncate",
                  isActive 
                    ? "bg-gray-900 border-gray-900 text-white shadow-md shadow-gray-900/10" 
                    : canMove 
                       ? "bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50"
                       : "bg-white border-gray-200 text-gray-300 cursor-not-allowed"
                )}
              >
                {stage.name}
              </button>
            )
         })}
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex overflow-hidden">
         <DealSidebar dealId={deal.id} />
         <DealTabs dealId={deal.id} />
      </div>

    </div>
  );
}
