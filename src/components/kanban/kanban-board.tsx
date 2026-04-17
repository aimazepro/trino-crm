"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useCrm } from "@/contexts/crm-context";
import { isToday, isTomorrow, isPast, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building, AlertTriangle, XCircle, Trophy, Plus, Briefcase } from "lucide-react";
import { LossReasonModal } from "@/components/deal/loss-reason-modal";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  pipelineId: string;
  onNewDeal?: (stageId?: string) => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function KanbanBoard({ pipelineId, onNewDeal }: KanbanBoardProps) {
  const { state, moveDeal, markDealStatus } = useCrm();
  const [isDragging, setIsDragging] = useState(false);
  const [lossModalDealId, setLossModalDealId] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState("");

  const pipeline = state.pipelines.find(p => p.id === pipelineId);
  if (!pipeline) return null;

  // Render cards logic mapped by stage
  const dealsByStage = pipeline.stages.reduce((acc, stage) => {
    acc[stage.id] = state.deals.filter(d =>
      d.pipelineId === pipelineId &&
      d.stageId === stage.id &&
      d.status === "Ativo"
    );
    return acc;
  }, {} as Record<string, typeof state.deals>);

  const totalDeals = Object.values(dealsByStage).reduce((sum, arr) => sum + arr.length, 0);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);
    if (!result.destination) return;

    const { destination, source, draggableId } = result;

    if (destination.droppableId === "zone_ganho") {
       markDealStatus(draggableId, "Ganho");
       return;
    }

    if (destination.droppableId === "zone_perdido") {
       setLossModalDealId(draggableId);
       return;
    }

    // Moving between columns
    if (source.droppableId !== destination.droppableId) {
       moveDeal(draggableId, destination.droppableId);
    }
  };

  const confirmLoss = () => {
    if (lossModalDealId && lossReason.trim()) {
      markDealStatus(lossModalDealId, "Perdido", lossReason);
      setLossModalDealId(null);
      setLossReason("");
    }
  };

  const formatActivityDate = (dateInput: string) => {
    const d = new Date(dateInput);
    if (isToday(d)) return `Hoje ${format(d, 'HH:mm')}`;
    if (isTomorrow(d)) return `Amanhã ${format(d, 'HH:mm')}`;
    return format(d, 'dd/MM HH:mm');
  };

  // Empty pipeline state
  if (totalDeals === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
          <Briefcase size={28} className="text-amber-400" />
        </div>
        <p className="text-[15px] font-bold text-zinc-800 mb-1">Nenhum negocio ainda</p>
        <p className="text-[13px] font-medium text-zinc-400 text-center max-w-xs mb-5">
          Adicione seu primeiro negocio para comecar a acompanhar seu pipeline de vendas.
        </p>
        <button
          onClick={() => onNewDeal?.()}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white text-[13px] font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus size={15} /> Adicionar primeiro negocio
        </button>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full min-w-max relative pb-32">

          {pipeline.stages.map((stage) => {
             const stageDeals = dealsByStage[stage.id] || [];
             const totalValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0);

             return (
               <div key={stage.id} className="w-[270px] flex flex-col shrink-0">
                 {/* Column Header */}
                 <div className="mb-3 px-1">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <h3 className="font-semibold text-zinc-700 text-[13px]">{stage.name}</h3>
                       <span className="text-zinc-400 text-[11px] font-medium">{stageDeals.length}</span>
                     </div>
                     <button
                       onClick={() => onNewDeal?.(stage.id)}
                       className="text-zinc-300 hover:text-zinc-600 transition-colors"
                     >
                       <Plus size={14} />
                     </button>
                   </div>
                   <p className="text-[12px] font-medium text-zinc-400 mt-0.5">{fmt(totalValue)}</p>
                 </div>

                 {/* Drop Area */}
                 <Droppable droppableId={stage.id}>
                   {(provided, snapshot) => (
                     <div 
                       ref={provided.innerRef} 
                       {...provided.droppableProps}
                       className={cn(
                         "flex-1 transition-colors min-h-[150px] rounded-2xl",
                         snapshot.isDraggingOver ? "bg-amber-50/30 ring-1 ring-amber-200" : "bg-transparent"
                       )}
                     >
                       <div className="space-y-3">
                         {stageDeals.map((deal, index) => {
                            const company = state.companies.find(c => c.id === deal.companyId);
                            const contact = deal.contactId ? state.contacts.find(c => c.id === deal.contactId) : null;
                            const isStagnant = deal.daysInStage >= stage.maxDays;
                            
                            const pendingActivities = deal.activities?.filter(a => !a.completed) || [];
                            const nextActivity = pendingActivities.length > 0 
                               ? pendingActivities.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] 
                               : null;
                            const isActivityToday = nextActivity ? isToday(new Date(nextActivity.date)) : false;
                            const isOverdue = nextActivity ? (isPast(new Date(nextActivity.date)) && !isActivityToday) : false;
                            
                            return (
                              <Draggable key={deal.id} draggableId={deal.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={cn(
                                      "bg-white p-4 rounded-xl border transition-all group cursor-grab active:cursor-grabbing",
                                      snapshot.isDragging ? "shadow-xl border-amber-500 rotate-2 scale-105 z-50" : "border-gray-100 shadow-sm hover:border-amber-200 hover:shadow-md",
                                      isStagnant ? "border-red-200 shadow-[0_0_0_1px_rgba(254,226,226,1)]" : ""
                                    )}
                                    onClick={() => window.location.href = `/negocios/${deal.id}`}
                                  >
                                     <div className="flex justify-between items-start mb-2">
                                       <h4 className="font-semibold text-gray-900 text-[13px] group-hover:text-amber-600 transition-colors line-clamp-1 leading-snug">
                                         {deal.title}
                                       </h4>
                                     </div>
                                     
                                     {contact ? (
                                       <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 mb-1 truncate">
                                         <span className="truncate">{contact.name}</span>
                                       </div>
                                     ) : company ? (
                                       <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 mb-1 truncate">
                                         <Building size={12} className="text-gray-300 shrink-0" />
                                         <span className="truncate">{company.name}</span>
                                       </div>
                                     ) : null}

                                     <div className="flex items-center justify-between text-[13px] font-semibold text-gray-900 mb-4">
                                       {deal.value > 0 ? (
                                          deal.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                       ) : (
                                          <span className="text-gray-300 font-medium">R$ 0,00</span>
                                       )}
                                     </div>
                                     
                                     <div className="flex items-center justify-between text-[10px] font-medium">
                                       {nextActivity ? (
                                          <div className={cn(
                                             "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors",
                                             isOverdue ? "bg-red-50 text-red-500" :
                                             isActivityToday ? "bg-amber-50 text-amber-600" :
                                             "bg-zinc-50 text-zinc-400"
                                          )}>
                                             {isOverdue && <AlertTriangle size={10} />}
                                             {isOverdue ? `Atrasada: ${nextActivity.type}` : `${formatActivityDate(nextActivity.date)}: ${nextActivity.type}`}
                                          </div>
                                       ) : (
                                          <div className="flex items-center gap-1 text-amber-400">
                                            <AlertTriangle size={10} />
                                            <span className="text-[10px] font-medium">Sem atividade</span>
                                          </div>
                                       )}
                                       <div className="text-zinc-300 font-medium">{deal.daysInStage}d</div>
                                     </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                         })}
                         {provided.placeholder}
                       </div>
                       
                       {/* + Negocio Button (Always visible) */}
                       {!snapshot.isDraggingOver && (
                          <button 
                             onClick={() => onNewDeal?.(stage.id)}
                             className="w-[calc(100%-8px)] mx-1 mt-2 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center text-xs font-medium text-gray-300 py-2.5 hover:bg-gray-50 hover:text-gray-500 transition-colors"
                          >
                             + Negócio
                          </button>
                       )}
                     </div>
                   )}
                 </Droppable>
               </div>
             );
          })}
        </div>

        {/* Global Bottom Dropzones - Visible only when dragging */}
        <div className={cn(
          "fixed bottom-0 left-64 right-0 h-28 bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] transform transition-transform duration-300 flex z-50",
          isDragging ? "translate-y-0" : "translate-y-full"
        )}>
           <Droppable droppableId="zone_perdido">
             {(provided, snapshot) => (
                <div 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex-1 flex items-center justify-center border-r border-gray-100 transition-colors",
                    snapshot.isDraggingOver ? "bg-red-50" : "hover:bg-red-50/50"
                  )}
                >
                  <div className={cn("flex items-center gap-2 font-medium text-lg", snapshot.isDraggingOver ? "text-red-600 scale-110" : "text-red-400")}>
                    <XCircle size={24} /> PERDIDO
                  </div>
                  <div className="hidden">{provided.placeholder}</div>
                </div>
             )}
           </Droppable>

           <Droppable droppableId="zone_ganho">
             {(provided, snapshot) => (
                <div 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex-1 flex items-center justify-center transition-colors",
                    snapshot.isDraggingOver ? "bg-green-50" : "hover:bg-green-50/50"
                  )}
                >
                  <div className={cn("flex items-center gap-2 font-medium text-lg", snapshot.isDraggingOver ? "text-green-600 scale-110" : "text-green-400")}>
                    <Trophy size={24} /> GANHO
                  </div>
                  <div className="hidden">{provided.placeholder}</div>
                </div>
             )}
           </Droppable>
        </div>
      </DragDropContext>

      {/* Loss Reason Modal */}
      {lossModalDealId && (
        <LossReasonModal 
          onConfirm={(reason) => {
            markDealStatus(lossModalDealId, "Perdido", reason);
            setLossModalDealId(null);
          }}
          onCancel={() => setLossModalDealId(null)}
        />
      )}
    </>
  );
}
