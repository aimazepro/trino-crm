"use client";

import { useState } from "react";
import { Trophy, Trash2, DownloadCloud, X, ArrowLeft } from "lucide-react";
import { useRouter, useParams } from "next/navigation";

export default function MetaDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const goal = {
    title: "Negócios Ganhos",
    subtitle: "Negócios Ganhos | Mensal",
    target: 10,
    current: 0,
    accumulated: 0,
    trend: "N/A",
    periodLabel: "Mai 2026",
  };

  const percentage = goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F3F4F6] border-l border-zinc-200">
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/metas")}
            className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-zinc-900">{goal.title}</h1>
            <p className="text-xs text-zinc-400">{goal.subtitle}</p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-zinc-100">
            <p className="text-xs text-zinc-400 mb-1">Meta por período</p>
            <p className="text-lg font-bold text-zinc-900">{goal.target}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-zinc-100">
            <p className="text-xs text-zinc-400 mb-1">Período atual</p>
            <p className="text-lg font-bold text-zinc-900">{goal.current}</p>
            <p className="text-xs mt-0.5 text-amber-600">{percentage}% da meta</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-zinc-100">
            <p className="text-xs text-zinc-400 mb-1">Total acumulado</p>
            <p className="text-lg font-bold text-zinc-900">{goal.accumulated}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-zinc-100">
            <p className="text-xs text-zinc-400 mb-1">Tendência</p>
            <p className="text-lg font-bold text-zinc-300">{goal.trend}</p>
            <p className="text-xs text-zinc-400 mt-0.5">vs período anterior</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-700 mb-5">Evolução por período</h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-zinc-400 uppercase tracking-wide">Quantidade</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-4 rounded bg-green-500" />
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
                  <span className="text-xs font-medium text-zinc-700 whitespace-nowrap">{goal.current}</span>
                </div>
                <div className="absolute w-full border-t-2 border-dashed border-zinc-300 z-10" style={{ bottom: "100%" }} />
                <div
                  className="w-full max-w-10 rounded-t-md transition-all group-hover:opacity-80 bg-green-500"
                  style={{ height: `${percentage}%`, minHeight: "0px" }}
                />
                <span className="text-[10px] text-zinc-400 mt-1.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full text-center">
                  {goal.periodLabel}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-4">Clique em uma barra para ver os detalhes do período</p>
        </div>

      </div>

      {/* Modal de Exclusão */}
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
                onClick={() => {
                  const savedGoals = localStorage.getItem("dmhub_goals");
                  if (savedGoals) {
                    const goals = JSON.parse(savedGoals);
                    const updatedGoals = goals.filter((g: any) => g.id !== id);
                    localStorage.setItem("dmhub_goals", JSON.stringify(updatedGoals));
                  }
                  setShowDeleteModal(false);
                  router.push("/metas");
                }}
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
          <div className="relative w-full max-w-[600px] h-[350px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-zinc-100 flex items-start justify-between bg-white shrink-0">
              <div>
                <h2 className="text-[16px] font-bold text-zinc-900">Negócios | {goal.periodLabel}</h2>
                <p className="text-[12px] font-medium text-zinc-400 mt-1">0 registro(s)</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors shadow-sm">
                  <DownloadCloud size={14} /> CSV
                </button>
                <button onClick={() => setShowDetailsModal(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors ml-2">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center bg-white px-8">
              <p className="text-[13px] font-medium text-zinc-400">Nenhum registro encontrado neste período</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
