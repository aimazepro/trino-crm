"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Activity, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { useAutomacoes, TRIGGER_LABELS, ACTION_LABELS } from "@/contexts/automacoes-context";

type RunRow = {
  id: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
};

type StepRow = {
  id: string;
  step_id: string;
  action_type: string;
  status: string;
  error: string | null;
  response_code: number | null;
  created_at: string;
};

const RUN_LIMIT = 50;

const RUN_STATUS_LABELS: Record<string, string> = {
  running: "Em execução",
  success: "Sucesso",
  partial: "Parcial",
  failed: "Falhou",
};

const STEP_STATUS_LABELS: Record<string, string> = {
  success: "Sucesso",
  failed: "Falhou",
};

function runStatusBadge(status: string) {
  switch (status) {
    case "success":
      return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    case "failed":
      return "bg-red-50 text-red-700 border border-red-100";
    case "partial":
      return "bg-amber-50 text-amber-700 border border-amber-100";
    case "running":
    default:
      return "bg-blue-50 text-blue-700 border border-blue-100";
  }
}

function stepStatusBadge(status: string) {
  return status === "success"
    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
    : "bg-red-50 text-red-700 border border-red-100";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")}, ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

export default function AutomationLogPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { role } = useWorkspace();
  const { automations } = useAutomacoes();
  const supabase = createClient();

  const automation = automations.find((a) => a.id === rawId);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stepsByRun, setStepsByRun] = useState<Record<string, StepRow[]>>({});
  const [stepsLoading, setStepsLoading] = useState<Record<string, boolean>>({});

  const loadRuns = useCallback(async () => {
    if (!rawId) return;
    setLoading(true);

    const { data } = await supabase
      .from("automation_runs")
      .select("id, trigger, status, started_at, finished_at")
      .eq("automation_id", rawId)
      .order("started_at", { ascending: false })
      .limit(RUN_LIMIT);

    setRuns(data ?? []);
    setLoading(false);
  }, [supabase, rawId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const toggleRun = async (runId: string) => {
    if (expandedId === runId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(runId);
    if (stepsByRun[runId]) return;

    setStepsLoading((prev) => ({ ...prev, [runId]: true }));
    const { data } = await supabase
      .from("automation_run_steps")
      .select("id, step_id, action_type, status, error, response_code, created_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });
    setStepsByRun((prev) => ({ ...prev, [runId]: data ?? [] }));
    setStepsLoading((prev) => ({ ...prev, [runId]: false }));
  };

  if (role !== "admin") {
    return (
      <div className="flex flex-col min-h-full items-center justify-center gap-3 py-20 bg-[#F4F4F5]">
        <p className="text-[13px] font-semibold text-zinc-500">
          Só administradores acessam o log de execuções.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-8 pb-5 shrink-0 bg-transparent">
        <button
          onClick={() => router.push("/automacoes")}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 transition-colors cursor-pointer bg-white border border-zinc-200 shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-zinc-950 tracking-tight">
            Log de execuções{automation ? ` — ${automation.name}` : ""}
          </h1>
          <p className="text-[13px] text-zinc-400 font-medium">
            Histórico das execuções desta automação, mais recentes primeiro.
          </p>
        </div>
      </div>

      <div className="flex-1 px-8 pb-8 max-w-5xl">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Activity className="h-10 w-10 text-zinc-300" />
            <p className="text-[14px] text-zinc-400 font-medium">Nenhuma execução registrada ainda.</p>
          </div>
        ) : (
          <div className="border border-zinc-200/60 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Gatilho
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Iniciado em
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Finalizado em
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {runs.map((run) => {
                  const isExpanded = expandedId === run.id;
                  const steps = stepsByRun[run.id];

                  return (
                    <Fragment key={run.id}>
                      <tr
                        className="hover:bg-zinc-50 cursor-pointer"
                        onClick={() => toggleRun(run.id)}
                      >
                        <td className="px-4 py-3 text-[13px] text-zinc-700 font-medium">
                          {TRIGGER_LABELS[run.trigger] ?? run.trigger}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "text-xs font-semibold px-2.5 py-1 rounded-full",
                              runStatusBadge(run.status)
                            )}
                          >
                            {RUN_STATUS_LABELS[run.status] ?? run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-zinc-500">
                          {formatDate(run.started_at)}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-zinc-500">
                          {formatDate(run.finished_at)}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-zinc-400 transition-transform ml-auto",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="bg-zinc-50/60 px-4 py-4">
                            {stepsLoading[run.id] ? (
                              <div className="flex items-center justify-center py-6">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                              </div>
                            ) : !steps || steps.length === 0 ? (
                              <p className="text-[12px] text-zinc-400 text-center py-4">
                                Nenhum passo registrado para esta execução.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {steps.map((step) => (
                                  <div
                                    key={step.id}
                                    className="flex items-start gap-3 bg-white border border-zinc-200/60 rounded-lg px-4 py-3"
                                  >
                                    <span
                                      className={cn(
                                        "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0",
                                        stepStatusBadge(step.status)
                                      )}
                                    >
                                      {STEP_STATUS_LABELS[step.status] ?? step.status}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] font-semibold text-zinc-800">
                                        {ACTION_LABELS[step.action_type] ?? step.action_type}
                                      </p>
                                      {step.error && (
                                        <p className="text-[12px] text-red-500 mt-1 break-words">
                                          {step.error}
                                        </p>
                                      )}
                                      {step.response_code !== null && (
                                        <p className="text-[11px] text-zinc-400 mt-1">
                                          Código de resposta: {step.response_code}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
