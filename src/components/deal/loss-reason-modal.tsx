"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";

const FALLBACK = ["Preço", "Concorrência", "Timing ruim", "Sem budget", "Produto não atende", "Sem resposta", "Não qualificado", "Outros"];

interface LossReasonModalProps {
  onConfirm: (reason: string, reasonId: string | null, note: string) => void;
  onCancel: () => void;
}

export function LossReasonModal({ onConfirm, onCancel }: LossReasonModalProps) {
  const [reasons, setReasons] = useState<string[]>(FALLBACK);
  const [reasonIds, setReasonIds] = useState<Record<string, string>>({});
  const [selectedTag, setSelectedTag] = useState("");
  const [note, setNote] = useState("");
  const supabase = createClient();
  const { workspaceId } = useWorkspace();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("loss_reasons").select("id, name").eq("workspace_id", workspaceId).eq("active", true).order("sort_order");
      if (data && data.length > 0) {
        const unique = Array.from(new Set([...data.map(r => r.name), "Outros"]));
        setReasons(unique);
        setReasonIds(Object.fromEntries(data.map(r => [r.name, r.id])));
      }
    }
    load();
  }, [supabase, workspaceId]);

  const handleConfirm = () => {
    const reasonId = reasonIds[selectedTag] ?? null;
    onConfirm(selectedTag, reasonId, note.trim());
  };

  const isDisabled = !selectedTag || (selectedTag === "Outros" && !note.trim());

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-[480px] p-6 flex flex-col max-h-full animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 mb-4">
          <h2 className="text-[17px] font-bold text-gray-900">Marcar como perdido</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-gray-750 mb-1.5">
              Motivo da perda <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedTag}
                onChange={e => setSelectedTag(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-[14px] text-zinc-800 outline-none focus:border-amber-500 appearance-none cursor-pointer pr-10"
              >
                <option value="" disabled hidden>Selecione um motivo...</option>
                {reasons.map((r, i) => (
                  <option key={`${r}_${i}`} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-750 mb-1.5">
              Comentários {selectedTag === "Outros" && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Descreva o motivo (obrigatório quando 'Outros')"
              className="w-full h-28 border border-gray-200 rounded-xl p-4 text-[14px] outline-none focus:border-amber-500 resize-none placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors text-sm cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDisabled}
            className={cn(
              "flex-1 py-3 font-bold rounded-xl transition-colors text-sm",
              isDisabled
                ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600 text-white cursor-pointer"
            )}
          >
            Confirmar perda
          </button>
        </div>
      </div>
    </div>
  );
}
