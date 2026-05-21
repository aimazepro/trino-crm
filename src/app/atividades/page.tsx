"use client";

import { useState, useMemo } from "react";
import {
  Plus, List, Calendar as CalendarIcon,
  CheckCircle, Edit2, Trash2, Phone, Users, Video, Mail,
  MessageCircle, Camera, Briefcase, ClipboardList, AlertCircle, ChevronDown,
  ChevronLeft, ChevronRight, Filter,
} from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Activity } from "@/lib/crm-types";
import { ActivityModal } from "@/components/deal/activity-modal";
import { NextActivityModal } from "@/components/deal/next-activity-modal";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay, isPast,
  addMonths, subMonths, startOfDay, endOfDay, addDays, startOfISOWeek, endOfISOWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "calendar";
type DateFilter = "hoje" | "amanha" | "semana" | "proxima_semana" | "vencido" | "periodo" | "concluidas";

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

interface ActivityWithMeta extends Activity {
  dealTitle: string;
}

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "amanha", label: "Amanhã" },
  { key: "semana", label: "Esta semana" },
  { key: "proxima_semana", label: "Próxima semana" },
  { key: "vencido", label: "Vencido" },
  { key: "periodo", label: "Selecionar período" },
  { key: "concluidas", label: "Concluídas" },
];

