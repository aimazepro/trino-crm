"use client";

import { RefObject } from "react";
import Link from "next/link";
import {
  Plus, ChevronDown, Search, PanelTop, LayoutDashboard,
  Trash2, FileText, BarChart2, Check, X, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedReport } from "./insights-constants";

interface InsightsSidebarProps {
  createDropdownRef: RefObject<HTMLDivElement | null>;
  showCreateDropdown: boolean;
  onToggleCreateDropdown: () => void;
  onCloseCreateDropdown: () => void;
  onCreateReportZero: () => void;
  onCreateDashboard: () => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  activeReportId: string | null;
  savedReports: SavedReport[];
  filteredReports: SavedReport[];
  editingReportId: string | null;
  editingReportName: string;
  onEditingReportNameChange: (name: string) => void;
  onCancelRename: () => void;
  onStartRename: (id: string, name: string, e: React.MouseEvent) => void;
  onSaveRename: (id: string, e: React.FormEvent) => void;
  onDeleteReport: (id: string, e: React.MouseEvent) => void;
  panels: { id: string; name: string; isDefault: boolean }[];
  activePanelId: string | null;
  onRenamePanel: (id: string, currentName: string, e: React.MouseEvent) => void;
  onDeletePanel: (id: string, e: React.MouseEvent) => void;
}

export function InsightsSidebar({
  createDropdownRef,
  showCreateDropdown,
  onToggleCreateDropdown,
  onCloseCreateDropdown,
  onCreateReportZero,
  onCreateDashboard,
  searchQuery,
  onSearchChange,
  activeReportId,
  savedReports,
  filteredReports,
  editingReportId,
  editingReportName,
  onEditingReportNameChange,
  onCancelRename,
  onStartRename,
  onSaveRename,
  onDeleteReport,
  panels,
  activePanelId,
  onRenamePanel,
  onDeletePanel,
}: InsightsSidebarProps) {
  return (
    <div className="w-64 shrink-0 border-r border-zinc-200 bg-white overflow-y-auto flex flex-col">
      <div className="p-3 relative" ref={createDropdownRef}>
        <button
          onClick={onToggleCreateDropdown}
          className="flex items-center gap-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors justify-center cursor-pointer"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Criar
          <ChevronDown className="h-3 w-3 ml-auto shrink-0" />
        </button>
        {showCreateDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={onCloseCreateDropdown}></div>
            <div className="absolute left-3 right-3 top-14 z-50 rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden">
              <button onClick={onCreateReportZero} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left cursor-pointer">
                <BarChart2 className="h-4 w-4 text-zinc-400" />
                Novo relatório
              </button>
              <button onClick={onCreateDashboard} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left cursor-pointer">
                <PanelTop className="h-4 w-4 text-zinc-400" />
                Novo painel
              </button>
            </div>
          </>
        )}
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <input
            placeholder="Buscar no Insights"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="bg-transparent text-sm text-zinc-700 outline-none w-full placeholder:text-zinc-400"
            type="text"
          />
        </div>
      </div>

      <div className="px-2 flex-1 overflow-y-auto">
        <button className="flex items-center gap-2 w-full px-2 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-700 text-left">
          <PanelTop className="h-3 w-3" />
          Painéis
          <ChevronDown className="h-3 w-3 ml-auto" />
        </button>

        <div className="space-y-0.5 mb-3">
          {panels.map((panel) => (
            <div key={panel.id} className="group relative">
              <Link
                href={panel.isDefault ? "/insights" : `/insights/dashboards/${panel.id}`}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-colors font-medium text-left",
                  activePanelId === panel.id ? "bg-emerald-50 text-emerald-700" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                )}
              >
                <LayoutDashboard className={cn("h-4 w-4 shrink-0", activePanelId === panel.id ? "text-emerald-500" : "text-zinc-400")} />
                <span className="truncate flex-1 pr-11 font-semibold">{panel.name}</span>
              </Link>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={(e) => onRenamePanel(panel.id, panel.name, e)} title="Renomear painel" className="p-1 rounded text-zinc-300 hover:text-blue-500 transition-all cursor-pointer">
                  <Pencil className="h-3 w-3" />
                </button>
                {!panel.isDefault && (
                  <button onClick={(e) => onDeletePanel(panel.id, e)} title="Excluir painel" className="p-1 rounded text-zinc-300 hover:text-red-500 transition-all cursor-pointer">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="flex items-center gap-2 w-full px-2 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-700 text-left">
          <FileText className="h-3 w-3" />
          Relatórios
          <span className="ml-1 text-[10px] text-zinc-400 font-normal normal-case">{savedReports.length}</span>
          <ChevronDown className="h-3 w-3 ml-auto" />
        </button>

        <div className="space-y-0.5 pb-4">
          {filteredReports.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-400">Nenhum relatório salvo</p>
          ) : (
            filteredReports.map(report => (
              <div
                key={report.id}
                className="group relative"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-trino-report-id", report.id);
                  e.dataTransfer.setData("text/plain", report.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
              >
                {editingReportId === report.id ? (
                  <form onSubmit={(e) => onSaveRename(report.id, e)} className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 rounded-lg">
                    <input
                      type="text"
                      value={editingReportName}
                      onChange={e => onEditingReportNameChange(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-500"
                      autoFocus
                    />
                    <button type="submit" className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"><Check className="h-3 w-3" /></button>
                    <button type="button" onClick={onCancelRename} className="p-0.5 text-zinc-400 hover:bg-zinc-100 rounded cursor-pointer"><X className="h-3 w-3" /></button>
                  </form>
                ) : (
                  <>
                    <Link
                      href={`/insights/reports/${report.id}`}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors text-left cursor-grab active:cursor-grabbing",
                        activeReportId === report.id ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                      )}
                    >
                      <BarChart2 className={cn("h-3.5 w-3.5 shrink-0", activeReportId === report.id ? "text-emerald-600" : "text-zinc-400")} />
                      <span className="truncate flex-1 min-w-0">{report.name}</span>
                      {report.pipeline && (
                        <span className="text-[10px] font-normal text-zinc-400 shrink-0 group-hover:opacity-0 transition-opacity">
                          {report.pipeline}
                        </span>
                      )}
                    </Link>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-white pl-1">
                      <button onClick={(e) => onStartRename(report.id, report.name, e)} className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 cursor-pointer" title="Renomear"><Pencil className="h-3 w-3" /></button>
                      <button onClick={(e) => onDeleteReport(report.id, e)} className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-zinc-50 cursor-pointer" title="Excluir"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
