"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useCrm } from "@/contexts/crm-context";
import { isToday, isTomorrow, isPast, format } from "date-fns";
import { TriangleAlert, XCircle, Trophy, Plus, User, Building } from "lucide-react";
import { LossReasonModal } from "@/components/deal/loss-reason-modal";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  pipelineId: string;
  onNewDeal?: (stageId?: string) => void;
  statusFilter?: "Ativo" | "Ganho" | "Perdido";
}

export function KanbanBoard({ pipelineId, onNewDeal, statusFilter = "Ativo" }: KanbanBoardProps) {
  const { state, moveDeal, markDealStatus } = useCrm();
  const [isDragging, setIsDragging] = useState(false);
  const [lossModalDealId, setLossModalDealId] = useState<string | null>(null);

  const pipeline = state.pipelines.find(p => p.id === pipelineId);
  if (!pipeline) return null;

  const dealsByStage = pipeline.stages.reduce((acc, stage) => {
    acc[stage.id] = state.deals.filter(d =>
      d.pipelineId === pipelineId &&
      d.stageId === stage.id &&
      d.status === statusFilter
    );
    return acc;
  }, {} as Record<string, typeof state.deals>);

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);
    if (!result.destination) return;
    const { destination, source, draggableId } = result;
    if (destination.droppableId === "zone_ganho") { markDealStatus(draggableId, "Ganho"); return; }
    if (destination.droppableId === "zone_perdido") { setLossModalDealId(draggableId); return; }
    if (source.droppableId !== destination.droppableId) moveDeal(draggableId, destination.droppableId);
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatActivityDate = (dateInput: string) => {
    const d = new Date(dateInput);
    if (isToday(d)) return `Hoje ${format(d, "HH:mm")}`;
    if (isTomorrow(d)) return `Amanhã ${format(d, "HH:mm")}`;
    return format(d, "dd/MM HH:mm");
  };

  return (
    <>
      <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          {pipeline.stages.map((stage) => {
            const stageDeals = dealsByStage[stage.id] || [];
            const totalValue = stageDeals.reduce((s, d) => s + d.value, 0);

            return (
              <div
                key={stage.id}
                className="flex min-w-[220px] flex-1 shrink-0 flex-col h-full border-r border-zinc-200/60 pr-4 last:border-r-0"
              >
                {/* Column header */}
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="truncate text-[13px] font-semibold text-zinc-700"
                      title={stage.name}
                    >
                      {stage.name}
                    </span>
                    <span className="shrink-0 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-zinc-100 px-1.5 text-[10px] font-semibold text-zinc-500">
                      {stageDeals.length}
                    </span>
                  </div>
                  <button
                    onClick={() => onNewDeal?.(stage.id)}
                    className="shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div className="mb-3 text-xs text-zinc-400 font-medium">
                  {fmt(totalValue)}
                </div>

                {/* Cards */}
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex flex-col gap-2.5 min-h-0 flex-1 overflow-y-auto rounded-xl transition-colors",
                        snapshot.isDraggingOver && "bg-amber-50/30 ring-1 ring-amber-200"
                      )}
                    >
                      {stageDeals.map((deal, index) => {
                        const contact = deal.contactId ? state.contacts.find(c => c.id === deal.contactId) : null;
                        const company = deal.companyId ? state.companies.find(c => c.id === deal.companyId) : null;
                        const pendingActivities = deal.activities?.filter(a => !a.completed) || [];
                        const nextActivity = pendingActivities.length > 0
                          ? pendingActivities.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
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
                                  "rounded-xl bg-white p-4 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] transition-all duration-200 select-none border border-zinc-200/70",
                                  snapshot.isDragging && "shadow-xl border-amber-500 rotate-2 scale-105 z-50"
                                )}
                                style={{ ...provided.draggableProps.style, opacity: 1 }}
                                onClick={() => window.location.href = `/negocios/${deal.id}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <h3
                                    className="text-[13px] font-semibold leading-snug text-zinc-800 line-clamp-2"
                                    style={{ textTransform: "capitalize" }}
                                  >
                                    {deal.title}
                                  </h3>
                                  {deal.status === "Ganho" && (
                                    <span className="bg-emerald-50 text-emerald-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md tracking-wider shrink-0">
                                      GANHO
                                    </span>
                                  )}
                                  {deal.status === "Perdido" && (
                                    <span className="bg-red-50 text-red-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md tracking-wider shrink-0">
                                      PERDIDO
                                    </span>
                                  )}
                                </div>

                                {contact && (
                                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
                                    <User className="h-3 w-3 text-zinc-300 shrink-0" />
                                    <span className="truncate">{contact.name}</span>
                                  </div>
                                )}
                                {company && (
                                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
                                    <Building className="h-3 w-3 text-zinc-300 shrink-0" />
                                    <span className="truncate">{company.name}</span>
                                  </div>
                                )}

                                <p className="mt-2.5 text-sm font-bold text-zinc-800">
                                  {fmt(deal.value)}
                                </p>

                                <div className="mt-3 flex items-center justify-between gap-2">
                                  {nextActivity ? (
                                    <div className={cn(
                                      "flex items-center gap-1 text-[11px]",
                                      isOverdue ? "text-red-500" : isActivityToday ? "text-amber-500" : "text-zinc-400"
                                    )}>
                                      {isOverdue && <TriangleAlert className="h-3 w-3" aria-hidden="true" />}
                                      <span>
                                        {isOverdue
                                          ? `Atrasada: ${nextActivity.type}`
                                          : formatActivityDate(nextActivity.date)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-[11px] text-amber-500">
                                      <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                                      Sem atividade
                                    </div>
                                  )}
                                  <span className="shrink-0 text-[11px] font-medium text-zinc-400">
                                    {deal.daysInStage}d
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}

                      {/* + Negócio button */}
                      <div
                        role="button"
                        onClick={() => onNewDeal?.(stage.id)}
                        className="flex h-10 items-center justify-center rounded-lg border border-dashed border-zinc-200/80 text-xs text-zinc-300 cursor-pointer hover:border-zinc-300 hover:text-zinc-500 hover:bg-zinc-50/50 transition-all duration-200 mt-1"
                      >
                        + Negócio
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>

        {/* Drop zones (visible while dragging) */}
        <div className={cn(
          "fixed bottom-0 left-64 right-0 h-28 bg-white border-t border-zinc-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] transition-opacity duration-300 flex z-50",
          isDragging ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}>
          <Droppable droppableId="zone_perdido">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "flex-1 flex items-center justify-center border-r border-zinc-100 transition-colors",
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
