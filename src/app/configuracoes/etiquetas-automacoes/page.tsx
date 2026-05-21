"use client";

import { useState } from "react";
import { Tag, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutomacoes } from "@/contexts/automacoes-context";
import type { AutomationLabel } from "@/lib/crm-types";

const PRESET_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#ef4444",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#1f2937",
  "#9ca3af",
];

export default function EtiquetasAutomacoesPage() {
  const { automationLabels, addAutomationLabel, deleteAutomationLabel } = useAutomacoes();
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Informe um nome para a etiqueta.");
      return;
    }
    const label: AutomationLabel = {
      id: crypto.randomUUID(),
      name: trimmed,
      color: selectedColor,
    };
    addAutomationLabel(label);
    setNewName("");
    setError("");
  }

  function handleDelete(id: string) {
    if (deleteConfirmId === id) {
      deleteAutomationLabel(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-8 py-5 bg-white shrink-0">
        <Tag className="h-5 w-5 text-amber-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Etiquetas de Automações</h1>
          <p className="text-[13px] text-zinc-400 font-medium">
            Organize as automações em grupos visuais. As etiquetas aparecem ao lado do nome na lista e podem ser usadas como filtro.
          </p>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-xl space-y-6">

          {/* Add new */}
          <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Nova etiqueta</p>

            <div>
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Nome da etiqueta (ex: Hunters, SDR)..."
                className={cn(
                  "w-full px-4 py-2.5 text-[13px] border rounded-lg outline-none transition-colors",
                  error ? "border-red-400 focus:border-red-500" : "border-zinc-200 focus:border-amber-400"
                )}
              />
              {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-zinc-600">Cor:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all",
                      selectedColor === color ? "ring-2 ring-offset-2 ring-zinc-400 scale-110" : "hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleAdd}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>

          {/* Existing labels */}
          {automationLabels.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100">
                <p className="text-[12px] font-bold uppercase tracking-wider text-zinc-400">
                  Etiquetas criadas ({automationLabels.length})
                </p>
              </div>
              <div className="divide-y divide-zinc-100">
                {automationLabels.map((label) => (
                  <div key={label.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="flex-1 text-[14px] font-semibold text-zinc-800">{label.name}</span>
                    <button
                      onClick={() => handleDelete(label.id)}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        deleteConfirmId === label.id
                          ? "text-red-600 bg-red-50 hover:bg-red-100"
                          : "text-zinc-300 hover:text-red-500 hover:bg-red-50"
                      )}
                      title={deleteConfirmId === label.id ? "Clique novamente para confirmar" : "Excluir"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {automationLabels.length === 0 && (
            <div className="text-center py-10">
              <Tag className="h-8 w-8 text-zinc-200 mx-auto mb-2" />
              <p className="text-[13px] text-zinc-400">Nenhuma etiqueta criada ainda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
