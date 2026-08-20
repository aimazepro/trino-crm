"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Target, TrendingUp, Trophy, DollarSign, Activity, X, ArrowRight, ArrowLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchGoalProgress } from "@/lib/goals-helpers";
import { useWorkspace } from "@/lib/workspace";

type GoalType = "Negócios Adicionados" | "Negócios em Andamento" | "Negócios Ganhos" | "Receita" | "Atividades";

const GOAL_TYPES = [
  { id: "Negócios Adicionados", title: "Negócios Adicionados", desc: "Quantidade ou valor de negócios criados", icon: Plus, defaultPlaceholder: "Negocios Adicionados" },
  { id: "Negócios em Andamento", title: "Negócios em Andamento", desc: "Negócios que atingiram determinada etapa", icon: TrendingUp, defaultPlaceholder: "Negocios em Andamento" },
  { id: "Negócios Ganhos", title: "Negócios Ganhos", desc: "Quantidade ou valor de negócios fechados", icon: Trophy, defaultPlaceholder: "Negocios Ganhos" },
  { id: "Receita", title: "Receita", desc: "Valor total de receita gerada", icon: DollarSign, defaultPlaceholder: "Receita" },
  { id: "Atividades", title: "Atividades", desc: "Quantidade de atividades concluídas", icon: Activity, defaultPlaceholder: "Atividades Concluidas" },
];

const PERIOD_LABELS: Record<string, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
};

