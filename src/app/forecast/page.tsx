"use client";

import { useMemo, useState } from "react";
import { useCrm } from "@/contexts/crm-context";
import { TrendingUp, DollarSign, Star, Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { format, parseISO, startOfMonth, addMonths, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const MONTHS_AHEAD = 6;

function monthKey(iso: string) {
  return iso.slice(0, 7); // "YYYY-MM"
}

export default function ForecastPage() {
  const { state } = useCrm();
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [showPipelineMenu, setShowPipelineMenu] = useState(false);

  const now = new Date();
  const windowEnd = addMonths(startOfMonth(now), MONTHS_AHEAD);

  const activeDeals = useMemo(() =>
    state.deals.filter(d => d.status === "Ativo" && !d.deletedAt),
  [state.deals]);

  const filteredDeals = useMemo(() =>
    selectedPipeline === "all"
      ? activeDeals
      : activeDeals.filter(d => d.pipelineId === selectedPipeline),
  [activeDeals, selectedPipeline]);

  // Summary KPIs
  const totalPipeline = filteredDeals.reduce((s, d) => s + d.value, 0);
  const weightedForecast = filteredDeals.reduce((s, d) => s + d.value * ((d.probability ?? 50) / 100), 0);
  const commits = filteredDeals
    .filter(d => (d.probability ?? 50) >= 80)
    .reduce((s, d) => s + d.value * ((d.probability ?? 50) / 100), 0);
  const dealsThisMonth = filteredDeals.filter(d => d.expectedCloseDate?.startsWith(monthKey(now.toISOString()))).length;

  // Monthly bars for next MONTHS_AHEAD months
  const months = useMemo(() => {
    const result: { key: string; label: string; weighted: number; bestCase: number }[] = [];
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const m = addMonths(startOfMonth(now), i);
      const key = format(m, "yyyy-MM");
      const label = format(m, "MMM/yy", { locale: ptBR });
      const inMonth = filteredDeals.filter(d => d.expectedCloseDate?.startsWith(key));
      result.push({
        key,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        weighted: inMonth.reduce((s, d) => s + d.value * ((d.probability ?? 50) / 100), 0),
        bestCase: inMonth.reduce((s, d) => s + d.value, 0),
      });
    }
    return result;
  }, [filteredDeals, now]);

  // Deal table sorted by expected close date
  const tableDeals = useMemo(() =>
    [...filteredDeals]
      .filter(d => d.expectedCloseDate)
      .sort((a, b) => (a.expectedCloseDate ?? "") < (b.expectedCloseDate ?? "") ? -1 : 1),
  [filteredDeals]);

  const noDateDeals = filteredDeals.filter(d => !d.expectedCloseDate);

  const getStage = (d: typeof filteredDeals[0]) => {
    const p = state.pipelines.find(p => p.id === d.pipelineId);
    return p?.stages.find(s => s.id === d.stageId)?.name ?? "—";
  };

  const getPipelineName = (id: string) => state.pipelines.find(p => p.id === id)?.name ?? "—";

  const probColor = (p: number) => {
    if (p >= 80) return "text-green-600 bg-green-50";
    if (p >= 50) return "text-amber-600 bg-amber-50";
    return "text-zinc-500 bg-zinc-100";
  };

  const isClosingSoon = (iso: string | undefined) => {
    if (!iso) return false;
    const d = parseISO(iso);
    return !isAfter(d, addMonths(now, 1)) && !isBefore(d, now);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="p-8 max-w-6xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Forecast de Receita</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Previsão baseada em valor × probabilidade dos negócios ativos</p>
          </div>

          {/* Pipeline filter */}
          <div className="relative">
            <button
              onClick={() => setShowPipelineMenu(v => !v)}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              {selectedPipeline === "all" ? "Todos os pipelines" : getPipelineName(selectedPipeline)}
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            </button>
            {showPipelineMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
                {[{ id: "all", name: "Todos os pipelines" }, ...state.pipelines].map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedPipeline(p.id); setShowPipelineMenu(false); }}
                    className={cn(
                      "w-full text-left px-4 py-2.5 text-sm transition-colors",
                      selectedPipeline === p.id ? "bg-amber-50 text-amber-700 font-medium" : "text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Pipeline Total", value: fmt(totalPipeline), sub: `${filteredDeals.length} negócios ativos`, icon: DollarSign, color: "text-zinc-600 bg-zinc-100" },
            { label: "Forecast Ponderado", value: fmt(weightedForecast), sub: "valor × probabilidade", icon: TrendingUp, color: "text-amber-600 bg-amber-100" },
            { label: "Comprometido (≥80%)", value: fmt(commits), sub: "alta confiança", icon: Star, color: "text-green-600 bg-green-100" },
            { label: "Fechando este mês", value: String(dealsThisMonth), sub: "negócios com prazo", icon: Zap, color: "text-blue-600 bg-blue-100" },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg mb-3", card.color)}>
                <card.icon className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold text-zinc-900">{card.value}</p>
              <p className="text-xs font-medium text-zinc-600 mt-0.5">{card.label}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Monthly Chart */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 mb-8">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">Previsão mensal</h2>
          <p className="text-xs text-zinc-400 mb-5">Próximos {MONTHS_AHEAD} meses — negócios com data prevista de fechamento</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={months} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={48}
              />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [fmt(v as number), name === "weighted" ? "Ponderado" : "Melhor caso"]}
                contentStyle={{ borderRadius: 10, border: "1px solid #e4e4e7", fontSize: 12 }}
              />
              <Bar dataKey="bestCase" name="bestCase" fill="#fde68a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="weighted" name="weighted" radius={[4, 4, 0, 0]}>
                {months.map((_, i) => <Cell key={i} fill={i === 0 ? "#f59e0b" : "#fb923c"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 justify-end">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="inline-block h-3 w-3 rounded-sm bg-amber-200" />Melhor caso</span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="inline-block h-3 w-3 rounded-sm bg-amber-500" />Ponderado</span>
          </div>
        </div>

        {/* Deal Table */}
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Negócios com data prevista</h2>
            <span className="text-xs text-zinc-400">{tableDeals.length} negócios</span>
          </div>
          {tableDeals.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-zinc-400">
              Nenhum negócio ativo com data prevista de fechamento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="px-6 py-3 font-semibold text-zinc-600">Negócio</th>
                    <th className="px-6 py-3 font-semibold text-zinc-600">Pipeline / Etapa</th>
                    <th className="px-6 py-3 font-semibold text-zinc-600 text-right">Valor</th>
                    <th className="px-6 py-3 font-semibold text-zinc-600 text-center">Probabilidade</th>
                    <th className="px-6 py-3 font-semibold text-zinc-600 text-right">Ponderado</th>
                    <th className="px-6 py-3 font-semibold text-zinc-600 text-center">Fechamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {tableDeals.map(d => {
                    const prob = d.probability ?? 50;
                    const weighted = d.value * (prob / 100);
                    const soon = isClosingSoon(d.expectedCloseDate);
                    return (
                      <tr key={d.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-3.5">
                          <a href={`/negocios/${d.id}`} className="font-medium text-zinc-900 hover:text-amber-600 transition-colors">
                            {d.title}
                          </a>
                        </td>
                        <td className="px-6 py-3.5 text-zinc-500">
                          {getPipelineName(d.pipelineId)} · {getStage(d)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-medium text-zinc-900">{fmt(d.value)}</td>
                        <td className="px-6 py-3.5 text-center">
                          <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-bold", probColor(prob))}>
                            {prob}%
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-amber-700">{fmt(weighted)}</td>
                        <td className="px-6 py-3.5 text-center">
                          <span className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                            soon ? "bg-orange-50 text-orange-600 border border-orange-200" : "text-zinc-500"
                          )}>
                            {d.expectedCloseDate
                              ? format(parseISO(d.expectedCloseDate), "dd/MM/yyyy")
                              : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-50 border-t border-zinc-200">
                    <td colSpan={2} className="px-6 py-3 text-xs font-semibold text-zinc-700">Total</td>
                    <td className="px-6 py-3 text-right text-xs font-bold text-zinc-900">{fmt(tableDeals.reduce((s, d) => s + d.value, 0))}</td>
                    <td />
                    <td className="px-6 py-3 text-right text-xs font-bold text-amber-700">
                      {fmt(tableDeals.reduce((s, d) => s + d.value * ((d.probability ?? 50) / 100), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Deals without date */}
          {noDateDeals.length > 0 && (
            <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50/50">
              <p className="text-xs text-zinc-400">
                <span className="font-medium text-zinc-600">{noDateDeals.length}</span> negócio(s) sem data prevista — não incluídos no forecast
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
