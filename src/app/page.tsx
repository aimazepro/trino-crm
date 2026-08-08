"use client";

import { useMemo, useState } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useRouter } from "next/navigation";
import {
  DollarSign, CheckCircle, TrendingUp, Clock,
  CirclePlus, ArrowRight, X, Calendar, Briefcase,
  ChartColumn
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

  // Soft-deleted deals can still be in local state right after a same-session
  // delete (the mutation updates in place instead of removing) — filter them
  // out here so dashboard aggregates don't double-count until next reload.
  const deals = useMemo(
    () => state.deals.filter((d) => !d.deletedAt),
    [state.deals]
  );

  // ── Metrics ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeDeals = deals.filter((d) => d.status === "Ativo");
    const wonDeals = deals.filter((d) => d.status === "Ganho");
    const lostDeals = deals.filter((d) => d.status === "Perdido");
    const totalPipeline = activeDeals.reduce((s, d) => s + d.value, 0);
    const wonValue = wonDeals.reduce((s, d) => s + d.value, 0);
    const convRate =
      deals.length > 0
        ? Math.round((wonDeals.length / deals.length) * 100)
        : 0;
    const allActivities = deals.flatMap((d) => d.activities);
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
  }, [deals]);

  // ── Stage data grouped by pipeline ───────────────────────────────────────────
  const pipelineStageData = useMemo(() => {
    return state.pipelines
      .map((pipeline) => ({
        pipeline,
        stages: pipeline.stages
          .map((stage) => {
            const stageDeals = deals.filter(
              (d) =>
                d.pipelineId === pipeline.id &&
                d.stageId === stage.id &&
                d.status === "Ativo"
            );
            return {
              ...stage,
              count: stageDeals.length,
              value: stageDeals.reduce((s, d) => s + d.value, 0),
              deals: stageDeals,
            };
          })
          .filter((stage) => stage.count > 0),
      }))
      .filter((p) => p.stages.length > 0);
  }, [state.pipelines, deals]);

  const allStageCounts = pipelineStageData.flatMap((p) => p.stages.map((s) => s.count));
  const maxCount = Math.max(...allStageCounts, 1);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // ── Drawer content helpers ────────────────────────────────────────────────────
  function getDealContact(contactId?: string) {
    return contactId ? state.contacts.find((c) => c.id === contactId) : null;
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

  function PipelineDrawerContent() {
    return (
      <div className="divide-y divide-zinc-100">
        {state.pipelines.map((pipeline) => {
          const pipelineDeals = deals.filter(
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

  function StageDrawerContent({ stageId }: { stageId: string }) {
    const stageDeals = deals.filter(
      (d) => d.stageId === stageId && d.status === "Ativo"
    );
    return <DealsDrawerContent deals={stageDeals} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Meu Painel</h1>
        <p className="mt-0.5 text-sm text-zinc-400">
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
        <div
          className="group rounded-2xl bg-white p-5 transition-all hover:shadow-md cursor-pointer"
          onClick={() => setDrawer({ type: "pipeline" })}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400 tracking-wide">Total em Pipeline</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900 tracking-tight">{fmt(stats.totalPipeline)}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {stats.activeDeals.length} negócio{stats.activeDeals.length !== 1 ? "s" : ""} aberto{stats.activeDeals.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-transform group-hover:scale-105">
              <DollarSign className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Ganhos no Mês */}
        <div
          className="group rounded-2xl bg-white p-5 transition-all hover:shadow-md cursor-pointer"
          onClick={() => setDrawer({ type: "ganhos" })}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400 tracking-wide">Ganhos no Mês</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900 tracking-tight">{fmt(stats.wonValue)}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {stats.wonDeals.length} negócio{stats.wonDeals.length !== 1 ? "s" : ""} fechado{stats.wonDeals.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-600 transition-transform group-hover:scale-105">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Taxa de Conversão */}
        <div className="group rounded-2xl bg-white p-5 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400 tracking-wide">Taxa de Conversão</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900 tracking-tight">{stats.convRate}%</p>
              <p className="mt-1 text-xs text-zinc-400">negócios fechados</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-105">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Atividades Hoje */}
        <a href="/atividades">
          <div className="group rounded-2xl bg-white p-5 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-400 tracking-wide">Atividades Hoje</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 tracking-tight">{stats.todayPending.length}</p>
                <p className="mt-1 text-xs text-zinc-400">pendentes</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition-transform group-hover:scale-105">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
          </div>
        </a>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">

        {/* Negócios por Etapa */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-5">Negócios por Etapa</h2>
          <div className="space-y-6">
            {pipelineStageData.map(({ pipeline, stages }) => (
              <div key={pipeline.id}>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                  {pipeline.name}
                </h3>
                <div className="space-y-2">
                  {stages.map((stage) => (
                    <div
                      key={stage.id}
                      className="flex items-center gap-3 hover:bg-zinc-50 rounded-lg px-1 -mx-1 py-1 transition-colors cursor-pointer"
                      onClick={() => setDrawer({ type: "stage", stageId: stage.id, stageName: stage.name })}
                    >
                      <div className="w-32 shrink-0 text-xs text-zinc-500 truncate">{stage.name}</div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-7 bg-zinc-50 rounded-md overflow-hidden">
                          <div
                            className="h-full rounded-md flex items-center px-2 transition-all"
                            style={{
                              width: stage.count > 0 ? `${Math.max((stage.count / maxCount) * 100, 15)}%` : "0%",
                              backgroundColor: "rgb(244, 244, 245)",
                              borderLeft: stage.count > 0 ? "3px solid rgb(161, 161, 170)" : "none",
                            }}
                          >
                            {stage.count > 0 && (
                              <span className="text-xs font-semibold text-zinc-600">{stage.count}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-zinc-400 w-24 text-right shrink-0">{fmt(stage.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {pipelineStageData.length === 0 && (
              <p className="text-center py-12 text-sm text-zinc-300">
                Nenhum negócio ainda
              </p>
            )}
          </div>
        </div>

        {/* Atividades de Hoje */}
        <div className="rounded-2xl bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-zinc-900">Atividades de Hoje</h2>
            <a href="/atividades" className="text-xs text-amber-500 hover:underline font-medium">Ver todas</a>
          </div>

          {stats.todayAll.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-400 gap-2">
              <Calendar className="h-7 w-7" aria-hidden="true" />
              <p className="text-sm">Nenhuma atividade hoje</p>
            </div>
          ) : (
            <div className="space-y-2">
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
                    "text-xs font-semibold truncate flex-1",
                    a.completed ? "text-zinc-400 line-through" : "text-zinc-700"
                  )}>
                    {a.title}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Este Mês */}
          <div className="mt-5 pt-5 border-t border-zinc-100">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Este Mês</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDrawer({ type: "ganhos" })}
                className="flex-1 rounded-lg bg-green-50 border border-green-100 p-3 text-center hover:border-green-300 transition-colors cursor-pointer"
              >
                <p className="text-xl font-bold text-green-600">{stats.wonDeals.length}</p>
                <p className="text-xs text-green-500 mt-0.5">Ganhos</p>
              </button>
              <button
                onClick={() => setDrawer({ type: "perdidos" })}
                className="flex-1 rounded-lg bg-red-50 border border-red-100 p-3 text-center hover:border-red-300 transition-colors cursor-pointer"
              >
                <p className="text-xl font-bold text-red-500">{stats.lostDeals.length}</p>
                <p className="text-xs text-red-400 mt-0.5">Perdidos</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Ações Rápidas ── */}
      <div>
        <h2 className="text-xs font-medium text-zinc-400 tracking-wide mb-3">Ações Rápidas</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            className="group flex items-center justify-between rounded-2xl bg-white p-5 hover:shadow-md transition-all text-left"
            onClick={() => setShowNewDeal(true)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                <CirclePlus className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Novo Negócio</p>
                <p className="text-xs text-zinc-400 mt-0.5">Adicionar ao pipeline</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-300 group-hover:text-amber-400 transition-colors" aria-hidden="true" />
          </button>

          <a
            className="group flex items-center justify-between rounded-2xl bg-white p-5 hover:shadow-md transition-all"
            href="/atividades"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Nova Atividade</p>
                <p className="text-xs text-zinc-400 mt-0.5">Agendar tarefa</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-300 group-hover:text-amber-400 transition-colors" aria-hidden="true" />
          </a>

          <a
            className="group flex items-center justify-between rounded-2xl bg-white p-5 hover:shadow-md transition-all"
            href="/insights"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-500">
                <ChartColumn className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Ver Relatórios</p>
                <p className="text-xs text-zinc-400 mt-0.5">Análise de desempenho</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-300 group-hover:text-amber-400 transition-colors" aria-hidden="true" />
          </a>
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
