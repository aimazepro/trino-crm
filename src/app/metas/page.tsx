"use client";

import { useState } from "react";
import { Plus, Target, TrendingUp, Trophy, DollarSign, Activity, X, ChevronDown, Calendar, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type GoalType = "Negócios Adicionados" | "Negócios em Andamento" | "Negócios Ganhos" | "Receita" | "Atividades";

const GOAL_TYPES = [
  { id: "Negócios Adicionados", title: "Negócios Adicionados", desc: "Quantidade ou valor de negócios criados", icon: Plus },
  { id: "Negócios em Andamento", title: "Negócios em Andamento", desc: "Negócios que atingiram determinada etapa", icon: TrendingUp },
  { id: "Negócios Ganhos", title: "Negócios Ganhos", desc: "Quantidade ou valor de negócios fechados", icon: Trophy },
  { id: "Receita", title: "Receita", desc: "Valor total de receita gerada", icon: DollarSign },
  { id: "Atividades", title: "Atividades", desc: "Quantidade de atividades concluídas", icon: Activity },
];

export default function MetasPage() {
  const [goals, setGoals] = useState<any[]>([
    { id: "ligacoes", title: "ligacoes", subtitle: "Negócios Ganhos | Trimestral", current: 0, target: 100, progress: 0 }
  ]); // Simulated state with 1 item to match Image 4. If empty array, matches Image 1.

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<GoalType | "">("Negócios Ganhos");

  // Step 2 Form State
  const [formData, setFormData] = useState({
    name: "Negócios Ganhos",
    metric: "Quantidade", // Quantidade | Valor
    period: "Mensal", // Semanal | Mensal | Trimestral
    target: "10",
    pipeline: "Todos os pipelines",
    responsible: "Todos os usuários",
    startDate: "",
    endDate: ""
  });

  const openModal = () => {
    setStep(1);
    setSelectedType("Negócios Ganhos");
    setShowModal(true);
  };

  const handleNextStep = () => {
    if (selectedType) {
      setFormData({ ...formData, name: selectedType });
      setStep(2);
    }
  };

  const handleCreateGoal = () => {
    const newGoal = {
      id: Date.now().toString(),
      title: formData.name || selectedType,
      subtitle: `${selectedType} | ${formData.period}`,
      current: 0,
      target: parseInt(formData.target) || 0,
      progress: 0
    };
    setGoals([...goals, newGoal]);
    setShowModal(false);
  };

  const handleDeleteGoal = () => {
    if (goalToDelete) {
      setGoals(goals.filter(g => g.id !== goalToDelete));
    }
    setShowDeleteModal(false);
    setGoalToDelete(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#F3F4F6] border-l border-zinc-200">

      {/* Header */}
      <div className="flex items-start justify-between px-8 py-8 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Metas</h1>
          <p className="text-[13px] font-medium text-zinc-400 mt-1">Acompanhe o progresso das suas metas de vendas</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-lg text-[13px] font-medium hover:bg-amber-600 transition-all shadow-sm"
        >
          <Plus size={16} strokeWidth={2.5} /> Nova Meta
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-10">
        {goals.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-amber-100">
              <Target size={32} className="text-amber-500" strokeWidth={2} />
            </div>
            <h2 className="text-[15px] font-bold text-zinc-900 mb-2">Nenhuma meta criada</h2>
            <p className="text-[13px] font-medium text-zinc-400 mb-8 leading-relaxed max-w-sm">
              Defina metas para acompanhar o desempenho da sua equipe em negócios, receita e atividades.
            </p>
            <button
              onClick={openModal}
              className="flex items-center gap-2 bg-amber-500 text-white px-6 py-2.5 rounded-lg text-[13px] font-medium hover:bg-amber-600 transition-all shadow-md"
            >
              <Plus size={16} strokeWidth={2.5} /> Criar primeira meta
            </button>
          </div>
        ) : (
          /* List State */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goals.map(goal => (
              <Link href={`/metas/${goal.id}`} key={goal.id} className="block group">
                <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-zinc-200 transition-all relative">
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGoalToDelete(goal.id); setShowDeleteModal(true); }}
                    className="absolute top-6 right-6 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="flex bg-white items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-green-50 text-green-500 flex items-center justify-center">
                      <Trophy size={20} />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-zinc-900">{goal.title}</h3>
                      <p className="text-[12px] font-medium text-zinc-400">{goal.subtitle}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-2xl font-bold text-zinc-900">{goal.current}</span>
                      <span className="text-[12px] font-medium text-zinc-400">de {goal.target}</span>
                    </div>

                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${goal.progress}%` }} />
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[11px] font-medium text-zinc-400">Em andamento</span>
                      <span className="text-[12px] font-bold text-amber-500">{goal.progress}%</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Modal Nova Meta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/20 backdrop-blur-sm" onClick={() => setShowModal(false)} />

          <div className="relative w-full max-w-[500px] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header Modal */}
            <div className="px-6 py-5 flex items-start justify-between bg-white border-b border-zinc-100 shrink-0">
              <div>
                <h2 className="text-[16px] font-bold text-zinc-900">Nova Meta</h2>
                <p className="text-[12px] font-medium text-zinc-400 mt-1">Passo {step} de 2</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Progress Bar Modal */}
            <div className="w-full h-0.5 bg-zinc-100 shrink-0">
              <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: step === 1 ? '50%' : '100%' }} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
              {step === 1 ? (
                /* STEP 1 */
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <p className="text-[14px] font-medium text-zinc-700 mb-2">Que tipo de meta você quer acompanhar?</p>

                  <div className="space-y-3">
                    {GOAL_TYPES.map((type) => {
                      const isSelected = selectedType === type.id;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setSelectedType(type.id as GoalType)}
                          className={cn(
                            "w-full flex items-center p-4 rounded-xl border text-left transition-all",
                            isSelected ? "border-amber-500 bg-amber-50/10 shadow-sm" : "border-zinc-200 hover:border-zinc-300 bg-white"
                          )}
                        >
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mr-4", isSelected ? "bg-amber-100 text-amber-600" : "bg-zinc-50 text-zinc-400")}>
                            <type.icon size={20} />
                          </div>
                          <div>
                            <h4 className={cn("text-[14px] font-bold", isSelected ? "text-amber-700" : "text-zinc-700")}>{type.title}</h4>
                            <p className="text-[12px] font-medium text-zinc-400 mt-0.5">{type.desc}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                /* STEP 2 */
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-zinc-600">Nome da meta</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex gap-4">
                    <div className="space-y-1.5 flex-1">
                      <label className="text-[12px] font-medium text-zinc-600">Métrica</label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none px-3 py-2.5 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500 cursor-pointer"
                          value={formData.metric}
                          onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                        >
                          <option>Quantidade</option>
                          <option>Valor (R$)</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <label className="text-[12px] font-medium text-zinc-600">Período</label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none px-3 py-2.5 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500 cursor-pointer"
                          value={formData.period}
                          onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                        >
                          <option>Semanal</option>
                          <option>Mensal</option>
                          <option>Trimestral</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-zinc-600">
                      {formData.metric === "Valor (R$)" ? "Valor alvo (R$)" : "Quantidade alvo"}
                    </label>
                    <input
                      type="number"
                      value={formData.target}
                      onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-zinc-600">Pipeline (opcional)</label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none px-3 py-2.5 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500 cursor-pointer"
                        value={formData.pipeline}
                        onChange={(e) => setFormData({ ...formData, pipeline: e.target.value })}
                      >
                        <option>Todos os pipelines</option>
                        <option>Vendas B2B</option>
                        <option>Parcerias</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-zinc-600">Responsável (opcional)</label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none px-3 py-2.5 bg-white border border-amber-500 rounded-lg text-[13px] font-medium text-zinc-700 outline-none shadow-sm cursor-pointer" // Matches yellow border from screenshot focus state
                        value={formData.responsible}
                        onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                      >
                        <option>Todos os usuários</option>
                        <option>João Paulo</option>
                        <option>Equipe de Vendas</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="space-y-1.5 flex-1 relative">
                      <label className="text-[12px] font-medium text-zinc-600">Data início (opcional)</label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1.5 flex-1 relative">
                      <label className="text-[12px] font-medium text-zinc-600">Data fim (opcional)</label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Footer Fixado */}
            <div className="absolute bottom-0 left-0 w-full px-6 py-4 bg-white border-t border-zinc-100 flex items-center justify-between">
              {step === 1 ? (
                <>
                  <div />
                  <button
                    onClick={handleNextStep}
                    disabled={!selectedType}
                    className="bg-amber-500 text-white px-6 py-2.5 rounded-lg text-[13px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próximo →
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-zinc-500 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={handleCreateGoal}
                    className="bg-amber-500 text-white px-6 py-2.5 rounded-lg text-[13px] font-medium hover:bg-amber-600 transition-colors shadow-sm"
                  >
                    Criar Meta
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

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
                <button onClick={() => { setShowDeleteModal(false); setGoalToDelete(null); }} className="px-4 py-2 text-[13px] font-medium text-zinc-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors">
                   Cancelar
                </button>
                <button onClick={handleDeleteGoal} className="px-4 py-2 text-[13px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition-colors">
                   Excluir
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
