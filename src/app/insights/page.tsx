"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useCrm } from "@/contexts/crm-context";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import {
  Plus, ChevronDown, Search, PanelTop, LayoutDashboard,
  Trash2, FileText, Sparkles, Pencil, Maximize2,
  GripVertical, Settings, BarChart2, X, Check, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SavedReport {
  id: string;
  name: string;
}

// ── Default Reports list ──────────────────────────────────────────────────────
const DEFAULT_REPORTS: SavedReport[] = [
  { id: "rep_1", name: "Ganhos vs Perdidos" },
  { id: "rep_2", name: "Receita Mensal" },
  { id: "rep_3", name: "Negocios Criados" },
  { id: "rep_4", name: "Receita por Responsavel" },
  { id: "rep_5", name: "Negocios por Responsavel" },
  { id: "rep_6", name: "Mix de Atividades" },
  { id: "rep_7", name: "Atividades por Responsavel" },
  { id: "rep_8", name: "Negocios Aberto..." },
  { id: "rep_9", name: "Funil de Conversao" },
  { id: "rep_10", name: "Leads Ganhos" },
  { id: "rep_11", name: "Reunioes Agendadas" },
  { id: "rep_12", name: "Novos Leads no Funil" },
  { id: "rep_13", name: "Leads Qualificados" },
  { id: "rep_14", name: "Leads em Formulario" }
];

