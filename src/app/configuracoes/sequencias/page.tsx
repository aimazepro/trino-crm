"use client";

import { useState } from "react";
import { Plus, X, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type StepType = "Email" | "Ligação" | "WhatsApp" | "Tarefa" | "Reunião" | "Visita" | "Outros";

type Step = {
  id: string;
  type: StepType;
  day: number;
  note: string;
};

type Sequence = {
  id: string;
  name: string;
  description: string;
  skipWeekends: boolean;
  steps: Step[];
  tags: string[];
};

const STEP_TYPES: StepType[] = ["Email", "Ligação", "WhatsApp", "Tarefa", "Reunião", "Visita", "Outros"];

const STEP_TYPE_COLORS: Record<StepType, string> = {
  Email: "bg-blue-100 text-blue-700",
  Ligação: "bg-green-100 text-green-700",
  WhatsApp: "bg-green-100 text-green-700",
  Tarefa: "bg-amber-100 text-amber-700",
  Reunião: "bg-purple-100 text-purple-700",
  Visita: "bg-orange-100 text-orange-700",
  Outros: "bg-zinc-100 text-zinc-600",
};

const TAG_COLORS = ["bg-green-100 text-green-700", "bg-blue-100 text-blue-700", "bg-amber-100 text-amber-700", "bg-purple-100 text-purple-700"];

// Build a mini calendar preview for the right panel
function CalendarPreview({ steps, skipWeekends }: { steps: Step[]; skipWeekends: boolean }) {
  const today = new Date(2026, 3, 16); // fixed reference
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

  // Map step days to actual calendar days
  const stepDayMap: Record<number, Step[]> = {};
  steps.forEach(step => {
    let targetDay = today.getDate() + step.day - 1;
    if (skipWeekends) {
      const d = new Date(today.getFullYear(), today.getMonth(), targetDay);
      if (d.getDay() === 0) targetDay += 1;
      else if (d.getDay() === 6) targetDay += 2;
    }
    if (targetDay <= daysInMonth) {
      if (!stepDayMap[targetDay]) stepDayMap[targetDay] = [];
      stepDayMap[targetDay].push(step);
    }
  });

  const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];
  const cells: (number | null)[] = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="select-none">
      <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
        {today.toLocaleString("pt-BR", { month: "long", year: "numeric" }).toUpperCase()}
      </p>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekdays.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-zinc-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isToday = day === today.getDate();
          const stepsOnDay = stepDayMap[day] || [];
          return (
            <div
              key={i}
              className={cn(
                "relative flex flex-col items-center justify-start rounded-lg p-1 min-h-[36px] transition-colors",
                isToday ? "bg-amber-50" : stepsOnDay.length > 0 ? "bg-zinc-50" : ""
              )}
            >
              <span className={cn(
                "text-[11px] font-bold leading-none mb-0.5",
                isToday ? "text-amber-600" : "text-zinc-600"
              )}>
                {day}
              </span>
              {stepsOnDay.slice(0, 2).map((step, si) => (
                <span key={si} className={cn("w-full text-center text-[9px] font-bold px-0.5 rounded truncate", STEP_TYPE_COLORS[step.type])}>
                  {step.type.slice(0, 3)}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      {steps.length === 0 && (
        <p className="text-[12px] font-medium text-zinc-400 mt-4 text-center">
          Adicione passos para ver o preview
        </p>
      )}
    </div>
  );
}

export default function SequenciasPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", skipWeekends: false });
  const [steps, setSteps] = useState<Step[]>([]);

  const addStep = () => {
    const newDay = steps.length > 0 ? Math.max(...steps.map(s => s.day)) + 1 : 1;
    setSteps([...steps, { id: Date.now().toString(), type: "Email", day: newDay, note: "" }]);
  };

  const removeStep = (id: string) => setSteps(steps.filter(s => s.id !== id));

  const updateStep = (id: string, changes: Partial<Step>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...changes } : s));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const tags = [...new Set(steps.map(s => s.type))].slice(0, 3);
    setSequences([...sequences, {
      id: Date.now().toString(),
      name: form.name,
      description: form.description,
      skipWeekends: form.skipWeekends,
      steps,
      tags,
    }]);
    setForm({ name: "", description: "", skipWeekends: false });
    setSteps([]);
    setShowModal(false);
  };

  const handleDelete = (id: string) => setSequences(sequences.filter(s => s.id !== id));

  const openModal = () => {
    setForm({ name: "", description: "", skipWeekends: false });
    setSteps([]);
    setShowModal(true);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Sequências de Atividades</h1>
          <p className="text-sm font-medium text-zinc-400 mt-0.5">Modelos de cadências automatizadas para negócios.</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus size={15} /> Nova Sequência
        </button>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-3xl">
          {sequences.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm py-16 text-center">
              <p className="text-[14px] font-medium text-zinc-400">Nenhuma sequência criada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sequences.map((seq) => (
                <div key={seq.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-4 shadow-sm flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <span className="text-[14px] font-bold text-zinc-900">{seq.name}</span>
                    <div className="flex gap-1.5">
                      {seq.tags.map((tag, i) => (
                        <span key={tag} className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", TAG_COLORS[i % TAG_COLORS.length])}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button className="flex items-center gap-1.5 text-[12px] font-bold text-zinc-500 hover:text-amber-600 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors">
                      <Edit2 size={13} /> Editar
                    </button>
                    <button onClick={() => handleDelete(seq.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova Sequência - Two-column layout */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-auto flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
              <h2 className="text-base font-bold text-zinc-900">Nova Sequência</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>

            {/* Modal body — two columns */}
            <div className="flex-1 overflow-hidden flex min-h-0">

              {/* Left column: form + steps */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 border-r border-zinc-100">

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">NOME</label>
                  <input
                    type="text"
                    placeholder="Ex: Prospecção Inicial"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">DESCRIÇÃO</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.skipWeekends}
                    onChange={e => setForm({ ...form, skipWeekends: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-700">Pular finais de semana</p>
                    <p className="text-[12px] font-medium text-zinc-400 mt-0.5">Atividades no sáb/dom serão ajustadas para segunda-feira.</p>
                  </div>
                </label>

                {/* Steps */}
                <div>
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-3">PASSOS</label>

                  {steps.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {steps.map((step) => (
                        <div key={step.id} className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-zinc-400">Dia</span>
                            <input
                              type="number"
                              min={1}
                              value={step.day}
                              onChange={e => updateStep(step.id, { day: parseInt(e.target.value) || 1 })}
                              className="w-16 bg-white border border-zinc-200 text-[13px] font-bold text-zinc-900 rounded-lg px-2 py-1 outline-none focus:border-amber-500 text-center"
                            />
                            <button onClick={() => removeStep(step.id)} className="ml-auto p-1 text-zinc-300 hover:text-red-500 rounded">
                              <X size={13} />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {STEP_TYPES.map(t => (
                              <button
                                key={t}
                                onClick={() => updateStep(step.id, { type: t })}
                                className={cn(
                                  "text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors",
                                  step.type === t
                                    ? "bg-amber-500 text-white"
                                    : "bg-white border border-zinc-200 text-zinc-500 hover:border-amber-300"
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Nota sobre este passo (opcional)..."
                            value={step.note}
                            onChange={e => updateStep(step.id, { note: e.target.value })}
                            className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-3 py-1.5 outline-none focus:border-amber-500 transition-all text-zinc-600"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={addStep}
                    className="flex items-center gap-1.5 text-[13px] font-bold text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    <Plus size={14} /> Adicionar passo
                  </button>
                </div>
              </div>

              {/* Right column: calendar preview */}
              <div className="w-[220px] shrink-0 px-4 py-5 bg-zinc-50/50 overflow-y-auto">
                <CalendarPreview steps={steps} skipWeekends={form.skipWeekends} />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200">
                Cancelar
              </button>
              <button onClick={handleSave} className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
