import type { ReportTypeDef, ReportConfig } from "./types";
import { NEGOCIO_REPORT_TYPES } from "./negocio";
import { ATIVIDADE_REPORT_TYPES } from "./atividade";

const EM_BRANCO_GENERICO: ReportTypeDef = {
  key: "em_branco",
  label: "Em branco",
  description: "Comece do zero: escolha período, filtros, agrupamento e visualização",
  entity: "contact",
  defaultChartType: "table",
  compute: () => ({ chartData: [], records: [] }),
};

export const REPORT_TYPE_REGISTRY: Record<ReportConfig["entity"], ReportTypeDef[]> = {
  deal: NEGOCIO_REPORT_TYPES,
  activity: ATIVIDADE_REPORT_TYPES,
  contact: [{ ...EM_BRANCO_GENERICO, entity: "contact" }],
  company: [{ ...EM_BRANCO_GENERICO, entity: "company" }],
};

export function getReportType(entity: ReportConfig["entity"], key: string): ReportTypeDef | undefined {
  return REPORT_TYPE_REGISTRY[entity].find((t) => t.key === key) ?? REPORT_TYPE_REGISTRY[entity][0];
}

export const ENTITY_LABELS: Record<ReportConfig["entity"], string> = {
  deal: "Negócio",
  activity: "Atividade",
  contact: "Contato",
  company: "Empresa",
};
