"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useCrm } from "@/contexts/crm-context";
import { DealSidebar } from "@/components/deal/deal-sidebar";
import { DealTabs } from "@/components/deal/deal-tabs";
import { LossReasonModal } from "@/components/deal/loss-reason-modal";
import { ArrowLeft, Check, ChevronDown, MoreVertical, Trophy, XCircle, Trash2, Play, Edit2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { state, markDealStatus, moveDeal, deleteDeal, updateDealFields } = useCrm();
  
  const [showLossModal, setShowLossModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showStageDropdown, setShowStageDropdown] = useState(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  
  const deal = state.deals.find(d => d.id === id);
  const pipeline = state.pipelines.find(p => p.id === deal?.pipelineId);
  const company = state.companies.find(c => c.id === deal?.companyId);

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

  const startEditingTitle = () => {
    if (deal) {
      setTempTitle(deal.title);
      setIsEditingTitle(true);
    }
  };

  const saveTitle = () => {
    if (deal && tempTitle.trim() && tempTitle !== deal.title) {
      updateDealFields(deal.id, { title: tempTitle });
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in bg-white overflow-hidden">
      
      {/* Header Profile Area */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/negocios" className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </Link>
          
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 font-bold flex items-center justify-center text-sm border border-gray-200">
                {company ? company.name.charAt(0).toUpperCase() : deal.title.charAt(0).toUpperCase()}
             </div>
             <div>
               {isEditingTitle ? (
                 <div className="flex items-center gap-1.5 mb-1">
                   <input 
                     type="text"
                     value={tempTitle}
                     onChange={e => setTempTitle(e.target.value)}
                     className="font-bold text-lg text-gray-900 border-2 border-amber-400 focus:border-amber-400 focus:ring-0 outline-none rounded-lg bg-white px-2 py-0.5 w-48 sm:w-64"
                     autoFocus
                     onKeyDown={e => {
                       if (e.key === "Enter") saveTitle();
                       if (e.key === "Escape") setIsEditingTitle(false);
                     }}
                   />
                   <button onClick={saveTitle} className="text-green-500 hover:bg-green-50 p-1 rounded transition-colors shrink-0"><Check size={16}/></button>
                   <button onClick={() => setIsEditingTitle(false)} className="text-red-400 hover:bg-red-50 p-1 rounded transition-colors shrink-0"><X size={16}/></button>
                 </div>
               ) : (
                 <div 
                   className="group flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 py-0.5 transition-colors mb-1"
                   onClick={startEditingTitle}
                 >
                   <h1 className="text-lg font-bold text-gray-900 leading-none">{deal.title}</h1>
                   <Edit2 size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                 </div>
               )}
               
               {/* Pipeline & Process stage selection dropdown */}
               <div className="relative">
                 <button
                   onClick={() => setShowStageDropdown(!showStageDropdown)}
                   className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 tracking-wide uppercase transition-colors"
                 >
                   <span>{pipeline.name}</span>
                   <span className="text-gray-300">➔</span>
                   <span className="text-gray-700">{pipeline.stages.find(s => s.id === deal.stageId)?.name}</span>
                   <ChevronDown size={12} className="opacity-50" />
                 </button>
                 
                 {showStageDropdown && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setShowStageDropdown(false)} />
                     <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-gray-100 rounded-xl z-50 p-1 animate-in fade-in slide-in-from-top-1 duration-150 normal-case font-medium">
                       <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
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
                               "w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between",
                               stage.id === deal.stageId ? "text-amber-600 bg-amber-50/50 font-bold" : "text-gray-700",
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
          </div>
        </div>

        <div className="flex items-center gap-3">
           {/* Owner Avatar */}
           <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
             <div className="text-right hidden sm:block">
               <div className="text-xs font-bold text-gray-900">João Paulo</div>
               <div className="text-[10px] text-gray-400 font-medium tracking-wider">Proprietário</div>
             </div>
             <img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" alt="User" className="w-8 h-8 rounded-full border border-gray-200" />
           </div>

           {deal.status === "Ativo" && (
             <>
               <button 
                 onClick={() => setShowLossModal(true)}
                 className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 font-bold text-xs rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors bg-white"
               >
                 <XCircle size={14} /> Perdido
               </button>
               <button 
                 onClick={() => markDealStatus(deal.id, "Ganho")}
                 className="flex items-center gap-1.5 px-3 py-1.5 border border-green-500 bg-[#25D366] text-white font-bold text-xs rounded-lg hover:bg-[#1DA851] transition-colors"
               >
                 <Check size={14} /> Ganho
               </button>
             </>
           )}

           {deal.status !== "Ativo" && (
             <>
               <div className={cn(
                  "px-3 py-1.5 font-bold text-xs rounded-lg flex items-center gap-1.5 border", 
                  deal.status === "Ganho" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
               )}>
                  {deal.status === "Ganho" ? <Trophy size={14} /> : <XCircle size={14} />}
                  NEGÓCIO {deal.status.toUpperCase()}
               </div>
               <button 
                 onClick={() => markDealStatus(deal.id, "Ativo")}
                 className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors bg-white ml-1"
               >
                 <Play size={14} /> Reabrir
               </button>
             </>
           )}

           <div className="relative">
             <button 
               onClick={() => setShowDropdown(!showDropdown)} 
               className="p-1.5 text-gray-400 hover:text-gray-700 border border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-lg transition-colors ml-1"
             >
                <MoreVertical size={16} />
             </button>
             {showDropdown && (
               <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-xl z-50 p-1">
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
                    ? "bg-gray-900 border-gray-900 text-white" 
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
