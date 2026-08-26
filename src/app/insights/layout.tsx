"use client";

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { InsightsProvider, useInsights } from "./insights-context";
import { InsightsSidebar } from "./insights-sidebar";

export default function InsightsLayout({ children }: { children: ReactNode }) {
  return (
    <InsightsProvider>
      <InsightsShell>{children}</InsightsShell>
    </InsightsProvider>
  );
}

/**
 * Sidebar fica no layout, não na página — assim ela continua visível ao
 * abrir /insights/reports/[id], com o relatório aberto destacado.
 */
function InsightsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    savedReports, createDefaultReports, sync, deleteReport, deleteAllReports,
    patchReport, dashboardName, renameDashboard,
    dashboards, createPanel, renamePanel, deletePanel,
  } = useInsights();

  const [showPanelModal, setShowPanelModal] = useState(false);
  const [panelName, setPanelName] = useState("");
  const [creatingPanel, setCreatingPanel] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingReportName, setEditingReportName] = useState("");
  const createDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setShowCreateDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // /insights/reports/<id> → destaca o item; /insights e /insights/reports/new → nenhum
  const activeReportId = useMemo(() => {
    const match = pathname?.match(/^\/insights\/reports\/([^/]+)$/);
    return match && match[1] !== "new" ? match[1] : null;
  }, [pathname]);

  const activePanelId = useMemo(() => {
    const match = pathname?.match(/^\/insights\/dashboards\/([^/]+)$/);
    return match ? match[1] : null;
  }, [pathname]);

  const handleCreatePanel = async () => {
    const name = panelName.trim();
    if (!name || creatingPanel) return;
    setCreatingPanel(true);
    try {
      const panel = await createPanel(name);
      setShowPanelModal(false);
      setPanelName("");
      router.push(`/insights/dashboards/${panel.id}`);
    } catch (err) {
      console.error("[insights] falha ao criar painel:", err);
    } finally {
      setCreatingPanel(false);
    }
  };

  const filteredReports = useMemo(() => {
    if (!searchQuery) return savedReports;
    return savedReports.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [savedReports, searchQuery]);

  const handleStartRename = (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setEditingReportId(id); setEditingReportName(name);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault(); e.stopPropagation();
    const name = editingReportName.trim();
    if (!name) return;
    patchReport(id, { name });
    setEditingReportId(null);
    const updated = savedReports.map((r) => (r.id === id ? { ...r, name } : r));
    sync(updated).catch((err) => console.error("[insights] rename falhou:", err));
  };

  const handleDeleteReport = (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    deleteReport(id);
  };

  const handleDeleteDashboard = () => {
    if (!confirm("Excluir o painel apaga todos os relatórios salvos. Continuar?")) return;
    deleteAllReports();
  };

  const handleRenameDashboard = () => {
    const next = prompt("Novo nome do painel:", dashboardName);
    if (next) renameDashboard(next);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-50">
      <InsightsSidebar
        createDropdownRef={createDropdownRef}
        showCreateDropdown={showCreateDropdown}
        onToggleCreateDropdown={() => setShowCreateDropdown((v) => !v)}
        onCloseCreateDropdown={() => setShowCreateDropdown(false)}
        onCreateReportZero={() => { window.location.href = "/insights/reports/new"; }}
        onCreateDashboard={() => { setShowCreateDropdown(false); setPanelName(""); setShowPanelModal(true); }}
        onRenameDashboard={handleRenameDashboard}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dashboardPopulated={savedReports.length > 0}
        activeReportId={activeReportId}
        onSelectReport={() => {}}
        onDeleteDashboard={handleDeleteDashboard}
        savedReports={savedReports}
        filteredReports={filteredReports}
        editingReportId={editingReportId}
        editingReportName={editingReportName}
        onEditingReportNameChange={setEditingReportName}
        onCancelRename={() => setEditingReportId(null)}
        onStartRename={handleStartRename}
        onSaveRename={handleSaveRename}
        onDeleteReport={handleDeleteReport}
        dashboardName={dashboardName}
        panels={dashboards}
        activePanelId={activePanelId}
        onRenamePanel={(id, currentName, e) => {
          e.preventDefault(); e.stopPropagation();
          const next = prompt("Novo nome do painel:", currentName);
          if (next) renamePanel(id, next);
        }}
        onDeletePanel={(id, e) => {
          e.preventDefault(); e.stopPropagation();
          if (!confirm("Excluir este painel? Os relatórios continuam salvos.")) return;
          deletePanel(id);
          if (activePanelId === id) router.push("/insights");
        }}
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>

      {showPanelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowPanelModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-zinc-900 mb-4">Novo painel</h2>
            <input
              autoFocus
              value={panelName}
              onChange={(e) => setPanelName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreatePanel(); }}
              placeholder="Nome do painel..."
              className="w-full rounded-lg border-2 border-emerald-400 px-3 py-2 text-sm outline-none placeholder:text-zinc-400"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPanelModal(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreatePanel}
                disabled={!panelName.trim() || creatingPanel}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-400 disabled:cursor-not-allowed"
              >
                {creatingPanel ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
