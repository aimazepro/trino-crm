"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useCrm } from "@/contexts/crm-context";
import { isToday, isTomorrow, isPast, format } from "date-fns";
import { TriangleAlert, XCircle, Trophy, Plus, User, Building } from "lucide-react";
import { LossReasonModal } from "@/components/deal/loss-reason-modal";
import { ActivityModal } from "@/components/deal/activity-modal";
import { NextActivityModal } from "@/components/deal/next-activity-modal";
import { getDaysInStage, getStageTimeColor } from "@/lib/stage-time";
import { cn } from "@/lib/utils";

import { useOwnerNameMap, getInitials } from "@/hooks/use-owner-name-map";

interface KanbanBoardProps {
  pipelineId: string;
  onNewDeal?: (stageId?: string) => void;
  statusFilter?: "Ativo" | "Ganho" | "Perdido";
}

export function KanbanBoard({ pipelineId, onNewDeal, statusFilter = "Ativo" }: KanbanBoardProps) {
  const { state, moveDeal, markDealStatus, addActivity, updateActivity } = useCrm();
  const { map: ownerNameMap, avatars: ownerAvatars, selfId, selfName } = useOwnerNameMap();
  const [isDragging, setIsDragging] = useState(false);
  const [lossModalDealId, setLossModalDealId] = useState<string | null>(null);
  const [activityPopoverDealId, setActivityPopoverDealId] = useState<string | null>(null);
  const [activityModalDealId, setActivityModalDealId] = useState<string | null>(null);
  const [nextActivityDealId, setNextActivityDealId] = useState<string | null>(null);

  const pipeline = state.pipelines.find(p => p.id === pipelineId);
  if (!pipeline) return null;

  const dealsByStage = pipeline.stages.reduce((acc, stage) => {
    acc[stage.id] = state.deals.filter(d =>
      !d.deletedAt &&
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
                        const isActivityTomorrow = nextActivity ? isTomorrow(new Date(nextActivity.date)) : false;
                        const isPastTime = nextActivity ? isPast(new Date(nextActivity.date)) : false;
                        const daysInStage = getDaysInStage(deal.stageEnteredAt);
                        const stageTimeColor = getStageTimeColor(daysInStage, stage.maxDays);

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
                                {/* Labels/Tags color bars */}
                                {deal.labels && deal.labels.length > 0 && (
                                  <div className="flex gap-1 mb-2.5 flex-wrap">
                                    {deal.labels.map(labelId => {
                                      const labelObj = state.labels.find(l => l.id === labelId);
                                      if (!labelObj) return null;
                                      return (
                                        <div
                                          key={labelId}
                                          className="h-[3px] w-8 rounded-full"
                                          title={labelObj.name}
                                          style={{ backgroundColor: labelObj.color }}
                                        />
                                      );
                                    })}
                                  </div>
                                )}

                                <div className="flex items-start justify-between gap-2">
                                  <h3
                                    className="text-[13px] font-semibold leading-snug text-zinc-800 line-clamp-2"
                                    style={{ textTransform: "capitalize" }}
                                  >
                                    {deal.title}
                                  </h3>
                                  <div className="flex items-center gap-1.5 shrink-0">
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
                                     {(() => {
                                       const ownerId = deal.ownerId || selfId;
                                       const ownerName = ownerNameMap[ownerId] || selfName || "Vendedor";
                                       const avatarUrl = ownerAvatars[ownerId];

                                       if (avatarUrl) {
                                         return (
                                           <img
                                             src={avatarUrl}
                                             alt={ownerName}
                                             title={ownerName}
                                             className="h-6 w-6 rounded-full object-cover shrink-0 ring-1 ring-zinc-200"
                                           />
                                         );
                                       }

                                       return (
                                         <div
                                           title={ownerName}
                                           className="h-6 w-6 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 ring-1 ring-zinc-200 uppercase tracking-tighter"
                                         >
                                           {getInitials(ownerName)}
                                         </div>
                                       );
                                     })()}
                                  </div>
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
                                  <div className="relative min-w-0">
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      title="Atividades deste negócio"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActivityPopoverDealId(v => v === deal.id ? null : deal.id);
                                      }}
                                      className="group cursor-pointer"
                                    >
                                      {nextActivity ? (
                                        <div className={cn(
                                          "flex items-center justify-between gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ring-1 ring-transparent group-hover:ring-current/20",
                                          isPastTime
                                            ? "bg-red-50 text-red-600"
                                            : isActivityToday
                                            ? "bg-emerald-50 text-emerald-600"
                                            : "bg-zinc-50 text-zinc-500"
                                        )}>
                                          <span className="truncate">
                                            {isActivityToday
                                              ? `Hoje: ${nextActivity.type}`
                                              : isActivityTomorrow
                                              ? `Amanhã: ${nextActivity.type}`
                                              : `${format(new Date(nextActivity.date), "dd/MM HH:mm")}: ${nextActivity.type}`}
                                          </span>
                                          {(isActivityToday || isActivityTomorrow) && (
                                            <span className="shrink-0 ml-1">
                                              {format(new Date(nextActivity.date), "HH:mm")}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-amber-500 ring-1 ring-transparent transition group-hover:bg-amber-50 group-hover:ring-amber-200">
                                          <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
                                          Sem atividade
                                        </div>
                                      )}
                                    </div>

                                    {activityPopoverDealId === deal.id && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-40"
                                          onClick={(e) => { e.stopPropagation(); setActivityPopoverDealId(null); }}
                                        />
                                        <div
                                          onClick={(e) => e.stopPropagation()}
                                          className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-lg"
                                        >
                                          {pendingActivities.length > 0 ? (
                                            <div className="max-h-48 overflow-y-auto py-1">
                                              {pendingActivities.map(a => (
                                                <div key={a.id} className="flex items-start gap-2 px-3 py-2 text-xs hover:bg-zinc-50">
                                                  <button
                                                    type="button"
                                                    role="checkbox"
                                                    aria-checked={false}
                                                    title="Concluir atividade"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      updateActivity(a.id, { completed: true });
                                                      setActivityPopoverDealId(null);
                                                      setNextActivityDealId(deal.id);
                                                    }}
                                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-zinc-300 hover:border-amber-500 hover:bg-amber-50 transition-colors"
                                                  />
                                                  <div className="min-w-0">
                                                    <p className="font-medium text-zinc-700 truncate">{a.title}</p>
                                                    <p className="text-zinc-400">{format(new Date(a.date), "dd/MM")}</p>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="px-3 py-3 text-center text-xs text-zinc-400">
                                              Você não tem nenhuma atividade programada para esse negócio
                                            </p>
                                          )}
                                          <div className="border-t border-zinc-100">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActivityPopoverDealId(null);
                                                setActivityModalDealId(deal.id);
                                              }}
                                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                                            >
                                              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" /> Agendar uma atividade
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <span className={cn(
                                    "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold",
                                    stageTimeColor === "red" ? "bg-red-50 text-red-600"
                                      : stageTimeColor === "yellow" ? "bg-amber-50 text-amber-600"
                                      : "text-zinc-400"
                                  )}>
                                    {daysInStage}d
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
          onConfirm={(reason, reasonId, note) => {
            markDealStatus(lossModalDealId, "Perdido", reason, reasonId, note);
            setLossModalDealId(null);
          }}
          onCancel={() => setLossModalDealId(null)}
        />
      )}

      {activityModalDealId && (
        <ActivityModal
          onClose={() => setActivityModalDealId(null)}
          onSave={(data) => {
            addActivity({
              dealId: data.dealId, title: data.title, date: data.date, endDate: data.endDate,
              type: data.type, description: data.description, guests: data.guests,
              assigneeId: data.assigneeId, completed: data.markAsDone,
            });
            setActivityModalDealId(null);
          }}
          defaultDealId={activityModalDealId}
        />
      )}

      {nextActivityDealId && (
        <NextActivityModal
          dealId={nextActivityDealId}
          onClose={() => setNextActivityDealId(null)}
          onSave={(data) => {
            addActivity({ dealId: nextActivityDealId, ...data });
            setNextActivityDealId(null);
          }}
        />
      )}
    </>
  );
}
