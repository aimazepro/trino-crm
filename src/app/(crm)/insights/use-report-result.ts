"use client";

import { useMemo } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { getReportType } from "./report-types/registry";
import { applyPeriodFilter, applyCustomFilters } from "./report-types/filters";
import type { SavedReport } from "./insights-constants";
import type { ReportComputeResult } from "./report-types/types";

export interface ReportOverrides {
  /** Período escolhido no cabeçalho do painel — vence o período do relatório. */
  period?: string;
  /** Nome do responsável; null/undefined = todos. */
  ownerName?: string | null;
}

export const ALL_USERS = "Todos os usuarios";

/** Roda o mesmo pipeline do viewer (filtros → calculadora) pra um relatório salvo. */
export function useReportResult(report: SavedReport | null, overrides?: ReportOverrides): ReportComputeResult | null {
  const { state } = useCrm();
  const { map: ownerNameMap } = useOwnerNameMap();
  const period = overrides?.period;
  const ownerName = overrides?.ownerName;

  return useMemo(() => {
    if (!report) return null;
    const pipelineNameById: Record<string, string> = {};
    state.pipelines.forEach((p) => { pipelineNameById[p.id] = p.name; });
    const stageNameById: Record<string, string> = {};
    state.pipelines.forEach((p) => p.stages.forEach((s) => { stageNameById[s.id] = s.name; }));

    const pipeline = report.pipeline ? state.pipelines.find((p) => p.name === report.pipeline) ?? null : null;
    let deals = report.pipeline ? state.deals.filter((d) => pipelineNameById[d.pipelineId] === report.pipeline) : state.deals;

    // Filtro de responsável do cabeçalho: corta os negócios e também as
    // atividades de cada negócio (relatórios de Atividade agrupam por
    // assignee, então filtrar só o negócio deixaria atividade de terceiro).
    if (ownerName && ownerName !== ALL_USERS) {
      deals = deals
        .filter((d) => (ownerNameMap[d.ownerId ?? ""] ?? "Sem dono") === ownerName)
        .map((d) => ({
          ...d,
          activities: d.activities.filter((a) => (ownerNameMap[a.assigneeId ?? ""] ?? "Sem responsável") === ownerName),
        }));
    }

    deals = applyPeriodFilter(deals, report.periodField, period || report.period);
    deals = applyCustomFilters(deals, report.filters, stageNameById, pipelineNameById, ownerNameMap);

    const def = getReportType(report.entity, report.reportType);
    if (!def) return null;
    return def.compute({ deals, pipeline, pipelines: state.pipelines, ownerNameMap, config: report });
  }, [report, state.deals, state.pipelines, ownerNameMap, period, ownerName]);
}
