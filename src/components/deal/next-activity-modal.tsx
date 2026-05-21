"use client";

import { useState, useRef, useEffect } from "react";
import { X, Calendar as CalendarIcon, Phone, Users, Video, Mail, MessageCircle, Camera, Briefcase, ClipboardList, Clock } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Activity } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

interface NextActivityModalProps {
  dealId: string;
  onClose: () => void;
  onSave: (data: { title: string; type: string; date: string; description: string }) => void;
}

const TYPES = [
  { id: "Ligação", icon: Phone },
  { id: "Reunião", icon: Users },
  { id: "Videochamada", icon: Video },
  { id: "Email", icon: Mail },
  { id: "WhatsApp", icon: MessageCircle },
  { id: "Instagram", icon: Camera },
  { id: "LinkedIn", icon: Briefcase },
  { id: "Outros", icon: ClipboardList },
];

export function NextActivityModal({ dealId, onClose, onSave }: NextActivityModalProps) {
  const [type, setType] = useState("Ligação");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");

  const handleTypeSelect = (newType: string) => {
    setType(newType);
    if (!title || TYPES.some(t => t.id === title)) setTitle(newType);
  };

  const handleCreate = () => {
    if (!title.trim() || !date) return;
    const combinedDate = new Date(`${date}T${time || "09:00"}:00`);
    onSave({ title, type, date: combinedDate.toISOString(), description: notes });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-[500px] p-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between mb-1 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Criar próxima atividade?</h2>
            <p className="text-sm text-gray-400 mt-0.5">Mantenha o ritmo de follow-up</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-5 hide-scrollbar px-1 mt-5">

          {/* Tipo */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-2">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(T => (
                <button
                  key={T.id}
                  onClick={() => handleTypeSelect(T.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors",
                    type === T.id
                      ? "border-amber-400 text-amber-600 bg-amber-50"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <T.icon size={14} className={type === T.id ? "text-amber-500" : "text-gray-400"} />
                  {T.id}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-2">Titulo *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium text-gray-800"
              placeholder="Ex: Ligação de follow-up"
            />
          </div>

          {/* Data & Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">Data</label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm outline-none focus:border-amber-500 transition-all text-gray-800 appearance-none"
                />
                <CalendarIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">Hora</label>
              <div className="relative">
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm outline-none focus:border-amber-500 transition-all text-gray-800 appearance-none"
                />
                <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-2">Observacoes (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anotacoes opcionais..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none h-24 text-gray-800"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl transition-colors hover:bg-gray-50"
          >
            Pular
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !date}
            className="flex-1 py-3 bg-[#F8AB00] hover:bg-[#E59E00] text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Criar atividade
          </button>
        </div>
      </div>
    </div>
  );
}