export default function MetasPage() {
  const router = useRouter();
  const supabase = createClient();
  const { workspaceId } = useWorkspace();
  
  const [goals, setGoals] = useState<any[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<GoalType>("Negócios Adicionados");

  const [formData, setFormData] = useState({
    name: "",
    metric: "COUNT",
    period: "MONTHLY",
    target: "",
    pipelineId: "",
    ownerUserId: "",
    startDate: "",
    endDate: "",
  });

  // Load pipelines and team members/users for selects
  const loadOptionsData = useCallback(async (userId: string) => {
    const { data: pData } = await supabase
      .from("pipelines")
      .select("id, name")
      .order("sort_order");
    setPipelines(pData ?? []);

    const { data: { user } } = await supabase.auth.getUser();
    const selfName = user?.user_metadata?.full_name || user?.email || "joao paulo";
    const userList = [{ id: userId, name: selfName }];

    const { data: members } = await supabase
      .from("workspace_members")
      .select("member_user_id, name, email")
      .eq("workspace_id", workspaceId)
      .eq("status", "active");

    (members ?? []).forEach((m) => {
      if (m.member_user_id && m.member_user_id !== userId) {
        userList.push({ id: m.member_user_id, name: m.name || m.email });
      }
    });

    setUsers(userList);
  }, [supabase, workspaceId]);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    await loadOptionsData(user.id);

    const { data: goalsData } = await supabase
      .from("goals")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    const loadedGoals = goalsData ?? [];

    // Calculate real progress for each goal from Supabase
    const goalsWithProgress = await Promise.all(
      loadedGoals.map(async (goal) => {
        const { currentValue } = await fetchGoalProgress(supabase, goal);
        return { ...goal, current_value: currentValue };
      })
    );

    setGoals(goalsWithProgress);
    setLoading(false);
  }, [supabase, workspaceId, loadOptionsData]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const openModal = () => {
    setStep(1);
    setSelectedType("Negócios Adicionados");
    setFormData({
      name: "",
      metric: "COUNT",
      period: "MONTHLY",
      target: "",
      pipelineId: "",
      ownerUserId: "",
      startDate: "",
      endDate: "",
    });
    setShowModal(true);
  };

  const handleSelectType = (typeId: GoalType) => {
    setSelectedType(typeId);
  };

  const handleNextStep = () => {
    const config = GOAL_TYPES.find((t) => t.id === selectedType);
    const defaultMetric = selectedType === "Receita" ? "VALUE" : "COUNT";
    setFormData((prev) => ({
      ...prev,
      name: prev.name || "",
      metric: defaultMetric,
    }));
    setStep(2);
  };

  const handleCreateGoal = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const config = GOAL_TYPES.find((t) => t.id === selectedType);
    const finalName = formData.name.trim() || config?.defaultPlaceholder || selectedType;
    const finalMetric = selectedType === "Receita" ? "VALUE" : (selectedType === "Atividades" ? "COUNT" : formData.metric);

    const { data, error } = await supabase
      .from("goals")
      .insert({
        workspace_id: workspaceId,
        title: finalName,
        goal_type: selectedType,
        metric: finalMetric,
        period: formData.period,
        target_value: parseFloat(formData.target) || 0,
        pipeline_id: selectedType === "Atividades" ? null : (formData.pipelineId || null),
        owner_user_id: formData.ownerUserId || null,
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
      })
      .select()
      .single();

    setSaving(false);
    if (!error && data) {
      const { currentValue } = await fetchGoalProgress(supabase, data);
      setGoals((prev) => [{ ...data, current_value: currentValue }, ...prev]);
      setShowModal(false);
    }
  };

  const handleDeleteGoal = async () => {
    if (!goalToDelete) return;
    await supabase.from("goals").delete().eq("id", goalToDelete);
    setGoals((prev) => prev.filter((g) => g.id !== goalToDelete));
    setShowDeleteModal(false);
    setGoalToDelete(null);
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

  return (
    <div className="flex-1 overflow-y-auto bg-[#F3F4F6] border-l border-zinc-200 min-h-screen">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Metas</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Acompanhe o progresso das suas metas de vendas</p>
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-400 rounded-lg hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors"
          >
            <Plus className="h-4 w-4" /> Nova Meta
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          </div>
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-amber-100">
              <Target size={32} className="text-amber-500" strokeWidth={2} />
            </div>
            <h2 className="text-[15px] font-bold text-zinc-900 mb-2">Nenhuma meta criada</h2>
            <p className="text-sm text-zinc-400 mb-8 leading-relaxed max-w-sm">
              Defina metas para acompanhar o desempenho da sua equipe em negócios, receita e atividades.
            </p>
            <button
              onClick={openModal}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-400 rounded-lg hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors"
            >
              <Plus className="h-4 w-4" /> Criar primeira meta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => {
              const IconComp = getGoalIcon(goal.goal_type);
              const targetVal = Number(goal.target_value) || 1;
              const curVal = Number(goal.current_value) || 0;
              const pct = Math.min(100, Math.round((curVal / targetVal) * 100));
              const isValueMetric = goal.metric === "VALUE" || goal.goal_type === "Receita";

              return (
                <div
                  key={goal.id}
                  onClick={() => router.push(`/metas/${goal.id}`)}
                  className="bg-white rounded-xl p-5 flex flex-col gap-4 cursor-pointer hover:shadow-md transition-shadow border border-zinc-100"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <IconComp className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{goal.title}</p>
                        <p className="text-xs text-zinc-400">
                          {goal.goal_type} | {PERIOD_LABELS[goal.period] ?? goal.period}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setGoalToDelete(goal.id);
                        setShowDeleteModal(true);
                      }}
                      className="p-1.5 rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      aria-label="Excluir meta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-xl font-bold text-zinc-900">
                        {isValueMetric ? `R$ ${curVal.toLocaleString("pt-BR")}` : curVal.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-xs text-zinc-400">
                        de {isValueMetric ? `R$ ${targetVal.toLocaleString("pt-BR")}` : targetVal.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-100">
                      <div
                        className="h-2 rounded-full transition-all bg-amber-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-zinc-400">Em andamento</span>
                      <span className="text-xs font-bold text-amber-600">{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Nova Meta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Nova Meta</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Passo {step} de 2</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mx-6 h-1 rounded-full bg-zinc-100 mb-5">
              <div
                className="h-1 rounded-full bg-amber-500 transition-all"
                style={{ width: step === 1 ? "50%" : "100%" }}
              />
            </div>
            <div className="px-6 pb-6 space-y-4">
              {step === 1 ? (
                <>
                  <p className="text-xs font-medium text-zinc-600 mb-3">Que tipo de meta voce quer acompanhar?</p>
                  <div className="space-y-2">
                    {GOAL_TYPES.map((type) => {
                      const isSelected = selectedType === type.id;
                      const IconComponent = type.icon;
                      return (
                        <button
                          key={type.id}
                          onClick={() => handleSelectType(type.id as GoalType)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                            isSelected
                              ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-400"
                              : "border-zinc-200 hover:border-zinc-300"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                              isSelected ? "bg-amber-100 text-amber-600" : "bg-zinc-100 text-zinc-500"
                            )}
                          >
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div>
                            <p className={cn("text-sm font-medium", isSelected ? "text-amber-700" : "text-zinc-700")}>
                              {type.title}
                            </p>
                            <p className="text-xs text-zinc-400">{type.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-end pt-3">
                    <button
                      onClick={handleNextStep}
                      disabled={!selectedType}
                      className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-400 rounded-lg hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors disabled:opacity-50"
                    >
                      Proximo <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Nome da Meta */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">Nome da meta</label>
                    <input
                      type="text"
                      placeholder={GOAL_TYPES.find((t) => t.id === selectedType)?.defaultPlaceholder || "Nome da meta"}
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  {/* Metrica & Periodo */}
                  {selectedType === "Receita" || selectedType === "Atividades" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1.5">Periodo</label>
                        <select
                          value={formData.period}
                          onChange={(e) => setFormData((prev) => ({ ...prev, period: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          <option value="WEEKLY">Semanal</option>
                          <option value="MONTHLY">Mensal</option>
                          <option value="QUARTERLY">Trimestral</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1.5">Metrica</label>
                        <select
                          value={formData.metric}
                          onChange={(e) => setFormData((prev) => ({ ...prev, metric: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          <option value="COUNT">Quantidade</option>
                          <option value="VALUE">Valor (R$)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1.5">Periodo</label>
                        <select
                          value={formData.period}
                          onChange={(e) => setFormData((prev) => ({ ...prev, period: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          <option value="WEEKLY">Semanal</option>
                          <option value="MONTHLY">Mensal</option>
                          <option value="QUARTERLY">Trimestral</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Quantidade alvo / Valor alvo (R$) */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                      {selectedType === "Receita" || formData.metric === "VALUE" ? "Valor alvo (R$)" : "Quantidade alvo"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder={selectedType === "Receita" ? "100000" : "10"}
                      value={formData.target}
                      onChange={(e) => setFormData((prev) => ({ ...prev, target: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  {/* Pipeline (opcional) - Omitted for Atividades */}
                  {selectedType !== "Atividades" && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1.5">Pipeline (opcional)</label>
                      <select
                        value={formData.pipelineId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, pipelineId: e.target.value }))}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="">Todos os pipelines</option>
                        {pipelines.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Responsavel (opcional) */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">Responsavel (opcional)</label>
                    <select
                      value={formData.ownerUserId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ownerUserId: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="">Todos os usuarios</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Datas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1.5">Data inicio (opcional)</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1.5">Data fim (opcional)</label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setStep(1)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 rounded-lg bg-zinc-100 hover:bg-zinc-200 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" /> Voltar
                    </button>
                    <button
                      onClick={handleCreateGoal}
                      disabled={!formData.target || saving}
                      className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-400 rounded-lg hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Criando..." : "Criar Meta"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                onClick={() => {
                  setShowDeleteModal(false);
                  setGoalToDelete(null);
                }}
                className="px-4 py-2 text-[13px] font-medium text-zinc-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteGoal}
                className="px-4 py-2 text-[13px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
