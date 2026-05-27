"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SavedReport } from "@/app/insights/insights-constants";
import { DEFAULT_REPORTS } from "@/app/insights/insights-constants";

export function useSavedReports(onLoad: (report: SavedReport) => void) {
  const userIdRef = useRef<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [dashboardPopulated, setDashboardPopulated] = useState(false);

  const sync = (reports: SavedReport[]) => {
    if (!userIdRef.current) return;
    const uid = userIdRef.current;
    createClient().from("saved_reports").upsert(
      reports.map(r => ({
        id: r.id, user_id: uid, name: r.name,
        chart_type: r.chartType, color: r.color,
        pipeline: r.pipeline, period: r.period, filters: r.filters,
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
        .select("id, name, chart_type, color, pipeline, period, filters")
        .order("created_at", { ascending: true });

      if (rows && rows.length > 0) {
        reports = rows.map(r => ({
          id: r.id as string,
          name: r.name as string,
          chartType: (r.chart_type as SavedReport["chartType"]) || "bar",
          color: (r.color as string) || "#ec4899",
          pipeline: (r.pipeline as string) || "Prospecção",
          period: (r.period as string) || "Este mes",
          filters: (r.filters as SavedReport["filters"]) || [],
        }));
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
                id: r.id, user_id: user.id, name: r.name,
                chart_type: r.chartType, color: r.color,
                pipeline: r.pipeline, period: r.period, filters: r.filters,
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
              id: r.id, user_id: user.id, name: r.name,
              chart_type: r.chartType, color: r.color,
              pipeline: r.pipeline, period: r.period, filters: r.filters,
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
