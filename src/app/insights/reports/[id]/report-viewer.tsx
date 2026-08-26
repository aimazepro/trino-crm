"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Palette, Download, Trash2, BarChart2, Layers, GitBranchPlus, ChartPie, Table2, Hash, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { useInsights } from "../../insights-context";
import { getReportType } from "../../report-types/registry";
import { applyPeriodFilter, applyCustomFilters, FILTER_FIELDS_BY_ENTITY } from "../../report-types/filters";
import { COLORS, type SavedReport, type ReportFilter } from "../../insights-constants";
import { ReportChart } from "../../report-chart";

const CHART_TYPE_BUTTONS = [
  { key: "bar" as const, label: "Barras", Icon: BarChart2 },
  { key: "stacked" as const, label: "Barras empilhadas", Icon: Layers },
  { key: "funnel" as const, label: "Funil de conversao", Icon: GitBranchPlus },
  { key: "pie" as const, label: "Pizza", Icon: ChartPie },
  { key: "table" as const, label: "Tabela", Icon: Table2 },
  { key: "number" as const, label: "Numero", Icon: Hash },
];

const GROUP_BY_OPTIONS = [
  { value: "none", label: "Sem agrupamento" },
  { value: "etapa", label: "Etapa" },
  { value: "responsavel", label: "Responsável" },
  { value: "status", label: "Status" },
  { value: "created_at", label: "Negócio criado em" },
  { value: "closed_at", label: "Negócio fechado em" },
];

