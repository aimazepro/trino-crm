"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import type { SavedReport } from "@/app/insights/insights-constants";
import type { Json } from "@/lib/supabase/database.types";

function toConfig(r: SavedReport): Json {
  return {
    entity: r.entity,
    reportType: r.reportType,
    chartType: r.chartType,
    color: r.color,
    pipeline: r.pipeline,
    period: r.period,
    periodField: r.periodField,
    filters: r.filters,
    measureBy: r.measureBy,
    groupBy: r.groupBy,
    groupByGranularity: r.groupByGranularity,
    excludeStage: r.excludeStage,
  } as unknown as Json;
}

function fromRow(row: { id: string; name: string; config: unknown }): SavedReport {
  const config = (row.config ?? {}) as Partial<Omit<SavedReport, "id" | "name">>;
  return {
    id: row.id,
    name: row.name,
    entity: config.entity || "deal",
    reportType: config.reportType || "em_branco",
    chartType: config.chartType || "bar",
    color: config.color || "#ec4899",
    pipeline: config.pipeline || "",
    period: config.period || "Este mes",
    periodField: config.periodField || "created_at",
    filters: config.filters || [],
    measureBy: config.measureBy,
    groupBy: config.groupBy,
    groupByGranularity: config.groupByGranularity,
    excludeStage: config.excludeStage,
  };
}

export function useSavedReports() {
  // useWorkspace() dá throw se o workspace ainda não resolveu, então
  // workspaceId/userId aqui são sempre válidos — sem race, sem fallback.
  const { workspaceId, userId } = useWorkspace();
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [loaded, setLoaded] = useState(false);

  /** Grava os relatórios no banco. Rejeita se o Supabase recusar — o chamador trata. */
  const sync = useCallback(async (reports: SavedReport[]): Promise<void> => {
    if (reports.length === 0) return;
    const { error } = await createClient().from("saved_reports").upsert(
      reports.map(r => ({
        id: r.id, user_id: userId, workspace_id: workspaceId, name: r.name,
        config: toConfig(r),
      })),
      { onConflict: "id" }   // saved_reports_pkey é PRIMARY KEY (id) — não existe unique (id,user_id)
    );
    if (error) {
      console.error("[insights] falha ao salvar relatórios:", error);
      throw new Error(error.message);
    }
  }, [userId, workspaceId]);

  const deleteFromDb = useCallback(async (id: string): Promise<void> => {
    const { error } = await createClient().from("saved_reports")
      .delete().eq("id", id).eq("user_id", userId);
    if (error) console.error("[insights] falha ao excluir relatório:", error);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("saved_reports")
      .select("id, name, config")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .then(({ data: rows, error }) => {
        if (cancelled) return;
        if (error) console.error("[insights] falha ao carregar relatórios:", error);
        setSavedReports(rows && rows.length > 0 ? rows.map(fromRow) : []);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [workspaceId]);

  return { savedReports, setSavedReports, loaded, sync, deleteFromDb };
}
