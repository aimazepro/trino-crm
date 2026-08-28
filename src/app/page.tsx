"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useRouter } from "next/navigation";
import {
  DollarSign, CheckCircle, TrendingUp, Clock,
  CirclePlus, ArrowRight, X, Calendar, Briefcase,
  ChartColumn, ChevronDown
} from "lucide-react";
import { NewDealModal } from "@/components/pipeline/new-deal-modal";
import { useTeam } from "@/hooks/use-team";
import { OwnerSelect } from "@/components/team/owner-select";
import { TeamScoreboard } from "@/app/insights/team-scoreboard";
import { periodToRange } from "@/app/insights/report-types/filters";
import { matchesDealScope, scopedDeals, sumDealValues } from "@/lib/deal-scope";
import { cn } from "@/lib/utils";
import { isToday } from "date-fns";

/**
 * Mesmos períodos de Insights. A *chave* é o que `periodToRange` entende e
 * tem que continuar sem acento; o rótulo é só o que aparece na tela.
 */
const PERIODS: { key: string; label: string }[] = [
  { key: "Este mes", label: "Este mês" },
  { key: "Mes passado", label: "Mês passado" },
  { key: "Este ano", label: "Este ano" },
  { key: "Ultimos 7 dias", label: "Últimos 7 dias" },
  { key: "Ultimos 30 dias", label: "Últimos 30 dias" },
  { key: "Todo o periodo", label: "Todo o período" },
];

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
  const { isManager } = useTeam();
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);

  // Esta tela não tinha período nenhum: os cards diziam "no Mês" e somavam o
  // histórico inteiro. O placar do time exige um intervalo, então o período
  // entrou de vez -- e os agregados que mentiam passaram a respeitá-lo.
  const [period, setPeriod] = useState("Este mes");
  const [showPeriod, setShowPeriod] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);

  // Vendedor já enxerga só a própria carteira pela RLS; o filtro só faz
  // sentido para quem vê mais de uma (gerente e admin), igual a /negocios.
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) setShowPeriod(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;
  const activePipeline = state.pipelines[0];

  // Limites do período aplicados à data de fechamento (ver DealScope).
  const { from: closedFrom, to: closedTo } = useMemo(() => periodToRange(period), [period]);

  // team_scoreboard pede datas fechadas; periodToRange devolve um limite
  // superior aberto (ou nulo, pra período "corrente"). Fecha subtraindo um dia
  // do "to" quando existe, e usa hoje quando não existe. Mesma conversão de
  // src/app/insights/panel-view.tsx -- se um dia mudar lá, muda aqui também.
  const { periodStart, periodEnd } = useMemo(() => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const start = closedFrom ?? new Date(2000, 0, 1);
    const end = closedTo ? new Date(closedTo.getTime() - 86400000) : new Date();
    return { periodStart: iso(start), periodEnd: iso(end) };
  }, [closedFrom, closedTo]);

  // Base de todos os agregados desta tela. `matchesDealScope` também descarta
  // os soft-deleted, que continuam no estado local logo depois de uma exclusão
  // na mesma sessão (a mutação atualiza no lugar em vez de remover).
  const deals = useMemo(
    () => scopedDeals(state.deals, { ownerId: ownerFilter }),
    [state.deals, ownerFilter]
  );

  // ── Metrics ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    // Pipeline é estado *atual*, não recorte de período: negócio aberto não
    // fechou, então filtrá-lo por data de fechamento esvaziaria o card.
    const activeDeals = scopedDeals(deals, { status: "Ativo" });
    const wonDeals = scopedDeals(deals, { status: "Ganho", closedFrom, closedTo });
    const lostDeals = scopedDeals(deals, { status: "Perdido", closedFrom, closedTo });
    const totalPipeline = sumDealValues(activeDeals);
    const wonValue = sumDealValues(wonDeals);
    // Ganhos sobre *fechados no período*. Antes era ganhos sobre todos os
    // negócios de todo o tempo, o que com período viraria numerador recortado
    // sobre denominador do sempre -- uma taxa que só cai com o tempo.
    const closedCount = wonDeals.length + lostDeals.length;
    const convRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;
    // "Hoje" não é o período da tela: trocar pra "Mês passado" não deveria
    // mudar a lista de atividades de hoje. A atividade herda o escopo do
    // negócio dono -- atividade atribuída a alguém num negócio de outro não
    // aparece pra ele aqui (o caso "atividade órfã" do P4).
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
  }, [deals, closedFrom, closedTo]);

  // ── Stage data grouped by pipeline ───────────────────────────────────────────
  const pipelineStageData = useMemo(() => {
    return state.pipelines
      .map((pipeline) => ({
        pipeline,
        stages: pipeline.stages
          .map((stage) => {
            const stageDeals = scopedDeals(deals, {
              pipelineId: pipeline.id,
              stageId: stage.id,
              status: "Ativo",
            });
            return {
              ...stage,
              count: stageDeals.length,
              value: sumDealValues(stageDeals),
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
          const pipelineDeals = scopedDeals(deals, {
            pipelineId: pipeline.id,
            status: "Ativo",
          });
          if (pipelineDeals.length === 0) return null;
          return (
            <div key={pipeline.id}>
              <div className="px-5 py-3 bg-zinc-50">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {pipeline.name}
                </p>
              </div>
              {pipeline.stages.map((stage) => {
                const stageDeals = pipelineDeals.filter((d) =>
                  matchesDealScope(d, { stageId: stage.id })
                );
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
    const stageDeals = scopedDeals(deals, { stageId, status: "Ativo" });
    return <DealsDrawerContent deals={stageDeals} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
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

        <div className="flex items-center gap-2">
          {/* Período: vale para os agregados de fechamento e para o placar. */}
          <div className="relative" ref={periodRef}>
            <button
              onClick={() => setShowPeriod((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <span>{periodLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
            </button>
            {showPeriod && (
              <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => { setPeriod(p.key); setShowPeriod(false); }}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50 cursor-pointer",
                      period === p.key && "bg-zinc-50 font-semibold",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro por vendedor -- só para quem vê mais de uma carteira. */}
          {isManager && (
            <OwnerSelect
              value={ownerFilter}
              onChange={setOwnerFilter}
              allowUnassigned
              unassignedLabel="Todos os vendedores"
              className="w-44"
            />
          )}
        </div>
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
              <p className="text-xs font-medium text-zinc-400 tracking-wide">Ganhos</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900 tracking-tight">{fmt(stats.wonValue)}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {stats.wonDeals.length} fechado{stats.wonDeals.length !== 1 ? "s" : ""} · {periodLabel.toLowerCase()}
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
              <p className="mt-1 text-xs text-zinc-400">dos fechados no período</p>
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
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">{periodLabel}</p>
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

      {/* ── Placar do Time ── */}
      {/* Agregado pela RPC team_scoreboard, que tem escopo próprio: mostra o
          time inteiro para todo papel, e por isso não responde ao filtro por
          vendedor acima -- é o comparativo que dá contexto ao número de cada
          um. Só o período é compartilhado. */}
      <TeamScoreboard periodStart={periodStart} periodEnd={periodEnd} />

      {/* ── Right Drawer ── */}
      {drawer && (
        <RightDrawer
          title={
            drawer.type === "pipeline"
              ? "Negócios em Pipeline"
              : drawer.type === "ganhos"
              ? `Negócios ganhos · ${periodLabel}`
              : drawer.type === "perdidos"
              ? `Negócios perdidos · ${periodLabel}`
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
