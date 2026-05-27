"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Plus, List, Calendar as CalendarIcon,
  CheckCircle, Edit2, Trash2, Phone, Users, Video, Mail,
  MessageCircle, Camera, Briefcase, ClipboardList,
  ChevronLeft, ChevronRight, Filter, X, ChevronDown,
} from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { Activity } from "@/lib/crm-types";
import { ActivityModal } from "@/components/deal/activity-modal";
import { NextActivityModal } from "@/components/deal/next-activity-modal";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay,
  addMonths, subMonths, startOfDay, endOfDay, addDays,
  startOfISOWeek, endOfISOWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "calendar";
type DateFilter = "hoje" | "amanha" | "semana" | "proxima_semana" | "vencido" | "periodo" | "concluidas";

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
  const { selfName } = useOwnerNameMap();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [dateFilter, setDateFilter] = useState<DateFilter>("hoje");
  const [filterType, setFilterType] = useState("Todos");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [userFilter, setUserFilter] = useState("");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showNextModal, setShowNextModal] = useState(false);
  const [pendingDealId, setPendingDealId] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const typeDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) setShowTypeDropdown(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const allActivities: ActivityWithMeta[] = useMemo(() =>
    state.deals.flatMap(deal => deal.activities.map(a => ({ ...a, dealTitle: deal.title }))),
    [state.deals]
  );

  const dealOptions = useMemo(() => state.deals.map(d => ({ id: d.id, title: d.title })), [state.deals]);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    return allActivities.filter(a => {
      const aDate = new Date(a.date);
      if (filterType !== "Todos" && a.type !== filterType) return false;
      switch (dateFilter) {
        case "hoje": return !a.completed && aDate >= todayStart && aDate <= todayEnd;
        case "amanha": { const s = startOfDay(addDays(now, 1)), e = endOfDay(addDays(now, 1)); return !a.completed && aDate >= s && aDate <= e; }
        case "semana": { const s = startOfISOWeek(now), e = endOfISOWeek(now); return !a.completed && aDate >= s && aDate <= e; }
        case "proxima_semana": { const s = startOfISOWeek(addDays(now, 7)), e = endOfISOWeek(addDays(now, 7)); return !a.completed && aDate >= s && aDate <= e; }
        case "vencido": return !a.completed && aDate < todayStart;
        case "periodo": {
          if (!rangeStart || !rangeEnd) return !a.completed;
          const rs = startOfDay(new Date(rangeStart + "T00:00:00")), re = endOfDay(new Date(rangeEnd + "T00:00:00"));
          return !a.completed && aDate >= rs && aDate <= re;
        }
        case "concluidas": return a.completed;
        default: return true;
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
      if (dateFilter === "concluidas") label = "CONCLUÍDAS";
      else if (!a.completed && dayStart < todayStart) label = "ATRASADAS";
      else if (dayStart.getTime() === todayStart.getTime()) label = "HOJE";
      else if (dayStart.getTime() === tomorrowStart.getTime()) label = "AMANHÃ";
      else label = format(d, "EEEE, d 'de' MMMM", { locale: ptBR }).toUpperCase();
      if (!groups[label]) groups[label] = [];
      groups[label].push(a);
    });
    return groups;
  }, [filtered, dateFilter]);

  const selectedDayActs = useMemo(() => {
    if (!selectedDay) return [];
    return allActivities.filter(a => {
      if (!isSameDay(new Date(a.date), selectedDay)) return false;
      if (filterType !== "Todos" && a.type !== filterType) return false;
      return true;
    });
  }, [allActivities, selectedDay, filterType]);

  const formatSidebarDate = (date: Date) => {
    const raw = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
    return raw.split(" ").map(word => {
      if (word.toLowerCase() === "de") return "De";
      return word.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("-");
    }).join(" ");
  };

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "calendar") {
      const now = new Date();
      const upcoming = [...filtered]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .find(a => new Date(a.date) >= startOfDay(now));
      const target = upcoming
        ? new Date(upcoming.date)
        : filtered.length > 0
          ? new Date(filtered[filtered.length - 1].date)
          : now;
      setCurrentDate(target);
    }
  };

  const handleDayClick = (day: Date) => {
    if (selectedDay && isSameDay(selectedDay, day)) setSelectedDay(null);
    else setSelectedDay(day);
  };

  const handleSave = (data: { title: string; type: string; date: string; description: string; dealId: string; guests: string[] }) => {
    if (editingActivity) {
      updateActivity(editingActivity.id, { title: data.title, date: data.date, type: data.type, description: data.description, guests: data.guests });
    } else {
      const targetDealId = data.dealId || state.deals.find(d => d.status === "Ativo")?.id || state.deals[0]?.id;
      if (!targetDealId) return; // no deals exist — nothing to attach activity to
      addActivity({ dealId: targetDealId, title: data.title, date: data.date, type: data.type, description: data.description, guests: data.guests });
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
  const calStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
  const calEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const calWeeks: Date[][] = [];
  for (let i = 0; i < calDays.length; i += 7) calWeeks.push(calDays.slice(i, i + 7));

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="flex items-center justify-between bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-800">Atividades</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{filtered.length} {filtered.length === 1 ? "atividade" : "atividades"}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => handleSetViewMode("list")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 transition-colors", viewMode === "list" ? "bg-amber-500 text-white" : "text-zinc-500 hover:bg-zinc-50")}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" /> Lista
            </button>
            <button
              onClick={() => handleSetViewMode("calendar")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 border-l border-zinc-200 transition-colors", viewMode === "calendar" ? "bg-amber-500 text-white" : "text-zinc-500 hover:bg-zinc-50")}
            >
              <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" /> Calendario
            </button>
          </div>

          {/* Type filter */}
          <div className="relative" ref={typeDropdownRef}>
            <button
              onClick={() => setShowTypeDropdown(v => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <Filter className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
              <span>{filterType === "Todos" ? "Todos" : filterType}</span>
              <ChevronDown className="h-3 w-3 text-zinc-400" aria-hidden="true" />
            </button>
            {showTypeDropdown && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 z-50">
                {["Todos", ...Object.keys(TYPE_ICONS)].map(type => (
                  <button
                    key={type}
                    onClick={() => { setFilterType(type); setShowTypeDropdown(false); }}
                    className={cn("w-full text-left px-4 py-2 text-xs transition-colors", filterType === type ? "bg-amber-50 text-amber-700 font-semibold" : "text-zinc-600 hover:bg-zinc-50")}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Users filter */}
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="text-xs text-zinc-600 bg-transparent border-none outline-none cursor-pointer"
            >
              <option value="">Todos os usuarios</option>
              <option value="mine">Minhas atividades</option>
            </select>
          </div>

          <button
            onClick={() => { setEditingActivity(null); setShowModal(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-2 text-xs font-semibold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Nova Atividade
          </button>
        </div>
      </div>

      {/* Date filter tabs (list view only) */}
      {viewMode === "list" && (
        <div className="flex items-center gap-1 border-b border-zinc-100 bg-white px-6 py-2 overflow-x-auto">
          {DATE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                dateFilter === f.key ? "bg-blue-50 text-blue-700" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
              )}
            >
              {f.label}
            </button>
          ))}
          {dateFilter === "periodo" && (
            <div className="ml-3 flex items-center gap-2 border-l border-zinc-200 pl-3">
              <input
                type="date"
                value={rangeStart}
                onChange={e => setRangeStart(e.target.value)}
                className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-amber-500"
              />
              <span className="text-xs text-zinc-400">até</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={e => setRangeEnd(e.target.value)}
                className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-amber-500"
              />
            </div>
          )}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="flex-1 overflow-auto p-6">
          {Object.keys(grouped).length === 0 ? (
            <div className="max-w-3xl mx-auto flex flex-col items-center justify-center py-24">
              <CheckCircle className="h-9 w-9 text-zinc-200 mb-3" />
              <p className="text-sm text-zinc-400">Nenhuma atividade agendada</p>
              <button
                onClick={() => { setEditingActivity(null); setShowModal(true); }}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Nova Atividade
              </button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-8">
              {Object.entries(grouped).map(([label, acts]) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{label}</h2>
                    <div className="flex-1 h-px bg-zinc-100" />
                    <span className="text-xs text-zinc-400">{acts.length}</span>
                  </div>
                  <div className="space-y-2">
                    {acts.map(a => {
                      const Icon = TYPE_ICONS[a.type] || ClipboardList;
                      return (
                        <div key={a.id} className="group flex items-start gap-3 rounded-xl p-4 transition-colors bg-white hover:bg-zinc-50">
                          <button onClick={() => handleComplete(a)} className="shrink-0 mt-0.5 transition-colors">
                            {a.completed
                              ? <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
                              : <div className="h-5 w-5 rounded-full border-2 border-zinc-300 hover:border-amber-400 transition-colors" />
                            }
                          </button>
                          <span className="shrink-0 rounded-full bg-zinc-100 p-1.5 text-zinc-500">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingActivity(a); setShowModal(true); }}>
                            <p className={cn("text-sm font-semibold text-zinc-800", a.completed && "line-through text-zinc-400")}>
                              {format(new Date(a.date), "HH:mm")} - {a.title}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium bg-amber-50 text-amber-600">
                                <CalendarIcon className="h-3 w-3" aria-hidden="true" />
                                {format(new Date(a.date), "d 'de' MMM. HH:mm", { locale: ptBR })}
                              </span>
                              <Link
                                href={`/negocios/${a.dealId}`}
                                className="text-xs text-amber-500 hover:underline font-medium truncate"
                                onClick={e => e.stopPropagation()}
                              >
                                {a.dealTitle}
                              </Link>
                              <span className="flex items-center gap-1 text-xs text-zinc-500">
                                <Users className="h-3 w-3" aria-hidden="true" /> {selfName || "Você"} (você)
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="inline-block rounded-full px-2 py-0.5 text-xs text-zinc-400 bg-zinc-100">{a.type}</span>
                            <button
                              onClick={() => { setEditingActivity(a); setShowModal(true); }}
                              className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-amber-500 transition-all"
                              title="Editar atividade"
                            >
                              <Edit2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => deleteActivity(a.id)}
                              className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-400 transition-all"
                              title="Excluir atividade"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === "calendar" && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto p-6">
            {/* Nav */}
            <div className="flex items-center justify-between mb-5 max-w-4xl mx-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 hover:bg-zinc-50 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 hover:bg-zinc-50 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <h2 className="text-sm font-semibold text-zinc-800 capitalize">
                {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </h2>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
              >
                Hoje
              </button>
            </div>

            <div className="max-w-4xl mx-auto">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-zinc-400 uppercase tracking-wide py-1">{d}</div>
                ))}
              </div>

              {/* Calendar rows */}
              <div className="rounded-2xl overflow-hidden bg-white">
                {calWeeks.map((week, wi) => (
                  <div key={wi} className={cn("grid grid-cols-7", wi < calWeeks.length - 1 && "border-b border-zinc-100")}>
                    {week.map((day, di) => {
                      const isCurrentMonth = isSameMonth(day, currentDate);
                      const isLastCol = di === 6;
                      const dayActs = allActivities.filter(a => {
                        if (!isSameDay(new Date(a.date), day)) return false;
                        if (filterType !== "Todos" && a.type !== filterType) return false;
                        return true;
                      });

                      if (!isCurrentMonth) {
                        return (
                          <div
                            key={di}
                            className={cn("bg-zinc-50 min-h-[90px]", !isLastCol && "border-r border-zinc-100")}
                          />
                        );
                      }

                      return (
                        <div
                          key={di}
                          onClick={() => handleDayClick(day)}
                          className={cn(
                            "min-h-[90px] p-2 cursor-pointer transition-colors bg-white hover:bg-zinc-50",
                            !isLastCol && "border-r border-zinc-100"
                          )}
                        >
                          <div className="flex items-center justify-center w-6 h-6 mb-1 mx-auto">
                            <span className={cn(
                              "text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center",
                              isToday(day) ? "bg-amber-500 text-white" : "text-zinc-700"
                            )}>
                              {format(day, "d")}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {dayActs.slice(0, 3).map(a => (
                              <div
                                key={a.id}
                                className={cn(
                                  "flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium truncate text-blue-700 bg-blue-50 border border-blue-200",
                                  a.completed && "opacity-50"
                                )}
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-500" />
                                <span className={cn("truncate", a.completed && "line-through")}>
                                  {format(new Date(a.date), "HH:mm")} {a.title}
                                </span>
                              </div>
                            ))}
                            {dayActs.length > 3 && (
                              <p className="text-[9px] text-zinc-400 pl-1">+{dayActs.length - 3} mais</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Day detail sidebar */}
          {selectedDay && (
            <div className="w-80 bg-white border-l border-zinc-100 flex flex-col shrink-0">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-800">{formatSidebarDate(selectedDay)}</h3>
                <button onClick={() => setSelectedDay(null)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-5 space-y-3">
                {selectedDayActs.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8">Nenhuma atividade neste dia</p>
                ) : (
                  selectedDayActs.map(a => {
                    const Icon = TYPE_ICONS[a.type] || ClipboardList;
                    return (
                      <div key={a.id} className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3.5">
                        <span className="shrink-0 rounded-full bg-white border border-zinc-200 p-1.5 text-zinc-500">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-xs font-semibold text-zinc-800", a.completed && "line-through text-zinc-400")}>
                            {format(new Date(a.date), "HH:mm")} - {a.title}
                          </p>
                          <p className="text-[10px] text-amber-500 mt-0.5">{a.dealTitle}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ActivityModal
          activity={editingActivity || undefined}
          onClose={() => { setShowModal(false); setEditingActivity(null); }}
          onSave={handleSave}
          deals={dealOptions}
          userName={selfName || undefined}
        />
      )}

      {showNextModal && (
        <NextActivityModal
          dealId={pendingDealId}
          onClose={() => setShowNextModal(false)}
          onSave={(data) => { addActivity({ dealId: pendingDealId, ...data }); setShowNextModal(false); }}
        />
      )}
    </div>
  );
}
