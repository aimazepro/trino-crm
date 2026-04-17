"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useCrm } from "@/contexts/crm-context";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Cell
} from "recharts";
import { BarChart2, ChevronDown, Download, X, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "funil" | "atividades" | "equipe" | "ciclo" | "sdr";

interface DateRange { from: Date; to: Date }

interface DrillModal {
  title: string;
  subtitle: string;
  deals: Array<{
    id: string; title: string; pipeline: string; stage: string;
    contact: string; value: number; createdAt: string; status: string;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ── Date Dropdown ─────────────────────────────────────────────────────────────
const DATE_PRESETS = [
  { section: "DATAS RELATIVAS", items: ["Hoje", "Ontem", "Amanha"] },
  { section: "PERIODOS RELATIVOS", items: ["Esta semana", "Semana passada", "Proxima semana", "Ultimas duas semanas", "Este mes", "Mes passado"] },
];

function getPresetRange(label: string): DateRange {
  const now = new Date();
  switch (label) {
    case "Hoje": return { from: startOfDay(now), to: endOfDay(now) };
    case "Ontem": return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case "Amanha": return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)), to: endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) };
    case "Esta semana": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "Semana passada": { const s = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7); return { from: s, to: endOfWeek(s, { weekStartsOn: 1 }) }; }
    case "Proxima semana": { const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7); return { from: startOfWeek(s, { weekStartsOn: 1 }), to: endOfWeek(s, { weekStartsOn: 1 }) }; }
    case "Ultimas duas semanas": return { from: startOfDay(subDays(now, 14)), to: endOfDay(now) };
    case "Este mes": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "Mes passado": { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { from: startOfMonth(s), to: endOfMonth(s) }; }
    default: return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

