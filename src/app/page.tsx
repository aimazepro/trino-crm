"use client";

import { useMemo, useState } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useRouter } from "next/navigation";
import { ArrowUpRight, DollarSign, TrendingUp, CheckCircle, ListTodo, Plus, ChevronRight } from "lucide-react";
import { NewDealModal } from "@/components/pipeline/new-deal-modal";
import { cn } from "@/lib/utils";
import { isToday, isPast } from "date-fns";

const TYPE_COLORS: Record<string, string> = {
  "Ligação": "bg-blue-100 text-blue-700",
  "Reunião": "bg-purple-100 text-purple-700",
  "Videochamada": "bg-green-100 text-green-700",
  "Email": "bg-gray-100 text-gray-600",
  "WhatsApp": "bg-emerald-100 text-emerald-700",
  "Instagram": "bg-pink-100 text-pink-700",
  "LinkedIn": "bg-sky-100 text-sky-700",
  "Outros": "bg-gray-100 text-gray-600",
};

export default function DashboardPage() {
  const { state } = useCrm();
  const router = useRouter();
  const [showNewDeal, setShowNewDeal] = useState(false);

  const activePipeline = state.pipelines[0];

  // ── Computed metrics ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeDeals = state.deals.filter(d => d.status === "Ativo");
    const totalPipeline = activeDeals.reduce((s, d) => s + d.value, 0);

    const now = new Date();
    const wonDeals = state.deals.filter(d => {
      if (d.status !== "Ganho") return false;
      // We don't have a closedAt field, so count all won deals this month
      return true;
    });
    const wonValue = wonDeals.reduce((s, d) => s + d.value, 0);

    const convRate = state.deals.length > 0
      ? Math.round((wonDeals.length / state.deals.length) * 100)
      : 0;

    const allActivities = state.deals.flatMap(d => d.activities);
    const todayPending = allActivities.filter(a => !a.completed && isToday(new Date(a.date)));
    const todayActivities = allActivities.filter(a => isToday(new Date(a.date)));

    return { activeDeals, totalPipeline, wonDeals, wonValue, convRate, todayPending, todayActivities, allActivities };
  }, [state.deals]);

  // Deals per stage for active pipeline
  const stageData = useMemo(() => {
    if (!activePipeline) return [];
    return activePipeline.stages.map(stage => {
      const stageDeals = state.deals.filter(d => d.pipelineId === activePipeline.id && d.stageId === stage.id && d.status === "Ativo");
      return {
        ...stage,
        count: stageDeals.length,
        value: stageDeals.reduce((s, d) => s + d.value, 0),
      };
    }).filter(s => s.count > 0 || true); // show all stages
  }, [activePipeline, state.deals]);

  const maxStageCount = Math.max(...stageData.map(s => s.count), 1);

  const STAT_CARDS = [
    {
      label: "Total em Pipeline",
      value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.totalPipeline),
      sub: `${stats.activeDeals.length} negócio${stats.activeDeals.length !== 1 ? "s" : ""} aberto${stats.activeDeals.length !== 1 ? "s" : ""}`,
      icon: DollarSign,
      color: "text-amber-500",
      bg: "bg-amber-50",
      href: "/pipeline",
    },
    {
      label: "Ganhos no Mês",
      value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.wonValue),
      sub: `${stats.wonDeals.length} negócio${stats.wonDeals.length !== 1 ? "s" : ""} fechado${stats.wonDeals.length !== 1 ? "s" : ""}`,
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-50",
      href: "/pipeline",
    },
    {
      label: "Taxa de Conversão",
      value: `${stats.convRate}%`,
      sub: `${stats.wonDeals.length} de ${state.deals.length} negócios fechados`,
      icon: TrendingUp,
      color: "text-blue-500",
      bg: "bg-blue-50",
      href: "/pipeline",
    },
    {
      label: "Atividades Hoje",
      value: String(stats.todayPending.length),
      sub: "pendentes",
      icon: ListTodo,
      color: "text-purple-500",
      bg: "bg-purple-50",
      href: "/atividades",
    },
  ];

  return (
    <div className="max-w-6xl space-y-6">

      {/* Greeting */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Meu Painel</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card, i) => (
          <button
            key={i}
            onClick={() => router.push(card.href)}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all text-left group active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{card.label}</span>
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center", card.bg)}>
                <card.icon size={17} className={card.color} />
              </div>
            </div>
            <p className="text-2xl font-black text-gray-900 leading-none mb-1">{card.value}</p>
            <p className="text-xs font-medium text-gray-400">{card.sub}</p>
            <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs font-bold text-amber-500">Ver detalhes</span>
              <ChevronRight size={12} className="text-amber-500" />
            </div>
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Negócios por Etapa */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-gray-900">Negócios por Etapa</h2>
              {activePipeline && (
                <p className="text-xs text-gray-400 mt-0.5 uppercase font-bold tracking-wider">{activePipeline.name}</p>
              )}
            </div>
            <button onClick={() => router.push("/pipeline")} className="text-xs font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1">
              Ver todos <ChevronRight size={12} />
            </button>
          </div>

          <div className="space-y-4">
            {stageData.map(stage => (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-gray-700">{stage.name}</span>
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-black text-[11px]">{stage.count}</span>
                    <span className="text-amber-600 font-black">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(stage.value)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: maxStageCount > 0 ? `${(stage.count / maxStageCount) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}

            {stageData.length === 0 && (
              <p className="text-center py-10 text-sm text-gray-300 font-medium">Nenhum negócio ainda</p>
            )}
          </div>
        </div>

        {/* Atividades de Hoje */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-gray-900">Atividades de Hoje</h2>
            <button onClick={() => router.push("/atividades")} className="text-xs font-bold text-amber-500 hover:text-amber-600">
              Ver todas
            </button>
          </div>

          {stats.todayActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                <ListTodo size={22} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">Nenhuma atividade hoje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.todayActivities.slice(0, 5).map(a => {
                const isOverdue = !a.completed && isPast(new Date(a.date)) && !isToday(new Date(a.date));
                return (
                  <button
                    key={a.id}
                    onClick={() => router.push("/atividades")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left transition-colors group"
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      a.completed ? "bg-green-400" : (isOverdue ? "bg-red-500 animate-pulse" : "bg-amber-400")
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-bold text-gray-900 truncate", 
                        a.completed && "line-through text-gray-400",
                        isOverdue && "text-red-600"
                      )}>
                        {isOverdue && <span className="mr-1">⚠️</span>}
                        {a.title}
                      </p>
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded", 
                        isOverdue ? "bg-red-50 text-red-600" : (TYPE_COLORS[a.type] || "bg-gray-100 text-gray-600")
                      )}>
                        {isOverdue ? "Atrasada" : a.type}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Este mês */}
          <div className="mt-6 pt-4 border-t border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Este Mês</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center justify-center py-3 bg-green-50 rounded-xl border border-green-100">
                <span className="text-2xl font-black text-green-600">{stats.wonDeals.length}</span>
                <span className="text-[10px] font-bold text-green-500 uppercase mt-1">Ganhos</span>
              </div>
              <div className="flex flex-col items-center justify-center py-3 bg-red-50 rounded-xl border border-red-100">
                <span className="text-2xl font-black text-red-500">
                  {state.deals.filter(d => d.status === "Perdido").length}
                </span>
                <span className="text-[10px] font-bold text-red-400 uppercase mt-1">Perdidos</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ações Rápidas</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              icon: Plus,
              color: "text-amber-500",
              bg: "bg-amber-50",
              label: "Novo Negócio",
              sub: "Adicionar ao pipeline",
              action: () => setShowNewDeal(true),
            },
            {
              icon: ListTodo,
              color: "text-blue-500",
              bg: "bg-blue-50",
              label: "Nova Atividade",
              sub: "Agendar tarefa",
              action: () => router.push("/atividades"),
            },
            {
              icon: TrendingUp,
              color: "text-purple-500",
              bg: "bg-purple-50",
              label: "Ver Relatórios",
              sub: "Análise de desempenho",
              action: () => router.push("/"),
            },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition-all group text-left active:scale-[0.98]"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                <item.icon size={20} className={item.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-400 font-medium">{item.sub}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      </div>

      {showNewDeal && activePipeline && (
        <NewDealModal
          activePipelineId={activePipeline.id}
          onClose={() => setShowNewDeal(false)}
        />
      )}
    </div>
  );
}
