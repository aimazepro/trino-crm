"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const FALLBACK = ["Duplicado", "Criado por engano", "Teste", "Lead inválido", "Fora do perfil", "Outros"];

interface DeleteDealModalProps {
  count?: number; // >1 when deleting in bulk
  onConfirm: (reason: string, note: string) => void;
  onCancel: () => void;
}

export function DeleteDealModal({ count = 1, onConfirm, onCancel }: DeleteDealModalProps) {
  const [reasons, setReasons] = useState<string[]>(FALLBACK);
  const [selectedTag, setSelectedTag] = useState("");
  const [note, setNote] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("delete_reasons").select("name").eq("user_id", user.id).eq("active", true).order("sort_order");
      if (data && data.length > 0) {
        const unique = Array.from(new Set([...data.map(r => r.name), "Outros"]));
        setReasons(unique);
      }
    }
    load();
  }, [supabase]);

  const isDisabled = !selectedTag || (selectedTag === "Outros" && !note.trim());

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="relative bg-white rounded-2xl w-full max-w-[480px] p-6 flex flex-col max-h-full animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 mb-1">
          <h2 className="text-[17px] font-bold text-gray-900">
            {count > 1 ? `Excluir ${count} negócios?` : "Excluir negócio?"}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {count > 1 ? "Eles saem" : "Ele sai"} das listas e dos relatórios, e as atividades vinculadas saem da lista de atividades.
            O histórico continua acessível para consulta e um administrador pode restaurar (as atividades voltam junto).
          </p>
        </div>

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-[13px] font-semibold text-gray-750 mb-1.5">
              Motivo da exclusão <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedTag}
                onChange={e => setSelectedTag(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-[14px] text-zinc-800 outline-none focus:border-red-400 appearance-none cursor-pointer pr-10"
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
              Observação {selectedTag === "Outros" ? <span className="text-red-500">*</span> : <span className="font-normal text-zinc-400">(opcional)</span>}
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Adicione contexto sobre a exclusão"
              rows={3}
              maxLength={500}
              className="w-full border border-gray-200 rounded-xl p-4 text-[14px] outline-none focus:border-red-400 resize-none placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6 shrink-0">
          <button
            onClick={() => onConfirm(selectedTag, note.trim())}
            disabled={isDisabled}
            className={cn(
              "flex-1 py-3 font-bold rounded-xl transition-colors text-sm",
              isDisabled
                ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600 text-white cursor-pointer"
            )}
          >
            Excluir
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors text-sm cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
