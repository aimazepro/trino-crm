export interface SavedReport {
  id: string;
  name: string;
  chartType: "bar" | "stacked" | "funnel" | "pie" | "table" | "number";
  color: string;
  pipeline: string;
  period: string;
  filters: { field: string; operator: string; value: string }[];
}

export const DEFAULT_REPORTS: SavedReport[] = [
  // ── Prospecção (7 reports) ──────────────────────────────────────────────────
  { id: "rep_prospec_funil", name: "Funil de Conversao", chartType: "funnel", color: "#eab308", pipeline: "Prospecção", period: "Este mes", filters: [] },
  { id: "rep_prospec_ganhos", name: "Leads Ganhos", chartType: "number", color: "#22c55e", pipeline: "Prospecção", period: "Este mes", filters: [{ field: "Status", operator: "é", value: "Ganho" }] },
  { id: "rep_prospec_reunioes", name: "Reunioes Agendadas", chartType: "bar", color: "#3b82f6", pipeline: "Prospecção", period: "Este mes", filters: [{ field: "Etapa", operator: "é", value: "Reunião Agendada" }] },
  { id: "rep_prospec_novos", name: "Novos Leads no Funil", chartType: "bar", color: "#ec4899", pipeline: "Prospecção", period: "Este mes", filters: [{ field: "Etapa", operator: "é", value: "Entrada de Leads" }] },
  { id: "rep_prospec_mix", name: "Mix de Atividades", chartType: "stacked", color: "#3b82f6", pipeline: "Prospecção", period: "Este mes", filters: [] },
  { id: "rep_prospec_ativ_resp", name: "Atividades por Responsavel", chartType: "stacked", color: "#22c55e", pipeline: "Prospecção", period: "Este mes", filters: [] },
  { id: "rep_prospec_abertos", name: "Negocios Abertos por Etapa", chartType: "bar", color: "#8b5cf6", pipeline: "Prospecção", period: "Este mes", filters: [{ field: "Status", operator: "é", value: "Ativo" }] },
  // ── Inbound (8 reports) ─────────────────────────────────────────────────────
  { id: "rep_inbound_funil", name: "Funil de Conversao", chartType: "funnel", color: "#eab308", pipeline: "Inbound", period: "Este mes", filters: [] },
  { id: "rep_inbound_ganhos", name: "Leads Ganhos", chartType: "number", color: "#22c55e", pipeline: "Inbound", period: "Este mes", filters: [{ field: "Status", operator: "é", value: "Ganho" }] },
  { id: "rep_inbound_reunioes", name: "Reunioes Agendadas", chartType: "bar", color: "#3b82f6", pipeline: "Inbound", period: "Este mes", filters: [{ field: "Etapa", operator: "é", value: "Reunião Agendada" }] },
  { id: "rep_inbound_qualificados", name: "Leads Qualificados", chartType: "bar", color: "#a855f7", pipeline: "Inbound", period: "Este mes", filters: [{ field: "Etapa", operator: "é", value: "Qualificado pelo formulário" }] },
  { id: "rep_inbound_formulario", name: "Leads em Formulario", chartType: "bar", color: "#f97316", pipeline: "Inbound", period: "Este mes", filters: [{ field: "Etapa", operator: "é", value: "Formulário Preenchido" }] },
  { id: "rep_inbound_mix", name: "Mix de Atividades", chartType: "stacked", color: "#3b82f6", pipeline: "Inbound", period: "Este mes", filters: [] },
  { id: "rep_inbound_ativ_resp", name: "Atividades por Responsavel", chartType: "stacked", color: "#22c55e", pipeline: "Inbound", period: "Este mes", filters: [] },
  { id: "rep_inbound_abertos", name: "Negocios Abertos por Etapa", chartType: "bar", color: "#8b5cf6", pipeline: "Inbound", period: "Este mes", filters: [{ field: "Status", operator: "é", value: "Ativo" }] },
  // ── Social Selling (5 reports) ──────────────────────────────────────────────
  { id: "rep_social_funil", name: "Funil de Conversao", chartType: "funnel", color: "#eab308", pipeline: "Social Selling", period: "Este mes", filters: [] },
  { id: "rep_social_ganhos", name: "Leads Ganhos", chartType: "number", color: "#22c55e", pipeline: "Social Selling", period: "Este mes", filters: [{ field: "Status", operator: "é", value: "Ganho" }] },
  { id: "rep_social_reunioes", name: "Reunioes Agendadas", chartType: "bar", color: "#3b82f6", pipeline: "Social Selling", period: "Este mes", filters: [{ field: "Etapa", operator: "é", value: "Reunião Agendada" }] },
  { id: "rep_social_contatos", name: "Contatos Realizados com Decisor", chartType: "bar", color: "#ec4899", pipeline: "Social Selling", period: "Este mes", filters: [{ field: "Etapa", operator: "é", value: "Conversa Significativa" }] },
  { id: "rep_social_novos", name: "Novos Leads no Funil", chartType: "bar", color: "#06b6d4", pipeline: "Social Selling", period: "Este mes", filters: [{ field: "Etapa", operator: "é", value: "MQL Cadastrado" }] },
];

export const COLORS = [
  { name: "Pink", value: "#ec4899" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Emerald", value: "#22c55e" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Red", value: "#ef4444" },
];