export function ReportViewer({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { state } = useCrm();
  const { map: ownerNameMap, names: ownerNames } = useOwnerNameMap();
  const { patchReport, setSavedReports } = useInsights();
  const [report, setReport] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("saved_reports").select("id, name, config").eq("id", reportId).maybeSingle().then(({ data, error }) => {
      setLoading(false);
      if (error || !data) { setNotFound(true); return; }
      const config = (data.config ?? {}) as Partial<SavedReport>;
      setReport({
        id: data.id, name: data.name,
        entity: config.entity || "deal", reportType: config.reportType || "em_branco",
        chartType: config.chartType || "bar", color: config.color || "#ec4899",
        pipeline: config.pipeline || "", period: config.period || "Este mes",
        periodField: config.periodField || "created_at", filters: config.filters || [],
        measureBy: config.measureBy, groupBy: config.groupBy,
        groupByGranularity: config.groupByGranularity, excludeStage: config.excludeStage,
      });
    });
  }, [reportId]);

  const persist = useCallback((next: SavedReport) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      createClient().from("saved_reports").update({
        name: next.name,
        config: {
          entity: next.entity, reportType: next.reportType, chartType: next.chartType, color: next.color,
          pipeline: next.pipeline, period: next.period, periodField: next.periodField, filters: next.filters,
          measureBy: next.measureBy, groupBy: next.groupBy, groupByGranularity: next.groupByGranularity,
          excludeStage: next.excludeStage,
        } as unknown as Json,
      }).eq("id", next.id).then(({ error }) => {
        if (error) console.error("[insights] falha ao salvar relatório:", error);
      });
    }, 500);
  }, []);

  const update = useCallback((patch: Partial<SavedReport>) => {
    setReport((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      persist(next);
      patchReport(next.id, patch);   // sidebar reflete rename/cor na hora
      return next;
    });
  }, [persist, patchReport]);

  const pipeline = useMemo(() => {
    if (!report?.pipeline) return null;
    return state.pipelines.find((p) => p.name === report.pipeline) ?? null;
  }, [report?.pipeline, state.pipelines]);

  const stageNameById = useMemo(() => {
    const map: Record<string, string> = {};
    state.pipelines.forEach((p) => p.stages.forEach((s) => (map[s.id] = s.name)));
    return map;
  }, [state.pipelines]);

  const pipelineNameById = useMemo(() => {
    const map: Record<string, string> = {};
    state.pipelines.forEach((p) => (map[p.id] = p.name));
    return map;
  }, [state.pipelines]);

  const filteredDeals = useMemo(() => {
    if (!report) return [];
    let deals = report.pipeline ? state.deals.filter((d) => pipelineNameById[d.pipelineId] === report.pipeline) : state.deals;
    deals = applyPeriodFilter(deals, report.periodField, report.period);
    deals = applyCustomFilters(deals, report.filters, stageNameById, pipelineNameById, ownerNameMap);
    return deals;
  }, [report, state.deals, pipelineNameById, stageNameById, ownerNameMap]);

  const result = useMemo(() => {
    if (!report) return null;
    const def = getReportType(report.entity, report.reportType);
    if (!def) return null;
    return def.compute({ deals: filteredDeals, pipeline, pipelines: state.pipelines, ownerNameMap, config: report });
  }, [report, filteredDeals, pipeline, state.pipelines, ownerNameMap]);

  const handleDelete = async () => {
    setSavedReports((prev) => prev.filter((r) => r.id !== reportId));
    const { error } = await createClient().from("saved_reports").delete().eq("id", reportId);
    if (error) console.error("[insights] falha ao excluir relatório:", error);
    router.push("/insights");
  };

  const handleExportCSV = () => {
    if (!result) return;
    const headers = ["Titulo", "Valor", "Etapa", "Funil", "Responsavel", "Criado em", "Status"];
    const rows = result.records.map((r) => [r.title, `R$ ${r.value}`, r.stageName, r.pipelineName, r.ownerName, new Date(r.createdAt).toLocaleString("pt-BR"), r.status]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `${(report?.name ?? "relatorio").replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fieldOptions = report ? FILTER_FIELDS_BY_ENTITY[report.entity === "activity" ? "activity" : "deal"] : [];

  if (loading) return <div className="p-6 text-sm text-zinc-400">Carregando...</div>;
  if (notFound || !report) return <div className="p-6 text-sm text-zinc-400">Relatório não encontrado.</div>;

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 flex flex-col">
      <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/insights")} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <input
            value={report.name}
            onChange={(e) => update({ name: e.target.value })}
            className="text-lg font-semibold text-zinc-900 rounded px-1 -mx-1 border border-transparent hover:border-zinc-200 focus:border-emerald-500 outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {CHART_TYPE_BUTTONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                title={label}
                onClick={() => update({ chartType: key })}
                className={cn("p-2 rounded-lg transition-colors", report.chartType === key ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100")}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <ColorPicker color={report.color} onChange={(c) => update({ color: c })} />
          <button onClick={handleExportCSV} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button onClick={handleDelete} className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 border border-zinc-200">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4 flex-1 overflow-auto">
        <FiltersPanel report={report} fieldOptions={fieldOptions} ownerNames={ownerNames} pipelines={state.pipelines} onUpdate={update} />

        <div className="rounded-xl border border-zinc-200 bg-white p-6 overflow-hidden">
          <div className="mb-4 flex items-center justify-end gap-2 flex-wrap">
            {report.entity === "deal" && (
              <>
                <span className="text-sm text-zinc-500">Medir por</span>
                <select value={report.measureBy ?? "count"} onChange={(e) => update({ measureBy: e.target.value as "count" | "value" })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
                  <option value="count">Quantidade</option>
                  <option value="value">Valor (R$)</option>
                </select>
              </>
            )}
            <span className="text-sm text-zinc-500 ml-2">Ver por</span>
            <select value={report.groupBy ?? "none"} onChange={(e) => update({ groupBy: e.target.value })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
              {GROUP_BY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {(report.groupBy === "created_at" || report.groupBy === "closed_at") && (
              <select value={report.groupByGranularity ?? "month"} onChange={(e) => update({ groupByGranularity: e.target.value as "day" | "week" | "month" })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
                <option value="day">Por dia</option>
                <option value="week">Por semana</option>
                <option value="month">Por mês</option>
              </select>
            )}
            {report.reportType === "funil_conversao" && pipeline && (
              <>
                <span className="text-sm text-zinc-500 ml-2">Excluir etapa</span>
                <select value={report.excludeStage ?? ""} onChange={(e) => update({ excludeStage: e.target.value || undefined })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
                  <option value="">Nenhuma</option>
                  {pipeline.stages.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </>
            )}
          </div>
          {report.reportType === "funil_conversao" && !pipeline && (
            <div className="mb-3 text-right text-xs text-amber-600 font-medium">Selecione um filtro de Funil pra ver o funil de conversão.</div>
          )}
          {result?.extraMetric && (
            <div className="font-bold text-zinc-800 mb-2 text-sm">{result.extraMetric.label}: {result.extraMetric.value}</div>
          )}
          <ReportChart chartType={report.chartType} data={result?.chartData ?? []} color={report.color} />
        </div>

        <RecordsTable records={result?.records ?? []} onExport={handleExportCSV} />
      </div>
    </div>
  );
}

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
        <div className="h-4 w-4 rounded-full border border-zinc-200" style={{ backgroundColor: color }} />
        <Palette className="h-3.5 w-3.5 text-zinc-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 p-2 rounded-lg border border-zinc-200 bg-white shadow-lg z-50 grid grid-cols-4 gap-1.5 w-36">
          {COLORS.map((c) => (
            <button key={c.value} onClick={() => { onChange(c.value); setOpen(false); }} className={cn("h-6 w-6 rounded-full border", color === c.value ? "border-zinc-900 scale-105" : "border-zinc-200")} style={{ backgroundColor: c.value }} title={c.name} />
          ))}
        </div>
      )}
    </div>
  );
}

function FiltersPanel({ report, fieldOptions, ownerNames, pipelines, onUpdate }: {
  report: SavedReport;
  fieldOptions: { value: string; label: string; type: string }[];
  ownerNames: string[];
  pipelines: { name: string }[];
  onUpdate: (patch: Partial<SavedReport>) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [field, setField] = useState(fieldOptions[0]?.value ?? "Status");
  const [operator, setOperator] = useState("é");
  const [value, setValue] = useState("");

  const addFilter = () => {
    const next: ReportFilter = { field, operator, value };
    onUpdate({ filters: [...report.filters, next] });
    setShowAdd(false);
    setValue("");
  };

  const removeFilter = (idx: number) => {
    onUpdate({ filters: report.filters.filter((_, i) => i !== idx) });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">{report.entity === "activity" ? "ATIVIDADE" : "NEGOCIO"}</span>
        <select value={report.periodField} onChange={(e) => onUpdate({ periodField: e.target.value as "created_at" | "closed_at" })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
          <option value="created_at">{report.entity === "activity" ? "Data de criacao" : "Negocio criado em"}</option>
          {report.entity === "deal" && <option value="closed_at">Negocio fechado em</option>}
        </select>
        <span className="text-sm text-zinc-400">e</span>
        <select value={report.period} onChange={(e) => onUpdate({ period: e.target.value })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
          {["Este mes", "Mes passado", "Este ano", "Ultimos 7 dias", "Ultimos 30 dias", "Todo o periodo"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {report.filters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {report.filters.map((f, idx) => (
            <div key={idx} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-700">
              <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-500">{report.entity === "activity" ? "ATIVIDADES" : "NEGOCIOS"}</span>
              <span className="font-semibold">{f.field}</span>
              <span className="text-zinc-400">{f.operator}</span>
              {f.value && <span className="font-semibold">{f.value}</span>}
              <button onClick={() => removeFilter(idx)} className="p-0.5 rounded hover:bg-zinc-200 text-zinc-400"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowAdd((v) => !v)} className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
        <Plus className="h-4 w-4" /> Adicionar filtro
      </button>
      {showAdd && (
        <div className="p-3 border border-zinc-200 rounded-lg bg-zinc-50 space-y-3 max-w-sm">
          <div className="grid grid-cols-3 gap-2">
            <select value={field} onChange={(e) => setField(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5">
              {fieldOptions.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select value={operator} onChange={(e) => setOperator(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5">
              {fieldOptions.find((f) => f.value === field)?.type === "date" ? (
                <>
                  <option value="está vazio">está vazio</option>
                  <option value="não está vazio">não está vazio</option>
                </>
              ) : fieldOptions.find((f) => f.value === field)?.type === "number" ? (
                <>
                  <option value="maior que">maior que</option>
                  <option value="menor que">menor que</option>
                  <option value="igual a">igual a</option>
                </>
              ) : (
                <option value="é">é</option>
              )}
            </select>
            {fieldOptions.find((f) => f.value === field)?.type === "date" ? (
              <div />
            ) : field === "Status" ? (
              <select value={value} onChange={(e) => setValue(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5">
                <option value="Ativo">Ativo</option><option value="Ganho">Ganho</option><option value="Perdido">Perdido</option>
              </select>
            ) : field === "Funil" ? (
              <select value={value} onChange={(e) => setValue(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5">
                {pipelines.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            ) : field === "Responsavel" ? (
              <select value={value} onChange={(e) => setValue(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5">
                {ownerNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : (
              <input value={value} onChange={(e) => setValue(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5" />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-2 py-1 text-xs border border-zinc-200 rounded text-zinc-500">Cancelar</button>
            <button onClick={addFilter} className="px-2 py-1 text-xs bg-emerald-600 rounded text-white">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordsTable({ records, onExport }: { records: { id: string; title: string; value: number; stageName: string; pipelineName: string; ownerName: string; createdAt: string; status: string }[]; onExport: () => void }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Registros</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{records.length} registros</p>
        </div>
        <button onClick={onExport} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
          <Download className="h-3.5 w-3.5" /> Exportar
        </button>
      </div>
      <div className="overflow-auto max-h-[600px]">
        {records.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-zinc-400">Nenhum registro encontrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                {["Titulo", "Valor", "Etapa", "Funil", "Responsavel", "Criado em", "Status"].map((h) => (
                  <th key={h} className="text-left py-2.5 px-4 font-semibold text-zinc-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} onClick={() => { window.location.href = `/negocios/${r.id}`; }} className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer">
                  <td className="py-2.5 px-4 truncate max-w-[200px]">{r.title}</td>
                  <td className="py-2.5 px-4">R$&nbsp;{r.value.toLocaleString("pt-BR")}</td>
                  <td className="py-2.5 px-4">{r.stageName}</td>
                  <td className="py-2.5 px-4">{r.pipelineName}</td>
                  <td className="py-2.5 px-4">{r.ownerName}</td>
                  <td className="py-2.5 px-4">{new Date(r.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="py-2.5 px-4">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
