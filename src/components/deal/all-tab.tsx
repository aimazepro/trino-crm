"use client";

import { useState } from "react";
import {
  ChevronDown, ArrowRight, Calendar, CalendarPlus, Pencil,
  FileText, Plus, Trash2, CheckCircle2, RotateCcw, CircleCheck, CircleX, GitMerge,
  AlertCircle, Phone, Mail, Video, Users, MessageCircle, Hash,
  type LucideIcon,
} from "lucide-react";
import { getTimelineIconConfig } from "@/lib/timeline-helpers";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCrm } from "@/contexts/crm-context";
import { Deal, Activity } from "@/lib/crm-types";
import { ActivityModal } from "./activity-modal";
import { NextActivityModal } from "./next-activity-modal";
import { cn } from "@/lib/utils";

// Picks an icon per event category so the timeline reads at a glance
// instead of every entry sharing the same generic arrow.
function historyIcon(description: string): LucideIcon {
  if (description === "Negócio criado") return Plus;
  if (description === "Negócio reaberto" || description === "Negócio restaurado") return RotateCcw;
  if (description === "Negócio excluído") return Trash2;
  if (description === "Negócios mesclados") return GitMerge;
  if (description.startsWith("Negócio marcado como")) return description.includes("Ganho") ? CircleCheck : CircleX;
  if (description === "Nota adicionada" || description === "Nota editada") return FileText;
  if (description === "Nota removida") return Trash2;
  if (description === "Atividade criada") return CalendarPlus;
  if (description === "Atividade concluída") return CheckCircle2;
  if (description === "Atividade removida") return Trash2;
  if (description.endsWith(" alterado")) return Pencil;
  return ArrowRight; // Etapa alterada, Pipeline alterada, fallback
}

// Same per-type icon set as ActivityTab, so a card looks identical whether
// it's read from "Todos" or from "Atividades".
const TYPE_ICONS: Record<string, React.ReactNode> = {
  "Ligação":      <Phone className="h-4 w-4" />,
  "Reunião":      <Users className="h-4 w-4" />,
  "Videochamada": <Video className="h-4 w-4" />,
  "Email":        <Mail className="h-4 w-4" />,
  "WhatsApp":     <MessageCircle className="h-4 w-4" />,
  "Instagram":    <Hash className="h-4 w-4" />,
  "LinkedIn":     <Hash className="h-4 w-4" />,
  "Outros":       <Hash className="h-4 w-4" />,
};

const getTypeIcon = (type: string) => TYPE_ICONS[type] ?? <Hash className="h-4 w-4" />;

