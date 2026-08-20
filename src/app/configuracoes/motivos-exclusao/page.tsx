"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Lock, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";

type Reason = { id: string; name: string; sort_order: number; active: boolean };

const DEFAULTS = ["Duplicado", "Criado por engano", "Teste", "Lead inválido", "Fora do perfil"];

export default function MotivosExclusaoPage() {
  const [items, setItems] = useState<Reason[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const supabase = createClient();
  const { workspaceId } = useWorkspace();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("delete_reasons")
        .select("*")
        .eq("active", true)
        .order("sort_order");

      if (data && data.length === 0) {
        const rows = DEFAULTS.map((name, i) => ({ workspace_id: workspaceId, name, sort_order: i, active: true }));
        const { data: seeded } = await supabase.from("delete_reasons").insert(rows).select();
        setItems(seeded ?? []);
      } else {
        setItems(data ?? []);
      }
    }
    load();
  }, [supabase, workspaceId]);

  const handleAdd = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === "outros") {
      setInput("");
      return;
    }
    if (items.some(i => i.name.toLowerCase() === trimmed.toLowerCase())) return;

    const { data, error } = await supabase
      .from("delete_reasons")
      .insert({
        workspace_id: workspaceId,
        name: trimmed,
        sort_order: items.length,
        active: true
      })
      .select()
      .single();

    if (!error && data) {
      setItems([...items, data]);
      setInput("");
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase
      .from("delete_reasons")
      .update({ active: false })
      .eq("id", id);

    if (!error) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const startEdit = (item: Reason) => {
    setEditingId(item.id);
    setEditingValue(item.name);
  };

  const handleRenameSave = async (id: string) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    if (trimmed.toLowerCase() === "outros") {
      setEditingId(null);
      return;
    }
    if (items.some(i => i.id !== id && i.name.toLowerCase() === trimmed.toLowerCase())) {
      setEditingId(null);
      return;
    }

    const { error } = await supabase
      .from("delete_reasons")
      .update({ name: trimmed })
      .eq("id", id);

    if (!error) {
      setItems(items.map(item => item.id === id ? { ...item, name: trimmed } : item));
    }
    setEditingId(null);
  };

  const filteredItems = items.filter(item => item.name.toLowerCase() !== "outros");

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Motivos de Exclusão</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          Padronize por que um negócio é excluído. Aparecem como opções ao excluir, na ficha e em lote.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <input
          placeholder="Novo motivo de exclusão..."
          maxLength={60}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:opacity-50"
        />
        <button
          disabled={!input.trim()}
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
        {filteredItems.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between px-4 py-3 group gap-3 min-h-[45px]"
          >
            {editingId === item.id ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={editingValue}
                  onChange={e => setEditingValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleRenameSave(item.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  autoFocus
                  maxLength={60}
                />
                <button
                  onClick={() => handleRenameSave(item.id)}
                  className="p-1 text-emerald-600 hover:text-emerald-700 transition-colors"
                  title="Salvar"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1 text-zinc-400 hover:text-zinc-500 transition-colors"
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-sm text-zinc-700 flex items-center gap-2">
                  {item.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(item)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-zinc-700 transition-all p-1"
                    title="Renomear"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-all p-1 disabled:opacity-50"
                    title="Desativar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Outros is fixed and locked */}
        <div className="flex items-center justify-between px-4 py-3 group gap-3 min-h-[45px]">
          <span className="text-sm text-zinc-700 flex items-center gap-2">
            Outros
            <Lock className="h-3 w-3 text-zinc-300" />
          </span>
          <div className="flex items-center gap-1"></div>
        </div>
      </div>

      <p className="text-xs text-zinc-400 mt-4">
        &quot;Outros&quot; é fixo e exige observação. Apenas administradores do workspace podem gerenciar a lista.
        Excluir um negócio não apaga nada: ele sai das listas, continua acessível para consulta e pode ser restaurado.
      </p>
    </div>
  );
}
