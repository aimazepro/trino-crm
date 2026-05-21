"use client";

import { useState } from "react";
import { ListTodo, Trash2, Pencil, AlertCircle, Phone, Mail, Video, Users, MessageCircle, Hash, ChevronDown, Plus, Calendar, Play } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Deal, Activity } from "@/lib/crm-types";
import { ActivityModal } from "./activity-modal";
import { NextActivityModal } from "./next-activity-modal";
import { cn } from "@/lib/utils";
import { isPast, isToday, isTomorrow } from "date-fns";

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

const getIcon = (type: string) => TYPE_ICONS[type] ?? <Hash className="h-4 w-4" />;

export function ActivityTab({ deal }: { deal: Deal }) {
  const { addActivity, deleteActivity, updateActivity } = useCrm();
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showNextModal, setShowNextModal] = useState(false);
  const [showSeqMenu, setShowSeqMenu] = useState(false);

  const startAdding = () => {
    setEditingActivity(null);
    setShowModal(true);
  };

  const saveActivity = (data: { title: string; type: string; date: string; description: string; dealId: string; guests: string[] }) => {
    if (editingActivity) {
      updateActivity(editingActivity.id, { title: data.title, date: data.date, type: data.type, description: data.description, guests: data.guests });
    } else {
      addActivity({ dealId: deal.id, title: data.title, date: data.date, type: data.type, description: data.description, guests: data.guests });
    }
    setShowModal(false);
    setEditingActivity(null);
  };

  const handleComplete = (a: Activity) => {
    updateActivity(a.id, { completed: !a.completed });
    if (!a.completed) setShowNextModal(true);
  };

  const handleEdit = (a: Activity) => {
    setEditingActivity(a);
    setShowModal(true);
  };

  const saveNextActivity = (data: { title: string; type: string; date: string; description: string }) => {
    addActivity({ dealId: deal.id, ...data });
    setShowNextModal(false);
  };

  const sorted = [...deal.activities].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-zinc-400 tracking-wide">ATIVIDADES</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowSeqMenu(v => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <Play className="h-3 w-3" /> Sequências <ChevronDown className="h-3 w-3" />
            </button>
            {showSeqMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-zinc-200 rounded-lg shadow-lg min-w-[200px]">
                <p className="text-xs text-zinc-400 px-3 py-2">Nenhuma sequencia disponivel.</p>
              </div>
            )}
          </div>
          <button
            onClick={startAdding}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-semibold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
      </div>

      {deal.activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-16 h-16 rounded-full bg-zinc-100 text-zinc-300 flex items-center justify-center mb-4">
            <ListTodo size={32} />
          </div>
          <p className="text-sm font-medium text-zinc-500">Nenhuma atividade registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(a => {
            const d = new Date(a.date);
            const isOverdue = !a.completed && isPast(d) && !isToday(d);
            const isToday_ = !a.completed && isToday(d);
            const isTomorrow_ = !a.completed && isTomorrow(d);
            return (
              <div key={a.id}>
                <div className={cn(
                  "flex items-start gap-3 rounded-xl p-3.5 transition-colors",
                  a.completed ? "bg-zinc-50 opacity-70" : isOverdue ? "bg-red-50" : "bg-white"
                )}>
                  <div className={cn("shrink-0 rounded-full p-2 bg-zinc-100", a.completed ? "text-zinc-400" : isOverdue ? "text-red-400" : "text-zinc-600")}>
                    {isOverdue ? <AlertCircle className="h-4 w-4" /> : getIcon(a.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      a.completed ? "line-through text-zinc-500" : isOverdue ? "text-red-700" : "text-zinc-800"
                    )}>
                      {a.title}
                    </p>
                    {a.description && (
                      <p className="text-xs mt-0.5 whitespace-pre-wrap break-words text-zinc-400">{a.description}</p>
                    )}
                    <p className="text-xs mt-1 flex items-center gap-1.5 text-zinc-400">
                      <Calendar className="h-3 w-3" />
                      {d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      {isOverdue && <span className="font-semibold text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-500">Atrasada</span>}
                      {isToday_ && <span className="font-semibold text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600">Hoje</span>}
                      {isTomorrow_ && <span className="font-semibold text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-500">Amanhã</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleEdit(a)}
                      className="rounded-md border border-zinc-200 p-1 text-zinc-400 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteActivity(a.id)}
                      className="rounded-md border border-zinc-200 p-1 text-zinc-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {!a.completed && (
                      <button
                        onClick={() => handleComplete(a)}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors"
                      >
                        Concluir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ActivityModal
          activity={editingActivity || undefined}
          onClose={() => setShowModal(false)}
          onSave={saveActivity}
          defaultDealId={deal.id}
          userName="João Paulo Olivera"
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
