"use client";

import { useState } from "react";
import { ListTodo, CheckCircle, Trash2, Edit2, AlertCircle } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Deal, Activity } from "@/lib/crm-types";
import { ActivityModal } from "./activity-modal";
import { NextActivityModal } from "./next-activity-modal";
import { cn } from "@/lib/utils";
import { isPast, isToday } from "date-fns";

// Color map per activity type
const TYPE_COLORS: Record<string, { dot: string; badge: string }> = {
  "Ligação":      { dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700" },
  "Reunião":      { dot: "bg-purple-500",  badge: "bg-purple-50 text-purple-700" },
  "Videochamada": { dot: "bg-green-500",   badge: "bg-green-50 text-green-700" },
  "Email":        { dot: "bg-gray-400",    badge: "bg-gray-100 text-gray-600" },
  "WhatsApp":     { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  "Instagram":    { dot: "bg-pink-500",    badge: "bg-pink-50 text-pink-700" },
  "LinkedIn":     { dot: "bg-sky-600",     badge: "bg-sky-50 text-sky-700" },
  "Outros":       { dot: "bg-gray-400",    badge: "bg-gray-100 text-gray-600" },
};

const getColors = (type: string) =>
  TYPE_COLORS[type] || { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" };

export function ActivityTab({ deal }: { deal: Deal }) {
  const { addActivity, deleteActivity, updateActivity } = useCrm();
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showNextModal, setShowNextModal] = useState(false);

  const startAdding = () => {
    setEditingActivity(null);
    setShowModal(true);
  };

  const saveActivity = (data: { title: string; type: string; date: string; description: string }) => {
    if (editingActivity) {
      updateActivity(editingActivity.id, {
        title: data.title,
        date: data.date,
        type: data.type,
        description: data.description,
      });
    } else {
      addActivity({
        dealId: deal.id,
        title: data.title,
        date: data.date,
        type: data.type,
        description: data.description,
      });
    }
    setShowModal(false);
    setEditingActivity(null);
  };

  const handleComplete = (a: Activity) => {
    if (!a.completed) {
      // Mark as done then prompt next
      updateActivity(a.id, { completed: true });
      setShowNextModal(true);
    } else {
      // Reopen
      updateActivity(a.id, { completed: false });
    }
  };

  const handleEdit = (a: Activity) => {
    setEditingActivity(a);
    setShowModal(true);
  };

  const saveNextActivity = (data: { title: string; type: string; date: string; description: string }) => {
    addActivity({
      dealId: deal.id,
      title: data.title,
      date: data.date,
      type: data.type,
      description: data.description,
    });
    setShowNextModal(false);
  };

  // Sort: pending first, completed last. For pending, earlier dates first.
  const sorted = [...deal.activities].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Atividades</h4>
        <button
          onClick={startAdding}
          className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-4 py-2 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        >
          + Adicionar
        </button>
      </div>

      {deal.activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-200 flex items-center justify-center mb-4">
            <ListTodo size={32} />
          </div>
          <p className="text-sm font-medium text-gray-500">Nenhuma atividade registrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(a => {
            const colors = getColors(a.type);
            const isOverdue = !a.completed && isPast(new Date(a.date)) && !isToday(new Date(a.date));
            
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center justify-between p-4 border rounded-xl shadow-sm transition-all group",
                  a.completed
                    ? "bg-gray-50/70 border-gray-100 opacity-60"
                    : isOverdue 
                      ? "bg-red-50/30 border-red-100 hover:border-red-200" 
                      : "bg-white border-gray-100 hover:border-amber-200 hover:shadow-md"
                )}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Complete button */}
                  <button
                    onClick={() => handleComplete(a)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      a.completed
                        ? "bg-green-500 border-green-500 text-white"
                        : isOverdue 
                          ? "border-red-300 text-red-500 hover:bg-red-50" 
                          : "border-gray-300 hover:border-amber-500 hover:scale-110"
                    )}
                  >
                    {a.completed ? <CheckCircle size={14} /> : (isOverdue ? <AlertCircle size={14} /> : null)}
                  </button>

                  {/* Color dot */}
                  <div className={cn("w-2 h-2 rounded-full shrink-0", isOverdue ? "bg-red-500" : colors.dot)} />

                  <div className="min-w-0">
                    <div className={cn(
                      "text-sm font-bold flex items-center gap-2",
                      a.completed ? "line-through text-gray-400" : (isOverdue ? "text-red-700" : "text-gray-900")
                    )}>
                      {a.title}
                      {isOverdue && <span className="text-[9px] uppercase font-black text-red-500 px-1.5 py-0.5 bg-red-100 rounded-full tracking-wider">Atrasada</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", isOverdue ? "bg-red-100 text-red-700" : colors.badge)}>
                        {a.type}
                      </span>
                      <span className={cn("text-xs font-medium", a.completed ? "text-gray-300" : (isOverdue ? "text-red-400" : "text-gray-400"))}>
                        {new Date(a.date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions — visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                  <button
                    onClick={() => handleComplete(a)}
                    className="text-xs font-bold px-3 py-1 border border-gray-200 text-gray-500 hover:text-gray-800 rounded-md whitespace-nowrap hidden sm:block"
                  >
                    {a.completed ? "Reabrir" : "Concluir"}
                  </button>
                  <button
                    onClick={() => handleEdit(a)}
                    className="p-1.5 text-gray-400 hover:text-amber-600 border border-transparent hover:border-amber-200 hover:bg-amber-50 rounded-md transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteActivity(a.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 border border-transparent hover:border-red-200 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
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
