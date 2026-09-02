import type { Deal } from "@/lib/crm-types";

export interface ReportFilter {
  field: string;
  operator: string; // "é" | "está vazio" | "não está vazio" | "maior que" | "menor que" | "igual a"
  value: string;
}

export interface ReportConfig {
  entity: "deal" | "activity" | "contact" | "company";
  reportType: string;
  chartType: "bar" | "stacked" | "funnel" | "pie" | "table" | "number";
  color: string;
  pipeline: string; // "" = todos os funis
  period: string;
  periodField: "created_at" | "closed_at";
  filters: ReportFilter[];
  measureBy?: "count" | "value";
  groupBy?: string; // "etapa" | "responsavel" | "status" | "created_at" | "closed_at" | "none" | "loss_reason"
  groupByGranularity?: "day" | "week" | "month";
  excludeStage?: string;
}

export interface ChartDatum {
  name: string;
  value: number;
  amount?: number;
  [seriesKey: string]: string | number | undefined;
}

export interface ReportRecord {
  id: string;
  title: string;
  value: number;
  stageName: string;
  pipelineName: string;
  ownerName: string;
  createdAt: string;
  status: string;
}

export interface ReportComputeArgs {
  deals: Deal[]; // já filtrados por período + filtros custom
  pipeline: import("@/lib/crm-types").Pipeline | null; // pipeline resolvido de config.pipeline, ou null = todos
  pipelines: import("@/lib/crm-types").Pipeline[];
  ownerNameMap: Record<string, string>;
  config: ReportConfig;
}

export interface ReportComputeResult {
  chartData: ChartDatum[];
  records: ReportRecord[];
  extraMetric?: { label: string; value: string };
}

export type ReportTypeCalculator = (args: ReportComputeArgs) => ReportComputeResult;

export interface ReportTypeDef {
  key: string;
  label: string;
  description: string;
  entity: "deal" | "activity" | "contact" | "company";
  defaultChartType: ReportConfig["chartType"];
  defaultGroupBy?: string;
  compute: ReportTypeCalculator;
}

export function dealToRecord(d: Deal, stageName: string, pipelineName: string, ownerName: string): ReportRecord {
  return {
    id: d.id,
    title: d.title,
    value: d.value,
    stageName,
    pipelineName,
    ownerName,
    createdAt: d.createdAt || new Date().toISOString(),
    status: d.status,
  };
}
