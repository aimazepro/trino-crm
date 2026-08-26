"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInsights } from "../../insights-context";
import { ReportCard } from "../../report-card";

/** MIME usado no drag da sidebar — só o id do relatório viaja. */
export const REPORT_DND_TYPE = "application/x-trino-report-id";

export function CustomDashboard({ dashboardId }: { dashboardId: string }) {
  const { dashboards, savedReports, addReportToPanel, removeReportFromPanel } = useInsights();
  const [dragOver, setDragOver] = useState(false);

  const panel = dashboards.find((d) => d.id === dashboardId);
  if (!panel) {
    return <div className="p-6 text-sm text-zinc-400">Painel não encontrado.</div>;
  }

  const cards = panel.reportIds
    .map((id) => savedReports.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const reportId = e.dataTransfer.getData(REPORT_DND_TYPE) || e.dataTransfer.getData("text/plain");
    if (reportId) addReportToPanel(dashboardId, reportId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    // só aceita o drag de relatório
    if (e.dataTransfer.types.includes(REPORT_DND_TYPE)) {
      e.preventDefault();
      setDragOver(true);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 flex flex-col">
      <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-zinc-900">{panel.name}</h1>
        <span className="text-xs text-zinc-400">{cards.length} {cards.length === 1 ? "relatorio" : "relatorios"}</span>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "p-6 min-h-[calc(100vh-120px)] transition-colors",
          dragOver && "bg-emerald-50/60 ring-2 ring-inset ring-emerald-400"
        )}
      >
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-2xl bg-white border border-zinc-200 p-8 text-center max-w-md">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                <Sparkles className="h-6 w-6 text-zinc-400" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 mb-2">Painel vazio</h2>
              <p className="text-sm text-zinc-500">Arraste relatorios da lista ao lado para adicionar ao painel.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cards.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onRemove={() => removeReportFromPanel(dashboardId, report.id)}
              />
            ))}
          </div>
        )}

        {dragOver && cards.length > 0 && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50/60 py-8 text-center text-sm font-medium text-emerald-700">
            Solte para adicionar ao painel
          </div>
        )}
      </div>
    </div>
  );
}