export default function InsightsPage() {
  const { state } = useCrm();

  // ── States ──────────────────────────────────────────────────────────────────
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [dashboardPopulated, setDashboardPopulated] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingReportName, setEditingReportName] = useState("");

  const [dateLabel, setDateLabel] = useState("Este mes");
  const [userFilter, setUserFilter] = useState("Todos os usuarios");

  const createDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount in a safe, non-synchronous way
  useEffect(() => {
    const storedReports = localStorage.getItem("insights_saved_reports");
    const storedPopulated = localStorage.getItem("insights_dashboard_populated");
    const storedActiveReport = localStorage.getItem("insights_active_report_id");

    const timer = setTimeout(() => {
      if (storedReports) {
        setSavedReports(JSON.parse(storedReports));
      }
      if (storedPopulated === "true") {
        setDashboardPopulated(true);
      }
      if (storedActiveReport) {
        setActiveReportId(storedActiveReport === "null" ? null : storedActiveReport);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Handle click outside create dropdown and filter dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setShowCreateDropdown(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setShowDateDropdown(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Seeding default reports ──────────────────────────────────────────────────
  const handleCreateDefaultReports = () => {
    setSavedReports(DEFAULT_REPORTS);
    setDashboardPopulated(true);
    setActiveReportId(null); // Go to Meu Painel
    localStorage.setItem("insights_saved_reports", JSON.stringify(DEFAULT_REPORTS));
    localStorage.setItem("insights_dashboard_populated", "true");
    localStorage.setItem("insights_active_report_id", "null");
  };

  const handleCreateReportZero = () => {
    const newId = `rep_${Date.now()}`;
    const newReport: SavedReport = { id: newId, name: `Novo Relatório ${savedReports.length + 1}` };
    const updated = [newReport, ...savedReports];
    setSavedReports(updated);
    setActiveReportId(newId);
    setDashboardPopulated(true);
    localStorage.setItem("insights_saved_reports", JSON.stringify(updated));
    localStorage.setItem("insights_dashboard_populated", "true");
    localStorage.setItem("insights_active_report_id", newId);
    setShowCreateDropdown(false);
  };

  const handleCreateDashboard = () => {
    setDashboardPopulated(true);
    setActiveReportId(null);
    localStorage.setItem("insights_dashboard_populated", "true");
    localStorage.setItem("insights_active_report_id", "null");
    setShowCreateDropdown(false);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleDeleteReport = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = savedReports.filter(r => r.id !== id);
    setSavedReports(updated);
    if (activeReportId === id) {
      setActiveReportId(null);
      localStorage.setItem("insights_active_report_id", "null");
    }
    localStorage.setItem("insights_saved_reports", JSON.stringify(updated));
  };

  const handleDeleteDashboard = () => {
    setDashboardPopulated(false);
    setActiveReportId(null);
    localStorage.setItem("insights_dashboard_populated", "false");
    localStorage.setItem("insights_active_report_id", "null");
  };

  const handleStartRename = (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingReportId(id);
    setEditingReportName(name);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingReportName.trim()) return;
    const updated = savedReports.map(r => r.id === id ? { ...r, name: editingReportName } : r);
    setSavedReports(updated);
    setEditingReportId(null);
    localStorage.setItem("insights_saved_reports", JSON.stringify(updated));
  };

  const handleSelectReport = (id: string | null) => {
    setActiveReportId(id);
    localStorage.setItem("insights_active_report_id", id === null ? "null" : id);
  };

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filteredReports = useMemo(() => {
    if (!searchQuery) return savedReports;
    return savedReports.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [savedReports, searchQuery]);

  // ── CRM Data Calculations ───────────────────────────────────────────────────
  const prospeccaoPipeline = useMemo(() => {
    return state.pipelines.find(p => p.name.toLowerCase().includes("prospec")) || state.pipelines[0];
  }, [state.pipelines]);

  const pipelineDeals = useMemo(() => {
    if (!prospeccaoPipeline) return [];
    return state.deals.filter(d => d.pipelineId === prospeccaoPipeline.id);
  }, [state.deals, prospeccaoPipeline]);

  // Dynamic counts for cards
  const dynamicCounts = useMemo(() => {
    if (!prospeccaoPipeline) return { leads: 0, decisor: 0, reunioes: 0, ganhos: 0 };
    const firstStage = prospeccaoPipeline.stages[0];
    const decisorStage = prospeccaoPipeline.stages.find(s => s.name.toLowerCase().includes("decisor"));
    const reuniaoStage = prospeccaoPipeline.stages.find(s => s.name.toLowerCase().includes("reuni"));
    
    return {
      leads: pipelineDeals.filter(d => d.stageId === firstStage?.id && d.status === "Ativo").length,
      decisor: decisorStage ? pipelineDeals.filter(d => d.stageId === decisorStage.id && d.status === "Ativo").length : 0,
      reunioes: reuniaoStage ? pipelineDeals.filter(d => d.stageId === reuniaoStage.id && d.status === "Ativo").length : 0,
      ganhos: pipelineDeals.filter(d => d.status === "Ganho").length,
    };
  }, [prospeccaoPipeline, pipelineDeals]);

  // If there are real active deals in the pipeline, use dynamic data. Otherwise, fallback to the screenshot mock values.
  const hasRealDeals = useMemo(() => {
    return pipelineDeals.length > 0;
  }, [pipelineDeals]);

  const cardStats = useMemo(() => {
    if (hasRealDeals) {
      return {
        leads: dynamicCounts.leads,
        decisor: dynamicCounts.decisor,
        reunioes: dynamicCounts.reunioes,
        ganhos: dynamicCounts.ganhos,
      };
    }
    return { leads: 2, decisor: 0, reunioes: 0, ganhos: 0 };
  }, [hasRealDeals, dynamicCounts]);

  // Funil de Conversão Data
  const funnelChartData = useMemo(() => {
    if (hasRealDeals && prospeccaoPipeline) {
      return prospeccaoPipeline.stages.map(s => {
        const count = pipelineDeals.filter(d => d.stageId === s.id && d.status === "Ativo").length;
        // Truncate name like in screenshot if long
        const displayName = s.name.length > 18 ? s.name.slice(0, 17) + "..." : s.name;
        return { name: displayName, fullName: s.name, value: count };
      });
    }
    // Screenshot mock data
    return [
      { name: "Entrada de Leads", value: 2 },
      { name: "Tentando contato", value: 0 },
      { name: "Contato realizado ...", value: 0 },
      { name: "Contato realizado ...", value: 0 },
      { name: "Reunião Agendada", value: 0 },
    ];
  }, [hasRealDeals, prospeccaoPipeline, pipelineDeals]);

  // Negócios Abertos por Etapa Data
  const openStageChartData = useMemo(() => {
    if (hasRealDeals && prospeccaoPipeline) {
      return prospeccaoPipeline.stages
        .map(s => {
          const count = pipelineDeals.filter(d => d.stageId === s.id && d.status === "Ativo").length;
          return { name: s.name, value: count };
        })
        .filter(d => d.value > 0);
    }
    return [
      { name: "Entrada de Leads", value: 2 }
    ];
  }, [hasRealDeals, prospeccaoPipeline, pipelineDeals]);

  // Atividades por Responsável
  const activityOwnerChartData = useMemo(() => {
    // Check if we have active activities
    const activities = state.deals.flatMap(d => d.activities);
    if (activities.length > 0) {
      // Mock grouping for active logged-in user or owner
      const completed = activities.filter(a => a.completed).length;
      const pending = activities.filter(a => !a.completed).length;
      return [
        { name: "João Paulo Olivera", "Concluídas": completed, "Pendentes": pending }
      ];
    }
    return [
      { name: "João Paulo Olivera", "Concluídas": 4, "Pendentes": 1 }
    ];
  }, [state.deals]);

  // Mix de Atividades
  const mixActivityChartData = useMemo(() => {
    const activities = state.deals.flatMap(d => d.activities);
    if (activities.length > 0) {
      const counts: Record<string, number> = {};
      activities.forEach(a => {
        counts[a.type] = (counts[a.type] || 0) + 1;
      });
      return [
        { name: "João Paulo Olivera", ...counts }
      ];
    }
    return [
      { name: "João Paulo Olivera", "WhatsApp": 4, "Reunião": 1 }
    ];
  }, [state.deals]);

  // ── Render Helpers ──────────────────────────────────────────────────────────
  const renderDashboardContent = () => {
    if (!dashboardPopulated) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="rounded-2xl bg-white border border-zinc-200 p-8 text-center max-w-md">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
              <Settings className="h-6 w-6 text-zinc-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Seu painel esta vazio</h2>
            <p className="text-sm text-zinc-500 mb-6">Comece com relatorios prontos ou crie do zero.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleCreateDefaultReports}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Criar relatorios padrao
              </button>
              <button
                onClick={handleCreateReportZero}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Criar relatorio do zero
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeReportId !== null) {
      // Render single report details view
      const activeReport = savedReports.find(r => r.id === activeReportId);
      const name = activeReport?.name || "Relatório";

      return (
        <div className="p-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 mb-6">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Visualização do Relatório</span>
                <h2 className="text-lg font-semibold text-zinc-800">{name}</h2>
              </div>
              <button
                onClick={() => handleSelectReport(null)}
                className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
              >
                Voltar para o Painel <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* Display appropriate chart based on report name */}
            <div className="h-[400px] mt-6">
              {name.toLowerCase().includes("funil") || name.toLowerCase().includes("conversao") ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelChartData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} angle={-20} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#eab308" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fontWeight: 700, fill: "#52525b" }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : name.toLowerCase().includes("etapa") || name.toLowerCase().includes("aberto") ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={openStageChartData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fontWeight: 700, fill: "#52525b" }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : name.toLowerCase().includes("responsavel") || name.toLowerCase().includes("atividades por") ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityOwnerChartData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Concluídas" stackId="a" fill="#22c55e" />
                    <Bar dataKey="Pendentes" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mixActivityChartData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="WhatsApp" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="Reunião" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Default Populated Dashboard Layout
    return (
      <div className="p-6 min-h-[calc(100vh-120px)] transition-colors">
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Prospeccao</h2>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-sm font-semibold text-zinc-800 mb-1">Novos Leads no Funil</div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">ENTRADA DE LEADS</div>
              <div className="text-3xl font-bold text-zinc-900">{cardStats.leads}</div>
              <div className="text-xs text-zinc-400 mt-0.5">no periodo</div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-sm font-semibold text-zinc-800 mb-1">Contatos Realizados com Decisor</div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">CONTATO REALIZADO COM O DECISOR</div>
              <div className="text-3xl font-bold text-zinc-900">{cardStats.decisor}</div>
              <div className="text-xs text-zinc-400 mt-0.5">no periodo</div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-sm font-semibold text-zinc-800 mb-1">Reunioes Agendadas</div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">REUNIÃO AGENDADA</div>
              <div className="text-3xl font-bold text-zinc-900">{cardStats.reunioes}</div>
              <div className="text-xs text-zinc-400 mt-0.5">no periodo</div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-sm font-semibold text-zinc-800 mb-1">Leads Ganhos</div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">GANHOS</div>
              <div className="text-3xl font-bold text-zinc-900">{cardStats.ganhos}</div>
              <div className="text-xs text-zinc-400 mt-0.5">no periodo</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Funil de Conversao */}
            <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden" style={{ opacity: 1, zIndex: "auto" }}>
              <div className="h-1 bg-[#f59e0b]"></div>
              <div className="flex items-center gap-1 px-3 pt-2 pb-1">
                <h3 className="text-sm font-semibold text-zinc-800 truncate flex-1">Funil de Conversao</h3>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button className="p-1.5 rounded hover:bg-violet-50 text-zinc-400 hover:text-violet-600 transition-colors" title="Analisar com IA">
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const rep = savedReports.find(r => r.name.toLowerCase().includes("funil"));
                      if (rep) handleSelectReport(rep.id);
                    }}
                    className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-blue-600 transition-colors"
                    title="Editar relatorio"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="Expandir">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button role="button" className="p-1.5 rounded cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors" title="Arrastar para reordenar">
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-semibold">NEGOCIOS</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">PROSPECCAO</span>
              </div>
              <div className="px-4 pb-4 overflow-hidden">
                <div className="recharts-responsive-container" style={{ width: "100%", height: "240px", minWidth: "0px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelChartData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} angle={-40} textAnchor="end" interval={0} height={70} />
                      <YAxis tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#eab308" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fontWeight: 700, fill: "#52525b" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Negocios Abertos por Etapa */}
            <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden" style={{ opacity: 1, zIndex: "auto" }}>
              <div className="h-1 bg-[#f59e0b]"></div>
              <div className="flex items-center gap-1 px-3 pt-2 pb-1">
                <h3 className="text-sm font-semibold text-zinc-800 truncate flex-1">Negocios Abertos por Etapa</h3>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button className="p-1.5 rounded hover:bg-violet-50 text-zinc-400 hover:text-violet-600 transition-colors" title="Analisar com IA">
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const rep = savedReports.find(r => r.name.toLowerCase().includes("etapa") || r.name.toLowerCase().includes("aberto"));
                      if (rep) handleSelectReport(rep.id);
                    }}
                    className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-blue-600 transition-colors"
                    title="Editar relatorio"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="Expandir">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button role="button" className="p-1.5 rounded cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors" title="Arrastar para reordenar">
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-semibold">NEGOCIOS</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">PROSPECCAO</span>
              </div>
              <div className="px-4 pb-4 overflow-hidden">
                <div className="recharts-responsive-container" style={{ width: "100%", height: "260px", minWidth: "0px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={openStageChartData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                      <YAxis tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} domain={[0, 2]} ticks={[0, 0.5, 1, 1.5, 2]} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fontWeight: 700, fill: "#52525b" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Atividades por Responsavel */}
            <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden" style={{ opacity: 1, zIndex: "auto" }}>
              <div className="h-1 bg-[#22c55e]"></div>
              <div className="flex items-center gap-1 px-3 pt-2 pb-1">
                <h3 className="text-sm font-semibold text-zinc-800 truncate flex-1">Atividades por Responsavel</h3>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button className="p-1.5 rounded hover:bg-violet-50 text-zinc-400 hover:text-violet-600 transition-colors" title="Analisar com IA">
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const rep = savedReports.find(r => r.name.toLowerCase().includes("atividades por"));
                      if (rep) handleSelectReport(rep.id);
                    }}
                    className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-blue-600 transition-colors"
                    title="Editar relatorio"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="Expandir">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button role="button" className="p-1.5 rounded cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors" title="Arrastar para reordenar">
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-semibold">ATIVIDADES</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">PROSPECCAO</span>
              </div>
              <div className="px-4 pb-4 overflow-hidden">
                <div className="recharts-responsive-container" style={{ width: "100%", height: "240px", minWidth: "0px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityOwnerChartData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                      <YAxis tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Concluídas" stackId="a" fill="#22c55e" />
                      <Bar dataKey="Pendentes" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Mix de Atividades */}
            <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden" style={{ opacity: 1, zIndex: "auto" }}>
              <div className="h-1 bg-[#3b82f6]"></div>
              <div className="flex items-center gap-1 px-3 pt-2 pb-1">
                <h3 className="text-sm font-semibold text-zinc-800 truncate flex-1">Mix de Atividades</h3>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button className="p-1.5 rounded hover:bg-violet-50 text-zinc-400 hover:text-violet-600 transition-colors" title="Analisar com IA">
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const rep = savedReports.find(r => r.name.toLowerCase().includes("mix"));
                      if (rep) handleSelectReport(rep.id);
                    }}
                    className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-blue-600 transition-colors"
                    title="Editar relatorio"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="Expandir">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button role="button" className="p-1.5 rounded cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors" title="Arrastar para reordenar">
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-semibold">ATIVIDADES</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">PROSPECCAO</span>
              </div>
              <div className="px-4 pb-4 overflow-hidden">
                <div className="recharts-responsive-container" style={{ width: "100%", height: "240px", minWidth: "0px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mixActivityChartData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                      <YAxis tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="WhatsApp" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="Reunião" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-50">
      
      {/* ── LEFT PANEL (Insights Sidebar w-64) ─────────────────────────────────── */}
      <div className="w-64 shrink-0 border-r border-zinc-200 bg-white overflow-y-auto flex flex-col">
        
        {/* Criar Button and Dropdown */}
        <div className="p-3 relative" ref={createDropdownRef}>
          <button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="flex items-center gap-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors justify-center"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Criar
            <ChevronDown className="h-3 w-3 ml-auto shrink-0" />
          </button>
          
          {showCreateDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCreateDropdown(false)}></div>
              <div className="absolute left-3 right-3 top-14 z-50 rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden">
                <button
                  onClick={handleCreateReportZero}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <BarChart2 className="h-4 w-4 text-zinc-400" />
                  Novo relatório
                </button>
                <button
                  onClick={handleCreateDashboard}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <PanelTop className="h-4 w-4 text-zinc-400" />
                  Novo painel
                </button>
              </div>
            </>
          )}
        </div>

        {/* Search Bar */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <input
              placeholder="Buscar no Insights"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-zinc-700 outline-none w-full placeholder:text-zinc-400"
              type="text"
            />
          </div>
        </div>

        {/* Navigation list */}
        <div className="px-2 flex-1 overflow-y-auto">
          
          {/* Painéis */}
          <button className="flex items-center gap-2 w-full px-2 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-700">
            <PanelTop className="h-3 w-3" />
            Painéis
            <ChevronDown className="h-3 w-3 ml-auto" />
          </button>
          
          <div className="space-y-0.5 mb-3">
            {dashboardPopulated && (
              <div className="group relative">
                <button
                  onClick={() => handleSelectReport(null)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-colors font-medium text-left",
                    activeReportId === null
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                  )}
                >
                  <LayoutDashboard className={cn("h-4 w-4 shrink-0", activeReportId === null ? "text-emerald-500" : "text-zinc-400")} />
                  <span className="truncate flex-1 pr-6">Meu Painel</span>
                </button>
                <button
                  onClick={handleDeleteDashboard}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Relatórios */}
          <button className="flex items-center gap-2 w-full px-2 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-700">
            <FileText className="h-3 w-3" />
            Relatórios
            <span className="ml-1 text-[10px] text-zinc-400 font-normal normal-case">
              {savedReports.length}
            </span>
            <ChevronDown className="h-3 w-3 ml-auto" />
          </button>

          <div className="space-y-0.5 pb-4">
            {filteredReports.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">Nenhum relatório salvo</p>
            ) : (
              filteredReports.map(report => (
                <div key={report.id} className="group relative">
                  {editingReportId === report.id ? (
                    <form
                      onSubmit={(e) => handleSaveRename(report.id, e)}
                      className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 rounded-lg"
                    >
                      <input
                        type="text"
                        value={editingReportName}
                        onChange={e => setEditingReportName(e.target.value)}
                        className="w-full text-xs bg-white border border-zinc-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-500"
                        autoFocus
                      />
                      <button type="submit" className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded">
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingReportId(null)}
                        className="p-0.5 text-zinc-400 hover:bg-zinc-100 rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSelectReport(report.id)}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-colors text-left",
                          activeReportId === report.id
                            ? "bg-zinc-100 text-zinc-900 font-medium"
                            : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                        )}
                      >
                        <BarChart2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate flex-1 pr-6">{report.name}</span>
                      </button>
                      
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-white pl-1">
                        <button
                          onClick={(e) => handleStartRename(report.id, report.name, e)}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                          title="Renomear"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteReport(report.id, e)}
                          className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-zinc-50"
                          title="Excluir"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

        </div>
      </div>

      {/* ── MAIN CONTENT (flex-1) ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-zinc-50">
        
        {/* Header bar */}
        <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900">
            {activeReportId === null ? "Meu Painel" : savedReports.find(r => r.id === activeReportId)?.name || "Relatório"}
          </h1>
          
          <div className="flex items-center gap-3">
            {/* Date filter dropdown button */}
            <div className="relative" ref={dateDropdownRef}>
              <button
                onClick={() => setShowDateDropdown(!showDateDropdown)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0"
              >
                <span className="min-w-0 truncate text-zinc-800 font-medium">{dateLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              </button>
              
              {showDateDropdown && (
                <div className="absolute right-0 mt-1 w-44 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 z-50">
                  {["Este mes", "Mes passado", "Ultimos 7 dias", "Ultimos 30 dias", "Todo o periodo"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setDateLabel(label);
                        setShowDateDropdown(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors",
                        dateLabel === label && "bg-zinc-50 font-semibold text-emerald-700"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* User filter dropdown button */}
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0"
              >
                <span className="min-w-0 truncate text-zinc-800 font-medium">{userFilter}</span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              </button>
              
              {showUserDropdown && (
                <div className="absolute right-0 mt-1 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 z-50">
                  {["Todos os usuarios", "Joao Paulo Olivera", "Pixeo Digital Business"].map((user) => (
                    <button
                      key={user}
                      type="button"
                      onClick={() => {
                        setUserFilter(user);
                        setShowUserDropdown(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors",
                        userFilter === user && "bg-zinc-50 font-semibold text-emerald-700"
                      )}
                    >
                      {user}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard main area */}
        {renderDashboardContent()}

      </div>

    </div>
  );
}
