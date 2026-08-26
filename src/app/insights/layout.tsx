"use client";

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
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
  const {
    savedReports, createDefaultReports, sync, deleteReport, deleteAllReports,
    patchReport, dashboardName, renameDashboard,
  } = useInsights();

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
        onCreateDashboard={() => { setShowCreateDropdown(false); createDefaultReports(); }}
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
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
