"use client";

import { useState } from "react";
import { Plus, Search, Trash2, Edit2, ShieldAlert } from "lucide-react";

type LossReason = {
  id: string;
  title: string;
  type: "Vendas" | "Pré-Venda" | "Ambos";
};

const MOCK: LossReason[] = [
  { id: "1", title: "Falta de Interesse", type: "Ambos" },
  { id: "2", title: "Comprou do Concorrente", type: "Vendas" },
  { id: "3", title: "Achou Muito Caro", type: "Vendas" },
  { id: "4", title: "Sem Tempo Agora", type: "Pré-Venda" },
];

export default function MotivosPerdaPage() {
  const [items] = useState<LossReason[]>(MOCK);
  
  return (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Motivos de Perda</h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">Padronize por que seus negócios não estão fechando</p>
        </div>
      </div>

      {/* Toolbox */}
      <div className="flex items-center justify-between px-8 py-4 bg-zinc-50/50 border-b border-zinc-100 shrink-0">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar motivos..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500 transition-all placeholder:text-zinc-400"
          />
        </div>

        <button className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm">
          <Plus size={15} /> Novo Motivo
        </button>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-3xl space-y-3">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-xl hover:border-amber-400 transition-all group shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">{item.title}</h3>
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{item.type}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={15} /></button>
                <button className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
