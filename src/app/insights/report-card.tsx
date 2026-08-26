"use client";

import Link from "next/link";
import { Pencil, X } from "lucide-react";
import { ReportChart } from "./report-chart";
import { useReportResult } from "./use-report-result";
import type { SavedReport } from "./insights-constants";

export function ReportCard({ report, onRemove }: { report: SavedReport; onRemove: () => void }) {
  const result = useReportResult(report);
  return (
    <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="h-1" style={{ backgroundColor: report.color }} />
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <h3 className="text-sm font-semibold text-zinc-800 truncate flex-1">{report.name}</h3>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/insights/reports/${report.id}`} title="Editar relatorio" className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-blue-600 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <button onClick={onRemove} title="Remover do painel" className="p-1.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-semibold">
          {report.entity === "activity" ? "ATIVIDADES" : "NEGOCIOS"}
        </span>
        {report.pipeline && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium uppercase">{report.pipeline}</span>
        )}
      </div>
      <div className="px-4 pb-4">
        <div className="[&_.recharts-responsive-container]:!h-[220px]">
          <ReportChart chartType={report.chartType} data={result?.chartData ?? []} color={report.color} />
        </div>
      </div>
    </div>
  );
}
