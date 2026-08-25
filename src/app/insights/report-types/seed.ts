import type { Pipeline } from "@/lib/crm-types";
import type { SavedReport } from "../insights-constants";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `rep_${Date.now()}_${counter}`;
}

function base(overrides: Partial<SavedReport> & { name: string }): SavedReport {
  return {
    id: nextId(),
    entity: "deal",
    reportType: "em_branco",
    chartType: "bar",
    color: "#3b82f6",
    pipeline: "",
    period: "Este mes",
    periodField: "created_at",
    filters: [],
    ...overrides,
  };
}

export function buildDefaultReports(pipelines: Pipeline[]): SavedReport[] {
  const reports: SavedReport[] = [];

  // 5 relatórios globais, sem filtro de funil
  reports.push(base({ name: "Ganhos vs Perdidos", reportType: "ganho_perda", chartType: "pie", color: "#ec4899", groupBy: "status" }));
  reports.push(base({ name: "Receita Mensal", reportType: "em_branco", chartType: "bar", color: "#3b82f6", period: "Este ano", periodField: "closed_at", measureBy: "value", groupBy: "closed_at", groupByGranularity: "month", filters: [{ field: "Status", operator: "é", value: "Ganho" }] }));
  reports.push(base({ name: "Negocios Criados por Dia", reportType: "em_branco", chartType: "bar", color: "#8b5cf6", groupBy: "created_at", groupByGranularity: "day" }));
  reports.push(base({ name: "Receita por Responsavel", reportType: "em_branco", chartType: "bar", color: "#22c55e", measureBy: "value", groupBy: "responsavel", filters: [{ field: "Status", operator: "é", value: "Ganho" }] }));
  reports.push(base({ name: "Negocios por Responsavel", reportType: "em_branco", chartType: "bar", color: "#f97316", groupBy: "responsavel" }));

  // por pipeline: 5 de Negócio + 2 de Atividade
  pipelines.forEach((p) => {
    reports.push(base({ name: "Funil de Conversao", reportType: "funil_conversao", chartType: "funnel", color: "#eab308", pipeline: p.name }));
    reports.push(base({ name: "Leads Ganhos", reportType: "em_branco", chartType: "number", color: "#22c55e", pipeline: p.name, filters: [{ field: "Status", operator: "é", value: "Ganho" }] }));
    reports.push(base({ name: "Reunioes Agendadas", reportType: "em_branco", chartType: "bar", color: "#3b82f6", pipeline: p.name, filters: [{ field: "Etapa", operator: "é", value: p.stages.find((s) => s.name.toLowerCase().includes("reuni"))?.name ?? "Reunião Agendada" }] }));
    reports.push(base({ name: "Novos Leads no Funil", reportType: "em_branco", chartType: "bar", color: "#ec4899", pipeline: p.name, filters: [{ field: "Etapa", operator: "é", value: p.stages[0]?.name ?? "Entrada de Leads" }] }));
    reports.push(base({ name: "Negocios Abertos por Etapa", reportType: "em_branco", chartType: "bar", color: "#8b5cf6", pipeline: p.name, groupBy: "etapa", periodField: "closed_at", filters: [{ field: "closed_at", operator: "está vazio", value: "" }] }));
    reports.push(base({ name: "Mix de Atividades", reportType: "mix_atividades", entity: "activity", chartType: "stacked", color: "#3b82f6", pipeline: p.name }));
    reports.push(base({ name: "Atividades por Responsavel", reportType: "atividades_por_responsavel", entity: "activity", chartType: "stacked", color: "#22c55e", pipeline: p.name }));
  });

  return reports;
}