export default function AtividadesPage() {
  const { state, addActivity, updateActivity, deleteActivity } = useCrm();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [dateFilter, setDateFilter] = useState<DateFilter>("hoje");
  const [filterType, setFilterType] = useState("Todos");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showNextModal, setShowNextModal] = useState(false);
  const [pendingDealId, setPendingDealId] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const allActivities: ActivityWithMeta[] = useMemo(() => {
    return state.deals.flatMap(deal =>
      deal.activities.map(a => ({ ...a, dealTitle: deal.title }))
    );
  }, [state.deals]);

  const dealOptions = useMemo(() => state.deals.map(d => ({ id: d.id, title: d.title })), [state.deals]);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    return allActivities.filter(a => {
      const aDate = new Date(a.date);

      // Type filter
      if (filterType !== "Todos" && a.type !== filterType) return false;

      switch (dateFilter) {
        case "hoje":
          return !a.completed && aDate >= todayStart && aDate <= todayEnd;
        case "amanha": {
          const tomorrowStart = startOfDay(addDays(now, 1));
          const tomorrowEnd = endOfDay(addDays(now, 1));
          return !a.completed && aDate >= tomorrowStart && aDate <= tomorrowEnd;
        }
        case "semana": {
          const weekStart = startOfISOWeek(now);
          const weekEnd = endOfISOWeek(now);
          return !a.completed && aDate >= weekStart && aDate <= weekEnd;
        }
        case "proxima_semana": {
          const nextWeekStart = startOfISOWeek(addDays(now, 7));
          const nextWeekEnd = endOfISOWeek(addDays(now, 7));
          return !a.completed && aDate >= nextWeekStart && aDate <= nextWeekEnd;
        }
        case "vencido":
          return !a.completed && aDate < todayStart;
        case "periodo": {
          if (!rangeStart || !rangeEnd) return !a.completed;
          const rs = startOfDay(new Date(rangeStart + "T00:00:00"));
          const re = endOfDay(new Date(rangeEnd + "T00:00:00"));
          return !a.completed && aDate >= rs && aDate <= re;
        }
        case "concluidas":
          return a.completed;
        default:
          return true;
      }
    });
  }, [allActivities, filterType, dateFilter, rangeStart, rangeEnd]);

  const grouped = useMemo(() => {
    const groups: Record<string, ActivityWithMeta[]> = {};
    const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sorted.forEach(a => {
      const d = new Date(a.date);
      const dayStart = startOfDay(d);
      const todayStart = startOfDay(new Date());
      const tomorrowStart = startOfDay(addDays(new Date(), 1));

      let label: string;
      if (dateFilter === "concluidas") {
        label = "CONCLUÍDAS";
      } else if (!a.completed && dayStart < todayStart) {
        label = "ATRASADAS";
      } else if (dayStart.getTime() === todayStart.getTime()) {
        label = "HOJE";
      } else if (dayStart.getTime() === tomorrowStart.getTime()) {
        label = "AMANHÃ";
      } else {
        label = format(d, "EEEE, d 'de' MMMM", { locale: ptBR }).toUpperCase();
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(a);
    });
    return groups;
  }, [filtered, dateFilter]);

  const handleSave = (data: { title: string; type: string; date: string; description: string; dealId: string }) => {
    if (editingActivity) {
      updateActivity(editingActivity.id, { title: data.title, date: data.date, type: data.type, description: data.description });
    } else {
      const targetDealId = data.dealId || state.deals.find(d => d.status === "Ativo")?.id || state.deals[0]?.id;
      if (targetDealId) {
        addActivity({ dealId: targetDealId, title: data.title, date: data.date, type: data.type, description: data.description });
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

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-3.5 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 leading-none mb-0.5">Atividades</h1>
          <p className="text-[11px] font-medium text-zinc-400">{allActivities.length} {allActivities.length === 1 ? "atividade" : "atividades"}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-zinc-200 overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={cn("flex items-center px-3 py-1.5 border-r border-zinc-200 transition-colors text-[12px] font-semibold gap-1.5", viewMode === "list" ? "bg-amber-500 text-white" : "bg-white text-zinc-500 hover:text-zinc-700")}
            >
              <List size={13} /> Lista
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn("flex items-center px-3 py-1.5 transition-colors text-[12px] font-semibold gap-1.5", viewMode === "calendar" ? "bg-amber-500 text-white" : "bg-white text-zinc-500 hover:text-zinc-700")}
            >
              <CalendarIcon size={13} /> Calendário
            </button>
          </div>

          <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50">
            <Filter size={13} className="text-zinc-400" /> Todos <ChevronDown size={12} className="text-zinc-400" />
          </button>

          <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50">
            <Users size={13} className="text-zinc-400" /> Todos os usuários <ChevronDown size={12} className="text-zinc-400" />
          </button>

          <button
            onClick={() => { setEditingActivity(null); setShowModal(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-1.5 text-[13px] font-semibold text-white transition-colors shadow-sm"
          >
            <Plus size={15} /> Nova Atividade
          </button>
        </div>
      </div>

      {/* Date Filter Tabs */}
      <div className="bg-white border-b border-zinc-100 px-6 flex items-center gap-0 shrink-0">
        {DATE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setDateFilter(f.key)}
            className={cn(
              "px-4 py-3 text-[13px] font-medium transition-colors whitespace-nowrap border-b-2 -mb-px",
              dateFilter === f.key
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Period date inputs */}
      {dateFilter === "periodo" && (
        <div className="bg-white px-6 py-3 flex items-center gap-3 border-b border-zinc-100 shrink-0">
          <input
            type="date"
            value={rangeStart}
            onChange={e => setRangeStart(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-amber-400"
          />
          <span className="text-zinc-400 text-sm">até</span>
          <input
            type="date"
            value={rangeEnd}
            onChange={e => setRangeEnd(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-amber-400"
          />
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-8 space-y-8">
          {Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <CheckCircle size={28} className="text-amber-300" />
              </div>
              <p className="text-sm font-semibold text-zinc-400 mb-1">Nenhuma atividade agendada</p>
              <p className="text-xs text-zinc-300">Crie atividades para acompanhar ligações, reuniões e emails com seus clientes.</p>
              <button
                onClick={() => { setEditingActivity(null); setShowModal(true); }}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Plus size={15} /> Nova Atividade
              </button>
            </div>
          ) : (
            Object.entries(grouped).map(([label, acts]) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">{label}</span>
                  <span className="text-[10px] font-semibold text-zinc-400">{acts.length}</span>
                </div>
                <div className="space-y-1.5">
                  {acts.map(a => {
                    const colors = getColors(a.type);
                    const Icon = TYPE_ICONS[a.type] || ClipboardList;
                    const isOverdue = label === "ATRASADAS";
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "flex items-center justify-between p-2 pl-4 pr-3 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all group border",
                          a.completed ? "opacity-60 border-transparent" : "border-transparent hover:border-zinc-200"
                        )}
                      >
                        <div className="flex items-center gap-3 w-full min-w-0">
                          <button
                            onClick={() => handleComplete(a)}
                            className={cn(
                              "w-[18px] h-[18px] rounded-full border flex items-center justify-center shrink-0 transition-all",
                              a.completed ? "bg-green-500 border-green-500 text-white" : "border-zinc-300 hover:border-amber-500 bg-white"
                            )}
                          >
                            {a.completed && <CheckCircle size={10} />}
                          </button>
                          <div className="w-[30px] h-[30px] rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                            <Icon size={14} className={cn("transition-colors", a.completed ? "text-zinc-300" : "text-zinc-500")} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span
                              className={cn("text-[13px] font-semibold cursor-pointer hover:text-amber-600 transition-colors block truncate", a.completed ? "line-through text-zinc-400" : "text-zinc-900")}
                              onClick={() => { setEditingActivity(a); setShowModal(true); }}
                            >
                              {format(new Date(a.date), "HH:mm")} — {a.title}
                            </span>
                            <div className="flex items-center gap-2 mt-[2px] flex-wrap">
                              <span className={cn("rounded text-[10px] px-1.5 py-0.5 font-medium flex items-center gap-1", isOverdue && !a.completed ? "bg-red-50 text-red-500" : "bg-zinc-100 text-zinc-500")}>
                                <CalendarIcon size={9} />
                                {format(new Date(a.date), "d 'de' MMM, HH:mm", { locale: ptBR })}
                              </span>
                              <span className="text-amber-500 text-[10px] font-medium">{a.dealTitle}</span>
                              <span className="text-zinc-400 text-[10px] flex items-center gap-1">
                                <Users size={9} /> João Paulo Olivera (você)
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center pl-2 gap-1.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingActivity(a); setShowModal(true); }} className="p-1 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => deleteActivity(a.id)} className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <span className="bg-zinc-100/80 text-zinc-400 rounded-full px-2 py-0.5 text-[10px] font-medium">{a.type}</span>
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
        <div className="flex-1 flex flex-col min-h-0 m-6 bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
              <ChevronLeft size={20} className="text-gray-500" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-tight">
              {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
              <ChevronRight size={20} className="text-gray-500" />
            </button>
          </div>
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
            {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map(d => (
              <div key={d} className="py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1 overflow-y-auto">
            {calDays.map((day, idx) => {
              const dayActs = allActivities.filter(a => isSameDay(new Date(a.date), day));
              return (
                <div key={idx} className={cn("min-h-[100px] p-2 border-b border-r border-gray-50 flex flex-col", !isSameMonth(day, currentDate) && "bg-gray-50/30 opacity-40")}>
                  <span className={cn("w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold mb-1 self-start", isToday(day) ? "bg-amber-500 text-white" : "text-gray-700")}>
                    {format(day, "d")}
                  </span>
                  <div className="space-y-1 overflow-hidden">
                    {dayActs.slice(0, 3).map(a => {
                      const colors = getColors(a.type);
                      const isOverdue = !a.completed && isPast(new Date(a.date)) && !isToday(day);
                      return (
                        <button
                          key={a.id}
                          onClick={() => { setEditingActivity(a); setShowModal(true); }}
                          className={cn("w-full text-left px-2 py-1 rounded-lg border text-[10px] font-medium truncate transition-all hover:scale-[1.02]", a.completed ? "line-through opacity-60 " + colors.chip : (isOverdue ? "bg-red-50 border-red-300 text-red-800" : colors.chip))}
                        >
                          {format(new Date(a.date), "HH:mm")} {a.title}
                        </button>
                      );
                    })}
                    {dayActs.length > 3 && <p className="text-[10px] text-gray-400 pl-1">+{dayActs.length - 3} mais</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && (
        <ActivityModal
          activity={editingActivity || undefined}
          onClose={() => { setShowModal(false); setEditingActivity(null); }}
          onSave={handleSave}
          deals={dealOptions}
          userName="João Paulo Olivera"
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
