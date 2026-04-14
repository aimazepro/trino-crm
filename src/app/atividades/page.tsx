"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Plus, List, Calendar as CalendarIcon,
  CheckCircle, Edit2, Trash2, Phone, Users, Video, Mail,
  MessageCircle, Camera, Briefcase, ClipboardList, Filter
} from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Activity } from "@/lib/crm-types";
import { ActivityModal } from "@/components/deal/activity-modal";
import { NextActivityModal } from "@/components/deal/next-activity-modal";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay,
  addMonths, subMonths
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "calendar";

const TYPE_COLORS: Record<string, { dot: string; badge: string; chip: string }> = {
  "Ligação":      { dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700",       chip: "bg-blue-100 border-blue-300 text-blue-800" },
  "Reunião":      { dot: "bg-purple-500",  badge: "bg-purple-50 text-purple-700",   chip: "bg-purple-100 border-purple-300 text-purple-800" },
  "Videochamada": { dot: "bg-green-500",   badge: "bg-green-50 text-green-700",     chip: "bg-green-100 border-green-300 text-green-800" },
  "Email":        { dot: "bg-gray-400",    badge: "bg-gray-100 text-gray-600",      chip: "bg-gray-100 border-gray-300 text-gray-700" },
  "WhatsApp":     { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", chip: "bg-emerald-100 border-emerald-300 text-emerald-800" },
  "Instagram":    { dot: "bg-pink-500",    badge: "bg-pink-50 text-pink-700",       chip: "bg-pink-100 border-pink-300 text-pink-800" },
  "LinkedIn":     { dot: "bg-sky-600",     badge: "bg-sky-50 text-sky-700",         chip: "bg-sky-100 border-sky-300 text-sky-800" },
  "Outros":       { dot: "bg-gray-400",    badge: "bg-gray-100 text-gray-600",      chip: "bg-gray-100 border-gray-300 text-gray-700" },
};
const getColors = (type: string) => TYPE_COLORS[type] || { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700", chip: "bg-amber-100 border-amber-300 text-amber-800" };

const TYPE_ICONS: Record<string, React.ElementType> = {
  "Ligação": Phone, "Reunião": Users, "Videochamada": Video,
  "Email": Mail, "WhatsApp": MessageCircle, "Instagram": Camera,
  "LinkedIn": Briefcase, "Outros": ClipboardList,
};
const ACTIVITY_TYPES = ["Todos", "Ligação", "Reunião", "Videochamada", "Email", "WhatsApp", "Instagram", "LinkedIn", "Outros"];

interface ActivityWithMeta extends Activity {
  dealTitle: string;
}

export default function AtividadesPage() {
  const { state, addActivity, updateActivity, deleteActivity } = useCrm();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterType, setFilterType] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Pendentes");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showNextModal, setShowNextModal] = useState(false);
  const [pendingDealId, setPendingDealId] = useState("");

  // Collect all activities with deal metadata
  const allActivities: ActivityWithMeta[] = useMemo(() => {
    return state.deals.flatMap(deal =>
      deal.activities.map(a => ({ ...a, dealTitle: deal.title }))
    );
  }, [state.deals]);

  // Apply filters
  const filtered = useMemo(() => {
    return allActivities.filter(a => {
      if (filterType !== "Todos" && a.type !== filterType) return false;
      if (filterStatus === "Pendentes" && a.completed) return false;
      if (filterStatus === "Concluídas" && !a.completed) return false;
      return true;
    });
  }, [allActivities, filterType, filterStatus]);

  // Group by date for list view
  const grouped = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const groups: Record<string, ActivityWithMeta[]> = {};
    const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sorted.forEach(a => {
      const d = new Date(a.date);
      d.setHours(0, 0, 0, 0);
      let label = format(d, "EEEE, d 'de' MMMM", { locale: ptBR });
      if (d.getTime() === today.getTime()) label = "HOJE";
      else if (d.getTime() === tomorrow.getTime()) label = "AMANHÃ";
      if (!groups[label]) groups[label] = [];
      groups[label].push(a);
    });
    return groups;
  }, [filtered]);

  const handleSave = (data: { title: string; type: string; date: string; description: string }) => {
    if (editingActivity) {
      updateActivity(editingActivity.id, data);
    } else {
      // Add to first deal if none selected, or use a generic approach
      const firstDeal = state.deals[0];
      if (firstDeal) {
        addActivity({ dealId: firstDeal.id, ...data });
      }
    }
    setShowModal(false);
    setEditingActivity(null);
  };

  const handleComplete = (a: ActivityWithMeta) => {
    if (!a.completed) {
      updateActivity(a.id, { completed: true });
      setPendingDealId(a.dealId);
      setShowNextModal(true);
    } else {
      updateActivity(a.id, { completed: false });
    }
  };

  // Calendar
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atividades</h1>
          <p className="text-sm text-gray-400">{allActivities.length} atividades</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm gap-1">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === "list" ? "bg-gray-900 text-white shadow" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <List size={15} /> Lista
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === "calendar" ? "bg-amber-500 text-white shadow" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <CalendarIcon size={15} /> Calendário
            </button>
          </div>

          {/* Status filter */}
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm gap-1">
            {["Pendentes", "Concluídas", "Todas"].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-bold transition-all",
                  filterStatus === s ? "bg-amber-500 text-white" : "text-gray-500 hover:bg-gray-50"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold bg-white text-gray-700 shadow-sm outline-none focus:border-amber-500"
          >
            {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>

          <button
            onClick={() => { setEditingActivity(null); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <Plus size={18} /> Nova Atividade
          </button>
        </div>
      </div>

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
          {Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <CalendarIcon size={64} className="mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-sm">Nenhuma atividade encontrada</p>
            </div>
          ) : (
            Object.entries(grouped).map(([label, acts]) => (
              <div key={label}>
                <h3 className={cn(
                  "text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2",
                  label === "HOJE" ? "text-amber-500" : "text-gray-400"
                )}>
                  {label === "HOJE" && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                  {label}
                </h3>
                <div className="space-y-2">
                  {acts.map(a => {
                    const colors = getColors(a.type);
                    const Icon = TYPE_ICONS[a.type] || ClipboardList;
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "flex items-center gap-4 p-4 bg-white border rounded-2xl shadow-sm transition-all group hover:shadow-md",
                          a.completed ? "opacity-50 border-gray-100" : "border-gray-100 hover:border-amber-200"
                        )}
                      >
                        {/* Complete circle */}
                        <button
                          onClick={() => handleComplete(a)}
                          className={cn(
                            "w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                            a.completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-amber-500 hover:scale-110"
                          )}
                        >
                          {a.completed && <CheckCircle size={14} />}
                        </button>

                        {/* Type icon */}
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", colors.badge)}>
                          <Icon size={15} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-bold text-gray-900 truncate", a.completed && "line-through text-gray-400")}>
                            {format(new Date(a.date), "HH:mm")} — {a.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", colors.badge)}>{a.type}</span>
                            <span className="text-xs text-gray-400 font-medium">{a.dealTitle}</span>
                          </div>
                        </div>

                        {/* Actions on hover */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingActivity(a); setShowModal(true); }}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => deleteActivity(a.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === "calendar" && (
        <div className="flex-1 flex flex-col min-h-0 bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
              <ChevronLeft size={20} className="text-gray-500" />
            </button>
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">
              {format(currentDate, "MMMM 'De' yyyy", { locale: ptBR })}
            </h2>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
              <ChevronRight size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
            {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map(d => (
              <div key={d} className="py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 flex-1 overflow-y-auto">
            {calDays.map((day, idx) => {
              const dayActs = allActivities.filter(a =>
                isSameDay(new Date(a.date), day) &&
                (filterType === "Todos" || a.type === filterType)
              );

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[120px] p-2 border-b border-r border-gray-50 flex flex-col",
                    !isSameMonth(day, currentDate) && "bg-gray-50/30 opacity-40"
                  )}
                >
                  <span className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full text-xs font-black mb-2 self-start",
                    isToday(day) ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "text-gray-700"
                  )}>
                    {format(day, "d")}
                  </span>
                  <div className="space-y-1 overflow-hidden">
                    {dayActs.slice(0, 4).map(a => {
                      const colors = getColors(a.type);
                      return (
                        <button
                          key={a.id}
                          onClick={() => { setEditingActivity(a); setShowModal(true); }}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded-lg border text-[10px] font-bold truncate transition-all hover:scale-[1.02]",
                            a.completed ? "line-through opacity-60 " + colors.chip : colors.chip
                          )}
                        >
                          <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1 shrink-0", colors.dot)} />
                          {format(new Date(a.date), "HH:mm")} {a.title}
                        </button>
                      );
                    })}
                    {dayActs.length > 4 && (
                      <p className="text-[10px] text-gray-400 font-bold pl-1">+{dayActs.length - 4} mais</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ActivityModal
          activity={editingActivity || undefined}
          onClose={() => { setShowModal(false); setEditingActivity(null); }}
          onSave={handleSave}
        />
      )}

      {showNextModal && (
        <NextActivityModal
          dealId={pendingDealId}
          onClose={() => setShowNextModal(false)}
          onSave={(data) => {
            addActivity({ dealId: pendingDealId, ...data });
            setShowNextModal(false);
          }}
        />
      )}
    </div>
  );
}
