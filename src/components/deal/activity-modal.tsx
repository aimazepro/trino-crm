"use client";

import { useState, useEffect, useRef } from "react";
import { X, Phone, Users, Video, Mail, MessageCircle, Camera, Briefcase, ClipboardList, Search } from "lucide-react";
import { Activity } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

interface ActivityModalProps {
  activity?: Activity;
  onClose: () => void;
  onSave: (data: { title: string; type: string; date: string; description: string; dealId: string }) => void;
  deals?: { id: string; title: string }[];
  defaultDealId?: string;
  userName?: string;
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

function DealSearch({ deals, selectedId, onSelect }: { deals: { id: string; title: string }[]; selectedId: string; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = deals.find(d => d.id === selectedId);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = query.trim() ? deals.filter(d => d.title.toLowerCase().includes(query.toLowerCase())) : deals.slice(0, 8);

  if (selected) {
    return (
      <div className="flex items-center justify-between border border-amber-300 bg-amber-50/30 rounded-xl px-4 py-2.5">
        <span className="text-sm font-medium text-gray-900 truncate">{selected.title}</span>
        <button onClick={() => onSelect("")} className="text-gray-400 hover:text-red-400 ml-2 shrink-0"><X size={14} /></button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center border border-gray-200 rounded-xl px-4 py-2.5 focus-within:border-amber-400 transition-colors bg-white">
        <Search size={14} className="text-gray-400 mr-2 shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar negócio..."
          className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">Nenhum negócio encontrado</div>
          ) : filtered.map(d => (
            <button
              key={d.id}
              onMouseDown={() => { onSelect(d.id); setQuery(""); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-amber-50 transition-colors"
            >
              {d.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActivityModal({ activity, onClose, onSave, deals = [], defaultDealId = "", userName = "Você" }: ActivityModalProps) {
  const [type, setType] = useState(activity?.type || "Ligação");
  const [title, setTitle] = useState(activity?.title || "Ligação");
  const [datetime, setDatetime] = useState("");
  const [notes, setNotes] = useState(activity?.description || "");
  const [dealId, setDealId] = useState(defaultDealId || activity?.dealId || "");

  useEffect(() => {
    if (activity?.date) {
      const d = new Date(activity.date);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      setDatetime(local.toISOString().slice(0, 16));
    } else {
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      setDatetime(local.toISOString().slice(0, 16));
    }
  }, [activity]);

  const handleTypeSelect = (newType: string) => {
    setType(newType);
    if (!title || TYPES.some(t => t.id === title)) setTitle(newType);
  };

  const handleSubmit = () => {
    if (!title.trim() || !datetime) return;
    onSave({ title, type, date: new Date(datetime).toISOString(), description: notes, dealId });
  };

  const showDealSearch = !defaultDealId;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[460px] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-[17px] font-bold text-gray-900">{activity ? "Editar Atividade" : "Nova Atividade"}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-5 px-6 pb-6 hide-scrollbar">

          {/* Tipo */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(T => (
                <button
                  key={T.id}
                  onClick={() => handleTypeSelect(T.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors",
                    type === T.id ? "border-amber-400 text-amber-600 bg-amber-50" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <T.icon size={13} className={type === T.id ? "text-amber-500" : "text-gray-400"} />
                  {T.id}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Título <span className="text-red-400">*</span></label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors font-medium text-gray-800"
              placeholder="Ex: Ligação"
            />
          </div>

          {/* Data e hora */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Data e hora</label>
            <input
              type="datetime-local"
              value={datetime}
              onChange={e => setDatetime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors text-gray-800"
            />
          </div>

          {/* Negócio */}
          {showDealSearch && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Negócio <span className="text-red-400">*</span></label>
              <DealSearch deals={deals} selectedId={dealId} onSelect={setDealId} />
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observacoes opcionais..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-400 transition-colors resize-none h-24 text-gray-800"
            />
          </div>

          {/* Responsável */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Responsável</label>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-amber-400 transition-colors bg-white">
              <option>{userName} (você)</option>
            </select>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !datetime}
            className="w-full py-3 bg-amber-400 hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
          >
            {activity ? "Salvar Alterações" : "Salvar Atividade"}
          </button>
        </div>
      </div>
    </div>
  );
}
