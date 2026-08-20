"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import type { SavedReport } from "@/app/insights/insights-constants";
import { DEFAULT_REPORTS } from "@/app/insights/insights-constants";

function toConfig(r: SavedReport) {
  return {
    chartType: r.chartType,
    color: r.color,
    pipeline: r.pipeline,
    period: r.period,
    filters: r.filters,
  };
}

function fromRow(row: { id: string; name: string; config: unknown }): SavedReport {
  const config = (row.config ?? {}) as Partial<ReturnType<typeof toConfig>>;
  return {
    id: row.id,
    name: row.name,
    chartType: config.chartType || "bar",
    color: config.color || "#ec4899",
    pipeline: config.pipeline || "Prospecção",
    period: config.period || "Este mes",
    filters: config.filters || [],
  };
}

export function useSavedReports(onLoad: (report: SavedReport) => void) {
  const { workspaceId, userId } = useWorkspace();
  const userIdRef = useRef<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [dashboardPopulated, setDashboardPopulated] = useState(false);

  const sync = (reports: SavedReport[]) => {
    if (!userIdRef.current) return;
    const uid = userIdRef.current;
    createClient().from("saved_reports").upsert(
      reports.map(r => ({
        id: r.id, user_id: uid, workspace_id: workspaceId, name: r.name,
        config: toConfig(r),
      })),
      { onConflict: "id,user_id" }
    ).then(() => {});
  };

  const deleteFromDb = (id: string) => {
    if (!userIdRef.current) return;
    createClient().from("saved_reports")
      .delete().eq("id", id).eq("user_id", userIdRef.current).then(() => {});
  };

  useEffect(() => {
    const storedPopulated = localStorage.getItem("insights_dashboard_populated");
    const storedActiveReport = localStorage.getItem("insights_active_report_id");
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      userIdRef.current = user.id;

      let reports: SavedReport[] = [];
      const { data: rows } = await supabase
        .from("saved_reports")
        .select("id, name, config")
        .order("created_at", { ascending: true });

      if (rows && rows.length > 0) {
        reports = rows.map(fromRow);
      } else {
        const storedReports = localStorage.getItem("insights_saved_reports");
        if (storedReports) {
          try {
            const parsed = JSON.parse(storedReports) as SavedReport[];
            reports = parsed.map(r => ({
              ...r,
              chartType: r.chartType || "bar",
              color: r.color || "#ec4899",
              pipeline: r.pipeline || "Prospecção",
              period: r.period || "Este mes",
              filters: r.filters || [],
            }));
            await supabase.from("saved_reports").upsert(
              reports.map(r => ({
                id: r.id, user_id: user.id, workspace_id: workspaceId, name: r.name,
                config: toConfig(r),
              })),
              { onConflict: "id,user_id" }
            );
            localStorage.removeItem("insights_saved_reports");
          } catch {
            reports = DEFAULT_REPORTS;
          }
        } else {
          reports = DEFAULT_REPORTS;
          await supabase.from("saved_reports").upsert(
            reports.map(r => ({
              id: r.id, user_id: user.id, workspace_id: workspaceId, name: r.name,
              config: toConfig(r),
            })),
            { onConflict: "id,user_id" }
          );
          setDashboardPopulated(true);
          localStorage.setItem("insights_dashboard_populated", "true");
        }
      }

      setSavedReports(reports);
      if (storedPopulated === "true") setDashboardPopulated(true);
      if (storedActiveReport && storedActiveReport !== "null") {
        const activeReport = reports.find(r => r.id === storedActiveReport);
        if (activeReport) onLoad(activeReport);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { savedReports, setSavedReports, dashboardPopulated, setDashboardPopulated, sync, deleteFromDb };
}