export function AllTab({ deal, userName }: { deal: Deal; userName?: string }) {
  const { addActivity, deleteActivity, updateActivity } = useCrm();
  const [activitiesOpen, setActivitiesOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showNextModal, setShowNextModal] = useState(false);

  const pending = [...deal.activities]
    .filter(a => !a.completed)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const startAdding = () => {
    setEditingActivity(null);
    setShowModal(true);
  };

  const handleEdit = (a: Activity) => {
    setEditingActivity(a);
    setShowModal(true);
  };

  const saveActivity = (data: { title: string; type: string; date: string; endDate?: string; description: string; dealId: string; guests: string[]; assigneeId: string | null; markAsDone: boolean }) => {
    if (editingActivity) {
      updateActivity(editingActivity.id, { title: data.title, date: data.date, endDate: data.endDate, type: data.type, description: data.description, guests: data.guests, assigneeId: data.assigneeId });
    } else {
      addActivity({ dealId: deal.id, title: data.title, date: data.date, endDate: data.endDate, type: data.type, description: data.description, guests: data.guests, assigneeId: data.assigneeId, completed: data.markAsDone });
    }
    setShowModal(false);
    setEditingActivity(null);
  };

  const handleComplete = (a: Activity) => {
    updateActivity(a.id, { completed: !a.completed });
    if (!a.completed) setShowNextModal(true);
  };

  const saveNextActivity = (data: { title: string; type: string; date: string; description: string }) => {
    addActivity({ dealId: deal.id, ...data });
    setShowNextModal(false);
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setActivitiesOpen(v => !v)} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition-colors hover:text-zinc-900">
            Próximas atividades
            <ChevronDown className={cn("h-4 w-4 transition-transform", !activitiesOpen && "-rotate-90")} />
          </button>
          <button
            onClick={startAdding}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:from-amber-600 hover:to-amber-500 hover:shadow-md"
          >
            <Plus className="h-3.5 w-3.5" /> Atividade
          </button>
        </div>
        {activitiesOpen && (
          pending.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 py-8 text-center">
              <p className="text-sm text-zinc-400">Nenhuma atividade pendente</p>
              <button onClick={startAdding} className="mt-1 text-sm font-medium text-amber-500 hover:underline">
                Agendar uma atividade
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map(a => {
                const d = new Date(a.date);
                const isOverdue = isPast(d) && !isToday(d);
                const isToday_ = isToday(d);
                const isTomorrow_ = isTomorrow(d);
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 transition-colors",
                      isOverdue ? "border-red-100 bg-red-50" : "border-zinc-200 bg-white"
                    )}
                  >
                    <div className={cn("shrink-0 rounded-full p-2 bg-zinc-100", isOverdue ? "text-red-400" : "text-zinc-600")}>
                      {isOverdue ? <AlertCircle className="h-4 w-4" /> : getTypeIcon(a.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", isOverdue ? "text-red-700" : "text-zinc-800")}>{a.title}</p>
                      {a.description && (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-zinc-400">{a.description}</p>
                      )}
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                        <Calendar className="h-3 w-3" />
                        {d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        {isOverdue && <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-red-50 text-red-500">Atrasada</span>}
                        {isToday_ && <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-green-50 text-green-600">Hoje</span>}
                        {isTomorrow_ && <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-500">Amanhã</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => handleEdit(a)}
                        title="Editar"
                        className="rounded-md border border-zinc-200 p-1 text-zinc-400 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-500"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteActivity(a.id)}
                        title="Excluir"
                        className="rounded-md border border-zinc-200 p-1 text-zinc-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleComplete(a)}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-600"
                      >
                        Concluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <div>
        <button onClick={() => setTimelineOpen(v => !v)} className="flex items-center gap-2 mb-3">
          <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", !timelineOpen && "-rotate-90")} />
          <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Linha do tempo</span>
        </button>
        {timelineOpen && (
          <div className="space-y-6 pl-4 border-l-2 border-gray-100 ml-4 py-2">
            {deal.history.map(log => {
              const { icon: Icon, badgeClass } = getTimelineIconConfig(log.description);
              return (
                <div key={log.id} className="relative">
                  <div className={cn(
                    "absolute -left-[27px] top-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-xs transition-colors",
                    badgeClass
                  )}>
                    <Icon size={14} />
                  </div>
                  <div className="pl-6">
                    <h5 className="font-semibold text-zinc-900 text-sm">{log.description}</h5>
                    {log.subtext && <p className="text-sm text-zinc-500 mt-0.5">{log.subtext}</p>}
                    <p className="text-xs text-zinc-400 mt-1">
                      {(() => {
                        try {
                          const d = new Date(log.createdAt);
                          const formattedDate = format(d, "dd/MM/yyyy HH:mm");
                          return userName ? `${formattedDate} · ${userName}` : formattedDate;
                        } catch {
                          return log.createdAt;
                        }
                      })()}
                    </p>
                  </div>
                </div>
              );
            })}
            {deal.history.length === 0 && (
              <p className="pl-6 text-sm text-gray-400 font-medium">Nenhum evento registrado ainda.</p>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <ActivityModal
          activity={editingActivity || undefined}
          onClose={() => setShowModal(false)}
          onSave={saveActivity}
          defaultDealId={deal.id}
          userName={userName}
        />
      )}

      {showNextModal && (
        <NextActivityModal
          dealId={deal.id}
          onClose={() => setShowNextModal(false)}
          onSave={saveNextActivity}
        />
      )}
    </div>
  );
}
