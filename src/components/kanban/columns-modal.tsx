"use client";

import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ColumnsModalProps {
  onClose: () => void;
}

const VISIBLE_FIELDS = [
  { id: "title", label: "Título", type: "Negocio", checked: true, disabled: true },
  { id: "valor", label: "Valor", type: "Negocio", checked: true },
  { id: "etapa", label: "Etapa", type: "Negocio", checked: true },
  { id: "pipeline", label: "Pipeline", type: "Negocio", checked: true },
  { id: "empresa", label: "Empresa", type: "Negocio", checked: true },
  { id: "contato", label: "Contato", type: "Negocio", checked: true },
  { id: "prop", label: "Proprietário", type: "Negocio", checked: true },
  { id: "status", label: "Status", type: "Negocio", checked: true },
];

const NEGOCIO_FIELDS = [
  { id: "criado_em", label: "Criado em" },
  { id: "data_prev", label: "Data prevista" },
  { id: "etiquetas", label: "Etiquetas" },
  { id: "prob", label: "Probabilidade" },
];

const CONTATO_FIELDS = [
  { id: "c_cargo", label: "Cargo" },
  { id: "c_email", label: "Email" },
  { id: "c_tel", label: "Telefone" },
];

const EMPRESA_FIELDS = [
  { id: "e_cidade", label: "Cidade" },
  { id: "e_cnpj", label: "CNPJ" },
  { id: "e_est", label: "Estado" },
  { id: "e_porte", label: "Porte" },
  { id: "e_seg", label: "Segmento" },
  { id: "e_site", label: "Website" },
];

export function ColumnsModal({ onClose }: ColumnsModalProps) {
  const [search, setSearch] = useState("");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-l-2xl shadow-2xl w-[400px] h-full flex flex-col animate-in slide-in-from-right-full absolute right-0 top-0">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">Personalizar colunas</h2>
            <span className="text-amber-500 text-xs font-bold cursor-pointer hover:underline">+ Campo personalizado</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-100 shrink-0">
           <div className="relative">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
             <input 
               value={search} onChange={e => setSearch(e.target.value)}
               placeholder="Buscar coluna..."
               className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-amber-500 transition-colors shadow-sm"
             />
           </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
           
           <div>
             <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Visível (8/21)</h3>
             <div className="space-y-3">
                {VISIBLE_FIELDS.map(f => (
                  <div key={f.id} className="flex items-center justify-between group">
                     <label className="flex items-center gap-3 cursor-pointer">
                        <div className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">⋮⋮</div>
                        <input type="checkbox" checked={f.checked} disabled={f.disabled} className={cn("rounded border-gray-300 text-amber-500 focus:ring-amber-500", f.disabled && "opacity-50")} readOnly />
                        <span className="text-sm font-medium text-gray-700">{f.label}</span>
                     </label>
                     <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{f.type}</span>
                  </div>
                ))}
             </div>
           </div>

           <div>
             <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Negócio</h3>
             <div className="space-y-3">
                {NEGOCIO_FIELDS.map(f => (
                  <label key={f.id} className="flex items-center gap-3 cursor-pointer pl-6">
                     <input type="checkbox" className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                     <span className="text-sm font-medium text-gray-600">{f.label}</span>
                  </label>
                ))}
             </div>
           </div>

           <div>
             <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Contato</h3>
             <div className="space-y-3">
                {CONTATO_FIELDS.map(f => (
                  <label key={f.id} className="flex items-center gap-3 cursor-pointer pl-6">
                     <input type="checkbox" className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                     <span className="text-sm font-medium text-gray-600">{f.label}</span>
                  </label>
                ))}
             </div>
           </div>

           <div>
             <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Empresa</h3>
             <div className="space-y-3">
                {EMPRESA_FIELDS.map(f => (
                  <label key={f.id} className="flex items-center gap-3 cursor-pointer pl-6">
                     <input type="checkbox" className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                     <span className="text-sm font-medium text-gray-600">{f.label}</span>
                  </label>
                ))}
             </div>
           </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
           <button className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Colunas padrao</button>
           <div className="flex items-center gap-3">
             <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Cancelar</button>
             <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 shadow-sm">Salvar</button>
           </div>
        </div>

      </div>
    </div>
  );
}
