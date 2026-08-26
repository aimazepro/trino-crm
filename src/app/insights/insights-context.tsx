"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useSavedReports } from "@/hooks/use-saved-reports";
import { buildDefaultReports } from "./report-types/seed";
import { useWorkspace } from "@/lib/workspace";
import {
  listDashboards, createDashboard, saveDashboardReports,
  renameDashboardRow, deleteDashboardRow, type Dashboard,
} from "./dashboards-api";
import type { SavedReport } from "./insights-constants";

interface InsightsCtx {
  savedReports: SavedReport[];
  setSavedReports: Dispatch<SetStateAction<SavedReport[]>>;
  loaded: boolean;
  seeding: boolean;
  seedError: string | null;
  createDefaultReports: () => Promise<void>;
  sync: (reports: SavedReport[]) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  deleteAllReports: () => Promise<void>;
  patchReport: (id: string, patch: Partial<SavedReport>) => void;
  dashboardName: string;
  renameDashboard: (name: string) => void;
  // painéis customizados
  dashboards: Dashboard[];
  createPanel: (name: string) => Promise<Dashboard>;
  renamePanel: (id: string, name: string) => void;
  deletePanel: (id: string) => Promise<void>;
  addReportToPanel: (panelId: string, reportId: string) => void;
  removeReportFromPanel: (panelId: string, reportId: string) => void;
}

const Ctx = createContext<InsightsCtx | null>(null);

export function useInsights(): InsightsCtx {
  const value = useContext(Ctx);
  if (!value) throw new Error("useInsights chamado fora do InsightsProvider");
  return value;
}

/**
 * Dono do estado de Insights. Vive no layout, então a sidebar e a página
 * (dashboard ou viewer de relatório) leem a MESMA lista — criar/renomear/
 * excluir reflete na sidebar sem recarregar.
 */
export function InsightsProvider({ children }: { children: ReactNode }) {
  const { state } = useCrm();
  const { workspaceId, userId } = useWorkspace();
  const { savedReports, setSavedReports, loaded, sync, deleteFromDb } = useSavedReports();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [dashboardName, setDashboardName] = useState("Meu Painel");

  useEffect(() => {
    const stored = localStorage.getItem("insights_dashboard_name");
    if (stored) setDashboardName(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listDashboards(workspaceId).then((rows) => { if (!cancelled) setDashboards(rows); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const createPanel = useCallback(async (name: string) => {
    const panel = await createDashboard(workspaceId, userId, name);
    setDashboards((prev) => [...prev, panel]);
    return panel;
  }, [workspaceId, userId]);

  const renamePanel = useCallback((id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setDashboards((prev) => prev.map((d) => (d.id === id ? { ...d, name: clean } : d)));
    renameDashboardRow(id, clean);
  }, []);

  const deletePanel = useCallback(async (id: string) => {
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    await deleteDashboardRow(id);
  }, []);

  const addReportToPanel = useCallback((panelId: string, reportId: string) => {
    setDashboards((prev) => prev.map((d) => {
      if (d.id !== panelId || d.reportIds.includes(reportId)) return d;
      const reportIds = [...d.reportIds, reportId];
      saveDashboardReports(panelId, reportIds);
      return { ...d, reportIds };
    }));
  }, []);

  const removeReportFromPanel = useCallback((panelId: string, reportId: string) => {
    setDashboards((prev) => prev.map((d) => {
      if (d.id !== panelId) return d;
      const reportIds = d.reportIds.filter((r) => r !== reportId);
      saveDashboardReports(panelId, reportIds);
      return { ...d, reportIds };
    }));
  }, []);

  const renameDashboard = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setDashboardName(clean);
    localStorage.setItem("insights_dashboard_name", clean);
  }, []);

  const createDefaultReports = useCallback(async () => {
    if (seeding) return;
    setSeeding(true);
    setSeedError(null);
    const reports = buildDefaultReports(state.pipelines);
    try {
      await sync(reports);          // grava primeiro; só pinta a tela se o banco confirmar
      setSavedReports(reports);
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : "Falha ao criar os relatórios.");
    } finally {
      setSeeding(false);
    }
  }, [seeding, state.pipelines, sync, setSavedReports]);

  const deleteReport = useCallback(async (id: string) => {
    setSavedReports((prev) => prev.filter((r) => r.id !== id));
    await deleteFromDb(id);
  }, [deleteFromDb, setSavedReports]);

  const deleteAllReports = useCallback(async () => {
    const ids = savedReports.map((r) => r.id);
    setSavedReports([]);
    await Promise.all(ids.map((id) => deleteFromDb(id)));
  }, [savedReports, deleteFromDb, setSavedReports]);

  const patchReport = useCallback((id: string, patch: Partial<SavedReport>) => {
    setSavedReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, [setSavedReports]);

  return (
    <Ctx.Provider value={{
      savedReports, setSavedReports, loaded, seeding, seedError,
      createDefaultReports, sync, deleteReport, deleteAllReports, patchReport,
      dashboardName, renameDashboard,
      dashboards, createPanel, renamePanel, deletePanel, addReportToPanel, removeReportFromPanel,
    }}>
      {children}
    </Ctx.Provider>
  );
}
