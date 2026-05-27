"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { useSavedReports } from "@/hooks/use-saved-reports";
import { DEFAULT_REPORTS, COLORS, type SavedReport } from "./insights-constants";
import { DashboardGrid } from "./dashboard-grid";
import { InsightsSidebar } from "./insights-sidebar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import {
  Plus, ChevronDown, Search, PanelTop, LayoutDashboard,
  Trash2, FileText, Sparkles, Pencil, Maximize2,
  GripVertical, Settings, BarChart2, X, Check,
  ArrowLeft, Layers, Palette, Save, Download, ArrowUpDown,
  Hash, GitBranch, Table
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function InsightsPage() {
  const { state } = useCrm();
  const { map: ownerNameMap, names: ownerNames, selfName: selfOwnerName } = useOwnerNameMap();

  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const {
    savedReports, setSavedReports,
    dashboardPopulated, setDashboardPopulated,
    sync: syncReports, deleteFromDb: deleteReportSupabase,
  } = useSavedReports((activeReport) => {
    setActiveReportId(activeReport.id);
    setEditReportName(activeReport.name);
    setEditChartType(activeReport.chartType || "bar");
    setEditColor(activeReport.color || "#ec4899");
    setEditPeriod(activeReport.period || "Este mes");
    setEditFilters(activeReport.filters || []);
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingReportName, setEditingReportName] = useState("");

  const [dateLabel, setDateLabel] = useState("Este mes");
  const [userFilter, setUserFilter] = useState("Todos os usuarios");

  // Report details edit states
  const [editReportName, setEditReportName] = useState("");
  const [editChartType, setEditChartType] = useState<"bar" | "stacked" | "funnel" | "pie" | "table" | "number">("bar");
  const [editColor, setEditColor] = useState("#ec4899");
  const [editPeriod, setEditPeriod] = useState("Este mes");
  const [editFilters, setEditFilters] = useState<{ field: string; operator: string; value: string }[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  
  // Custom Filter State
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [newFilterField, setNewFilterField] = useState("Status");
  const [newFilterOperator, setNewFilterOperator] = useState("é");
  const [newFilterValue, setNewFilterValue] = useState("Ganho");

  // Sorting
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const createDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const periodDropdownRef = useRef<HTMLDivElement>(null);

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
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(event.target as Node)) {
        setShowColorDropdown(false);
      }
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Seeding default reports ──────────────────────────────────────────────────
  const handleCreateDefaultReports = () => {
    setSavedReports(DEFAULT_REPORTS);
    syncReports(DEFAULT_REPORTS);
    setDashboardPopulated(true);
    setActiveReportId(null);
    localStorage.setItem("insights_dashboard_populated", "true");
    localStorage.setItem("insights_active_report_id", "null");
  };

  const handleCreateReportZero = () => {
    const newId = `rep_${Date.now()}`;
    const newReport: SavedReport = {
      id: newId,
      name: `Novo Relatório ${savedReports.length + 1}`,
      chartType: "bar",
      color: "#ec4899",
      pipeline: "Prospecção",
      period: "Este mes",
      filters: []
    };
    const updated = [newReport, ...savedReports];
    setSavedReports(updated);
    setActiveReportId(newId);
    setEditReportName(newReport.name);
    setEditChartType(newReport.chartType);
    setEditColor(newReport.color);
    setEditPeriod(newReport.period);
    setEditFilters(newReport.filters);
    setIsEditingTitle(false);
    setShowAddFilter(false);
    setDashboardPopulated(true);
    syncReports(updated);
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
    deleteReportSupabase(id);
    if (activeReportId === id) {
      setActiveReportId(null);
      localStorage.setItem("insights_active_report_id", "null");
    }
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
    if (activeReportId === id) {
      setEditReportName(editingReportName);
    }
    setEditingReportId(null);
    syncReports(updated);
  };

  const handleSelectReport = (id: string | null) => {
    setActiveReportId(id);
    localStorage.setItem("insights_active_report_id", id === null ? "null" : id);
    if (id) {
      const activeReport = savedReports.find(r => r.id === id);
      if (activeReport) {
        setEditReportName(activeReport.name);
        setEditChartType(activeReport.chartType || "bar");
        setEditColor(activeReport.color || "#ec4899");
        setEditPeriod(activeReport.period || "Este mes");
        setEditFilters(activeReport.filters || []);
        setIsEditingTitle(false);
        setShowAddFilter(false);
      }
    }
  };

  // ── Save Current Report Configurations ───────────────────────────────
  const isDirty = useMemo(() => {
    const activeReport = savedReports.find(r => r.id === activeReportId);
    if (!activeReport) return false;
    return (
      editReportName !== activeReport.name ||
      editChartType !== activeReport.chartType ||
      editColor !== activeReport.color ||
      editPeriod !== activeReport.period ||
      JSON.stringify(editFilters) !== JSON.stringify(activeReport.filters)
    );
  }, [activeReportId, savedReports, editReportName, editChartType, editColor, editPeriod, editFilters]);

  const handleSaveReport = () => {
    if (!activeReportId) return;
    const updated = savedReports.map(r => {
      if (r.id === activeReportId) {
        return {
          ...r,
          name: editReportName,
          chartType: editChartType,
          color: editColor,
          period: editPeriod,
          filters: editFilters
        };
      }
      return r;
    });
    setSavedReports(updated);
    syncReports(updated);
  };

  const handleDeleteActiveReport = () => {
    if (!activeReportId) return;
    const updated = savedReports.filter(r => r.id !== activeReportId);
    setSavedReports(updated);
    deleteReportSupabase(activeReportId);
    setActiveReportId(null);
    localStorage.setItem("insights_active_report_id", "null");
  };

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ["Titulo", "Valor", "Etapa", "Funil", "Responsavel", "Criado em", "Status"];
    const rows = filteredDeals.map(d => [
      d.title,
      `R$ ${d.value}`,
      d.stageName,
      d.pipelineName,
      d.ownerName,
      new Date(d.createdAt).toLocaleString("pt-BR"),
      d.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${editReportName.replace(/\s+/g, "_")}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // Fallback to mock deal logs if the database is empty
  const dealsToAnalyze = useMemo(() => {
    if (state.deals && state.deals.length > 0) {
      return state.deals.map(d => {
        const pipeline = state.pipelines.find(p => p.id === d.pipelineId);
        const stage = pipeline?.stages.find(s => s.id === d.stageId);
        return {
          id: d.id,
          title: d.title,
          value: d.value,
          stageName: stage?.name || "Entrada de Leads",
          pipelineName: pipeline?.name || "Prospeccao",
          ownerName: ownerNameMap[d.ownerId ?? ""] ?? "Sem dono",
          createdAt: d.createdAt || new Date().toISOString(),
          status: d.status === "Ativo" ? "-" : d.status
        };
      });
    }
    return [];
  }, [state.deals, state.pipelines]);

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
        const displayName = s.name.length > 18 ? s.name.slice(0, 17) + "..." : s.name;
        return { name: displayName, fullName: s.name, value: count };
      });
    }
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
    const activities = state.deals.flatMap(d => d.activities);
    if (activities.length > 0) {
      const completed = activities.filter(a => a.completed).length;
      const pending = activities.filter(a => !a.completed).length;
      return [
        { name: selfOwnerName || "Sem dono", "Concluídas": completed, "Pendentes": pending }
      ];
    }
    return [
      { name: selfOwnerName || "Sem dono", "Concluídas": 0, "Pendentes": 0 }
    ];
  }, [state.deals, selfOwnerName]);

  // Mix de Atividades
  const mixActivityChartData = useMemo(() => {
    const activities = state.deals.flatMap(d => d.activities);
    if (activities.length > 0) {
      const counts: Record<string, number> = {};
      activities.forEach(a => {
        counts[a.type] = (counts[a.type] || 0) + 1;
      });
      return [
        { name: selfOwnerName || "Sem dono", ...counts }
      ];
    }
    return [
      { name: selfOwnerName || "Sem dono" }
    ];
  }, [state.deals, selfOwnerName]);

  // ── Filter and Sort Deals for Editor ────────────────────────────────────────
  const filteredDeals = useMemo(() => {
    return dealsToAnalyze.filter(deal => {
      // 1. Period filter
      const dealDate = new Date(deal.createdAt);
      const now = new Date();
      if (editPeriod === "Este mes") {
        if (dealDate.getMonth() !== now.getMonth() || dealDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (editPeriod === "Este ano") {
        if (dealDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (editPeriod === "Ultimos 7 dias") {
        const diffTime = Math.abs(now.getTime() - dealDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
      } else if (editPeriod === "Ultimos 30 dias") {
        const diffTime = Math.abs(now.getTime() - dealDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 30) return false;
      }

      // 2. Additional filter conditions
      for (const f of editFilters) {
        if (f.field === "Status") {
          const val = deal.status === "-" ? "Ativo" : deal.status;
          if (f.operator === "é" && val !== f.value) return false;
        } else if (f.field === "Etapa") {
          if (f.operator === "é" && deal.stageName.toLowerCase() !== f.value.toLowerCase()) return false;
        } else if (f.field === "Funil") {
          if (f.operator === "é" && deal.pipelineName.toLowerCase() !== f.value.toLowerCase()) return false;
        } else if (f.field === "Responsavel") {
          if (f.operator === "é" && deal.ownerName.toLowerCase() !== f.value.toLowerCase()) return false;
        } else if (f.field === "Valor") {
          const valNum = deal.value;
          const filterNum = parseFloat(f.value) || 0;
          if (f.operator === "maior que" && valNum <= filterNum) return false;
          if (f.operator === "menor que" && valNum >= filterNum) return false;
          if (f.operator === "igual a" && valNum !== filterNum) return false;
        }
      }
      return true;
    });
  }, [dealsToAnalyze, editPeriod, editFilters]);

  // Sort deals
  const sortedDeals = useMemo(() => {
    if (!sortField) return filteredDeals;
    const sorted = [...filteredDeals];
    sorted.sort((a, b) => {
      const aVal = a[sortField as keyof typeof a];
      const bVal = b[sortField as keyof typeof b];

      if (sortField === "value") {
        const diff = a.value - b.value;
        return sortDirection === "asc" ? (diff < 0 ? -1 : diff > 0 ? 1 : 0) : (diff < 0 ? 1 : diff > 0 ? -1 : 0);
      } else if (sortField === "createdAt") {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sortDirection === "asc" ? (diff < 0 ? -1 : diff > 0 ? 1 : 0) : (diff < 0 ? 1 : diff > 0 ? -1 : 0);
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredDeals, sortField, sortDirection]);

  // Handle header sorting click
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // ── Calculate dynamic report chart data based on active filters ──────────────
  const activeReportChartData = useMemo(() => {
    const groups: Record<string, { name: string; value: number; amount: number }> = {};
    
    // Determine target stages depending on current active report pipeline
    const activeReport = savedReports.find(r => r.id === activeReportId);
    const pipelineName = activeReport?.pipeline || "Prospecção";
    const matchedPipeline = state.pipelines.find(p => p.name.toLowerCase().includes(pipelineName.toLowerCase()) || pipelineName.toLowerCase().includes(p.name.toLowerCase()));
    
    if (matchedPipeline) {
      matchedPipeline.stages.forEach(s => {
        groups[s.name] = { name: s.name, value: 0, amount: 0 };
      });
    }

    filteredDeals.forEach(d => {
      if (!groups[d.stageName]) {
        groups[d.stageName] = { name: d.stageName, value: 0, amount: 0 };
      }
      groups[d.stageName].value += 1;
      groups[d.stageName].amount += d.value;
    });

    return Object.values(groups);
  }, [filteredDeals, activeReportId, savedReports, state.pipelines]);

  // Pie chart dynamic slices
  const activePieChartData = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredDeals.forEach(d => {
      const key = d.status === "-" ? "Em aberto" : d.status;
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [filteredDeals]);

  // Drill down from dashboard click helper
  const handleSelectReportByNameAndPipeline = (name: string, pipeline: string) => {
    const rep = savedReports.find(r => r.name.toLowerCase().includes(name.toLowerCase()) && r.pipeline.toLowerCase().includes(pipeline.toLowerCase()));
    if (rep) {
      handleSelectReport(rep.id);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-50">
      
      <InsightsSidebar
        createDropdownRef={createDropdownRef}
        showCreateDropdown={showCreateDropdown}
        onToggleCreateDropdown={() => setShowCreateDropdown(v => !v)}
        onCloseCreateDropdown={() => setShowCreateDropdown(false)}
        onCreateReportZero={handleCreateReportZero}
        onCreateDashboard={handleCreateDashboard}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dashboardPopulated={dashboardPopulated}
        activeReportId={activeReportId}
        onSelectReport={handleSelectReport}
        onDeleteDashboard={handleDeleteDashboard}
        savedReports={savedReports}
        filteredReports={filteredReports}
        editingReportId={editingReportId}
        editingReportName={editingReportName}
        onEditingReportNameChange={setEditingReportName}
        onCancelRename={() => setEditingReportId(null)}
        onStartRename={handleStartRename}
        onSaveRename={handleSaveRename}
        onDeleteReport={handleDeleteReport}
      />

      {/* ── MAIN CONTENT (flex-1) ──────────────────────────────────────────────── */}
      {activeReportId === null ? (
        <div className="flex-1 overflow-auto bg-zinc-50 flex flex-col">
          {/* Header bar */}
          <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
            <h1 className="text-lg font-semibold text-zinc-900">Meu Painel</h1>
            
            <div className="flex items-center gap-3">
              {/* Date filter dropdown button */}
              <div className="relative" ref={dateDropdownRef}>
                <button
                  onClick={() => setShowDateDropdown(!showDateDropdown)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0 cursor-pointer"
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
                          "w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer",
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
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0 cursor-pointer"
                >
                  <span className="min-w-0 truncate text-zinc-800 font-medium">{userFilter}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                </button>
                
                {showUserDropdown && (
                  <div className="absolute right-0 mt-1 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 z-50">
                    {["Todos os usuarios", ...ownerNames].map((user) => (
                      <button
                        key={user}
                        type="button"
                        onClick={() => {
                          setUserFilter(user);
                          setShowUserDropdown(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer",
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

          <div className="flex-1 overflow-auto">
            <DashboardGrid
              dashboardPopulated={dashboardPopulated}
              onCreateDefaultReports={handleCreateDefaultReports}
              onCreateReportZero={handleCreateReportZero}
              onSelectByNameAndPipeline={handleSelectReportByNameAndPipeline}
              cardStats={cardStats}
              funnelChartData={funnelChartData}
              openStageChartData={openStageChartData}
              activityOwnerChartData={activityOwnerChartData}
              mixActivityChartData={mixActivityChartData}
            />
          </div>
        </div>
      ) : (
        /* ── REPORT DETAIL VIEWER & INTERACTIVE EDITOR ── */
        <div className="flex-1 overflow-auto bg-zinc-50 flex flex-col">
          {/* Header border-b border-zinc-200 */}
          <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
             {/* Left side: Back arrow + editable title */}
             <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSelectReport(null)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                {isEditingTitle ? (
                  <input
                    type="text"
                    value={editReportName}
                    onChange={e => setEditReportName(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={e => {
                      if (e.key === "Enter") setIsEditingTitle(false);
                    }}
                    className="text-lg font-semibold text-zinc-900 border border-zinc-300 rounded px-1 -mx-1 focus:outline-none focus:border-emerald-500 bg-white"
                    autoFocus
                  />
                ) : (
                  <h1
                    onClick={() => setIsEditingTitle(true)}
                    className="text-lg font-semibold text-zinc-900 cursor-text rounded px-1 -mx-1 hover:bg-zinc-100 transition-colors"
                    title="Click pra renomear"
                  >
                    {editReportName}
                  </h1>
                )}
             </div>

             {/* Right side: Chart type selectors, color picker, Save, Export, Delete */}
             <div className="flex items-center gap-3">
                {/* Chart buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditChartType("bar")}
                    title="Barras"
                    className={cn(
                      "p-2 rounded-lg transition-colors cursor-pointer",
                      editChartType === "bar"
                        ? "bg-zinc-900 text-white font-semibold"
                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                    )}
                  >
                    <BarChart2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditChartType("stacked")}
                    title="Barras empilhadas"
                    className={cn(
                      "p-2 rounded-lg transition-colors cursor-pointer",
                      editChartType === "stacked"
                        ? "bg-zinc-900 text-white font-semibold"
                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                    )}
                  >
                    <Layers className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditChartType("funnel")}
                    title="Funil de conversao"
                    className={cn(
                      "p-2 rounded-lg transition-colors cursor-pointer",
                      editChartType === "funnel"
                        ? "bg-zinc-900 text-white font-semibold"
                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                    )}
                  >
                    <GitBranch className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditChartType("pie")}
                    title="Pizza"
                    className={cn(
                      "p-2 rounded-lg transition-colors cursor-pointer",
                      editChartType === "pie"
                        ? "bg-zinc-900 text-white font-semibold"
                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                    )}
                  >
                    <PieChart className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditChartType("table")}
                    title="Tabela"
                    className={cn(
                      "p-2 rounded-lg transition-colors cursor-pointer",
                      editChartType === "table"
                        ? "bg-zinc-900 text-white font-semibold"
                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                    )}
                  >
                    <Table className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditChartType("number")}
                    title="Numero"
                    className={cn(
                      "p-2 rounded-lg transition-colors cursor-pointer",
                      editChartType === "number"
                        ? "bg-zinc-900 text-white font-semibold"
                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                    )}
                  >
                    <Hash className="h-4 w-4" />
                  </button>
                </div>

                {/* Color picker */}
                <div className="relative" ref={colorDropdownRef}>
                  <button
                    onClick={() => setShowColorDropdown(!showColorDropdown)}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div
                      className="h-4 w-4 rounded-full border border-zinc-200 shrink-0"
                      style={{ backgroundColor: editColor }}
                    ></div>
                    <Palette className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  </button>

                  {showColorDropdown && (
                    <div className="absolute right-0 mt-1 p-2 rounded-lg border border-zinc-200 bg-white shadow-lg z-50 grid grid-cols-4 gap-1.5 w-36">
                      {COLORS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => {
                            setEditColor(c.value);
                            setShowColorDropdown(false);
                          }}
                          className={cn(
                            "h-6 w-6 rounded-full border transition-transform hover:scale-110 cursor-pointer",
                            editColor === c.value ? "border-zinc-900 scale-105" : "border-zinc-200"
                          )}
                          style={{ backgroundColor: c.value }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveReport}
                  disabled={!isDirty}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors border",
                    isDirty
                      ? "bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800 cursor-pointer"
                      : "border-zinc-200 text-zinc-400 bg-white cursor-default"
                  )}
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </button>

                {/* Export button */}
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 bg-white transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Exportar
                </button>

                {/* Delete button */}
                <button
                  onClick={handleDeleteActiveReport}
                  className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 bg-white border border-zinc-200 transition-colors cursor-pointer"
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
             </div>
          </div>

          {/* Page body content */}
          <div className="p-6 space-y-4 flex-1 overflow-auto">
            
            {/* Filters section */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500 tracking-wider">NEGOCIO</span>
                <div className="relative">
                  <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0">
                    <span className="min-w-0 truncate text-zinc-800 font-medium">Negocio criado em</span>
                    <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  </button>
                </div>
                <span className="text-sm text-zinc-400">e</span>
                
                {/* Period filter dropdown */}
                <div className="relative" ref={periodDropdownRef}>
                  <button
                    onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0 cursor-pointer"
                  >
                    <span className="min-w-0 truncate text-zinc-800 font-medium">{editPeriod}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  </button>

                  {showPeriodDropdown && (
                    <div className="absolute left-0 mt-1 w-44 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 z-50">
                      {["Este mes", "Este ano", "Todo o periodo", "Ultimos 7 dias", "Ultimos 30 dias"].map((period) => (
                        <button
                          key={period}
                          onClick={() => {
                            setEditPeriod(period);
                            setShowPeriodDropdown(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer",
                            editPeriod === period && "bg-zinc-50 font-semibold text-emerald-700"
                          )}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Filters List */}
              {editFilters.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs text-zinc-500 font-medium">
                    {editFilters.length} {editFilters.length === 1 ? "filtro aplicado" : "filtros aplicados"}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {editFilters.map((filter, index) => (
                      <div key={index} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-700">
                        <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-500 tracking-wider">NEGOCIOS</span>
                        <span className="font-semibold text-zinc-800">{filter.field}</span>
                        <span className="text-zinc-400">{filter.operator}</span>
                        <span className="font-semibold text-zinc-900">{filter.value}</span>
                        <button
                          onClick={() => {
                            setEditFilters(prev => prev.filter((_, i) => i !== index));
                          }}
                          className="p-0.5 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors ml-1 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add filter button / form */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowAddFilter(!showAddFilter)}
                  className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar filtro
                </button>

                {showAddFilter && (
                  <div className="mt-3 p-3 border border-zinc-200 rounded-lg bg-zinc-50 space-y-3 max-w-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-zinc-500 font-semibold block mb-1">Campo</label>
                        <select
                          value={newFilterField}
                          onChange={e => {
                            const field = e.target.value;
                            setNewFilterField(field);
                            if (field === "Status") {
                              setNewFilterOperator("é");
                              setNewFilterValue("Ganho");
                            } else if (field === "Etapa") {
                              setNewFilterOperator("é");
                              setNewFilterValue("Entrada de Leads");
                            } else if (field === "Funil") {
                              setNewFilterOperator("é");
                              setNewFilterValue("Prospeccao");
                            } else if (field === "Responsavel") {
                              setNewFilterOperator("é");
                              setNewFilterValue(ownerNames[0] ?? "");
                            } else if (field === "Valor") {
                              setNewFilterOperator("maior que");
                              setNewFilterValue("1000");
                            }
                          }}
                          className="w-full text-xs border border-zinc-200 bg-white rounded p-1.5 outline-none"
                        >
                          <option value="Status">Status</option>
                          <option value="Etapa">Etapa</option>
                          <option value="Funil">Funil</option>
                          <option value="Responsavel">Responsável</option>
                          <option value="Valor">Valor</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 font-semibold block mb-1">Operador</label>
                        <select
                          value={newFilterOperator}
                          onChange={e => setNewFilterOperator(e.target.value)}
                          className="w-full text-xs border border-zinc-200 bg-white rounded p-1.5 outline-none"
                        >
                          {newFilterField === "Valor" ? (
                            <>
                              <option value="maior que">maior que</option>
                              <option value="menor que">menor que</option>
                              <option value="igual a">igual a</option>
                            </>
                          ) : (
                            <option value="é">é</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 font-semibold block mb-1">Valor</label>
                        {newFilterField === "Status" ? (
                          <select
                            value={newFilterValue}
                            onChange={e => setNewFilterValue(e.target.value)}
                            className="w-full text-xs border border-zinc-200 bg-white rounded p-1.5 outline-none"
                          >
                            <option value="Ativo">Ativo</option>
                            <option value="Ganho">Ganho</option>
                            <option value="Perdido">Perdido</option>
                          </select>
                        ) : newFilterField === "Funil" ? (
                          <select
                            value={newFilterValue}
                            onChange={e => setNewFilterValue(e.target.value)}
                            className="w-full text-xs border border-zinc-200 bg-white rounded p-1.5 outline-none"
                          >
                            <option value="Prospeccao">Prospeccao</option>
                            <option value="Inbound">Inbound</option>
                            <option value="Social Selling">Social Selling</option>
                            <option value="Negociação">Negociação</option>
                          </select>
                        ) : newFilterField === "Etapa" ? (
                          <select
                            value={newFilterValue}
                            onChange={e => setNewFilterValue(e.target.value)}
                            className="w-full text-xs border border-zinc-200 bg-white rounded p-1.5 outline-none"
                          >
                            {Array.from(new Set(state.pipelines.flatMap(p => p.stages.map(s => s.name)).concat([
                              "Entrada de Leads", "Tentando contato", "Contato realizado com o decisor", "Reunião Agendada",
                              "Formulário Preenchido", "Qualificado pelo formulário", "Contato realizado", "MQL Cadastrado",
                              "Conversa Significativa", "Reunião Realizada", "Proposta Apresentada", "Negociação", "Contrato"
                            ]))).map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        ) : newFilterField === "Responsavel" ? (
                          <select
                            value={newFilterValue}
                            onChange={e => setNewFilterValue(e.target.value)}
                            className="w-full text-xs border border-zinc-200 bg-white rounded p-1.5 outline-none"
                          >
                            {ownerNames.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        ) : (
                          <input
                            type="number"
                            value={newFilterValue}
                            onChange={e => setNewFilterValue(e.target.value)}
                            className="w-full text-xs border border-zinc-200 bg-white rounded p-1.5 outline-none"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => setShowAddFilter(false)}
                        className="px-2 py-1 text-xs border border-zinc-200 hover:bg-zinc-100 rounded text-zinc-500 font-medium cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          setEditFilters(prev => [...prev, { field: newFilterField, operator: newFilterOperator, value: newFilterValue }]);
                          setShowAddFilter(false);
                        }}
                        className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 rounded text-white font-medium cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chart Area */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 overflow-hidden">
               {filteredDeals.length === 0 ? (
                 <div className="flex items-center justify-center h-48 text-sm text-zinc-400">
                   Nenhum dado encontrado
                 </div>
               ) : editChartType === "table" ? (
                 /* Table representation */
                 <div className="overflow-auto max-h-[350px]">
                   <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          <th className="text-left py-2 px-3 font-semibold text-zinc-600">Título</th>
                          <th className="text-left py-2 px-3 font-semibold text-zinc-600">Valor</th>
                          <th className="text-left py-2 px-3 font-semibold text-zinc-600">Etapa</th>
                          <th className="text-left py-2 px-3 font-semibold text-zinc-600">Responsável</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDeals.map(d => (
                          <tr key={d.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                            <td className="py-2 px-3 text-zinc-800 font-medium">{d.title}</td>
                            <td className="py-2 px-3 text-zinc-600">R$ {d.value.toLocaleString("pt-BR")}</td>
                            <td className="py-2 px-3 text-zinc-600">{d.stageName}</td>
                            <td className="py-2 px-3 text-zinc-600">{d.ownerName}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                 </div>
               ) : editChartType === "number" ? (
                 /* Number representation */
                 <div className="flex flex-col items-center justify-center py-16">
                   <span className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Total de Registros</span>
                   <span className="text-7xl font-extrabold mt-2" style={{ color: editColor }}>
                     {filteredDeals.length}
                   </span>
                 </div>
               ) : editChartType === "pie" ? (
                 /* Pie chart rendering */
                 <div className="recharts-responsive-container" style={{ width: "100%", height: "350px", minWidth: "0px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={activePieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {activePieChartData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={idx === 0 ? editColor : idx === 1 ? "#3b82f6" : "#22c55e"} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend formatter={(value) => <span className="text-zinc-600 text-xs font-medium">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                 </div>
               ) : editChartType === "stacked" ? (
                 /* Stacked BarChart rendering */
                 <div className="recharts-responsive-container" style={{ width: "100%", height: "350px", minWidth: "0px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeReportChartData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" fill={editColor} stackId="a" radius={[4, 4, 0, 0]} name="Volume de Negócios" />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
               ) : editChartType === "funnel" ? (
                 /* Horizontal Funnel chart rendering */
                 <div className="recharts-responsive-container" style={{ width: "100%", height: "350px", minWidth: "0px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeReportChartData} layout="vertical" margin={{ top: 20, right: 30, left: 120, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill={editColor} radius={[0, 4, 4, 0]} name="Negócios" />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
               ) : (
                 /* Standard BarChart rendering */
                 <div className="recharts-responsive-container" style={{ width: "100%", height: "350px", minWidth: "0px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeReportChartData} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill={editColor} radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fontWeight: 700, fill: "#52525b" }} />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
               )}
            </div>

            {/* Records table area */}
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
               <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">Registros</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">{sortedDeals.length} {sortedDeals.length === 1 ? "registro" : "registros"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 bg-white transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exportar
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="Personalizar colunas font-medium">
                      <Settings className="h-5 w-5" />
                    </button>
                  </div>
               </div>

               {/* Table content */}
               <div className="overflow-auto max-h-[400px]">
                 {sortedDeals.length === 0 ? (
                   <div className="flex items-center justify-center h-48 text-sm text-zinc-400">
                     Nenhum registro encontrado
                   </div>
                 ) : (
                   <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          <th onClick={() => handleSort("title")} className="text-left py-2.5 px-4 font-semibold text-zinc-600 whitespace-nowrap select-none hover:bg-zinc-100 transition-colors group cursor-pointer">
                            <span className="inline-flex items-center gap-1.5">
                              <button className="cursor-grab text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="h-3.5 w-3.5" />
                              </button>
                              <span>Titulo</span>
                              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400 opacity-50" />
                            </span>
                          </th>
                          <th onClick={() => handleSort("value")} className="text-left py-2.5 px-4 font-semibold text-zinc-600 whitespace-nowrap select-none hover:bg-zinc-100 transition-colors group cursor-pointer">
                            <span className="inline-flex items-center gap-1.5">
                              <button className="cursor-grab text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="h-3.5 w-3.5" />
                              </button>
                              <span>Valor</span>
                              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400 opacity-50" />
                            </span>
                          </th>
                          <th onClick={() => handleSort("stageName")} className="text-left py-2.5 px-4 font-semibold text-zinc-600 whitespace-nowrap select-none hover:bg-zinc-100 transition-colors group cursor-pointer">
                            <span className="inline-flex items-center gap-1.5">
                              <button className="cursor-grab text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="h-3.5 w-3.5" />
                              </button>
                              <span>Etapa</span>
                              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400 opacity-50" />
                            </span>
                          </th>
                          <th onClick={() => handleSort("pipelineName")} className="text-left py-2.5 px-4 font-semibold text-zinc-600 whitespace-nowrap select-none hover:bg-zinc-100 transition-colors group cursor-pointer">
                            <span className="inline-flex items-center gap-1.5">
                              <button className="cursor-grab text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="h-3.5 w-3.5" />
                              </button>
                              <span>Funil</span>
                              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400 opacity-50" />
                            </span>
                          </th>
                          <th onClick={() => handleSort("ownerName")} className="text-left py-2.5 px-4 font-semibold text-zinc-600 whitespace-nowrap select-none hover:bg-zinc-100 transition-colors group cursor-pointer">
                            <span className="inline-flex items-center gap-1.5">
                              <button className="cursor-grab text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="h-3.5 w-3.5" />
                              </button>
                              <span>Responsavel</span>
                              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400 opacity-50" />
                            </span>
                          </th>
                          <th onClick={() => handleSort("createdAt")} className="text-left py-2.5 px-4 font-semibold text-zinc-600 whitespace-nowrap select-none hover:bg-zinc-100 transition-colors group cursor-pointer">
                            <span className="inline-flex items-center gap-1.5">
                              <button className="cursor-grab text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="h-3.5 w-3.5" />
                              </button>
                              <span>Criado em</span>
                              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400 opacity-50" />
                            </span>
                          </th>
                          <th onClick={() => handleSort("status")} className="text-left py-2.5 px-4 font-semibold text-zinc-600 whitespace-nowrap select-none hover:bg-zinc-100 transition-colors group cursor-pointer">
                            <span className="inline-flex items-center gap-1.5">
                              <button className="cursor-grab text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="h-3.5 w-3.5" />
                              </button>
                              <span>Status</span>
                              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400 opacity-50" />
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDeals.map((deal) => (
                          <tr
                            key={deal.id}
                            onClick={() => {
                              if (!deal.id.startsWith("deal_mock_")) {
                                window.location.href = `/negocios/${deal.id}`;
                              }
                            }}
                            className={cn(
                              "border-b border-zinc-100 hover:bg-zinc-50 transition-colors",
                              !deal.id.startsWith("deal_mock_") && "cursor-pointer"
                            )}
                          >
                            <td className="py-2.5 px-4 whitespace-nowrap max-w-[200px] truncate text-zinc-700 font-semibold">{deal.title}</td>
                            <td className="py-2.5 px-4 whitespace-nowrap max-w-[200px] truncate text-zinc-700">R$&nbsp;{deal.value.toLocaleString("pt-BR")}</td>
                            <td className="py-2.5 px-4 whitespace-nowrap max-w-[200px] truncate text-zinc-700">
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-800">
                                {deal.stageName}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap max-w-[200px] truncate text-zinc-700">{deal.pipelineName}</td>
                            <td className="py-2.5 px-4 whitespace-nowrap max-w-[200px] truncate text-zinc-700">{deal.ownerName}</td>
                            <td className="py-2.5 px-4 whitespace-nowrap max-w-[200px] truncate text-zinc-700">
                              {new Date(deal.createdAt).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap max-w-[200px] truncate text-zinc-400 font-medium">
                              {deal.status === "Ganho" ? (
                                <span className="text-emerald-600 font-semibold">Ganho</span>
                              ) : deal.status === "Perdido" ? (
                                <span className="text-red-600 font-semibold">Perdido</span>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                 )}
               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
