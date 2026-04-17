"use client";

import { useMemo, useState } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useRouter } from "next/navigation";
import {
  DollarSign, CheckCircle, TrendingUp, Clock,
  Plus, ChevronRight, X, CalendarDays, Briefcase, BarChart2
} from "lucide-react";
import { NewDealModal } from "@/components/pipeline/new-deal-modal";
import { cn } from "@/lib/utils";
import { isToday } from "date-fns";

// ── Right Drawer ──────────────────────────────────────────────────────────────
function RightDrawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[380px] bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
          <h2 className="text-[15px] font-bold text-zinc-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}

type DrawerState =
  | { type: "pipeline" }
  | { type: "ganhos" }
  | { type: "perdidos" }
  | { type: "stage"; stageId: string; stageName: string }
  | null;

export default function DashboardPage() {
  const { state } = useCrm();
  const router = useRouter();
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const activePipeline = state.pipelines[0];

  // ── Metrics ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeDeals = state.deals.filter((d) => d.status === "Ativo");
    const wonDeals = state.deals.filter((d) => d.status === "Ganho");
    const lostDeals = state.deals.filter((d) => d.status === "Perdido");
    const totalPipeline = activeDeals.reduce((s, d) => s + d.value, 0);
    const wonValue = wonDeals.reduce((s, d) => s + d.value, 0);
    const convRate =
      state.deals.length > 0
        ? Math.round((wonDeals.length / state.deals.length) * 100)
        : 0;
    const allActivities = state.deals.flatMap((d) => d.activities);
    const todayPending = allActivities.filter(
      (a) => !a.completed && isToday(new Date(a.date))
    );
    const todayAll = allActivities.filter((a) => isToday(new Date(a.date)));
    return {
      activeDeals,
      wonDeals,
      lostDeals,
      totalPipeline,
      wonValue,
      convRate,
      todayPending,
      todayAll,
    };
  }, [state.deals]);

  // ── Stage data ────────────────────────────────────────────────────────────────
  const stageData = useMemo(() => {
    if (!activePipeline) return [];
    return activePipeline.stages.map((stage) => {
      const stageDeals = state.deals.filter(
        (d) =>
          d.pipelineId === activePipeline.id &&
          d.stageId === stage.id &&
          d.status === "Ativo"
      );
      return {
        ...stage,
        count: stageDeals.length,
        value: stageDeals.reduce((s, d) => s + d.value, 0),
        deals: stageDeals,
      };
    });
  }, [activePipeline, state.deals]);

  const maxCount = Math.max(...stageData.map((s) => s.count), 1);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // ── Drawer content helpers ────────────────────────────────────────────────────
  function getDealContact(contactId: string) {
    return state.contacts.find((c) => c.id === contactId);
  }
  function getDealCompany(companyId?: string) {
    return companyId ? state.companies.find((c) => c.id === companyId) : null;
  }

  function DealRow({ deal }: { deal: (typeof state.deals)[0] }) {
    const company = getDealCompany(deal.companyId);
    const contact = getDealContact(deal.contactId);
    return (
      <div
        className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 transition-colors cursor-pointer"
        onClick={() => { setDrawer(null); router.push(`/negocios/${deal.id}`); }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-zinc-900 truncate">{deal.title}</p>
          <p className="text-[11px] font-medium text-zinc-400 truncate">
            {company?.name || contact?.name || "—"}
          </p>
        </div>
        <span className="text-[13px] font-bold text-zinc-700 shrink-0">{fmt(deal.value)}</span>
      </div>
    );
  }

  // ── Drawer: Pipeline ──────────────────────────────────────────────────────────
  function PipelineDrawerContent() {
    const pipelines = state.pipelines;
    return (
      <div className="divide-y divide-zinc-100">
        {pipelines.map((pipeline) => {
          const pipelineDeals = state.deals.filter(
            (d) => d.pipelineId === pipeline.id && d.status === "Ativo"
          );
          if (pipelineDeals.length === 0) return null;
          return (
            <div key={pipeline.id}>
              <div className="px-5 py-3 bg-zinc-50">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {pipeline.name}
                </p>
              </div>
              {pipeline.stages.map((stage) => {
                const stageDeals = pipelineDeals.filter((d) => d.stageId === stage.id);
                if (stageDeals.length === 0) return null;
                return (
                  <div key={stage.id}>
                    <div className="px-5 py-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-zinc-300" />
                      <span className="text-[12px] font-bold text-zinc-600">{stage.name}</span>
                      <span className="text-[11px] font-bold text-zinc-400 bg-zinc-100 rounded-full px-1.5">
                        {stageDeals.length}
                      </span>
                    </div>
                    {stageDeals.map((deal) => (
                      <DealRow key={deal.id} deal={deal} />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
        {stats.activeDeals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Briefcase size={28} className="text-zinc-200 mb-3" />
            <p className="text-[13px] font-medium text-zinc-400">Nenhum negócio encontrado</p>
          </div>
        )}
      </div>
    );
  }

  // ── Drawer: Ganhos / Perdidos ─────────────────────────────────────────────────
  function DealsDrawerContent({ deals }: { deals: (typeof state.deals) }) {
    if (deals.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <Briefcase size={28} className="text-zinc-200 mb-3" />
          <p className="text-[13px] font-medium text-zinc-400">Nenhum negócio encontrado</p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-zinc-100">
        {deals.map((deal) => (
          <DealRow key={deal.id} deal={deal} />
        ))}
      </div>
    );
  }

  // ── Drawer: Stage ─────────────────────────────────────────────────────────────
  function StageDrawerContent({ stageId }: { stageId: string }) {
    const stageDeals = state.deals.filter(
      (d) => d.stageId === stageId && d.status === "Ativo"
    );
    return <DealsDrawerContent deals={stageDeals} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#F4F4F5]">
      <div className="max-w-6xl mx-auto w-full p-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-[22px] font-black text-zinc-900 tracking-tight">Meu Painel</h1>
          <p className="text-[13px] font-medium text-zinc-400 mt-0.5">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Total em Pipeline */}
          <button
            onClick={() => setDrawer({ type: "pipeline" })}
            className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 text-left hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-[12px] font-semibold text-zinc-400">Total em Pipeline</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <DollarSign size={15} className="text-amber-500" />
              </div>
            </div>
            <p className="text-[22px] font-black text-zinc-900 leading-none">{fmt(stats.totalPipeline)}</p>
            <p className="text-[12px] font-medium text-zinc-400 mt-1.5">
              {stats.activeDeals.length} negócio{stats.activeDeals.length !== 1 ? "s" : ""} aberto{stats.activeDeals.length !== 1 ? "s" : ""}
            </p>
          </button>

          {/* Ganhos no Mês */}
          <button
            onClick={() => setDrawer({ type: "ganhos" })}
            className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 text-left hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-[12px] font-semibold text-zinc-400">Ganhos no Mês</span>
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <CheckCircle size={15} className="text-green-500" />
              </div>
            </div>
            <p className="text-[22px] font-black text-zinc-900 leading-none">{fmt(stats.wonValue)}</p>
            <p className="text-[12px] font-medium text-zinc-400 mt-1.5">
              {stats.wonDeals.length} negócio{stats.wonDeals.length !== 1 ? "s" : ""} fechado{stats.wonDeals.length !== 1 ? "s" : ""}
            </p>
          </button>

          {/* Taxa de Conversão */}
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 text-left hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[12px] font-semibold text-zinc-400">Taxa de Conversão</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <TrendingUp size={15} className="text-blue-500" />
              </div>
            </div>
            <p className="text-[22px] font-black text-zinc-900 leading-none">{stats.convRate}%</p>
            <p className="text-[12px] font-medium text-zinc-400 mt-1.5">negócios fechados</p>
          </div>

          {/* Atividades Hoje */}
          <button
            onClick={() => router.push("/atividades")}
            className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 text-left hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-[12px] font-semibold text-zinc-400">Atividades Hoje</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <Clock size={15} className="text-purple-500" />
              </div>
            </div>
            <p className="text-[22px] font-black text-zinc-900 leading-none">{stats.todayPending.length}</p>
            <p className="text-[12px] font-medium text-zinc-400 mt-1.5">pendentes</p>
          </button>
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">

          {/* Negócios por Etapa */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
            <div className="mb-5">
              <h2 className="text-[14px] font-bold text-zinc-900">Negócios por Etapa</h2>
              {activePipeline && (
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">
                  {activePipeline.name}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {stageData.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => setDrawer({ type: "stage", stageId: stage.id, stageName: stage.name })}
                  className="w-full flex items-center gap-3 group hover:bg-zinc-50/70 rounded-xl px-2 py-1 -mx-2 transition-colors cursor-pointer"
                >
                  <span className="text-[13px] font-semibold text-zinc-700 w-32 text-left truncate shrink-0">
                    {stage.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="inline-flex items-center justify-center w-6 h-6 border border-zinc-200 rounded text-[11px] font-bold text-zinc-600 bg-white">
                      {stage.count}
                    </span>
                  </div>
                  <div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-zinc-400 rounded-full transition-all duration-500"
                      style={{ width: `${(stage.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[12px] font-bold text-zinc-600 shrink-0 w-24 text-right">
                    {fmt(stage.value)}
                  </span>
                </button>
              ))}

              {stageData.every((s) => s.count === 0) && (
                <p className="text-center py-12 text-[13px] text-zinc-300 font-medium">
                  Nenhum negócio ainda
                </p>
              )}
            </div>
          </div>

          {/* Atividades de Hoje */}
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[14px] font-bold text-zinc-900">Atividades de Hoje</h2>
              <button
                onClick={() => router.push("/atividades")}
                className="text-[12px] font-bold text-amber-500 hover:text-amber-600 transition-colors"
              >
                Ver todas
              </button>
            </div>

            {stats.todayAll.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 flex-1">
                <CalendarDays size={28} className="text-zinc-200 mb-2" />
                <p className="text-[13px] font-medium text-zinc-400">Nenhuma atividade hoje</p>
              </div>
            ) : (
              <div className="space-y-2 flex-1">
                {stats.todayAll.slice(0, 4).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => router.push("/atividades")}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-50 text-left transition-colors"
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      a.completed ? "bg-green-400" : "bg-amber-400"
                    )} />
                    <p className={cn(
                      "text-[12px] font-semibold truncate flex-1",
                      a.completed ? "text-zinc-400 line-through" : "text-zinc-700"
                    )}>
                      {a.title}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Este Mês */}
            <div className="mt-4 pt-4 border-t border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
                Este Mês
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDrawer({ type: "ganhos" })}
                  className="flex flex-col items-center justify-center py-3 bg-green-50 rounded-xl border border-green-100 hover:bg-green-100 transition-colors cursor-pointer"
                >
                  <span className="text-[22px] font-black text-green-600">{stats.wonDeals.length}</span>
                  <span className="text-[10px] font-bold text-green-500 mt-0.5">Ganhos</span>
                </button>
                <button
                  onClick={() => setDrawer({ type: "perdidos" })}
                  className="flex flex-col items-center justify-center py-3 bg-red-50 rounded-xl border border-red-100 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <span className="text-[22px] font-black text-red-500">{stats.lostDeals.length}</span>
                  <span className="text-[10px] font-bold text-red-400 mt-0.5">Perdidos</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Ações Rápidas ── */}
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
            Ações Rápidas
          </p>
          <div className="grid grid-cols-3 gap-3">
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
                icon: Clock,
                color: "text-blue-500",
                bg: "bg-blue-50",
                label: "Nova Atividade",
                sub: "Agendar tarefa",
                action: () => router.push("/atividades"),
              },
              {
                icon: BarChart2,
                color: "text-purple-500",
                bg: "bg-purple-50",
                label: "Ver Relatórios",
                sub: "Análise de desempenho",
                action: () => router.push("/insights"),
              },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className="bg-white border border-zinc-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md hover:border-zinc-200 transition-all group text-left cursor-pointer"
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                  <item.icon size={18} className={item.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-zinc-900">{item.label}</p>
                  <p className="text-[11px] text-zinc-400 font-medium">{item.sub}</p>
                </div>
                <ChevronRight
                  size={15}
                  className="text-zinc-200 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Drawer ── */}
      {drawer && (
        <RightDrawer
          title={
            drawer.type === "pipeline"
              ? "Negócios em Pipeline"
              : drawer.type === "ganhos"
              ? "Negócios Ganhos no Mês"
              : drawer.type === "perdidos"
              ? "Negócios Perdidos no Mês"
              : `Etapa: ${drawer.stageName}`
          }
          onClose={() => setDrawer(null)}
        >
          {drawer.type === "pipeline" && <PipelineDrawerContent />}
          {drawer.type === "ganhos" && <DealsDrawerContent deals={stats.wonDeals} />}
          {drawer.type === "perdidos" && <DealsDrawerContent deals={stats.lostDeals} />}
          {drawer.type === "stage" && <StageDrawerContent stageId={drawer.stageId} />}
        </RightDrawer>
      )}

      {showNewDeal && activePipeline && (
        <NewDealModal
          activePipelineId={activePipeline.id}
          onClose={() => setShowNewDeal(false)}
        />
      )}
    </div>
  );
}
