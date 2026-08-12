"use client";

import { useState, useMemo } from "react";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Timer,
  Users,
  Clock,
  CalendarDays,
  Flame,
  Play,
  Pause,
  Sparkles,
  Plus,
  Volume2,
  CheckCircle2,
  XCircle,
  Clock3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface CallRecord {
  id: string;
  vendedor: string;
  telefone: string;
  contactName?: string;
  status: "Atendida" | "Não atendida" | "Ocupado";
  durationSeconds: number;
  timestamp: string; // ISO format or date string
  recordingUrl?: string;
}

const SAMPLE_CALLS: CallRecord[] = [
  {
    id: "call-1",
    vendedor: "João Paulo",
    telefone: "(11) 98765-4321",
    contactName: "Acme Corp (Carlos)",
    status: "Atendida",
    durationSeconds: 245,
    timestamp: "2026-08-12T14:32:00Z",
    recordingUrl: "sample.mp3",
  },
  {
    id: "call-2",
    vendedor: "Ana Silva",
    telefone: "(21) 99876-1234",
    contactName: "Tech Solutions",
    status: "Atendida",
    durationSeconds: 180,
    timestamp: "2026-08-12T11:15:00Z",
    recordingUrl: "sample.mp3",
  },
  {
    id: "call-3",
    vendedor: "João Paulo",
    telefone: "(31) 97654-8899",
    contactName: "Mariana Costa",
    status: "Não atendida",
    durationSeconds: 0,
    timestamp: "2026-08-12T10:05:00Z",
  },
  {
    id: "call-4",
    vendedor: "Carlos Eduardo",
    telefone: "(41) 98822-3344",
    contactName: "Logística Brasil",
    status: "Atendida",
    durationSeconds: 412,
    timestamp: "2026-08-11T16:45:00Z",
    recordingUrl: "sample.mp3",
  },
  {
    id: "call-5",
    vendedor: "Ana Silva",
    telefone: "(11) 97111-2233",
    contactName: "Grupo Vanguarda",
    status: "Não atendida",
    durationSeconds: 0,
    timestamp: "2026-08-11T15:20:00Z",
  },
  {
    id: "call-6",
    vendedor: "João Paulo",
    telefone: "(19) 99333-4455",
    contactName: "Fernanda Lima",
    status: "Atendida",
    durationSeconds: 135,
    timestamp: "2026-08-10T14:10:00Z",
    recordingUrl: "sample.mp3",
  },
  {
    id: "call-7",
    vendedor: "Carlos Eduardo",
    telefone: "(51) 98444-5566",
    contactName: "Sul Inovação",
    status: "Ocupado",
    durationSeconds: 0,
    timestamp: "2026-08-10T09:30:00Z",
  },
  {
    id: "call-8",
    vendedor: "Ana Silva",
    telefone: "(81) 99555-6677",
    contactName: "Nordeste Tech",
    status: "Atendida",
    durationSeconds: 310,
    timestamp: "2026-08-09T17:00:00Z",
    recordingUrl: "sample.mp3",
  },
];

