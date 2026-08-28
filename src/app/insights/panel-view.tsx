"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Plus, Settings, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { useInsights } from "./insights-context";
import { ReportCard } from "./report-card";
import { ALL_USERS } from "./use-report-result";
import { TeamScoreboard } from "./team-scoreboard";
import { periodToRange } from "./report-types/filters";

/** MIME do drag de relatório vindo da sidebar. */
export const REPORT_DND_TYPE = "application/x-trino-report-id";

const PERIODS = ["Este mes", "Mes passado", "Este ano", "Ultimos 7 dias", "Ultimos 30 dias", "Todo o periodo"];

/**
 * Renderiza um painel (o padrão "Meu Painel" ou um customizado): cabeçalho com
 * filtros que valem pra todos os cards, drop zone pra adicionar relatórios da
 * sidebar, e reordenação arrastando pelo grip do card.
 */
export function PanelView({ panelId }: { panelId: string }) {
  const {
    dashboards, savedReports, loaded, seeding, seedError, createDefaultReports,
    addReportToPanel, removeReportFromPanel, reorderPanelReports,
  } = useInsights();
  const { names: ownerNames } = useOwnerNameMap();

  const [period, setPeriod] = useState("Este mes");
  const [owner, setOwner] = useState<string>(ALL_USERS);
  const [showPeriod, setShowPeriod] = useState(false);
  const [showOwner, setShowOwner] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const periodRef = useRef<HTMLDivElement>(null);
  const ownerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) setShowPeriod(false);
      if (ownerRef.current && !ownerRef.current.contains(e.target as Node)) setShowOwner(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const panel = dashboards.find((d) => d.id === panelId) ?? null;

  const cards = useMemo(() => {
    if (!panel) return [];
    return panel.reportIds
      .map((id) => savedReports.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => !!r);
  }, [panel, savedReports]);

  const overrides = useMemo(() => ({ period, ownerName: owner }), [period, owner]);

  // team_scoreboard pede datas fechadas; periodToRange devolve um limite
  // superior aberto (ou nulo, pra período "corrente"). Fecha subtraindo um
  // dia do "to" quando existe, e usa hoje quando não existe.
  const { periodStart, periodEnd } = useMemo(() => {
    const { from, to } = periodToRange(period);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const start = from ?? new Date(2000, 0, 1);
    const end = to ? new Date(to.getTime() - 86400000) : new Date();
    return { periodStart: iso(start), periodEnd: iso(end) };
  }, [period]);

  if (!loaded || !panel) {
    return <div className="flex items-center justify-center py-20 text-sm text-zinc-400">Carregando painel...</div>;
  }

  const handleDropOnPanel = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const reportId = e.dataTransfer.getData(REPORT_DND_TYPE) || e.dataTransfer.getData("text/plain");
    if (reportId) addReportToPanel(panelId, reportId);
  };

  const handleDragOverPanel = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(REPORT_DND_TYPE)) {
      e.preventDefault();
      setDragOver(true);
    }
  };

  // Nenhum relatório salvo ainda: o caminho é criar os padrões.
  const noReportsAtAll = savedReports.length === 0;

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 flex flex-col">
      <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-zinc-900">{panel.name}</h1>
        <div className="flex items-center gap-3">
          <div className="relative" ref={periodRef}>
            <button
              onClick={() => setShowPeriod((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <span className="text-zinc-800 font-medium">{period}</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            </button>
            {showPeriod && (
              <div className="absolute right-0 mt-1 w-44 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 z-50">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPeriod(p); setShowPeriod(false); }}
                    className={cn("w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 cursor-pointer", period === p && "bg-zinc-50 font-semibold text-emerald-700")}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={ownerRef}>
            <button
              onClick={() => setShowOwner((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <span className="text-zinc-800 font-medium">{owner}</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            </button>
            {showOwner && (
              <div className="absolute right-0 mt-1 w-52 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 z-50 max-h-64 overflow-y-auto">
                {[ALL_USERS, ...ownerNames].map((u) => (
                  <button
                    key={u}
                    onClick={() => { setOwner(u); setShowOwner(false); }}
                    className={cn("w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 cursor-pointer", owner === u && "bg-zinc-50 font-semibold text-emerald-700")}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-xs text-zinc-400">{cards.length} {cards.length === 1 ? "relatorio" : "relatorios"}</span>
        </div>
      </div>

      <div
        onDragOver={handleDragOverPanel}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDropOnPanel}
        className={cn(
          "p-6 min-h-[calc(100vh-120px)] transition-colors",
          dragOver && "bg-emerald-50/60 ring-2 ring-inset ring-emerald-400"
        )}
      >
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-2xl bg-white border border-zinc-200 p-8 text-center max-w-md">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                {noReportsAtAll ? <Settings className="h-6 w-6 text-zinc-400" /> : <Sparkles className="h-6 w-6 text-zinc-400" />}
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 mb-2">Painel vazio</h2>
              {noReportsAtAll ? (
                <>
                  <p className="text-sm text-zinc-500 mb-6">Comece com relatorios prontos ou crie do zero.</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={createDefaultReports}
                      disabled={seeding}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      {seeding ? "Criando..." : "Criar relatorios padrao"}
                    </button>
                    <Link
                      href="/insights/reports/new"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Criar relatorio do zero
                    </Link>
                  </div>
                  {seedError && <p className="mt-4 text-xs text-red-600">{seedError}</p>}
                </>
              ) : (
                <p className="text-sm text-zinc-500">Arraste relatorios da lista ao lado para adicionar ao painel.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cards.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                overrides={overrides}
                dragging={draggingId === report.id}
                onRemove={() => removeReportFromPanel(panelId, report.id)}
                onDragStart={() => setDraggingId(report.id)}
                onDragOver={(e) => { if (draggingId && draggingId !== report.id) e.preventDefault(); }}
                onDrop={() => {
                  if (draggingId && draggingId !== report.id) reorderPanelReports(panelId, draggingId, report.id);
                  setDraggingId(null);
                }}
              />
            ))}
          </div>
        )}

        {dragOver && cards.length > 0 && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50/60 py-8 text-center text-sm font-medium text-emerald-700">
            Solte para adicionar ao painel
          </div>
        )}

        <div className="mt-4">
          <TeamScoreboard periodStart={periodStart} periodEnd={periodEnd} />
        </div>
      </div>
    </div>
  );
}
