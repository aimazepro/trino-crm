"use client";

import { useState, useEffect, useRef } from "react";
import { X, Phone, Users, Video, Mail, MessageCircle, Camera, Briefcase, ClipboardList, Search, UserPlus, Plus, Paperclip } from "lucide-react";
import { Activity } from "@/lib/crm-types";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { cn } from "@/lib/utils";

interface ActivityModalProps {
  activity?: Activity;
  onClose: () => void;
  onSave: (data: { title: string; type: string; date: string; endDate?: string; description: string; dealId: string; guests: string[]; assigneeId: string; markAsDone: boolean }) => void;
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
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
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

function toDateInput(iso: string) {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function toTimeInput(iso: string) {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(11, 16);
}

export function ActivityModal({ activity, onClose, onSave, deals = [], defaultDealId = "" }: ActivityModalProps) {
  const { addActivityAttachment, deleteActivityAttachment } = useCrm();
  const { map: ownerMap, selfId } = useOwnerNameMap();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState(activity?.type || "Ligação");
  const [title, setTitle] = useState(activity?.title || "Ligação");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState(activity?.description || "");
  const [dealId, setDealId] = useState(defaultDealId || activity?.dealId || "");
  const [guests, setGuests] = useState<string[]>(activity?.guests || []);
  const [guestInput, setGuestInput] = useState("");
  const [assigneeId, setAssigneeId] = useState(activity?.assigneeId || "");
  const [markAsDone, setMarkAsDone] = useState(false);

  const showGuests = type === "Reunião" || type === "Videochamada";

  const addGuest = () => {
    const email = guestInput.trim();
    if (email && !guests.includes(email)) setGuests(prev => [...prev, email]);
    setGuestInput("");
  };

  useEffect(() => {
    if (activity?.date) {
      setDate(toDateInput(activity.date));
      setStartTime(toTimeInput(activity.date));
      setEndTime(activity.endDate ? toTimeInput(activity.endDate) : "");
    } else {
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0);
      setDate(toDateInput(d.toISOString()));
      setStartTime(toTimeInput(d.toISOString()));
      setEndTime("");
    }
  }, [activity]);

  useEffect(() => {
    if (!activity && selfId && !assigneeId) setAssigneeId(selfId);
  }, [activity, selfId, assigneeId]);

  const handleTypeSelect = (newType: string) => {
    setType(newType);
    if (!title || TYPES.some(t => t.id === title)) setTitle(newType);
  };

  const handleSubmit = () => {
    if (!title.trim() || !date || !startTime) return;
    const startIso = new Date(`${date}T${startTime}`).toISOString();
    const endIso = endTime ? new Date(`${date}T${endTime}`).toISOString() : undefined;
    onSave({ title, type, date: startIso, endDate: endIso, description: notes, dealId, guests, assigneeId: assigneeId || selfId, markAsDone });
  };

  const handleFiles = (files: FileList | null) => {
    if (!activity || !files) return;
    Array.from(files).forEach(f => addActivityAttachment(activity.id, f));
  };

  const showDealSearch = !defaultDealId;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-[460px] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

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

          {/* Data e horário */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Data e horário</label>
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-center">
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors text-gray-800"
              />
              <span className="text-xs text-gray-400">às</span>
              <input
                type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors text-gray-800"
              />
              <span className="text-xs text-gray-400">–</span>
              <input
                type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors text-gray-800"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">Deixe a hora em branco para um lembrete sem horário.</p>
          </div>

          {/* Convidados — Reunião / Videochamada only */}
          {showGuests && (
            <div>
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
                <UserPlus size={14} className="text-gray-400" /> Convidados
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={guestInput}
                  onChange={e => setGuestInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addGuest(); } }}
                  placeholder="Digite o email e pressione Enter"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors text-gray-800 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={addGuest}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-500 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              {guests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {guests.map(g => (
                    <span key={g} className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-2.5 py-1 rounded-full">
                      {g}
                      <button onClick={() => setGuests(prev => prev.filter(x => x !== g))} className="hover:text-red-500 transition-colors"><X size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-1.5">Adicione emails para enviar convite automático via Google Calendar</p>
            </div>
          )}

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

          {/* Anexos — only once the activity exists */}
          {activity && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Anexos</label>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <Paperclip className="h-3.5 w-3.5" /> Anexar
                </button>
                <span className="text-xs text-gray-500">ou arraste</span>
                <input
                  ref={fileInputRef} type="file" multiple className="hidden"
                  onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
                />
              </div>
              {activity.attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {activity.attachments.map(att => (
                    <li key={att.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="truncate">{att.fileName}</span>
                      <button onClick={() => deleteActivityAttachment(att.id)} className="text-gray-400 hover:text-red-500 shrink-0 ml-2"><X size={12} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Responsável */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Responsável</label>
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-amber-400 transition-colors bg-white"
            >
              {Object.entries(ownerMap).map(([id, name]) => (
                <option key={id} value={id}>{id === selfId ? `${name} (você)` : name}</option>
              ))}
            </select>
          </div>

          {/* Marcar como feito — create only */}
          {!activity && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox" checked={markAsDone} onChange={e => setMarkAsDone(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700">Marcar como feito</span>
            </label>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !date || !startTime}
            className="w-full py-3 bg-amber-400 hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
          >
            {activity ? "Salvar Alterações" : "Salvar Atividade"}
          </button>
        </div>
      </div>
    </div>
  );
}
