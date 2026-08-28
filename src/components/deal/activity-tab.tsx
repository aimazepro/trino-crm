"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ListTodo, Trash2, Pencil, AlertCircle, Phone, Mail, Video, Users,
  MessageCircle, Hash, ChevronDown, Plus, Calendar, Play, Search, CircleCheck, X
} from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Deal, Activity } from "@/lib/crm-types";
import { ActivityModal } from "./activity-modal";
import { NextActivityModal } from "./next-activity-modal";
import { cn } from "@/lib/utils";
import { isPast, isToday, isTomorrow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { SequenceItem, getStepColors, enrollDealInSequence } from "@/lib/sequence-helpers";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  "Ligação":      <Phone className="h-4 w-4" />,
  "Reunião":      <Users className="h-4 w-4" />,
  "Videochamada": <Video className="h-4 w-4" />,
  "Email":        <Mail className="h-4 w-4" />,
  "WhatsApp":     <MessageCircle className="h-4 w-4" />,
  "Instagram":    <Hash className="h-4 w-4" />,
  "LinkedIn":     <Hash className="h-4 w-4" />,
  "Outros":       <Hash className="h-4 w-4" />,
};

const getIcon = (type: string) => TYPE_ICONS[type] ?? <Hash className="h-4 w-4" />;

