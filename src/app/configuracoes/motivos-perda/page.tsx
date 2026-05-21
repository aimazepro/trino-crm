"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Reason = { id: string; name: string; sort_order: number };

const DEFAULTS = ["Preço", "Concorrência", "Timing ruim", "Sem budget", "Produto não atende", "Sem resposta", "Não qualificado"];

export default function MotivosPerdaPage() {
  const [items, setItems] = useState<Reason[]>([]);
  const [input, setInput] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("loss_reasons").select("*").eq("user_id", user.id).eq("active", true).order("sort_order");
      if (data && data.length === 0) {
        const rows = DEFAULTS.map((name, i) => ({ user_id: user.id, name, sort_order: i }));
        const { data: seeded } = await supabase.from("loss_reasons").insert(rows).select();
        setItems(seeded ?? []);
      } else {
        setItems(data ?? []);
      }
    }
    load();
  }, [supabase]);

  const handleAdd = async () => {
    const trimmed = input.trim();
    if (!trimmed || items.some(i => i.name === trimmed)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("loss_reasons").insert({
      user_id: user.id, name: trimmed, sort_order: items.length,
    }).select().single();
    if (!error && data) { setItems([...items, data]); setInput(""); }
  };

  const handleRemove = async (id: string) => {
    setItems(items.filter(i => i.id !== id));
    await supabase.from("loss_reasons").delete().eq("id", id);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Motivos de Perda</h1>
          <p className="text-sm font-medium text-zinc-400 mt-0.5">Configure os motivos de perda disponíveis ao marcar um negócio como perdido.</p>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-lg space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Novo motivo de perda..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className="flex-1 bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all placeholder:text-zinc-400"
            />
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center justify-between px-5 py-3.5 group hover:bg-zinc-50/50 transition-colors ${i > 0 ? "border-t border-zinc-100" : ""}`}
              >
                <span className="text-[14px] font-medium text-zinc-800">{item.name}</span>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="p-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <p className="text-[12px] font-medium text-zinc-400 text-center">
            Esses motivos serão exibidos como opções ao marcar um negócio como perdido.
          </p>
        </div>
      </div>
    </div>
  );
}
