"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useSavedReports } from "@/hooks/use-saved-reports";
import { buildDefaultReports } from "./report-types/seed";
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
  const { savedReports, setSavedReports, loaded, sync, deleteFromDb } = useSavedReports();
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [dashboardName, setDashboardName] = useState("Meu Painel");

  useEffect(() => {
    const stored = localStorage.getItem("insights_dashboard_name");
    if (stored) setDashboardName(stored);
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
    }}>
      {children}
    </Ctx.Provider>
  );
}
