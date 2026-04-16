"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Plus, List, Calendar as CalendarIcon,
  CheckCircle, Edit2, Trash2, Phone, Users, Video, Mail,
  MessageCircle, Camera, Briefcase, ClipboardList, Filter, AlertCircle, ChevronDown
} from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Activity } from "@/lib/crm-types";
import { ActivityModal } from "@/components/deal/activity-modal";
import { NextActivityModal } from "@/components/deal/next-activity-modal";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay, isPast,
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
      
      if (!a.completed && d.getTime() < today.getTime()) {
        label = "ATRASADAS";
      } else if (d.getTime() === today.getTime()) {
        label = "HOJE";
      } else if (d.getTime() === tomorrow.getTime()) {
        label = "AMANHÃ";
      }
      
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
      const firstDeal = state.deals.find(d => d.status === "Ativo") || state.deals[0];
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
    <div className="flex flex-col h-full overflow-hidden bg-[#F4F4F5]">
      
      {/* Main Secondary Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-3.5 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 leading-none mb-1">Atividades</h1>
          <p className="text-[11px] font-medium text-zinc-400">{allActivities.length} {allActivities.length === 1 ? 'atividade' : 'atividades'}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-zinc-200 overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center justify-center px-3 py-1.5 border-r border-zinc-200 transition-colors text-[12px] font-semibold",
                viewMode === "list" ? "bg-amber-500 text-white" : "bg-white text-zinc-500 hover:text-zinc-700"
              )}
            >
              <List size={13} className="mr-1.5" /> Lista
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center justify-center px-3 py-1.5 transition-colors text-[12px] font-semibold",
                viewMode === "calendar" ? "bg-amber-500 text-white" : "bg-white text-zinc-500 hover:text-zinc-700"
              )}
            >
              <CalendarIcon size={13} className="mr-1.5" /> Calendário
            </button>
          </div>

          {/* Status filter */}
          <div className="flex items-center rounded-lg border border-zinc-200 overflow-hidden ml-2">
            {["Pendentes", "Concluídas", "Todas"].map((s, i) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "flex items-center justify-center px-3 py-1.5 transition-colors text-[12px] font-semibold border-zinc-200",
                  filterStatus === s ? "bg-amber-500 text-white" : "bg-white text-zinc-500 hover:text-zinc-700",
                  i !== 2 && "border-r"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Select dropdowns */}
          <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 ml-2">
            <Filter size={13} className="text-zinc-400" /> Todos <ChevronDown size={13} className="text-zinc-400 ml-1" />
          </button>
          
          <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50">
            <Users size={13} className="text-zinc-400" /> Todos os usuários <ChevronDown size={13} className="text-zinc-400 ml-1" />
          </button>

          <button
            onClick={() => { setEditingActivity(null); setShowModal(true); }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-1.5 text-[13px] font-medium text-white hover:from-amber-600 hover:to-amber-500 transition-all shadow-sm hover:shadow-md ml-2"
          >
            <Plus size={15} /> Nova Atividade
          </button>
        </div>
      </div>

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto p-8 space-y-8">
          {Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <CalendarIcon size={64} className="mb-4 opacity-20" />
              <p className="font-medium uppercase tracking-widest text-sm">Nenhuma atividade encontrada</p>
            </div>
          ) : (
            Object.entries(grouped).map(([label, acts]) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase">
                    {label}
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-400">{acts.length}</span>
                </div>

                <div className="space-y-1.5">
                  {acts.map(a => {
                    const colors = getColors(a.type);
                    const Icon = TYPE_ICONS[a.type] || ClipboardList;
                    const isOverdueLabel = label === "ATRASADAS";
                    
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "flex items-center justify-between p-2 pl-4 pr-3 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all group border",
                          a.completed ? "opacity-60 border-transparent shadow-none" : "border-transparent hover:border-zinc-200"
                        )}
                      >
                         <div className="flex items-center gap-3 w-full">
                            {/* Complete circle */}
                            <button
                              onClick={() => handleComplete(a)}
                              className={cn(
                                "w-[18px] h-[18px] rounded-full border flex items-center justify-center shrink-0 transition-all",
                                a.completed ? "bg-green-500 border-green-500 text-white" : "border-zinc-300 hover:border-amber-500 bg-white"
                              )}
                            >
                              {a.completed && <CheckCircle size={10} />}
                            </button>
                            
                            {/* Type icon block */}
                            <div className="w-[30px] h-[30px] rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                               <Icon size={14} className="text-zinc-500" />
                            </div>

                            <div className="flex flex-col ml-1">
                               <span 
                                 className="text-[13px] font-semibold text-zinc-900 cursor-pointer hover:text-amber-600 transition-colors" 
                                 onClick={() => { setEditingActivity(a); setShowModal(true); }}
                               >
                                  {format(new Date(a.date), "HH:mm")} - {a.title}
                               </span>
                               
                               <div className="flex items-center gap-2 mt-[2px]">
                                  <span className={cn(
                                    "rounded text-[10px] px-1.5 py-0.5 font-medium flex items-center gap-1",
                                    !a.completed && isOverdueLabel ? "bg-red-50 text-red-500" : "bg-zinc-100 text-zinc-500"
                                  )}>
                                    <CalendarIcon size={10} /> 
                                    {format(new Date(a.date), "d 'de' MMM, HH:mm", { locale: ptBR })}
                                  </span>
                                  <span className="text-amber-500 text-[10px] font-medium tracking-wide">{a.dealTitle}</span>
                               </div>
                            </div>
                         </div>

                         {/* Right side Actions & Badge */}
                         <div className="shrink-0 flex items-center pr-1 gap-2">
                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => { setEditingActivity(a); setShowModal(true); }} className="p-1 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors">
                               <Edit2 size={13} />
                             </button>
                             <button onClick={() => deleteActivity(a.id)} className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                               <Trash2 size={13} />
                             </button>
                           </div>
                           <span className="bg-zinc-100/80 text-zinc-400 rounded-full px-2.5 py-0.5 text-[10px] font-medium">
                             {a.type}
                           </span>
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
            <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-tight">
              {format(currentDate, "MMMM 'De' yyyy", { locale: ptBR })}
            </h2>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
              <ChevronRight size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
            {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map(d => (
              <div key={d} className="py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{d}</div>
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
                    "w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold mb-2 self-start",
                    isToday(day) ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "text-gray-700"
                  )}>
                    {format(day, "d")}
                  </span>
                  <div className="space-y-1 overflow-hidden">
                    {dayActs.slice(0, 4).map(a => {
                      const colors = getColors(a.type);
                      const isOverdue = !a.completed && isPast(new Date(a.date)) && !isToday(day);
                      return (
                        <button
                          key={a.id}
                          onClick={() => { setEditingActivity(a); setShowModal(true); }}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded-lg border text-[10px] font-medium truncate transition-all hover:scale-[1.02]",
                            a.completed ? "line-through opacity-60 " + colors.chip : (isOverdue ? "bg-red-50 border-red-300 text-red-800" : colors.chip)
                          )}
                        >
                          <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1 shrink-0", isOverdue ? "bg-red-500" : colors.dot)} />
                          {format(new Date(a.date), "HH:mm")} {a.title}
                        </button>
                      );
                    })}
                    {dayActs.length > 4 && (
                      <p className="text-[10px] text-gray-400 font-medium pl-1">+{dayActs.length - 4} mais</p>
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
