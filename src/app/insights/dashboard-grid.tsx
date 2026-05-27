"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Plus, Sparkles, Pencil, Maximize2, GripVertical, Settings } from "lucide-react";

interface DashboardGridProps {
  dashboardPopulated: boolean;
  onCreateDefaultReports: () => void;
  onCreateReportZero: () => void;
  onSelectByNameAndPipeline: (name: string, pipeline: string) => void;
  cardStats: { leads: number; decisor: number; reunioes: number; ganhos: number };
  funnelChartData: { name: string; value: number }[];
  openStageChartData: { name: string; value: number }[];
  activityOwnerChartData: Record<string, string | number>[];
  mixActivityChartData: Record<string, string | number>[];
}

export function DashboardGrid({
  dashboardPopulated,
  onCreateDefaultReports,
  onCreateReportZero,
  onSelectByNameAndPipeline,
  cardStats,
  funnelChartData,
  openStageChartData,
  activityOwnerChartData,
  mixActivityChartData,
}: DashboardGridProps) {
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
              onClick={onCreateDefaultReports}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              Criar relatorios padrao
            </button>
            <button
              onClick={onCreateReportZero}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Criar relatorio do zero
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-[calc(100vh-120px)] transition-colors">
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Prospeccao</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div onClick={() => onSelectByNameAndPipeline("Novos Leads no Funil", "Prospecção")} className="rounded-xl border border-zinc-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-sm font-semibold text-zinc-800 mb-1">Novos Leads no Funil</div>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">ENTRADA DE LEADS</div>
            <div className="text-3xl font-bold text-zinc-900">{cardStats.leads}</div>
            <div className="text-xs text-zinc-400 mt-0.5">no periodo</div>
          </div>
          <div onClick={() => onSelectByNameAndPipeline("Contatos Realizados com Decisor", "Social Selling")} className="rounded-xl border border-zinc-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-sm font-semibold text-zinc-800 mb-1">Contatos Realizados com Decisor</div>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">CONTATO REALIZADO COM O DECISOR</div>
            <div className="text-3xl font-bold text-zinc-900">{cardStats.decisor}</div>
            <div className="text-xs text-zinc-400 mt-0.5">no periodo</div>
          </div>
          <div onClick={() => onSelectByNameAndPipeline("Reunioes Agendadas", "Prospecção")} className="rounded-xl border border-zinc-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-sm font-semibold text-zinc-800 mb-1">Reunioes Agendadas</div>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">REUNIÃO AGENDADA</div>
            <div className="text-3xl font-bold text-zinc-900">{cardStats.reunioes}</div>
            <div className="text-xs text-zinc-400 mt-0.5">no periodo</div>
          </div>
          <div onClick={() => onSelectByNameAndPipeline("Leads Ganhos", "Prospecção")} className="rounded-xl border border-zinc-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-sm font-semibold text-zinc-800 mb-1">Leads Ganhos</div>
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">GANHOS</div>
            <div className="text-3xl font-bold text-zinc-900">{cardStats.ganhos}</div>
            <div className="text-xs text-zinc-400 mt-0.5">no periodo</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div onClick={() => onSelectByNameAndPipeline("Funil de Conversao", "Prospecção")} className="group rounded-xl border border-zinc-200 bg-white overflow-hidden cursor-pointer hover:shadow-md transition-all">
            <div className="h-1 bg-[#f59e0b]"></div>
            <div className="flex items-center gap-1 px-3 pt-2 pb-1">
              <h3 className="text-sm font-semibold text-zinc-800 truncate flex-1">Funil de Conversao</h3>
              <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                <button className="p-1.5 rounded hover:bg-violet-50 text-zinc-400 hover:text-violet-600 transition-colors" title="Analisar com IA"><Sparkles className="h-3.5 w-3.5" /></button>
                <button onClick={() => onSelectByNameAndPipeline("Funil de Conversao", "Prospecção")} className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-blue-600 transition-colors" title="Editar relatorio"><Pencil className="h-3.5 w-3.5" /></button>
                <button className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="Expandir"><Maximize2 className="h-3.5 w-3.5" /></button>
                <button role="button" className="p-1.5 rounded cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors" title="Arrastar para reordenar"><GripVertical className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-semibold">NEGOCIOS</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">PROSPECCAO</span>
            </div>
            <div className="px-4 pb-4 overflow-hidden">
              <div style={{ width: "100%", height: "240px" }}>
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

          <div onClick={() => onSelectByNameAndPipeline("Negocios Abertos por Etapa", "Prospecção")} className="group rounded-xl border border-zinc-200 bg-white overflow-hidden cursor-pointer hover:shadow-md transition-all">
            <div className="h-1 bg-[#f59e0b]"></div>
            <div className="flex items-center gap-1 px-3 pt-2 pb-1">
              <h3 className="text-sm font-semibold text-zinc-800 truncate flex-1">Negocios Abertos por Etapa</h3>
              <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                <button className="p-1.5 rounded hover:bg-violet-50 text-zinc-400 hover:text-violet-600 transition-colors" title="Analisar com IA"><Sparkles className="h-3.5 w-3.5" /></button>
                <button onClick={() => onSelectByNameAndPipeline("Negocios Abertos por Etapa", "Prospecção")} className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-blue-600 transition-colors" title="Editar relatorio"><Pencil className="h-3.5 w-3.5" /></button>
                <button className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="Expandir"><Maximize2 className="h-3.5 w-3.5" /></button>
                <button role="button" className="p-1.5 rounded cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors" title="Arrastar para reordenar"><GripVertical className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-semibold">NEGOCIOS</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">PROSPECCAO</span>
            </div>
            <div className="px-4 pb-4 overflow-hidden">
              <div style={{ width: "100%", height: "260px" }}>
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

          <div onClick={() => onSelectByNameAndPipeline("Atividades por Responsavel", "Prospecção")} className="group rounded-xl border border-zinc-200 bg-white overflow-hidden cursor-pointer hover:shadow-md transition-all">
            <div className="h-1 bg-[#22c55e]"></div>
            <div className="flex items-center gap-1 px-3 pt-2 pb-1">
              <h3 className="text-sm font-semibold text-zinc-800 truncate flex-1">Atividades por Responsavel</h3>
              <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                <button className="p-1.5 rounded hover:bg-violet-50 text-zinc-400 hover:text-violet-600 transition-colors" title="Analisar com IA"><Sparkles className="h-3.5 w-3.5" /></button>
                <button onClick={() => onSelectByNameAndPipeline("Atividades por Responsavel", "Prospecção")} className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-blue-600 transition-colors" title="Editar relatorio"><Pencil className="h-3.5 w-3.5" /></button>
                <button className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="Expandir"><Maximize2 className="h-3.5 w-3.5" /></button>
                <button role="button" className="p-1.5 rounded cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors" title="Arrastar para reordenar"><GripVertical className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-semibold">ATIVIDADES</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">PROSPECCAO</span>
            </div>
            <div className="px-4 pb-4 overflow-hidden">
              <div style={{ width: "100%", height: "240px" }}>
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

          <div onClick={() => onSelectByNameAndPipeline("Mix de Atividades", "Prospecção")} className="group rounded-xl border border-zinc-200 bg-white overflow-hidden cursor-pointer hover:shadow-md transition-all">
            <div className="h-1 bg-[#3b82f6]"></div>
            <div className="flex items-center gap-1 px-3 pt-2 pb-1">
              <h3 className="text-sm font-semibold text-zinc-800 truncate flex-1">Mix de Atividades</h3>
              <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                <button className="p-1.5 rounded hover:bg-violet-50 text-zinc-400 hover:text-violet-600 transition-colors" title="Analisar com IA"><Sparkles className="h-3.5 w-3.5" /></button>
                <button onClick={() => onSelectByNameAndPipeline("Mix de Atividades", "Prospecção")} className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-blue-600 transition-colors" title="Editar relatorio"><Pencil className="h-3.5 w-3.5" /></button>
                <button className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="Expandir"><Maximize2 className="h-3.5 w-3.5" /></button>
                <button role="button" className="p-1.5 rounded cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors" title="Arrastar para reordenar"><GripVertical className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-semibold">ATIVIDADES</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">PROSPECCAO</span>
            </div>
            <div className="px-4 pb-4 overflow-hidden">
              <div style={{ width: "100%", height: "240px" }}>
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
}