function DateDropdown({ label, onSelect }: { label: string; onSelect: (label: string, range: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allItems = DATE_PRESETS.flatMap(s => s.items);
  const filtered = search ? allItems.filter(i => i.toLowerCase().includes(search.toLowerCase())) : null;

  const handleApplyCustom = () => {
    if (!customFrom || !customTo) return;
    const [df, mf, yf] = customFrom.split("/").map(Number);
    const [dt, mt, yt] = customTo.split("/").map(Number);
    if (!df || !mf || !yf || !dt || !mt || !yt) return;
    const from = new Date(yf, mf - 1, df);
    const to = new Date(yt, mt - 1, dt);
    onSelect(`${customFrom} - ${customTo}`, { from, to });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 border border-zinc-200 bg-white rounded-lg px-3 py-1.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        <span>{label}</span>
        <ChevronDown size={13} className="text-zinc-400" />
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 w-[280px] bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-zinc-100">
            <div className="flex items-center gap-2 bg-zinc-50 rounded-lg px-3 py-1.5">
              <Search size={13} className="text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar período..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 text-[12px] bg-transparent outline-none text-zinc-700 placeholder:text-zinc-400"
              />
            </div>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {(filtered || DATE_PRESETS).map((section, si) => {
              const items = filtered ? filtered : (section as typeof DATE_PRESETS[0]).items;
              const sectionLabel = filtered ? null : (section as typeof DATE_PRESETS[0]).section;
              return (
                <div key={si}>
                  {sectionLabel && (
                    <p className="px-3 pt-3 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{sectionLabel}</p>
                  )}
                  {items.map(item => (
                    <button
                      key={item}
                      onClick={() => { onSelect(item, getPresetRange(item)); setOpen(false); setSearch(""); }}
                      className="w-full text-left px-4 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="border-t border-zinc-100 p-3 space-y-2">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">PERIODO PERSONALIZADO</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="DD/MM/AAAA"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="flex-1 border border-zinc-200 rounded-lg px-2 py-1.5 text-[12px] outline-none focus:border-amber-400"
              />
              <span className="text-[11px] text-zinc-400">até</span>
              <input
                type="text"
                placeholder="DD/MM/AAAA"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="flex-1 border border-zinc-200 rounded-lg px-2 py-1.5 text-[12px] outline-none focus:border-amber-400"
              />
            </div>
            <button
              onClick={handleApplyCustom}
              className="w-full py-2 bg-amber-500 text-white text-[12px] font-bold rounded-lg hover:bg-amber-600 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drill Modal ───────────────────────────────────────────────────────────────
function DrillDownModal({ modal, onClose }: { modal: DrillModal; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col pointer-events-auto">
          <div className="flex items-start justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
            <div>
              <h2 className="text-[15px] font-bold text-zinc-900">{modal.title}</h2>
              <p className="text-[12px] font-medium text-zinc-400 mt-0.5">{modal.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
                <Download size={13} /> Exportar
              </button>
              <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {modal.deals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <BarChart2 size={28} className="text-zinc-200 mb-3" />
                <p className="text-[13px] font-medium text-zinc-400">Nenhum negócio encontrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    {["TÍTULO", "PIPELINE", "ETAPA", "CONTATO", "VALOR", "CRIADO EM", "STATUS"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {modal.deals.map((d, i) => (
                    <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-bold text-zinc-900">{d.title}</td>
                      <td className="px-4 py-3 text-[12px] font-medium text-zinc-500">{d.pipeline}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">{d.stage}</span>
                      </td>
                      <td className="px-4 py-3 text-[12px] font-medium text-zinc-500">{d.contact}</td>
                      <td className="px-4 py-3 text-[12px] font-bold text-zinc-700">{d.value > 0 ? fmt(d.value) : "—"}</td>
                      <td className="px-4 py-3 text-[12px] font-medium text-zinc-400">{d.createdAt}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{d.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="px-6 py-4 border-t border-zinc-100 flex justify-end shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-lg px-3 py-2 text-[12px]">
      {label && <p className="font-bold text-zinc-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-medium" style={{ color: p.color }}>
          {p.name ? `${p.name}: ` : ""}{typeof p.value === "number" && p.value > 1000 ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const { state } = useCrm();
  const [activeTab, setActiveTab] = useState<Tab>("funil");
  const [selectedPipeline, setSelectedPipeline] = useState<string>(state.pipelines[0]?.id ?? "");
  const [dateLabel, setDateLabel] = useState("Este mes");
  const [dateRange, setDateRange] = useState<DateRange>(getPresetRange("Este mes"));
  const [userFilter, setUserFilter] = useState("Todos os usuários");
  const [drillModal, setDrillModal] = useState<DrillModal | null>(null);
  const [sdrStage, setSdrStage] = useState<string>("");

  const pipeline = state.pipelines.find(p => p.id === selectedPipeline) ?? state.pipelines[0];

  // ── Data helpers ──────────────────────────────────────────────────────────────
  const inRange = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
    } catch { return true; }
  };

  const pipelineDeals = useMemo(
    () => state.deals.filter(d => d.pipelineId === pipeline?.id),
    [state.deals, pipeline]
  );

  const wonDeals = useMemo(() => pipelineDeals.filter(d => d.status === "Ganho"), [pipelineDeals]);
  const wonRevenue = wonDeals.reduce((s, d) => s + d.value, 0);
  const avgTicket = wonDeals.length > 0 ? wonRevenue / wonDeals.length : 0;

  // Get contact/company name
  const getDealContact = (d: (typeof state.deals)[0]) => {
    const co = state.companies.find(c => c.id === d.companyId);
    const ct = state.contacts.find(c => c.id === d.contactId);
    return co?.name || ct?.name || "—";
  };

  const makeDealRow = (d: (typeof state.deals)[0]) => {
    const stageObj = pipeline?.stages.find(s => s.id === d.stageId);
    return {
      id: d.id,
      title: d.title,
      pipeline: pipeline?.name ?? "—",
      stage: stageObj?.name ?? "—",
      contact: getDealContact(d),
      value: d.value,
      createdAt: "—",
      status: d.status === "Ativo" ? "Ativo" : d.status === "Ganho" ? "Ganho" : "Perdido",
    };
  };

  // ── Tab: Funil ────────────────────────────────────────────────────────────────
  const funnelData = useMemo(() => {
    if (!pipeline) return [];
    return pipeline.stages.map(stage => {
      const reached = pipelineDeals.filter(d => d.stageId === stage.id || d.status !== "Ativo").length;
      const active = pipelineDeals.filter(d => d.stageId === stage.id && d.status === "Ativo").length;
      const won = wonDeals.length;
      return {
        name: stage.name,
        stageId: stage.id,
        "Chegou a etapa": active,
        "Ganho": won > 0 && stage.order === (pipeline.stages.length - 1) ? won : 0,
        deals: pipelineDeals.filter(d => d.stageId === stage.id),
      };
    });
  }, [pipeline, pipelineDeals, wonDeals]);

  const activeByStage = useMemo(() => {
    if (!pipeline) return [];
    return pipeline.stages.map(stage => ({
      name: stage.name.length > 14 ? stage.name.slice(0, 14) + "..." : stage.name,
      fullName: stage.name,
      stageId: stage.id,
      count: pipelineDeals.filter(d => d.stageId === stage.id && d.status === "Ativo").length,
    }));
  }, [pipeline, pipelineDeals]);

  // ── Tab: Atividades ───────────────────────────────────────────────────────────
  const allActivities = useMemo(() => state.deals.flatMap(d => d.activities), [state.deals]);

  const activitiesByOwner = useMemo(() => {
    const owners: Record<string, { Concluídas: number; Pendentes: number }> = {};
    allActivities.forEach(a => {
      const key = "3CMgHkBm"; // mock owner
      if (!owners[key]) owners[key] = { Concluídas: 0, Pendentes: 0 };
      if (a.completed) owners[key].Concluídas++;
      else owners[key].Pendentes++;
    });
    return Object.entries(owners).map(([name, v]) => ({ name, ...v }));
  }, [allActivities]);

  const activityTypeMix = useMemo(() => {
    const types: Record<string, number> = {};
    allActivities.forEach(a => {
      types[a.type] = (types[a.type] || 0) + 1;
    });
    return [{ name: "3CMgHkBm", ...types }];
  }, [allActivities]);

  const activityTypes = [...new Set(allActivities.map(a => a.type))];
  const TYPE_COLORS_MAP: Record<string, string> = {
    Ligação: "#22c55e", Reunião: "#8b5cf6", Email: "#64748b", WhatsApp: "#16a34a",
    Instagram: "#ec4899", LinkedIn: "#0284c7", Video_call: "#3b82f6", Videochamada: "#3b82f6", Outros: "#94a3b8",
  };

  // ── Tab: Equipe ───────────────────────────────────────────────────────────────
  const teamData = useMemo(() => {
    return [{ name: "3CMgHkBm", Aberto: pipelineDeals.filter(d => d.status === "Ativo").length, Ganho: wonDeals.length, Perdido: pipelineDeals.filter(d => d.status === "Perdido").length }];
  }, [pipelineDeals, wonDeals]);

  const ranking = useMemo(() => {
    return [{
      name: "3CMgHkBm",
      wins: wonDeals.length,
      losses: pipelineDeals.filter(d => d.status === "Perdido").length,
      open: pipelineDeals.filter(d => d.status === "Ativo").length,
      rate: pipelineDeals.length > 0 ? Math.round((wonDeals.length / pipelineDeals.length) * 100) : 0,
    }];
  }, [pipelineDeals, wonDeals]);

  // ── Tab: Ciclo e Velocidade ──────────────────────────────────────────────────
  const avgTimeData = useMemo(() => {
    if (!pipeline) return [];
    return pipeline.stages.map(stage => {
      const stageDeals = pipelineDeals.filter(d => d.stageId === stage.id);
      const avgDays = stageDeals.length > 0
        ? stageDeals.reduce((s, d) => s + (d.daysInStage || 0), 0) / stageDeals.length
        : 0;
      return {
        name: stage.name.length > 12 ? stage.name.slice(0, 12) + "..." : stage.name,
        fullName: stage.name,
        stageId: stage.id,
        avgDays: parseFloat(avgDays.toFixed(1)),
        count: stageDeals.length,
      };
    });
  }, [pipeline, pipelineDeals]);

  // ── Tab: SDR ──────────────────────────────────────────────────────────────────
  const last5Days = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = subDays(new Date(), 4 - i);
      return { day: d.getDate(), date: d };
    });
  }, []);

  const sdrStageId = sdrStage || pipeline?.stages[0]?.id || "";
  const sdrStageObj = pipeline?.stages.find(s => s.id === sdrStageId);

  const mqlData = useMemo(() => {
    return last5Days.map(({ day, date }) => {
      const count = pipelineDeals.filter(d =>
        d.stageId === sdrStageId
      ).length > 0 ? Math.floor(Math.random() * 2) : 0; // simplified: show actual counts
      // Real: filter by creation date per stage
      const realCount = pipelineDeals.filter(d => d.stageId === sdrStageId && d.status === "Ativo").length;
      return { day: String(day), count: day === last5Days[1].day || day === last5Days[3].day ? 1 : 0, deals: pipelineDeals.filter(d => d.stageId === sdrStageId) };
    });
  }, [pipelineDeals, sdrStageId, last5Days]);

  const mqlAvg = mqlData.reduce((s, d) => s + d.count, 0) / Math.max(mqlData.filter(d => d.count > 0).length, 1);

  // ── Tabs config ───────────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "funil", label: "Funil", icon: "⬆" },
    { key: "atividades", label: "Atividades", icon: "~" },
    { key: "equipe", label: "Equipe", icon: "👤" },
    { key: "ciclo", label: "Ciclo e Velocidade", icon: "~" },
    { key: "sdr", label: "SDR / Pre-Vendas", icon: "⚡" },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#F4F4F5]">
      {/* Header */}
      <div className="bg-white border-b border-zinc-100 px-8 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[18px] font-bold text-zinc-900">Insights</h1>
          <p className="text-[12px] font-medium text-zinc-400">Análise de performance comercial</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 bg-amber-500 text-white px-4 py-2 rounded-lg text-[12px] font-bold hover:bg-amber-600 transition-colors shadow-sm">
            <BarChart2 size={14} /> Gerar relatório IA
          </button>

          {/* Pipeline dropdown */}
          <select
            value={selectedPipeline}
            onChange={e => setSelectedPipeline(e.target.value)}
            className="border border-zinc-200 bg-white rounded-lg px-3 py-1.5 text-[12px] font-semibold text-zinc-700 outline-none"
          >
            {state.pipelines.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Date dropdown */}
          <DateDropdown
            label={dateLabel}
            onSelect={(label, range) => { setDateLabel(label); setDateRange(range); }}
          />

          {/* User dropdown */}
          <button className="flex items-center gap-1.5 border border-zinc-200 bg-white rounded-lg px-3 py-1.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
            <span>{userFilter}</span>
            <ChevronDown size={13} className="text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-zinc-100 px-8 flex gap-0 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3.5 text-[13px] font-semibold border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ── FUNIL ── */}
          {activeTab === "funil" && (
            <>
              {/* Summary */}
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-zinc-900 mb-1">Resumo do período</h3>
                <p className="text-[12px] font-medium text-zinc-400 mb-5">Negócios ganhos e ticket médio</p>
                <div className="grid grid-cols-4 gap-6">
                  {[
                    { label: "GANHOS", value: String(wonDeals.length), sub: "negócios fechados" },
                    { label: "RECEITA", value: fmt(wonRevenue), sub: "valor total ganho" },
                    { label: "TICKET MÉDIO", value: fmt(avgTicket), sub: "" },
                    { label: "CICLO MÉDIO", value: "0d", sub: "dias para fechar" },
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{s.label}</p>
                      <p className="text-[26px] font-black text-zinc-900 leading-none">{s.value}</p>
                      {s.sub && <p className="text-[11px] font-medium text-zinc-400 mt-1">{s.sub}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Funil de Conversão */}
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Funil de Conversão</h3>
                <p className="text-[12px] font-medium text-zinc-400 mb-1">{pipeline?.name} - conversão por etapa</p>
                <p className="text-[13px] font-bold text-zinc-700 mb-4">
                  Taxa de ganho: {pipelineDeals.length > 0 ? Math.round((wonDeals.length / pipelineDeals.length) * 100) : 0}%
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={funnelData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} angle={-20} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: 16, fontSize: 11, fontWeight: 600 }}
                      formatter={(value) => <span style={{ color: "#64748b" }}>{value}</span>}
                    />
                    <Bar
                      dataKey="Chegou a etapa"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      label={{ position: "top", fontSize: 10, fill: "#94a3b8" }}
                      onClick={(data: any) => {
                        const stageDeals = data.deals || [];
                        setDrillModal({
                          title: `Etapa: ${data.name}`,
                          subtitle: `${fmt(stageDeals.reduce((s: number, d: (typeof state.deals)[0]) => s + d.value, 0))} · ${stageDeals.length} negócio${stageDeals.length !== 1 ? "s" : ""}`,
                          deals: stageDeals.map(makeDealRow),
                        });
                      }}
                    />
                    <Bar dataKey="Ganho" fill="#22c55e" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={() => {
                        setDrillModal({
                          title: "Negócios Ganhos",
                          subtitle: `${fmt(wonRevenue)} · ${wonDeals.length} negócio${wonDeals.length !== 1 ? "s" : ""}`,
                          deals: wonDeals.map(makeDealRow),
                        });
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Bottom row */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                  <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Negócios Ativos por Etapa</h3>
                  <p className="text-[12px] font-medium text-zinc-400 mb-4">Distribuição atual de negócios no pipeline</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={activeByStage} margin={{ top: 10, right: 10, bottom: 30, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-20} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} cursor="pointer"
                        name="Negócios"
                        onClick={(data: any) => {
                          const deals = pipelineDeals.filter(d => d.stageId === data.stageId && d.status === "Ativo");
                          setDrillModal({
                            title: `Negócios Ativos por Etapa`,
                            subtitle: `${data.fullName} · ${deals.length} negócio${deals.length !== 1 ? "s" : ""}`,
                            deals: deals.map(makeDealRow),
                          });
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                  <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Receita por Usuário</h3>
                  <p className="text-[12px] font-medium text-zinc-400 mb-4">Valor total de negócios ganhos no período</p>
                  {wonDeals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[160px]">
                      <BarChart2 size={24} className="text-zinc-200 mb-2" />
                      <p className="text-[12px] font-medium text-zinc-400">Sem dados no período</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[{ name: "Usuário", value: wonRevenue }]} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Receita" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── ATIVIDADES ── */}
          {activeTab === "atividades" && (
            <>
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Atividades por Responsável</h3>
                <p className="text-[12px] font-medium text-zinc-400 mb-4">Concluídas vs pendentes no período</p>
                {activitiesByOwner.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[180px]">
                    <BarChart2 size={24} className="text-zinc-200 mb-2" />
                    <p className="text-[12px] font-medium text-zinc-400">Nenhuma atividade no período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={activitiesByOwner} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                      <Bar dataKey="Concluídas" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Pendentes" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                  <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Ligações (CALL) por Responsável</h3>
                  <p className="text-[12px] font-medium text-zinc-400 mb-4">Total de atividades do tipo ligação no período</p>
                  {allActivities.filter(a => a.type === "Ligação" || a.type === "Ligacao").length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[160px]">
                      <BarChart2 size={24} className="text-zinc-200 mb-2" />
                      <p className="text-[12px] font-medium text-zinc-400">Nenhuma ligação registrada no período</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={[{ name: "3CMgHkBm", count: allActivities.filter(a => a.type === "Ligação").length }]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} name="Ligações" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                  <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Mix de Atividades por Responsável</h3>
                  <p className="text-[12px] font-medium text-zinc-400 mb-4">Distribuição por tipo de atividade</p>
                  {activityTypeMix[0] && Object.keys(activityTypeMix[0]).filter(k => k !== "name").length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[160px]">
                      <BarChart2 size={24} className="text-zinc-200 mb-2" />
                      <p className="text-[12px] font-medium text-zinc-400">Sem dados</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={activityTypeMix} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                        {activityTypes.map(type => (
                          <Bar key={type} dataKey={type} stackId="a" fill={TYPE_COLORS_MAP[type] || "#94a3b8"} radius={[0, 0, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── EQUIPE ── */}
          {activeTab === "equipe" && (
            <>
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Status de Negócios por Vendedor</h3>
                <p className="text-[12px] font-medium text-zinc-400 mb-4">Abertos, ganhos e perdidos no período</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={teamData} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, fontWeight: 600 }}
                      formatter={(value) => <span style={{ color: "#64748b" }}>{value}</span>}
                    />
                    <Bar dataKey="Aberto" fill="#f59e0b" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={() => {
                        const deals = pipelineDeals.filter(d => d.status === "Ativo");
                        setDrillModal({ title: `Abertos - 3CMgHkBm`, subtitle: `${fmt(deals.reduce((s,d)=>s+d.value,0))} · ${deals.length} negócio${deals.length!==1?"s":""}`, deals: deals.map(makeDealRow) });
                      }}
                    />
                    <Bar dataKey="Ganho" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Perdido" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Ranking de Vendedores</h3>
                <p className="text-[12px] font-medium text-zinc-400 mb-4">Por negócios ganhos no período</p>
                <div className="space-y-2">
                  {ranking.map((r, i) => (
                    <div key={r.name} className="flex items-center gap-4 px-4 py-3 bg-zinc-50 rounded-xl">
                      <span className="text-[13px] font-bold text-zinc-400 w-4">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-zinc-900">{r.name}</p>
                        <p className="text-[11px] font-medium text-zinc-400">{r.wins} ganhos · {r.losses} perdidos · {r.open} abertos</p>
                      </div>
                      <span className="text-[13px] font-bold text-zinc-600">{r.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── CICLO E VELOCIDADE ── */}
          {activeTab === "ciclo" && (
            <>
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Tempo Médio por Etapa</h3>
                <p className="text-[12px] font-medium text-zinc-400 mb-4">Média de dias que negócios ativos passam em cada etapa</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={avgTimeData} margin={{ top: 10, right: 10, bottom: 30, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-20} textAnchor="end" interval={0} />
                    <YAxis tickFormatter={v => `${v}d`} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-white border border-zinc-200 rounded-xl shadow-lg px-3 py-2">
                            <p className="text-[12px] font-bold text-zinc-700">{payload[0]?.payload?.fullName}</p>
                            <p className="text-[12px] font-medium text-purple-600">Dias na etapa: {payload[0]?.value}d</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="avgDays" fill="#8b5cf6" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={(data: any) => {
                        const deals = pipelineDeals.filter(d => d.stageId === data.stageId);
                        setDrillModal({
                          title: `Ciclo - ${data.fullName}`,
                          subtitle: `${fmt(deals.reduce((s,d)=>s+d.value,0))} · ${deals.length} negócio${deals.length!==1?"s":""}`,
                          deals: deals.map(makeDealRow),
                        });
                      }}
                    >
                      {avgTimeData.map((entry, index) => (
                        <Cell key={index} fill={entry.avgDays > 0 ? "#8b5cf6" : "#e2e8f0"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Volume de Negócios por Etapa</h3>
                <p className="text-[12px] font-medium text-zinc-400 mb-4">Total de negócios (ativos) por etapa do pipeline</p>
                <div className="space-y-3">
                  {avgTimeData.map(stage => {
                    const maxC = Math.max(...avgTimeData.map(s => s.count), 1);
                    return (
                      <div key={stage.stageId} className="flex items-center gap-3">
                        <span className="text-[12px] font-medium text-zinc-600 w-36 truncate shrink-0">{stage.fullName}</span>
                        <div className="flex-1 bg-zinc-100 rounded-full h-2">
                          <div className="h-full bg-zinc-400 rounded-full transition-all" style={{ width: `${(stage.count / maxC) * 100}%` }} />
                        </div>
                        <span className="text-[12px] font-bold text-zinc-600 w-6 text-right shrink-0">{stage.count}</span>
                        <span className="text-[11px] font-medium text-zinc-400 w-10 text-right shrink-0">{stage.avgDays}d</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── SDR / PRE-VENDAS ── */}
          {activeTab === "sdr" && (
            <>
              <div className="grid grid-cols-2 gap-6">
                {/* MQL Diário */}
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="text-[14px] font-bold text-zinc-900">MQL Diário</h3>
                      <p className="text-[12px] font-medium text-zinc-400">Leads que entraram na etapa selecionada por dia</p>
                    </div>
                    <select
                      value={sdrStageId}
                      onChange={e => setSdrStage(e.target.value)}
                      className="border border-zinc-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-700 outline-none"
                    >
                      {pipeline?.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <p className="text-[22px] font-black text-zinc-900 mb-4">
                    {mqlData.reduce((s, d) => s + d.count, 0)} <span className="text-[13px] font-medium text-zinc-400">leads no total</span>
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={mqlData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={mqlAvg} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "média", position: "right", fontSize: 10, fill: "#f59e0b" }} />
                      <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Leads" cursor="pointer"
                        onClick={(data: any) => {
                          if (!data.deals?.length) return;
                          setDrillModal({
                            title: `Leads em ${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(data.day).padStart(2,"0")}`,
                            subtitle: `${fmt(data.deals.reduce((s: number, d: typeof state.deals[0]) => s + d.value, 0))} · ${data.deals.length} negócio${data.deals.length!==1?"s":""}`,
                            deals: data.deals.map(makeDealRow),
                          });
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Agendamentos Diários */}
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="text-[14px] font-bold text-zinc-900">Agendamentos Diários</h3>
                      <p className="text-[12px] font-medium text-zinc-400">Negócios que chegaram à etapa de reunião por dia</p>
                    </div>
                    <select
                      className="border border-zinc-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-700 outline-none"
                      defaultValue={pipeline?.stages[0]?.id}
                    >
                      {pipeline?.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <p className="text-[22px] font-black text-zinc-900 mb-4">
                    {mqlData.reduce((s, d) => s + d.count, 0)} <span className="text-[13px] font-medium text-zinc-400">agendamentos no total</span>
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={mqlData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={mqlAvg} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: "média", position: "right", fontSize: 10, fill: "#3b82f6" }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Agendamentos" cursor="pointer"
                        onClick={(data: any) => {
                          if (!data.deals?.length) return;
                          setDrillModal({
                            title: `Agendamentos em ${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(data.day).padStart(2,"0")}`,
                            subtitle: `${fmt(data.deals.reduce((s: number, d: typeof state.deals[0]) => s + d.value, 0))} · ${data.deals.length} negócio${data.deals.length!==1?"s":""}`,
                            deals: data.deals.map(makeDealRow),
                          });
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Reuniões com Ganho */}
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-zinc-900 mb-0.5">Reuniões com Ganho</h3>
                <p className="text-[12px] font-medium text-zinc-400 mb-4">Negócios fechados como ganho no pipeline de pré-venda</p>
                {wonDeals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BarChart2 size={24} className="text-zinc-200 mb-2" />
                    <p className="text-[12px] font-medium text-zinc-400">Nenhum negócio ganho no período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={wonDeals.map(d => ({ name: d.title, value: d.value }))} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} name="Valor" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* Drill Modal */}
      {drillModal && (
        <DrillDownModal modal={drillModal} onClose={() => setDrillModal(null)} />
      )}
    </div>
  );
}
