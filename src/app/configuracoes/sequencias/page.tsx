"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Pencil, Trash2, GripVertical, Play, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type StepType = "Ligação" | "Reunião" | "Videochamada" | "Email" | "WhatsApp" | "Instagram" | "LinkedIn" | "Outros";

type Step = {
  id: string;
  type: StepType;
  title: string;
  notes: string;
  unitValue: number;
  unit: "DAYS" | "WEEKS" | "MONTHS";
  time: string;
};

type Sequence = {
  id: string;
  name: string;
  description: string;
  skip_weekends: boolean;
  tags: string[];
  sequence_steps?: { id: string; step_type: string; day_offset: number; note: string; sort_order: number }[];
};

const STEP_TYPES: StepType[] = [
  "Ligação",
  "Reunião",
  "Videochamada",
  "Email",
  "WhatsApp",
  "Instagram",
  "LinkedIn",
  "Outros"
];

const STEP_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Ligação": { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  "Reunião": { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  "Videochamada": { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" },
  "Email": { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  "WhatsApp": { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  "Instagram": { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" },
  "LinkedIn": { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200" },
  "Outros": { bg: "bg-zinc-100", text: "text-zinc-700", border: "border-zinc-200" },
};

// Simulation date calculations starting from today
const getSimulationDays = () => {
  const today = new Date();
  const start = new Date(today);
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  start.setDate(today.getDate() - dayOfWeek);

  const days = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return { today, days };
};

const formatDayLabel = (date: Date, index: number) => {
  const day = date.getDate();
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthStr = monthNames[date.getMonth()];

  if (index === 0 || date.getDate() === 1) {
    return `${day} ${monthStr}`;
  }
  return `${day}`;
};

const formatSimStartLabel = (today: Date) => {
  const shortDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const dayOfWeek = shortDays[today.getDay()];
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `Simulação a partir de hoje (${dayOfWeek} ${day}/${month})`;
};

const getStepDate = (today: Date, unit: string, unitValue: number, skipWeekends: boolean) => {
  let offsetDays = 0;
  if (unit === "DAYS") offsetDays = unitValue;
  else if (unit === "WEEKS") offsetDays = unitValue * 7;
  else if (unit === "MONTHS") offsetDays = unitValue * 30;

  const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  baseDate.setDate(baseDate.getDate() + offsetDays);

  if (skipWeekends) {
    const day = baseDate.getDay();
    if (day === 6) {
      baseDate.setDate(baseDate.getDate() + 2); // Sat -> Mon
    } else if (day === 0) {
      baseDate.setDate(baseDate.getDate() + 1); // Sun -> Mon
    }
  }
  return baseDate;
};

const getCalendarBadgeText = (step: Step) => {
  if (step.time) {
    const shortType = step.type.slice(0, 3);
    return `${step.time} ${shortType}...`;
  }
  return step.type;
};

export default function SequenciasPage() {
  const supabase = createClient();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", description: "", skipWeekends: false });
  const [steps, setSteps] = useState<Step[]>([]);
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragEnabledIndex, setDragEnabledIndex] = useState<number | null>(null);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const loadSequences = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("sequences")
      .select("*, sequence_steps(*)")
      .eq("user_id", user.id)
      .order("created_at");

    const sortedData = (data ?? []).map(seq => ({
      ...seq,
      sequence_steps: seq.sequence_steps
        ? [...seq.sequence_steps].sort((a, b) => a.sort_order - b.sort_order)
        : []
    }));

    setSequences(sortedData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSequences();
  }, [loadSequences]);

  const addStep = () => {
    setSteps([
      ...steps,
      {
        id: crypto.randomUUID(),
        type: "Ligação",
        title: "",
        notes: "",
        unitValue: 0,
        unit: "DAYS",
        time: "",
      }
    ]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStep = (id: string, changes: Partial<Step>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...changes } : s));
  };

  const openNewModal = () => {
    setEditingSequenceId(null);
    setForm({ name: "", description: "", skipWeekends: false });
    setSteps([
      {
        id: crypto.randomUUID(),
        type: "Ligação",
        title: "",
        notes: "",
        unitValue: 0,
        unit: "DAYS",
        time: "",
      }
    ]);
    setShowModal(true);
  };

  const openEditModal = (seq: Sequence) => {
    setEditingSequenceId(seq.id);
    setForm({
      name: seq.name,
      description: seq.description || "",
      skipWeekends: seq.skip_weekends || false,
    });

    const mappedSteps = (seq.sequence_steps || [])
      .map(step => {
        let title = "";
        let notes = "";
        let time = "";
        let unit: "DAYS" | "WEEKS" | "MONTHS" = "DAYS";
        let unitValue = step.day_offset;
        try {
          const parsed = JSON.parse(step.note);
          title = parsed.title || "";
          notes = parsed.notes || "";
          time = parsed.time || "";
          unit = parsed.unit || "DAYS";
          unitValue = typeof parsed.unitValue === "number" ? parsed.unitValue : step.day_offset;
        } catch {
          title = step.note || "";
        }
        return {
          id: step.id || crypto.randomUUID(),
          type: step.step_type as StepType,
          title,
          notes,
          time,
          unit,
          unitValue,
        };
      });

    setSteps(mappedSteps);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || steps.length === 0) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSaving(false);
        return;
      }

      const tags = Array.from(new Set(steps.map(s => s.type))).slice(0, 3);
      let seqId = editingSequenceId;

      if (editingSequenceId) {
        const { error: seqError } = await supabase
          .from("sequences")
          .update({
            name: form.name.trim(),
            description: form.description.trim(),
            skip_weekends: form.skipWeekends,
            tags,
          })
          .eq("id", editingSequenceId);

        if (seqError) throw seqError;

        const { error: deleteError } = await supabase
          .from("sequence_steps")
          .delete()
          .eq("sequence_id", editingSequenceId);

        if (deleteError) throw deleteError;
      } else {
        const { data: newSeq, error: seqError } = await supabase
          .from("sequences")
          .insert({
            user_id: user.id,
            name: form.name.trim(),
            description: form.description.trim(),
            skip_weekends: form.skipWeekends,
            tags,
          })
          .select()
          .single();

        if (seqError || !newSeq) throw seqError || new Error("Failed to create sequence");
        seqId = newSeq.id;
      }

      if (steps.length > 0) {
        const stepsToInsert = steps.map((step, idx) => {
          let dayOffset = 0;
          if (step.unit === "DAYS") dayOffset = step.unitValue;
          else if (step.unit === "WEEKS") dayOffset = step.unitValue * 7;
          else if (step.unit === "MONTHS") dayOffset = step.unitValue * 30;

          const note = JSON.stringify({
            title: step.title,
            notes: step.notes,
            time: step.time,
            unit: step.unit,
            unitValue: step.unitValue,
          });

          return {
            sequence_id: seqId,
            step_type: step.type,
            day_offset: dayOffset,
            note,
            sort_order: idx,
          };
        });

        const { error: stepsError } = await supabase
          .from("sequence_steps")
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      showToast(editingSequenceId ? "Sequência salva." : "Sequência criada.");
      setShowModal(false);
      await loadSequences();
    } catch (error) {
      console.error("Error saving sequence:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("sequences").delete().eq("id", id);
      if (error) throw error;
      setSequences(prev => prev.filter(s => s.id !== id));
      showToast("Sequência excluída.");
    } catch (error) {
      console.error("Error deleting sequence:", error);
    }
  };

  // HTML5 Drag and drop sorting handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updatedSteps = [...steps];
    const item = updatedSteps[draggedIndex];
    updatedSteps.splice(draggedIndex, 1);
    updatedSteps.splice(index, 0, item);

    setDraggedIndex(index);
    setSteps(updatedSteps);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragEnabledIndex(null);
  };

  // Calendar Preview parameters
  const { today, days } = getSimulationDays();
  const uniqueTypes = Array.from(new Set(steps.map(s => s.type)));

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        
        {/* Toast Notification Component */}
        {toast && toast.visible && (
          <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-sm px-4 py-3 rounded-lg flex items-center gap-3 border border-zinc-800">
            <CircleCheck className="h-4 w-4 text-green-400 shrink-0" />
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-zinc-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Sequências de Atividades</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Modelos de cadências automatizadas para negócios.</p>
          </div>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors border-0 outline-none"
          >
            <Plus className="h-4 w-4" />
            Nova Sequência
          </button>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
          ) : sequences.length === 0 ? (
            <div className="border border-zinc-200 rounded-xl py-16 text-center bg-white">
              <p className="text-sm font-medium text-zinc-400">Nenhuma sequência criada ainda.</p>
            </div>
          ) : (
            sequences.map((seq) => {
              const stepCount = seq.sequence_steps?.length ?? 0;
              const stepText = stepCount === 1 ? "1 passo" : `${stepCount} passos`;
              
              // Unique tags in this sequence
              const seqTags = Array.from(new Set(seq.sequence_steps?.map(s => s.step_type) || []));

              return (
                <div
                  key={seq.id}
                  className="border border-zinc-200 rounded-xl p-5 flex items-start justify-between gap-4 bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-zinc-900">{seq.name}</h3>
                    {seq.description && <p className="text-sm text-zinc-500 mt-0.5">{seq.description}</p>}
                    <p className="text-xs text-zinc-400 mt-1">{stepText}</p>
                    {seqTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {seqTags.map((tag) => {
                          const tagColors = getStepColors(tag);
                          return (
                            <span
                              key={tag}
                              className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded-full border",
                                tagColors.bg,
                                tagColors.text,
                                tagColors.border
                              )}
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm font-medium text-amber-600 border border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Iniciar
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(seq)}
                      className="flex items-center gap-1.5 text-sm text-zinc-600 border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(seq.id)}
                      className="text-zinc-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Dialog Component */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col border border-zinc-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-semibold text-zinc-900">
                {editingSequenceId ? "Editar Sequência" : "Nova Sequência"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Nome
                </label>
                <input
                  type="text"
                  placeholder="Ex: Prospecção Inicial"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Descrição
                </label>
                <textarea
                  rows={2}
                  placeholder="Opcional"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                />
              </div>

              {/* Skip Weekends */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.skipWeekends}
                    onChange={(e) => setForm({ ...form, skipWeekends: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-300 accent-amber-500"
                  />
                  <span className="text-sm text-zinc-700 font-medium">Pular finais de semana</span>
                </label>
                <p className="mt-1 text-xs text-zinc-400 ml-6">
                  Se a atividade cair no sabado ou domingo, sera ajustada para a segunda-feira seguinte.
                </p>
              </div>

              {/* Steps List */}
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Passos
                </label>
                
                <div className="mt-2 space-y-3">
                  {steps.map((step, index) => {
                    const isDragging = draggedIndex === index;
                    return (
                      <div
                        key={step.id}
                        draggable={dragEnabledIndex === index}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "border border-zinc-200 rounded-lg p-3 space-y-2 bg-white transition-all",
                          isDragging ? "opacity-40 border-dashed border-amber-300" : ""
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onMouseDown={() => setDragEnabledIndex(index)}
                            onMouseUp={() => setDragEnabledIndex(null)}
                            className="cursor-grab text-zinc-300 hover:text-zinc-500 touch-none border-0 bg-transparent p-0"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          
                          <span className="text-xs font-semibold text-zinc-400 w-5">
                            {index + 1}.
                          </span>
                          
                          <div className="flex gap-1 flex-wrap flex-1">
                            {STEP_TYPES.map((t) => {
                              const isSelected = step.type === t;
                              const tColors = getStepColors(t);
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => updateStep(step.id, { type: t })}
                                  className={cn(
                                    "text-xs font-medium px-2 py-0.5 rounded-full transition-colors",
                                    isSelected
                                      ? cn(tColors.bg, tColors.text)
                                      : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                                  )}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => removeStep(step.id)}
                            className="text-zinc-300 hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Step Title */}
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) => updateStep(step.id, { title: e.target.value })}
                          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                          placeholder="Titulo da atividade"
                        />

                        {/* Step Notes */}
                        <textarea
                          rows={2}
                          value={step.notes}
                          onChange={(e) => updateStep(step.id, { notes: e.target.value })}
                          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200 resize-y min-h-[60px]"
                          placeholder="Observacao (ex: script de ligacao, instrucoes para o vendedor...)"
                        />

                        {/* Step Timing & Offset */}
                        <div className="flex items-center gap-2 text-sm text-zinc-500 flex-wrap">
                          <span>em</span>
                          <input
                            type="number"
                            min="0"
                            value={step.unitValue}
                            onChange={(e) => updateStep(step.id, { unitValue: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-16 border border-zinc-200 rounded px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-amber-200"
                          />
                          <select
                            value={step.unit}
                            onChange={(e) => updateStep(step.id, { unit: e.target.value as "DAYS" | "WEEKS" | "MONTHS" })}
                            className="border border-zinc-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white"
                          >
                            <option value="DAYS">Dias</option>
                            <option value="WEEKS">Semanas</option>
                            <option value="MONTHS">Meses</option>
                          </select>
                          <span className="ml-2">às</span>
                          <input
                            type="time"
                            value={step.time}
                            onChange={(e) => updateStep(step.id, { time: e.target.value })}
                            className="border border-zinc-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                          />
                          <span className="text-xs text-zinc-400">(usa horário da atribuição se vazio)</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* DnD descriptors for accessibility styling compatibility */}
                  <div id="DndDescribedBy-5" style={{ display: "none" }}>
                    To pick up a draggable item, press the space bar.
                    While dragging, use the arrow keys to move the item.
                    Press space again to drop the item in its new position, or press escape to cancel.
                  </div>
                  <div id="DndLiveRegion-5" role="status" aria-live="assertive" aria-atomic="true" style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, margin: -1, border: 0, padding: 0, overflow: "hidden", clip: "rect(0px, 0px, 0px, 0px)", clipPath: "inset(100%)", whiteSpace: "nowrap" }} />

                  {/* Add Step Button */}
                  <button
                    type="button"
                    onClick={addStep}
                    className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium bg-transparent border-0"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar passo
                  </button>
                </div>
              </div>

              {/* Calendar Simulation Preview */}
              <div className="mt-2 border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50/50">
                
                {/* Preview Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
                  <div>
                    <p className="text-xs font-semibold text-zinc-700">Preview no calendário</p>
                    <p className="text-[10px] text-zinc-400">
                      {formatSimStartLabel(today)}
                    </p>
                  </div>
                  
                  {/* Selected Tags Legend in Preview */}
                  <div className="flex flex-wrap gap-1 justify-end max-w-[55%]">
                    {uniqueTypes.map((type) => {
                      const colors = getStepColors(type);
                      return (
                        <span
                          key={type}
                          className={cn(
                            "text-[9px] font-medium px-1.5 py-0.5 rounded border",
                            colors.bg,
                            colors.text,
                            colors.border
                          )}
                        >
                          {type}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Weekdays Row */}
                <div className="grid grid-cols-7 gap-px bg-zinc-200 border-b border-zinc-200 text-[10px] font-medium text-zinc-500">
                  <div className="text-center py-1 bg-zinc-50">Dom</div>
                  <div className="text-center py-1 bg-zinc-50">Seg</div>
                  <div className="text-center py-1 bg-zinc-50">Ter</div>
                  <div className="text-center py-1 bg-zinc-50">Qua</div>
                  <div className="text-center py-1 bg-zinc-50">Qui</div>
                  <div className="text-center py-1 bg-zinc-50">Sex</div>
                  <div className="text-center py-1 bg-zinc-50">Sáb</div>
                </div>

                {/* Grid Cells */}
                <div className="grid grid-cols-7 gap-px bg-zinc-200">
                  {days.map((d, idx) => {
                    const isToday = d.toDateString() === today.toDateString();
                    const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const dayLabel = formatDayLabel(d, idx);
                    
                    // Filter steps scheduled on this day
                    const daySteps = steps.filter((step) => {
                      const stepDate = getStepDate(today, step.unit, step.unitValue, form.skipWeekends);
                      return stepDate.getFullYear() === d.getFullYear() &&
                             stepDate.getMonth() === d.getMonth() &&
                             stepDate.getDate() === d.getDate();
                    });

                    return (
                      <div
                        key={idx}
                        className={cn(
                          "min-h-[58px] bg-white px-1 py-1 transition-all",
                          isPast ? "opacity-40" : "",
                          isToday ? "ring-2 ring-inset ring-amber-400" : ""
                        )}
                      >
                        <div className={cn("text-[10px] font-semibold", isToday ? "text-amber-600" : "text-zinc-500")}>
                          {dayLabel}
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                          {daySteps.map((step) => {
                            const stepColors = getStepColors(step.type);
                            return (
                              <div
                                key={step.id}
                                title={`${step.type}${step.title ? `: ${step.title}` : ""}`}
                                className={cn(
                                  "text-[9px] font-medium px-1 py-0.5 rounded border truncate",
                                  stepColors.bg,
                                  stepColors.text,
                                  stepColors.border
                                )}
                              >
                                {getCalendarBadgeText(step)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.name.trim() || saving || steps.length === 0}
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-white rounded-lg disabled:opacity-60 transition-colors"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}

// Helpers
const getStepColors = (type: string) => {
  return STEP_TYPE_COLORS[type] || { bg: "bg-zinc-100", text: "text-zinc-700", border: "border-zinc-200" };
};
