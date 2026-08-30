"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, DollarSign, Calendar, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { useWorkspace } from "@/lib/workspace";
import { REPORT_TYPE_REGISTRY, ENTITY_LABELS } from "../../report-types/registry";
import type { ReportConfig } from "../../report-types/types";

const ENTITY_ICONS: Record<ReportConfig["entity"], typeof DollarSign> = {
  deal: DollarSign,
  activity: Calendar,
  contact: User,
  company: Building2,
};

export default function NewReportPage() {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [entity, setEntity] = useState<ReportConfig["entity"]>("deal");
  const [reportType, setReportType] = useState<string>(REPORT_TYPE_REGISTRY.deal[0].key);
  const [creating, setCreating] = useState(false);

  const types = REPORT_TYPE_REGISTRY[entity];

  const handleSelectEntity = (e: ReportConfig["entity"]) => {
    setEntity(e);
    setReportType(REPORT_TYPE_REGISTRY[e][0].key);
  };

  const handleContinue = async () => {
    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }
    const def = types.find((t) => t.key === reportType) ?? types[0];
    const config: ReportConfig = {
      entity, reportType,
      chartType: def.defaultChartType,
      color: "#ec4899", pipeline: "", period: "Este mes", periodField: "created_at", filters: [],
    };
    const { data, error } = await supabase
      .from("saved_reports")
      .insert({ user_id: user.id, workspace_id: workspaceId, name: def.label, config: config as unknown as Json })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) return;
    router.push(`/insights/reports/${data.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => router.push("/insights")}>
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">Adicionar novo relatório</h2>
          <button onClick={() => router.push("/insights")} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-[220px_1fr] gap-0 max-h-[60vh]">
          <div className="border-r border-zinc-100 p-3 space-y-1 overflow-y-auto">
            <p className="px-2 pb-2 text-[10px] font-bold text-zinc-400 tracking-wider">ESCOLHER ENTIDADE</p>
            {(Object.keys(ENTITY_LABELS) as ReportConfig["entity"][]).map((e) => {
              const Icon = ENTITY_ICONS[e];
              return (
                <button
                  key={e}
                  onClick={() => handleSelectEntity(e)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors",
                    entity === e ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {ENTITY_LABELS[e]}
                </button>
              );
            })}
          </div>
          <div className="p-3 space-y-1 overflow-y-auto">
            <p className="px-2 pb-2 text-[10px] font-bold text-zinc-400 tracking-wider">ESCOLHER TIPO DE RELATORIO</p>
            {types.map((t) => (
              <button
                key={t.key}
                onClick={() => setReportType(t.key)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                  reportType === t.key ? "bg-zinc-100" : "hover:bg-zinc-50"
                )}
              >
                <div className="text-sm font-semibold text-zinc-800">{t.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-100">
          <button onClick={() => router.push("/insights")} className="px-4 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">
            Cancelar
          </button>
          <button onClick={handleContinue} disabled={creating} className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 disabled:opacity-50">
            {creating ? "Criando..." : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
