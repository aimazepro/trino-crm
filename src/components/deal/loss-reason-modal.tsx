"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const LOSS_REASONS = [
  "Preço", 
  "Concorrência", 
  "Timing ruim", 
  "Sem budget", 
  "Produto não atende", 
  "Sem resposta"
];

interface LossReasonModalProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function LossReasonModal({ onConfirm, onCancel }: LossReasonModalProps) {
  const [selectedTag, setSelectedTag] = useState("");
  const [description, setDescription] = useState("");

  const handleConfirm = () => {
    const finalReason = selectedTag ? `${selectedTag}${description ? `: ${description}` : ""}` : description;
    onConfirm(finalReason || "Não informado");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] flex flex-col max-h-full animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Motivo da perda</h2>
            <p className="text-sm text-gray-500 mt-1">Opcional. Ajuda a entender padrões de perda.</p>
          </div>
          <button onClick={onCancel} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors self-start">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 pt-4 space-y-6">
          <div className="flex flex-wrap gap-2">
             {LOSS_REASONS.map(r => (
               <button
                 key={r}
                 onClick={() => setSelectedTag(r === selectedTag ? "" : r)}
                 className={cn(
                   "px-3 py-1.5 text-sm font-medium rounded-full border transition-all",
                   selectedTag === r ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                 )}
               >
                 {r}
               </button>
             ))}
          </div>

          <textarea 
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descreva o motivo da perda (opcional)..."
            className="w-full h-32 border border-gray-200 rounded-xl p-4 text-sm outline-none focus:border-amber-500 resize-none shadow-sm"
          />
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3">
           <button 
             onClick={handleConfirm}
             className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors shadow-sm"
           >
             Confirmar perda
           </button>
           <button 
             onClick={onCancel}
             className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors shadow-sm"
           >
             Cancelar
           </button>
        </div>

      </div>
    </div>
  );
}
