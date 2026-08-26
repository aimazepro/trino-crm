"use client";

import { useMemo } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { getReportType } from "./report-types/registry";
import { applyPeriodFilter, applyCustomFilters } from "./report-types/filters";
import type { SavedReport } from "./insights-constants";
import type { ReportComputeResult } from "./report-types/types";

/** Roda o mesmo pipeline do viewer (filtros → calculadora) pra um relatório salvo. */
export function useReportResult(report: SavedReport | null): ReportComputeResult | null {
  const { state } = useCrm();
  const { map: ownerNameMap } = useOwnerNameMap();
  return useMemo(() => {
    if (!report) return null;
    const pipelineNameById: Record<string, string> = {};
    state.pipelines.forEach((p) => { pipelineNameById[p.id] = p.name; });
    const stageNameById: Record<string, string> = {};
    state.pipelines.forEach((p) => p.stages.forEach((s) => { stageNameById[s.id] = s.name; }));

    const pipeline = report.pipeline ? state.pipelines.find((p) => p.name === report.pipeline) ?? null : null;
    let deals = report.pipeline ? state.deals.filter((d) => pipelineNameById[d.pipelineId] === report.pipeline) : state.deals;
    deals = applyPeriodFilter(deals, report.periodField, report.period);
    deals = applyCustomFilters(deals, report.filters, stageNameById, pipelineNameById, ownerNameMap);

    const def = getReportType(report.entity, report.reportType);
    if (!def) return null;
    return def.compute({ deals, pipeline, pipelines: state.pipelines, ownerNameMap, config: report });
  }, [report, state.deals, state.pipelines, ownerNameMap]);
}
