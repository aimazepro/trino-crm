"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Pencil, Trash2, GripVertical, Play, CircleCheck, Lock, Share2, Users, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { useCrm } from "@/contexts/crm-context";
import { TimeField } from "@/components/ui/time-field";
import {
  StepType,
  StepUnit,
  SequenceStepItem,
  SequenceSharing,
  SequenceItem,
  STEP_TYPES,
  getStepColors,
  parseSequenceStepNote,
  getStepPreviewSubtext,
  enrollDealInSequence,
} from "@/lib/sequence-helpers";
import { RequireCapability } from "@/components/auth/require-capability";

function SequenciasPageContent() {
  const supabase = createClient();
  const { workspaceId } = useWorkspace();
  const { state: crmState, addActivity } = useCrm();

  const [sequences, setSequences] = useState<SequenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal 1: Create / Edit Sequence
  const [showModal, setShowModal] = useState(false);
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name: string;
    description: string;
    skipWeekends: boolean;
    sharing: SequenceSharing;
  }>({
    name: "",
    description: "",
    skipWeekends: false,
    sharing: "ONLY_ME",
  });
  const [steps, setSteps] = useState<SequenceStepItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Modal 2: Iniciar Sequência
  const [startModalSequence, setStartModalSequence] = useState<SequenceItem | null>(null);
  const [dealSearchQuery, setDealSearchQuery] = useState("");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Modal 3: Compartilhar Template
  const [shareModalSequence, setShareModalSequence] = useState<SequenceItem | null>(null);
  const [selectedSharing, setSelectedSharing] = useState<SequenceSharing>("ONLY_ME");
  const [savingShare, setSavingShare] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  // Drag and drop state for sequence steps
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragEnabledIndex, setDragEnabledIndex] = useState<number | null>(null);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const loadSequences = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("sequences")
      .select("*, sequence_steps(*)")
      .order("created_at");

    if (error) {
      console.error("Error loading sequences:", error);
      setLoading(false);
      return;
    }

    const sortedData: SequenceItem[] = (data ?? []).map(seq => ({
      ...seq,
      sharing: (seq.tags?.find((t: string) => t.startsWith("sharing:"))?.replace("sharing:", "") as SequenceSharing) || "ONLY_ME",
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

  const updateStep = (id: string, changes: Partial<SequenceStepItem>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...changes } : s));
  };

  const openNewModal = () => {
    setEditingSequenceId(null);
    setForm({ name: "", description: "", skipWeekends: false, sharing: "ONLY_ME" });
    setSteps([
      {
        id: crypto.randomUUID(),
        type: "Ligação",
        title: "cold call",
        notes: "",
        unitValue: 1,
        unit: "DAYS",
        time: "09:00",
      }
    ]);
    setShowModal(true);
  };

  const openEditModal = (seq: SequenceItem) => {
    setEditingSequenceId(seq.id);
    setForm({
      name: seq.name,
      description: seq.description || "",
      skipWeekends: seq.skip_weekends || false,
      sharing: seq.sharing || "ONLY_ME",
    });

    const mappedSteps: SequenceStepItem[] = (seq.sequence_steps || [])
      .map(step => {
        const parsed = parseSequenceStepNote(step.note, step.day_offset);
        return {
          id: step.id || crypto.randomUUID(),
          type: step.step_type as StepType,
          title: parsed.title,
          notes: parsed.notes,
          time: parsed.time,
          unit: parsed.unit,
          unitValue: parsed.unitValue,
          emailTemplateId: parsed.emailTemplateId,
        };
      });

    setSteps(mappedSteps);
    setShowModal(true);
  };

  const handleSaveSequence = async () => {
    if (!form.name.trim() || steps.length === 0) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSaving(false);
        return;
      }

      // Build tags array preserving step type tags + sharing tag
      const typeTags = Array.from(new Set(steps.map(s => s.type))).slice(0, 3);
      const tags = [...typeTags, `sharing:${form.sharing}`];

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
            workspace_id: workspaceId,
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
            emailTemplateId: step.emailTemplateId,
          });

          return {
            sequence_id: seqId!,
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

  const handleDeleteSequence = async (id: string) => {
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

  // Handlers for "Iniciar Sequência"
  const openStartModal = (seq: SequenceItem) => {
    setStartModalSequence(seq);
    setSelectedDealId(null);
    setDealSearchQuery("");
  };

  const handleStartSequenceOnDeal = async () => {
    if (!startModalSequence || !selectedDealId) return;

    await enrollDealInSequence({
      dealId: selectedDealId,
      sequence: startModalSequence,
      addActivity,
      supabase,
    });

    setStartModalSequence(null);
  };

  // Handlers for "Compartilhar template"
  const openShareModal = (seq: SequenceItem) => {
    setShareModalSequence(seq);
    setSelectedSharing(seq.sharing || "ONLY_ME");
  };

  const handleSaveShare = async () => {
    if (!shareModalSequence) return;
    setSavingShare(true);

    try {
      // Update tags array with new sharing tag
      const existingTags = (shareModalSequence.tags || []).filter(t => !t.startsWith("sharing:"));
      const newTags = [...existingTags, `sharing:${selectedSharing}`];

      const { error } = await supabase
        .from("sequences")
        .update({ tags: newTags })
        .eq("id", shareModalSequence.id);

      if (error) throw error;

      showToast("Permissões de compartilhamento salvas.");
      setShareModalSequence(null);
      await loadSequences();
    } catch (err) {
      console.error("Error saving sequence sharing:", err);
    } finally {
      setSavingShare(false);
    }
  };

  const isSearchEmpty = !dealSearchQuery.trim();
  const filteredDeals = isSearchEmpty
    ? []
    : crmState.deals.filter(d => {
        const q = dealSearchQuery.toLowerCase();
        const contact = d.contactId ? crmState.contacts.find(c => c.id === d.contactId) : null;
        const company = d.companyId ? crmState.companies.find(c => c.id === d.companyId) : null;
        return (
          d.title.toLowerCase().includes(q) ||
          (contact?.name && contact.name.toLowerCase().includes(q)) ||
          (company?.name && company.name.toLowerCase().includes(q))
        );
      });

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        
        {/* Toast Notification */}
        {toast && toast.visible && (
          <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-zinc-800">
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
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors border-0 outline-none cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nova Sequência
          </button>
        </div>

        {/* Sequences Cards List */}
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
              
              // Filter out internal sharing tag for step tags preview
              const stepTypes = Array.from(
                new Set(seq.sequence_steps?.map(s => s.step_type) || [])
              );

              // Sharing label and icon
              let sharingLabel = "Só eu";
              let SharingIcon = Lock;
              if (seq.sharing === "SPECIFIC_USERS") {
                sharingLabel = "Usuários específicos";
                SharingIcon = Users;
              } else if (seq.sharing === "WORKSPACE") {
                sharingLabel = "Todo o workspace";
                SharingIcon = Globe;
              }

              return (
                <div
                  key={seq.id}
                  className="border border-zinc-200 rounded-xl p-5 flex items-start justify-between gap-4 bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-zinc-900">{seq.name}</h3>
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500">
                        <SharingIcon className="h-3 w-3" />
                        {sharingLabel}
                      </span>
                    </div>
                    {seq.description && <p className="text-sm text-zinc-500 mt-0.5">{seq.description}</p>}
                    <p className="text-xs text-zinc-400 mt-1">{stepText}</p>
                    {stepTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {stepTypes.map((tag) => {
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
                      onClick={() => openStartModal(seq)}
                      className="flex items-center gap-1.5 text-sm font-medium text-amber-600 border border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Iniciar
                    </button>
                    <button
                      type="button"
                      onClick={() => openShareModal(seq)}
                      className="flex items-center gap-1.5 text-sm text-zinc-600 border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Compartilhar
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(seq)}
                      className="flex items-center gap-1.5 text-sm text-zinc-600 border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSequence(seq.id)}
                      className="text-zinc-300 hover:text-red-400 transition-colors border-0 bg-transparent p-1 cursor-pointer"
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

      {/* Modal 1: Nova / Editar Sequência */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col border border-zinc-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-semibold text-zinc-900">
                {editingSequenceId ? "Editar Sequência" : "Nova Sequência"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 border-0 bg-transparent cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
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
                    className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-300 accent-amber-500 cursor-pointer"
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
                                    "text-xs font-medium px-2 py-0.5 rounded-full transition-colors cursor-pointer border-0",
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
                            className="text-zinc-300 hover:text-red-400 border-0 bg-transparent cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Title */}
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) => updateStep(step.id, { title: e.target.value })}
                          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                          placeholder="Titulo da atividade"
                        />

                        {/* Email Template selector if type === "Email" */}
                        {step.type === "Email" && (
                          <div>
                            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                              Template de email
                            </label>
                            <select
                              value={step.emailTemplateId || ""}
                              onChange={(e) => updateStep(step.id, { emailTemplateId: e.target.value })}
                              className="mt-1 w-full border border-zinc-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white"
                            >
                              <option value="">Sem template (descrição manual abaixo)</option>
                            </select>
                          </div>
                        )}

                        {/* Notes */}
                        <textarea
                          rows={2}
                          value={step.notes}
                          onChange={(e) => updateStep(step.id, { notes: e.target.value })}
                          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200 resize-y min-h-[60px]"
                          placeholder="Observacao (ex: script de ligacao, instrucoes para o vendedor...)"
                        />

                        {/* Timing */}
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
                            onChange={(e) => updateStep(step.id, { unit: e.target.value as StepUnit })}
                            className="border border-zinc-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white cursor-pointer"
                          >
                            <option value="DAYS">Dias</option>
                            <option value="WEEKS">Semanas</option>
                            <option value="MONTHS">Meses</option>
                          </select>
                          <span className="ml-2">às</span>
                          <TimeField
                            value={step.time}
                            onChange={(time) => updateStep(step.id, { time })}
                            className="w-24 rounded px-2 py-1 focus:ring-2 focus:ring-amber-200"
                          />
                          <span className="text-xs text-zinc-400">(usa horário da atribuição se vazio)</span>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addStep}
                    className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium bg-transparent border-0 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar passo
                  </button>
                </div>
              </div>

              {/* Prévia da sequência */}
              <div className="mt-2 border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50/50">
                <div className="px-3 py-2 border-b border-zinc-200 bg-white">
                  <p className="text-xs font-semibold text-zinc-700">Prévia da sequência</p>
                  <p className="text-[10px] text-zinc-400">
                    Uma atividade de cada vez: o próximo passo nasce quando você conclui o anterior.
                  </p>
                </div>

                <ol className="p-3 space-y-0">
                  {steps.map((step, idx) => {
                    const colors = getStepColors(step.type);
                    const isLast = idx === steps.length - 1;
                    const displayTitle = step.title.trim() || step.type;
                    const subtext = getStepPreviewSubtext(step, idx);

                    return (
                      <li key={step.id || idx} className="relative flex gap-3 pb-3 last:pb-0">
                        {!isLast && (
                          <span
                            className="absolute left-[11px] top-6 bottom-0 w-px bg-zinc-200"
                            aria-hidden="true"
                          />
                        )}
                        <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white border border-zinc-300 text-[10px] font-semibold text-zinc-600">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-[9px] font-medium px-1.5 py-0.5 rounded border",
                                colors.bg,
                                colors.text,
                                colors.border
                              )}
                            >
                              {step.type}
                            </span>
                            <span className="text-xs font-medium text-zinc-700 truncate">
                              {displayTitle}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{subtext}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 rounded-lg border-0 bg-transparent cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSequence}
                disabled={!form.name.trim() || saving || steps.length === 0}
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md text-white rounded-lg disabled:opacity-60 transition-colors border-0 cursor-pointer"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal 2: Iniciar Sequência */}
      {startModalSequence && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setStartModalSequence(null)}
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setStartModalSequence(null)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 border-0 bg-transparent cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-zinc-900">Iniciar Sequência</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Selecione o negócio que receberá as atividades de{" "}
              <strong className="font-semibold text-zinc-900">{startModalSequence.name}</strong>.
            </p>

            <div className="mt-4">
              <input
                type="text"
                placeholder="Buscar negócio..."
                value={dealSearchQuery}
                onChange={(e) => setDealSearchQuery(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>

            <div className="mt-3 overflow-y-auto max-h-[220px] space-y-2 pr-1">
              {isSearchEmpty ? null : filteredDeals.length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center">Nenhum negócio encontrado.</p>
              ) : (
                filteredDeals.map((deal) => {
                  const isSelected = selectedDealId === deal.id;
                  const contact = deal.contactId ? crmState.contacts.find(c => c.id === deal.contactId) : null;
                  const company = deal.companyId ? crmState.companies.find(c => c.id === deal.companyId) : null;
                  const subText = contact?.name || company?.name;

                  return (
                    <button
                      key={deal.id}
                      type="button"
                      onClick={() => setSelectedDealId(deal.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border text-sm transition-colors cursor-pointer flex items-center justify-between",
                        isSelected
                          ? "border-amber-500 bg-amber-50/50 text-zinc-900"
                          : "border-zinc-200 hover:border-zinc-300 text-zinc-700 bg-white"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{deal.title}</p>
                        {subText && (
                          <p className="text-xs text-zinc-400 truncate mt-0.5">
                            {subText}
                          </p>
                        )}
                      </div>
                      {typeof deal.value === "number" && deal.value > 0 && (
                        <span className="text-xs font-semibold text-zinc-500 shrink-0 ml-2">
                          R$ {deal.value.toLocaleString("pt-BR")}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStartModalSequence(null)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 rounded-lg border-0 bg-transparent cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStartSequenceOnDeal}
                disabled={!selectedDealId}
                className="px-4 py-2 text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-0 cursor-pointer"
              >
                Iniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Compartilhar Template */}
      {shareModalSequence && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShareModalSequence(null)}
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShareModalSequence(null)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 border-0 bg-transparent cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-zinc-900">Compartilhar template</h2>
            <p className="text-sm text-zinc-500 mt-1 truncate">{shareModalSequence.name}</p>

            <div className="mt-5 space-y-2">
              {/* Option 1: Só eu */}
              <button
                type="button"
                onClick={() => setSelectedSharing("ONLY_ME")}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                  selectedSharing === "ONLY_ME"
                    ? "border-amber-500 bg-amber-50/50"
                    : "border-zinc-200 hover:border-zinc-300"
                )}
              >
                <Lock
                  className={cn(
                    "h-5 w-5 shrink-0 mt-0.5",
                    selectedSharing === "ONLY_ME" ? "text-amber-500" : "text-zinc-400"
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">Só eu</p>
                  <p className="text-xs text-zinc-500">Apenas você vê e usa este template.</p>
                </div>
              </button>

              {/* Option 2: Usuários específicos */}
              <button
                type="button"
                onClick={() => setSelectedSharing("SPECIFIC_USERS")}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                  selectedSharing === "SPECIFIC_USERS"
                    ? "border-amber-500 bg-amber-50/50"
                    : "border-zinc-200 hover:border-zinc-300"
                )}
              >
                <Users
                  className={cn(
                    "h-5 w-5 shrink-0 mt-0.5",
                    selectedSharing === "SPECIFIC_USERS" ? "text-amber-500" : "text-zinc-400"
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">Usuários específicos</p>
                  <p className="text-xs text-zinc-500">Escolha quem da equipe pode usar.</p>
                </div>
              </button>

              {/* Option 3: Todo o workspace */}
              <button
                type="button"
                onClick={() => setSelectedSharing("WORKSPACE")}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                  selectedSharing === "WORKSPACE"
                    ? "border-amber-500 bg-amber-50/50"
                    : "border-zinc-200 hover:border-zinc-300"
                )}
              >
                <Globe
                  className={cn(
                    "h-5 w-5 shrink-0 mt-0.5",
                    selectedSharing === "WORKSPACE" ? "text-amber-500" : "text-zinc-400"
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">Todo o workspace</p>
                  <p className="text-xs text-zinc-500">Todos da equipe podem usar.</p>
                </div>
              </button>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShareModalSequence(null)}
                className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors border-0 bg-transparent cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveShare}
                disabled={savingShare}
                className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 py-2.5 text-sm font-bold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors border-0 cursor-pointer"
              >
                {savingShare ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Sequência é modelo do workspace: só admin/gerente cria, edita e compartilha.
// A RLS de `sequences` e `sequence_steps` já exige is_ws_manager para escrever.
// Vendedor continua *aplicando* uma sequência num negócio pela aba de
// atividades -- aquilo só cria atividades, não toca na sequência.
export default function SequenciasPage() {
  return (
    <RequireCapability capability="gerenciar_sequencias">
      <SequenciasPageContent />
    </RequireCapability>
  );
}