export function ActivityTab({ deal, userName }: { deal: Deal; userName?: string }) {
  const supabase = createClient();
  const { addActivity, deleteActivity, updateActivity } = useCrm();

  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showNextModal, setShowNextModal] = useState(false);

  // Sequences menu state
  const [showSeqMenu, setShowSeqMenu] = useState(false);
  const [sequences, setSequences] = useState<SequenceItem[]>([]);
  const [seqSearchQuery, setSeqSearchQuery] = useState("");
  const [loadingSeqs, setLoadingSeqs] = useState(false);
  const [startingSeqId, setStartingSeqId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  const showToastNotification = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const loadSequences = useCallback(async () => {
    setLoadingSeqs(true);
    try {
      const { data, error } = await supabase
        .from("sequences")
        .select("*, sequence_steps(*)")
        .order("created_at");

      if (error) {
        console.error("Error loading sequences in deal activity tab:", error);
        setLoadingSeqs(false);
        return;
      }

      // Esta lista é o que a pessoa pode *aplicar* num negócio, e a RLS de
      // select de sequences já resolve isso desde o P4: "Só eu" e "Usuários
      // específicos" simplesmente não chegam aqui para quem não é o dono nem
      // foi escolhido. Não há filtro a fazer no cliente.
      const sorted: SequenceItem[] = (data ?? []).map((seq) => ({
        ...seq,
        sharing: seq.sharing as SequenceItem["sharing"],
        sequence_steps: seq.sequence_steps
          ? [...seq.sequence_steps].sort((a, b) => a.sort_order - b.sort_order)
          : [],
      }));

      setSequences(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSeqs(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (showSeqMenu) {
      loadSequences();
    }
  }, [showSeqMenu, loadSequences]);

  const startAdding = () => {
    setEditingActivity(null);
    setShowModal(true);
  };

  const saveActivity = (data: {
    title: string;
    type: string;
    date: string;
    endDate?: string;
    description: string;
    dealId: string;
    guests: string[];
    assigneeId: string | null;
    markAsDone: boolean;
  }) => {
    if (editingActivity) {
      updateActivity(editingActivity.id, {
        title: data.title,
        date: data.date,
        endDate: data.endDate,
        type: data.type,
        description: data.description,
        guests: data.guests,
        assigneeId: data.assigneeId,
      });
    } else {
      addActivity({
        dealId: deal.id,
        title: data.title,
        date: data.date,
        endDate: data.endDate,
        type: data.type,
        description: data.description,
        guests: data.guests,
        assigneeId: data.assigneeId,
        completed: data.markAsDone,
      });
    }
    setShowModal(false);
    setEditingActivity(null);
  };

  const handleComplete = (a: Activity) => {
    updateActivity(a.id, { completed: !a.completed });
    if (!a.completed) setShowNextModal(true);
  };

  const handleEdit = (a: Activity) => {
    setEditingActivity(a);
    setShowModal(true);
  };

  const saveNextActivity = (data: { title: string; type: string; date: string; description: string }) => {
    addActivity({ dealId: deal.id, ...data });
    setShowNextModal(false);
  };

  const handleSelectSequence = async (seq: SequenceItem) => {
    setStartingSeqId(seq.id);
    try {
      await enrollDealInSequence({
        dealId: deal.id,
        sequence: seq,
        addActivity,
        supabase,
      });
    } catch (err) {
      console.error("Error starting sequence on deal:", err);
    } finally {
      setStartingSeqId(null);
      setShowSeqMenu(false);
    }
  };

  const sorted = [...deal.activities].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const filteredSequences = sequences.filter((seq) => {
    if (!seqSearchQuery.trim()) return true;
    const q = seqSearchQuery.toLowerCase();
    const nameMatch = seq.name.toLowerCase().includes(q);
    const descMatch = seq.description?.toLowerCase().includes(q);
    const stepMatch = seq.sequence_steps?.some((s) => s.step_type.toLowerCase().includes(q));
    return nameMatch || descMatch || stepMatch;
  });

  return (
    <div className="w-full relative">
      {/* Toast Notification */}
      {toast && toast.visible && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-zinc-800">
          <CircleCheck className="h-4 w-4 text-green-400 shrink-0" />
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-zinc-400 hover:text-white border-0 bg-transparent cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-zinc-400 tracking-wide">ATIVIDADES</h2>
        <div className="flex items-center gap-2">
          {/* Sequências Button Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSeqMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <Play className="h-3 w-3" /> Sequências <ChevronDown className="h-3 w-3" />
            </button>

            {showSeqMenu && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-zinc-200 rounded-xl shadow-xl w-72 p-2">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar sequência..."
                    value={seqSearchQuery}
                    onChange={(e) => setSeqSearchQuery(e.target.value)}
                    className="w-full border border-zinc-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-300"
                    autoFocus
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1">
                  {loadingSeqs ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    </div>
                  ) : filteredSequences.length === 0 ? (
                    <p className="text-xs text-zinc-400 px-3 py-3 text-center">
                      Nenhuma sequência encontrada.
                    </p>
                  ) : (
                    filteredSequences.map((seq) => {
                      const stepCount = seq.sequence_steps?.length ?? 0;
                      const stepText = stepCount === 1 ? "1 passo" : `${stepCount} passos`;
                      const isStarting = startingSeqId === seq.id;
                      const tags = Array.from(new Set(seq.sequence_steps?.map((s) => s.step_type) || []));

                      return (
                        <button
                          key={seq.id}
                          type="button"
                          disabled={isStarting}
                          onClick={() => handleSelectSequence(seq)}
                          className="w-full text-left p-2.5 rounded-lg hover:bg-amber-50/50 transition-colors cursor-pointer border-0 bg-transparent flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-semibold text-zinc-800 truncate">
                              {seq.name}
                            </span>
                            <span className="text-[10px] text-zinc-400 shrink-0">
                              {stepText}
                            </span>
                          </div>

                          {seq.description && (
                            <p className="text-[11px] text-zinc-400 line-clamp-1">
                              {seq.description}
                            </p>
                          )}

                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {tags.map((tag) => {
                                const colors = getStepColors(tag);
                                return (
                                  <span
                                    key={tag}
                                    className={cn(
                                      "text-[9px] font-medium px-1.5 py-0.2 rounded border",
                                      colors.bg,
                                      colors.text,
                                      colors.border
                                    )}
                                  >
                                    {tag}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={startAdding}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-semibold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors border-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
      </div>

      {deal.activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-16 h-16 rounded-full bg-zinc-100 text-zinc-300 flex items-center justify-center mb-4">
            <ListTodo size={32} />
          </div>
          <p className="text-sm font-medium text-zinc-500">Nenhuma atividade registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((a) => {
            const d = new Date(a.date);
            const isOverdue = !a.completed && isPast(d) && !isToday(d);
            const isToday_ = !a.completed && isToday(d);
            const isTomorrow_ = !a.completed && isTomorrow(d);
            return (
              <div key={a.id}>
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-xl p-3.5 transition-colors",
                    a.completed ? "bg-zinc-50 opacity-70" : isOverdue ? "bg-red-50" : "bg-white"
                  )}
                >
                  <div
                    className={cn(
                      "shrink-0 rounded-full p-2 bg-zinc-100",
                      a.completed ? "text-zinc-400" : isOverdue ? "text-red-400" : "text-zinc-600"
                    )}
                  >
                    {isOverdue ? <AlertCircle className="h-4 w-4" /> : getIcon(a.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        a.completed ? "line-through text-zinc-500" : isOverdue ? "text-red-700" : "text-zinc-800"
                      )}
                    >
                      {a.title}
                    </p>
                    {a.description && (
                      <p className="text-xs mt-0.5 whitespace-pre-wrap break-words text-zinc-400">
                        {a.description}
                      </p>
                    )}
                    <p className="text-xs mt-1 flex items-center gap-1.5 text-zinc-400">
                      <Calendar className="h-3 w-3" />
                      {d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      {isOverdue && (
                        <span className="font-semibold text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-500">
                          Atrasada
                        </span>
                      )}
                      {isToday_ && (
                        <span className="font-semibold text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600">
                          Hoje
                        </span>
                      )}
                      {isTomorrow_ && (
                        <span className="font-semibold text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-500">
                          Amanhã
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(a)}
                      className="rounded-md border border-zinc-200 p-1 text-zinc-400 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50 transition-colors border-0 cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteActivity(a.id)}
                      className="rounded-md border border-zinc-200 p-1 text-zinc-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors border-0 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {!a.completed && (
                      <button
                        type="button"
                        onClick={() => handleComplete(a)}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors border-0 cursor-pointer"
                      >
                        Concluir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ActivityModal
          activity={editingActivity || undefined}
          onClose={() => setShowModal(false)}
          onSave={saveActivity}
          defaultDealId={deal.id}
          userName={userName}
        />
      )}

      {showNextModal && (
        <NextActivityModal
          dealId={deal.id}
          onClose={() => setShowNextModal(false)}
          onSave={saveNextActivity}
        />
      )}
    </div>
  );
}