export default function LigacoesPage() {
  const { names: sellerNames } = useOwnerNameMap();
  const [sellerFilter, setSellerFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"Hoje" | "7 dias" | "30 dias" | "90 dias">("30 dias");
  const [useDemoData, setUseDemoData] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Calls dataset (either sample or empty based on state)
  const allCalls: CallRecord[] = useMemo(() => {
    return useDemoData ? SAMPLE_CALLS : [];
  }, [useDemoData]);

  // Filtered calls
  const filteredCalls = useMemo(() => {
    return allCalls.filter((c) => {
      if (sellerFilter && c.vendedor !== sellerFilter) return false;
      return true;
    });
  }, [allCalls, sellerFilter]);

  // Derived KPI Stats
  const stats = useMemo(() => {
    const total = filteredCalls.length;
    const answeredCalls = filteredCalls.filter((c) => c.status === "Atendida");
    const missedCalls = filteredCalls.filter((c) => c.status === "Não atendida" || c.status === "Ocupado");

    const answered = answeredCalls.length;
    const missed = missedCalls.length;

    const answeredPercent = total > 0 ? Math.round((answered / total) * 100) : 0;
    const missedPercent = total > 0 ? Math.round((missed / total) * 100) : 100;

    const daysCount = periodFilter === "Hoje" ? 1 : periodFilter === "7 dias" ? 7 : periodFilter === "30 dias" ? 30 : 90;
    const perDay = total > 0 ? (total / daysCount).toFixed(1) : "0";

    const totalSeconds = answeredCalls.reduce((acc, c) => acc + c.durationSeconds, 0);
    const totalMinutes = Math.round(totalSeconds / 60);
    const avgSeconds = answered > 0 ? Math.round(totalSeconds / answered) : 0;
    const avgMin = Math.floor(avgSeconds / 60);
    const avgSecRem = avgSeconds % 60;
    const avgDurationFormatted = `${avgMin}:${avgSecRem.toString().padStart(2, "0")}`;

    const uniqueContacts = new Set(filteredCalls.map((c) => c.telefone)).size;

    // Hourly peak & busiest day
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<string, number> = { Dom: 0, Seg: 0, Ter: 0, Qua: 0, Qui: 0, Sex: 0, Sab: 0 };
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

    filteredCalls.forEach((c) => {
      const d = new Date(c.timestamp);
      const h = d.getHours();
      const dayName = dayNames[d.getDay()];
      hourCounts[h] = (hourCounts[h] || 0) + 1;
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
    });

    let maxH = 0;
    let maxHCount = 0;
    Object.entries(hourCounts).forEach(([h, count]) => {
      if (count > maxHCount) {
        maxHCount = count;
        maxH = Number(h);
      }
    });

    let maxDay = "Dom";
    let maxDayCount = -1;
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        maxDay = day;
      }
    });

    return {
      total,
      perDay,
      answered,
      answeredPercent,
      missed,
      missedPercent,
      avgDurationFormatted,
      uniqueContacts,
      peakHour: maxH,
      busiestDay: maxDay,
      totalMinutes,
    };
  }, [filteredCalls, periodFilter]);

  // Heatmap Data (24 hours x 7 days)
  const { heatmapData, maxHeatmapVal } = useMemo(() => {
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let maxVal = 0;

    filteredCalls.forEach((c) => {
      const d = new Date(c.timestamp);
      const dayIdx = d.getDay();
      const h = d.getHours();
      grid[dayIdx][h] += 1;
      if (grid[dayIdx][h] > maxVal) {
        maxVal = grid[dayIdx][h];
      }
    });

    return { heatmapData: grid, maxHeatmapVal: maxVal, dayNames };
  }, [filteredCalls]);

  // Chart 1: Hourly Distribution (0h-23h)
  const hourlyDistributionData = useMemo(() => {
    const counts = Array(24).fill(0);
    filteredCalls.forEach((c) => {
      const h = new Date(c.timestamp).getHours();
      counts[h] += 1;
    });
    return counts.map((count, hour) => ({
      hour: `${hour}h`,
      count,
    }));
  }, [filteredCalls]);

  // Chart 2: Volume de Chamadas (Over time)
  const volumeChartData = useMemo(() => {
    if (filteredCalls.length === 0) return [];
    const dateMap: Record<string, number> = {};
    filteredCalls.forEach((c) => {
      const dStr = new Date(c.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      dateMap[dStr] = (dateMap[dStr] || 0) + 1;
    });
    return Object.entries(dateMap).map(([label, volume]) => ({ label, volume }));
  }, [filteredCalls]);

  // Chart 3: Status distribution
  const statusChartData = useMemo(() => {
    if (filteredCalls.length === 0) return [];
    const answered = filteredCalls.filter((c) => c.status === "Atendida").length;
    const missed = filteredCalls.filter((c) => c.status === "Não atendida").length;
    const busy = filteredCalls.filter((c) => c.status === "Ocupado").length;
    return [
      { name: "Atendidas", value: answered, color: "#22c55e" },
      { name: "Não atendidas", value: missed, color: "#ef4444" },
      { name: "Ocupado", value: busy, color: "#f97316" },
    ].filter((item) => item.value > 0);
  }, [filteredCalls]);

  // Chart 4: Seller Performance
  const sellerPerformanceData = useMemo(() => {
    if (filteredCalls.length === 0) return [];
    const sellersMap: Record<string, { atendidas: number; naoAtendidas: number }> = {};
    filteredCalls.forEach((c) => {
      if (!sellersMap[c.vendedor]) {
        sellersMap[c.vendedor] = { atendidas: 0, naoAtendidas: 0 };
      }
      if (c.status === "Atendida") sellersMap[c.vendedor].atendidas += 1;
      else sellersMap[c.vendedor].naoAtendidas += 1;
    });
    return Object.entries(sellersMap).map(([name, data]) => ({
      name,
      atendidas: data.atendidas,
      naoAtendidas: data.naoAtendidas,
    }));
  }, [filteredCalls]);

  // Toggle playback simulation
  const togglePlay = (id: string) => {
    setPlayingId(playingId === id ? null : id);
  };

  // Helper format seconds
  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#F4F4F5]">
      <div className="p-6 max-w-[1440px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
            <p className="text-sm text-zinc-400">Visualize e analise suas chamadas</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setUseDemoData((prev) => !prev)}
              className={cn(
                "h-9 px-3 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm",
                useDemoData
                  ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
              )}
              title="Alternar entre estado limpo e dados de teste"
            >
              <Sparkles className={cn("h-3.5 w-3.5", useDemoData ? "text-white fill-white" : "text-amber-500")} />
              {useDemoData ? "Dados de Exemplo (Ativos)" : "Modo Exemplo"}
            </button>
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="">Todos</option>
              {sellerNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <div className="flex h-9 rounded-lg border border-zinc-200 overflow-hidden bg-white">
              {(["Hoje", "7 dias", "30 dias", "90 dias"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setPeriodFilter(period)}
                  className={cn(
                    "px-3.5 text-xs font-medium transition-colors cursor-pointer",
                    periodFilter === period
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-500 hover:bg-zinc-50"
                  )}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 1 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Chamadas */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 flex flex-col items-center text-center shadow-sm hover:shadow transition-shadow">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 bg-blue-50 text-blue-500">
              <Phone className="h-4 w-4" />
            </div>
            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Total Chamadas</p>
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">{stats.total}</p>
            <p className="text-xs text-zinc-500 mt-1">{stats.perDay} chamadas/dia</p>
          </div>

          {/* Atendidas */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 flex flex-col items-center text-center shadow-sm hover:shadow transition-shadow">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 bg-green-50 text-green-500">
              <PhoneCall className="h-4 w-4" />
            </div>
            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Atendidas</p>
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">{stats.answered}</p>
            <p className="text-xs text-zinc-500 mt-1">{stats.answeredPercent}% do total</p>
          </div>

          {/* Não atendidas */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 flex flex-col items-center text-center shadow-sm hover:shadow transition-shadow">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 bg-red-50 text-red-500">
              <PhoneOff className="h-4 w-4" />
            </div>
            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Não atendidas</p>
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">{stats.missed}</p>
            <p className="text-xs text-zinc-500 mt-1">{stats.missedPercent}% do total</p>
          </div>

          {/* Duração média */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 flex flex-col items-center text-center shadow-sm hover:shadow transition-shadow">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 bg-zinc-100 text-zinc-500">
              <Timer className="h-4 w-4" />
            </div>
            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Duração média</p>
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">{stats.avgDurationFormatted}</p>
            <p className="text-xs text-zinc-500 mt-1">Tempo médio por chamada</p>
          </div>
        </div>

        {/* Row 2 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Contatos únicos */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 flex flex-col items-center text-center shadow-sm hover:shadow transition-shadow">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 bg-purple-50 text-purple-500">
              <Users className="h-4 w-4" />
            </div>
            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Contatos únicos</p>
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">{stats.uniqueContacts}</p>
            <p className="text-xs text-zinc-500 mt-1">Números diferentes</p>
          </div>

          {/* Hora pico */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 flex flex-col items-center text-center shadow-sm hover:shadow transition-shadow">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 bg-amber-50 text-amber-500">
              <Clock className="h-4 w-4" />
            </div>
            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Hora pico</p>
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">{stats.peakHour}h</p>
            <p className="text-xs text-zinc-500 mt-1">Horário com maior volume</p>
          </div>

          {/* Dia mais movimentado */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 flex flex-col items-center text-center shadow-sm hover:shadow transition-shadow">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 bg-amber-50 text-amber-500">
              <CalendarDays className="h-4 w-4" />
            </div>
            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Dia mais movimentado</p>
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">{stats.busiestDay}</p>
            <p className="text-xs text-zinc-500 mt-1">Dia da semana</p>
          </div>

          {/* Minutos totais */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 flex flex-col items-center text-center shadow-sm hover:shadow transition-shadow">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 bg-orange-50 text-orange-500">
              <Flame className="h-4 w-4" />
            </div>
            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Minutos totais</p>
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">{stats.totalMinutes}</p>
            <p className="text-xs text-zinc-500 mt-1">{stats.answered} chamadas atendidas</p>
          </div>
        </div>

        {/* Section 3: Volume & Status Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Volume de Chamadas */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-800 mb-4">Volume de Chamadas</p>
            {filteredCalls.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-zinc-300 text-sm">
                Sem dados no período
              </div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gVol" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="volume" name="Chamadas" stroke="#3b82f6" fill="url(#gVol)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Status das Chamadas */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-800 mb-1">Status das Chamadas</p>
            <p className="text-xs text-zinc-400 mb-4">Distribuição de chamadas por status</p>
            {filteredCalls.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-zinc-300 text-sm">
                Sem dados
              </div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                    >
                      {statusChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Performance & Heatmap Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Performance por vendedor */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-800 mb-4">Performance por vendedor</p>
            {filteredCalls.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-zinc-300 text-sm">
                Sem dados
              </div>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sellerPerformanceData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#71717a" }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#71717a" }} width={90} />
                    <Tooltip />
                    <Bar dataKey="atendidas" name="Atendidas" fill="#22c55e" radius={[0, 4, 4, 0]} stackId="a" />
                    <Bar dataKey="naoAtendidas" name="Não atendidas" fill="#ef4444" radius={[0, 4, 4, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Mapa de Calor por Horário */}
          <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-800 mb-1">Mapa de Calor por Horário</p>
            <p className="text-xs text-zinc-400 mb-4">Distribuição de chamadas por hora e dia da semana</p>

            <div className="overflow-x-auto">
              <div className="flex ml-10 mb-1">
                {Array.from({ length: 24 }).map((_, hour) => (
                  <div key={hour} className="w-6 text-center text-[9px] text-zinc-400 shrink-0">
                    {hour}h
                  </div>
                ))}
              </div>

              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day, dayIdx) => (
                <div key={day} className="flex items-center mb-0.5">
                  <span className="w-10 text-[11px] text-zinc-500 shrink-0">{day}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const count = heatmapData[dayIdx]?.[hour] || 0;
                      const maxVal = Math.max(1, maxHeatmapVal);
                      const intensity = count / maxVal;
                      let bg = "rgb(244, 244, 245)"; // default bg-zinc-100
                      if (count > 0) {
                        if (intensity > 0.75) bg = "rgb(234, 88, 12)";
                        else if (intensity > 0.5) bg = "rgb(249, 115, 22)";
                        else if (intensity > 0.25) bg = "rgb(253, 186, 116)";
                        else bg = "rgb(255, 237, 213)";
                      }
                      return (
                        <div
                          key={hour}
                          className="w-5 h-5 rounded-sm transition-colors cursor-pointer hover:ring-1 hover:ring-orange-400"
                          title={`${day} ${hour}h: ${count} chamadas`}
                          style={{ backgroundColor: bg }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 5: Distribuição por horário (Bar Chart) */}
        <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-zinc-800 mb-4">Distribuição por horário</p>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyDistributionData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gHour" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#fb923c" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#a1a1aa" }} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="count" name="Chamadas" fill="url(#gHour)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section 6: Table (Histórico de ligações) */}
        <div className="rounded-xl border border-zinc-100 bg-white overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-800">Histórico de ligações</p>
            <span className="text-[11px] text-zinc-400">{filteredCalls.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-50 bg-zinc-50/50">
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    Vendedor
                  </th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    Duração
                  </th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    Gravação
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-zinc-50">
                {filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-zinc-300 text-sm">
                      Nenhuma ligação no período
                    </td>
                  </tr>
                ) : (
                  filteredCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-5 py-3 font-medium text-zinc-800 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-zinc-200 text-zinc-600 font-semibold text-[10px] flex items-center justify-center">
                          {call.vendedor.charAt(0)}
                        </div>
                        {call.vendedor}
                      </td>
                      <td className="px-5 py-3 text-zinc-600">
                        {call.telefone}
                        {call.contactName && (
                          <span className="block text-[11px] text-zinc-400">{call.contactName}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {call.status === "Atendida" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="h-3 w-3" />
                            Atendida
                          </span>
                        ) : call.status === "Não atendida" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                            <XCircle className="h-3 w-3" />
                            Não atendida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                            <Clock3 className="h-3 w-3" />
                            Ocupado
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-zinc-600 font-mono text-xs">
                        {formatDuration(call.durationSeconds)}
                      </td>
                      <td className="px-5 py-3 text-zinc-500 text-xs">
                        {new Date(call.timestamp).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3">
                        {call.recordingUrl ? (
                          <button
                            onClick={() => togglePlay(call.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                          >
                            {playingId === call.id ? (
                              <>
                                <Pause className="h-3 w-3 text-amber-600 fill-amber-600" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3 text-emerald-600 fill-emerald-600" />
                                Ouvir
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
