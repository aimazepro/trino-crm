"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Trash2, DownloadCloud, X, ArrowLeft, Target, Plus, TrendingUp, DollarSign, Activity, FileText } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchGoalProgress, getPeriodLabel, exportGoalItemsToCSV } from "@/lib/goals-helpers";

const PERIOD_LABELS: Record<string, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
};

export default function MetaDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const supabase = createClient();

  const [goal, setGoal] = useState<any>(null);
  const [currentValue, setCurrentValue] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const loadGoal = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("goals").select("*").eq("id", id).single();
    if (error || !data) {
      setLoading(false);
      return;
    }
    setGoal(data);

    const { currentValue: val, items: itemRows, error: progressError } = await fetchGoalProgress(supabase, data);
    if (progressError) console.error(`Progresso da meta ${id} falhou:`, progressError);
    setCurrentValue(val);
    setItems(itemRows);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  const handleDelete = async () => {
    await supabase.from("goals").delete().eq("id", id);
    setShowDeleteModal(false);
    router.push("/metas");
  };

  const getGoalIcon = (type: string) => {
    switch (type) {
      case "Negócios Adicionados": return Plus;
      case "Negócios em Andamento": return TrendingUp;
      case "Negócios Ganhos": return Trophy;
      case "Receita": return DollarSign;
      case "Atividades": return Activity;
      default: return Target;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F3F4F6] min-h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F3F4F6] min-h-screen">
        <p className="text-sm text-zinc-400">Meta não encontrada.</p>
      </div>
    );
  }

  const targetValue = Number(goal.target_value) || 1;
  const percentage = Math.min(100, Math.round((currentValue / targetValue) * 100));
  const periodLabel = getPeriodLabel(goal.period, goal.start_date, goal.end_date);
  const isValueMetric = goal.metric === "VALUE" || goal.goal_type === "Receita";
  const IconComp = getGoalIcon(goal.goal_type);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F3F4F6] border-l border-zinc-200 min-h-screen">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/metas")}
            className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <IconComp className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-zinc-900">{goal.title}</h1>
            <p className="text-xs text-zinc-400">
              {goal.goal_type} | {PERIOD_LABELS[goal.period] ?? goal.period}
            </p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-zinc-100 shadow-sm">
            <p className="text-xs text-zinc-400 mb-1">Meta por período</p>
            <p className="text-lg font-bold text-zinc-900">
              {isValueMetric ? `R$ ${targetValue.toLocaleString("pt-BR")}` : targetValue.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-zinc-100 shadow-sm">
            <p className="text-xs text-zinc-400 mb-1">Período atual</p>
            <p className="text-lg font-bold text-zinc-900">
              {isValueMetric ? `R$ ${currentValue.toLocaleString("pt-BR")}` : currentValue.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs mt-0.5 text-amber-600 font-medium">{percentage}% da meta</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-zinc-100 shadow-sm">
            <p className="text-xs text-zinc-400 mb-1">Total acumulado</p>
            <p className="text-lg font-bold text-zinc-900">
              {isValueMetric ? `R$ ${currentValue.toLocaleString("pt-BR")}` : currentValue.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-zinc-100 shadow-sm">
            <p className="text-xs text-zinc-400 mb-1">Tendência</p>
            <p className="text-lg font-bold text-zinc-700">{percentage >= 100 ? "+100%" : `${percentage}%`}</p>
            <p className="text-xs text-zinc-400 mt-0.5">vs meta definida</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-zinc-100 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700 mb-5">Evolução por período</h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-zinc-400 uppercase tracking-wide">
                {isValueMetric ? "Valor (R$)" : "Quantidade"}
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-4 rounded bg-amber-500" />
                  <span className="text-xs text-zinc-400">Realizado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-0.5 w-4 bg-zinc-300 border-dashed border-t border-zinc-300" />
                  <span className="text-xs text-zinc-400">Meta</span>
                </div>
              </div>
            </div>
            <div className="flex items-end gap-1 h-56" style={{ minHeight: "14rem" }}>
              <div
                onClick={() => setShowDetailsModal(true)}
                className="flex-1 flex flex-col items-center justify-end relative cursor-pointer group"
                style={{ height: "100%" }}
              >
                <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-medium text-zinc-700 whitespace-nowrap">
                    {isValueMetric ? `R$ ${currentValue.toLocaleString("pt-BR")}` : currentValue}
                  </span>
                </div>
                <div
                  className="absolute w-full border-t-2 border-dashed border-zinc-300 z-10"
                  style={{ bottom: `${Math.min(100, (targetValue / Math.max(currentValue, targetValue)) * 100)}%` }}
                />
                <div
                  className="w-full max-w-16 rounded-t-md transition-all group-hover:opacity-80 bg-amber-500"
                  style={{ height: `${percentage}%`, minHeight: percentage > 0 ? "4px" : "0px" }}
                />
                <span className="text-[11px] text-zinc-500 mt-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-full text-center font-medium">
                  {periodLabel}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-4">Clique na barra para ver os detalhes do período</p>
        </div>
      </div>

      {/* Modal de Exclusao */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/20 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative w-full max-w-[320px] bg-[#f9fafb] border border-zinc-100 rounded-xl shadow-xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-amber-100/50 text-amber-900 px-2 py-1 rounded inline-block mb-3">
              <h3 className="text-[14px] font-bold">Excluir meta?</h3>
            </div>
            <div className="bg-amber-100/50 text-amber-900 px-2 py-1 rounded inline-block mb-6">
              <p className="text-[13px] font-medium">Essa ação não pode ser desfeita.</p>
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-[13px] font-medium text-zinc-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-[13px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes do Período */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowDetailsModal(false)} />
          <div className="relative w-full max-w-[650px] max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-start justify-between bg-white shrink-0">
              <div>
                <h2 className="text-[16px] font-bold text-zinc-900">
                  {goal.goal_type} | {periodLabel}
                </h2>
                <p className="text-[12px] font-medium text-zinc-400 mt-1">{items.length} registro(s) encontrado(s)</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => exportGoalItemsToCSV(items, goal.title)}
                  disabled={items.length === 0}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg hover:bg-zinc-100 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <DownloadCloud size={14} /> CSV
                </button>
                <button onClick={() => setShowDetailsModal(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors ml-2">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-white space-y-3 min-h-[200px]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400 text-center">
                  <FileText className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-[13px] font-medium">Nenhum registro encontrado neste período</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {items.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between hover:bg-zinc-50/80 px-3 rounded-lg transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-zinc-800">{item.title}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {new Date(item.created_at || item.date || item.updated_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        {item.value !== undefined && (
                          <p className="text-sm font-bold text-zinc-900">
                            R$ {Number(item.value).toLocaleString("pt-BR")}
                          </p>
                        )}
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                            item.status === "Ganho" || item.completed
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : item.status === "Ativo"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {item.status || (item.completed ? "Concluída" : item.type || "Ativo")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
