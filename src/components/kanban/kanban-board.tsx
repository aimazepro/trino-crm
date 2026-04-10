"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useCrm } from "@/contexts/crm-context";
import { isToday, isTomorrow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoreHorizontal, Calendar, DollarSign, Building, ChevronRight, AlertTriangle, XCircle, Trophy, Plus } from "lucide-react";
import { LossReasonModal } from "@/components/deal/loss-reason-modal";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  pipelineId: string;
  onNewDeal?: (stageId?: string) => void;
}

export function KanbanBoard({ pipelineId, onNewDeal }: KanbanBoardProps) {
  const { state, moveDeal, markDealStatus } = useCrm();
  const [isDragging, setIsDragging] = useState(false);
  const [lossModalDealId, setLossModalDealId] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState("");

  const pipeline = state.pipelines.find(p => p.id === pipelineId);
  if (!pipeline) return null;

  // Render cards logic mapped by stage
  const dealsByStage = pipeline.stages.reduce((acc, stage) => {
    // Only active deals in this pipeline and this stage
    acc[stage.id] = state.deals.filter(d => 
      d.pipelineId === pipelineId && 
      d.stageId === stage.id && 
      d.status === "Ativo"
    );
    return acc;
  }, {} as Record<string, typeof state.deals>);

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

  return (
    <>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full min-w-max relative pb-32">
          
          {pipeline.stages.map((stage) => {
             const stageDeals = dealsByStage[stage.id] || [];
             const totalValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0);

             return (
               <div key={stage.id} className="w-[320px] flex flex-col shrink-0">
                 {/* Column Header */}
                 <div className="mb-3 px-1 flex items-center justify-between">
                   <div>
                     <div className="flex items-center gap-2">
                       <h3 className="font-bold text-gray-900 text-sm tracking-tight">{stage.name}</h3>
                       <span className="text-gray-400 text-xs font-bold">{stageDeals.length}</span>
                     </div>
                     <span className="text-xs font-medium text-gray-500 mt-0.5 block">
                       {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                     </span>
                   </div>
                   <button className="text-gray-300 hover:text-gray-600 transition-colors">
                     <Plus size={16} />
                   </button>
                 </div>

                 {/* Drop Area */}
                 <Droppable droppableId={stage.id}>
                   {(provided, snapshot) => (
                     <div 
                       ref={provided.innerRef} 
                       {...provided.droppableProps}
                       className={cn(
                         "flex-1 rounded-2xl p-2 transition-colors min-h-[150px] border",
                         snapshot.isDraggingOver ? "bg-amber-50/50 border-amber-200" : "bg-gray-50/50 border-transparent"
                       )}
                     >
                       <div className="space-y-3">
                         {stageDeals.map((deal, index) => {
                           const company = state.companies.find(c => c.id === deal.companyId);
                           const isStagnant = deal.daysInStage >= stage.maxDays;
                           
                           const pendingActivities = deal.activities?.filter(a => !a.completed) || [];
                           const nextActivity = pendingActivities.length > 0 
                              ? pendingActivities.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] 
                              : null;
                           const isActivityToday = nextActivity ? isToday(new Date(nextActivity.date)) : false;
                           
                           return (
                             <Draggable key={deal.id} draggableId={deal.id} index={index}>
                               {(provided, snapshot) => (
                                 <div
                                   ref={provided.innerRef}
                                   {...provided.draggableProps}
                                   {...provided.dragHandleProps}
                                   className={cn(
                                     "bg-white p-4 rounded-xl border transition-all group",
                                     snapshot.isDragging ? "shadow-2xl border-amber-500 rotate-2 scale-105" : "border-gray-200 shadow-sm hover:border-amber-300 hover:shadow-md",
                                     isStagnant ? "border-red-200 shadow-[0_0_0_1px_rgba(254,226,226,1)]" : ""
                                   )}
                                   onClick={() => window.location.href = `/pipeline/${deal.id}`}
                                 >
                                    <div className="flex justify-between items-start mb-1.5">
                                      <h4 className="font-bold text-gray-900 text-sm group-hover:text-amber-600 transition-colors line-clamp-2 leading-snug">
                                        {deal.title}
                                      </h4>
                                      <button className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <MoreHorizontal size={16} />
                                      </button>
                                    </div>
                                    
                                    {company && (
                                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2 truncate">
                                        <Building size={12} className="text-gray-400 shrink-0" />
                                        <span className="truncate">{company.name}</span>
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between text-base font-bold text-gray-900 mb-3">
                                      {deal.value > 0 ? (
                                         deal.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                      ) : (
                                         <span className="text-gray-400 font-medium">R$ 0,00</span>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-[10px] font-bold">
                                      {nextActivity ? (
                                         <div className={cn(
                                            "border rounded-lg px-2 py-1 text-xs font-medium",
                                            isActivityToday ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 border-gray-100 text-gray-600"
                                         )}>
                                            {formatActivityDate(nextActivity.date)}: {nextActivity.type}
                                         </div>
                                      ) : (
                                         <div className={cn("flex items-center gap-1", isStagnant ? "text-red-500" : "text-amber-500")}>
                                            <AlertTriangle size={12} />
                                            {isStagnant ? "Estagnado!" : "Sem atividade"}
                                         </div>
                                      )}
                                      <div className="text-gray-400 font-medium">{deal.daysInStage}d</div>
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
                  <div className={cn("flex items-center gap-2 font-bold text-lg", snapshot.isDraggingOver ? "text-red-600 scale-110" : "text-red-400")}>
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
                  <div className={cn("flex items-center gap-2 font-bold text-lg", snapshot.isDraggingOver ? "text-green-600 scale-110" : "text-green-400")}>
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

// Plus added to the import string from lucide-react if not present.
