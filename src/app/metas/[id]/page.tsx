"use client";

import { useState } from "react";
import { Trophy, Trash2, DownloadCloud, X } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/utils";

export default function MetaDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Mock Data
  const goal = {
    title: "ligacoes",
    subtitle: "Negócios Ganhos | Trimestral",
    target: 100,
    current: 0,
    accumulated: 0,
    trend: "N/A"
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F3F4F6] border-l border-zinc-200">
      
      {/* Detached Header Area */}
      <div className="flex items-center justify-between px-8 py-8 shrink-0">
        <div className="flex items-center gap-4">
           <button onClick={() => router.push("/metas")} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200/50 rounded-full transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
           </button>
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 text-green-500 flex items-center justify-center border border-green-100">
                 <Trophy size={18} strokeWidth={2.5} />
              </div>
              <div>
                 <h1 className="text-[16px] font-bold text-zinc-900 tracking-tight leading-tight">{goal.title}</h1>
                 <p className="text-[12px] font-medium text-zinc-400">{goal.subtitle}</p>
              </div>
           </div>
        </div>

        <button 
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 text-[13px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-all border border-transparent hover:border-red-100"
        >
          <Trash2 size={16} /> Excluir
        </button>
      </div>

      <div className="flex-1 px-8 pb-10 space-y-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-6">
           <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
              <p className="text-[12px] font-medium text-zinc-500 mb-1">Meta por período</p>
              <h3 className="text-2xl font-bold text-zinc-900">{goal.target}</h3>
           </div>
           
           <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
              <p className="text-[12px] font-medium text-zinc-500 mb-1">Período atual</p>
              <h3 className="text-2xl font-bold text-zinc-900 mb-1">{goal.current}</h3>
              <p className="text-[11px] font-bold text-amber-500">{goal.current}% da meta</p>
           </div>
           
           <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
              <p className="text-[12px] font-medium text-zinc-500 mb-1">Total acumulado</p>
              <h3 className="text-2xl font-bold text-zinc-900">{goal.accumulated}</h3>
           </div>
           
           <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex flex-col justify-center">
              <p className="text-[12px] font-medium text-zinc-500 mb-1">Tendência</p>
              <h3 className="text-[16px] font-bold text-zinc-400">{goal.trend}</h3>
              <p className="text-[11px] font-medium text-zinc-400 mt-1">vs período anterior</p>
           </div>
        </div>

        {/* Chart Section */}
        <div className="bg-white border border-zinc-100 rounded-3xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
           <h3 className="text-[14px] font-bold text-zinc-800 mb-6">Evolução por período</h3>
           
           <div className="flex items-center justify-between mb-8">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest">Quantidade</span>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    <div className="w-4 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[12px] font-medium text-zinc-500">Realizado</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-4 border-t-2 border-dashed border-zinc-300" />
                    <span className="text-[12px] font-medium text-zinc-500">Meta</span>
                 </div>
              </div>
           </div>

           {/* Gráfico Visual (CSS-based Mock to match screenshot exactly without Recharts weight) */}
           <div className="relative h-64 mt-4 w-full">
              
              {/* Linha da Meta */}
              <div className="absolute top-[20%] left-0 right-0 border-t-2 border-dashed border-zinc-200 z-0"></div>

              {/* Grid do Gráfico */}
              <div className="absolute inset-0 flex items-end justify-center z-10 px-12">
                 
                 {/* Coluna / Barra de Q2 2026 */}
                 <div onClick={() => setShowDetailsModal(true)} className="flex flex-col items-center h-full justify-end group cursor-pointer">
                    {/* Tooltip Hover Area Effect */}
                    <div className="h-full w-24 bg-transparent group-hover:bg-zinc-50 rounded-t-xl transition-colors flex items-end justify-center pb-0 border-b-2 border-transparent group-hover:border-zinc-200">
                       
                       {/* Barra (vazia neste mock de 0%) */}
                       <div className="w-8 bg-green-500 rounded-t-md opacity-0 group-hover:opacity-10 transition-opacity" style={{ height: '0%' }} />

                    </div>
                    {/* Eixo X */}
                    <span className="text-[11px] font-medium text-zinc-400 mt-4 group-hover:text-zinc-600">Q2 2026</span>
                 </div>

              </div>
           </div>

           <div className="pt-8 mt-2 border-t border-zinc-50">
              <p className="text-[11px] font-medium text-zinc-400">Clique em uma barra para ver os detalhes do período</p>
           </div>
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
                <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-[13px] font-medium text-zinc-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors">
                   Cancelar
                </button>
                <button 
                  onClick={() => {
                    // Persistent delete logic
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
                 <h2 className="text-[16px] font-bold text-zinc-900">Negócios | Q2 2026</h2>
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
