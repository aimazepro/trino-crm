import type { Deal } from "@/lib/crm-types";
import type { ReportConfig, ReportFilter } from "./types";

export const FILTER_FIELDS_BY_ENTITY: Record<"deal" | "activity", { value: string; label: string; type: "select" | "date" | "number" }[]> = {
  deal: [
    { value: "Status", label: "Status", type: "select" },
    { value: "Etapa", label: "Etapa", type: "select" },
    { value: "Funil", label: "Funil", type: "select" },
    { value: "Responsavel", label: "Responsável", type: "select" },
    { value: "Valor", label: "Valor", type: "number" },
    { value: "closed_at", label: "Negócio fechado em", type: "date" },
  ],
  activity: [
    { value: "Tipo", label: "Tipo", type: "select" },
    { value: "Responsavel", label: "Responsável", type: "select" },
    { value: "Concluida", label: "Concluída", type: "select" },
  ],
};

function isDealClosed(d: Deal): boolean {
  return d.status === "Ganho" || d.status === "Perdido";
}

function dealClosedAt(d: Deal): string | undefined {
  if (!isDealClosed(d)) return undefined;
  // última entrada do histórico marca o fechamento (moveu pra Ganho/Perdido)
  return d.history[0]?.createdAt ?? d.updatedAt;
}

export function periodToRange(period: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (period === "Este mes") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
  }
  if (period === "Mes passado") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to };
  }
  if (period === "Este ano") {
    return { from: new Date(now.getFullYear(), 0, 1), to: null };
  }
  if (period === "Ultimos 7 dias") {
    return { from: new Date(now.getTime() - 7 * 86400000), to: null };
  }
  if (period === "Ultimos 30 dias") {
    return { from: new Date(now.getTime() - 30 * 86400000), to: null };
  }
  return { from: null, to: null }; // "Todo o periodo"
}

export function applyPeriodFilter(deals: Deal[], periodField: ReportConfig["periodField"], period: string): Deal[] {
  const { from, to } = periodToRange(period);
  if (!from && !to) return deals;
  return deals.filter((d) => {
    const raw = periodField === "closed_at" ? dealClosedAt(d) : d.createdAt;
    if (!raw) return false;
    const t = new Date(raw).getTime();
    if (from && t < from.getTime()) return false;
    if (to && t >= to.getTime()) return false;
    return true;
  });
}

export function applyCustomFilters(
  deals: Deal[],
  filters: ReportFilter[],
  stageNameById: Record<string, string>,
  pipelineNameById: Record<string, string>,
  ownerNameMap: Record<string, string>,
): Deal[] {
  return deals.filter((d) => {
    for (const f of filters) {
      if (!matchFilter(d, f, stageNameById, pipelineNameById, ownerNameMap)) return false;
    }
    return true;
  });
}

function matchFilter(
  d: Deal,
  f: ReportFilter,
  stageNameById: Record<string, string>,
  pipelineNameById: Record<string, string>,
  ownerNameMap: Record<string, string>,
): boolean {
  if (f.field === "Status") {
    return f.operator === "é" ? d.status === f.value : true;
  }
  if (f.field === "Etapa") {
    const stageName = stageNameById[d.stageId] ?? "";
    return f.operator === "é" ? stageName.toLowerCase() === f.value.toLowerCase() : true;
  }
  if (f.field === "Funil") {
    const pipelineName = pipelineNameById[d.pipelineId] ?? "";
    return f.operator === "é" ? pipelineName.toLowerCase() === f.value.toLowerCase() : true;
  }
  if (f.field === "Responsavel") {
    const ownerName = ownerNameMap[d.ownerId ?? ""] ?? "";
    return f.operator === "é" ? ownerName.toLowerCase() === f.value.toLowerCase() : true;
  }
  if (f.field === "Valor") {
    const num = parseFloat(f.value) || 0;
    if (f.operator === "maior que") return d.value > num;
    if (f.operator === "menor que") return d.value < num;
    if (f.operator === "igual a") return d.value === num;
    return true;
  }
  if (f.field === "closed_at") {
    const closedAt = dealClosedAt(d);
    if (f.operator === "está vazio") return !closedAt;
    if (f.operator === "não está vazio") return !!closedAt;
    return true;
  }
  return true;
}
