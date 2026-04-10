"use client";

import { useState, useEffect } from "react";
import { X, Phone, Users, Video, Mail, MessageCircle, Camera, Briefcase, ClipboardList, CalendarDays, Clock } from "lucide-react";
import { Activity } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

interface ActivityModalProps {
  activity?: Activity; // If provided, we are editing
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

export function ActivityModal({ activity, onClose, onSave }: ActivityModalProps) {
  const [type, setType] = useState(activity?.type || "WhatsApp");
  const [title, setTitle] = useState(activity?.title || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState(activity?.description || "");

  // Initialize date and time if editing
  useEffect(() => {
    if (activity?.date) {
      const d = new Date(activity.date);
      // Format to YYYY-MM-DD
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);
      
      // Format time to HH:MM
      const hh = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      setTime(`${hh}:${mins}`);
    } else {
       // Set default to now + 1 hour with zero minutes
       const d = new Date();
       d.setHours(d.getHours() + 1);
       d.setMinutes(0);
       const yyyy = d.getFullYear();
       const mm = String(d.getMonth() + 1).padStart(2, "0");
       const dd = String(d.getDate()).padStart(2, "0");
       setDate(`${yyyy}-${mm}-${dd}`);
       const hh = String(d.getHours()).padStart(2, "0");
       setTime(`${hh}:00`);
    }
  }, [activity]);

  // When type changes, and title is empty or matches another type default, auto-update title
  const handleTypeSelect = (newType: string) => {
    setType(newType);
    if (!title || TYPES.some(t => t.id === title)) {
      setTitle(newType);
    }
  };

  const handleSubmit = () => {
    if (!title.trim() || !date) return;
    
    // Combine Date and Time
    const combinedDate = new Date(`${date}T${time || "00:00"}:00`);

    onSave({
      title,
      type,
      date: combinedDate.toISOString(),
      description: notes
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] p-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {activity ? "Editar Atividade" : "Nova Atividade"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-6 hide-scrollbar px-1">
          
          {/* Tipo de Atividade */}
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

          {/* Titulo */}
          <div>
             <label className="text-sm font-medium text-gray-600 block mb-2">Titulo *</label>
             <input 
               value={title} onChange={e => setTitle(e.target.value)}
               className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium text-gray-800"
               placeholder="Ex: Ligação"
             />
          </div>

          {/* Data & Hora */}
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-sm font-medium text-gray-600 block mb-2">Data</label>
                <div className="relative">
                   <input 
                     type="date" 
                     value={date} onChange={e => setDate(e.target.value)}
                     className="w-full border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm outline-none focus:border-amber-500 transition-all text-gray-800 appearance-none"
                   />
                   <CalendarDays size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
             </div>
             <div>
                <label className="text-sm font-medium text-gray-600 block mb-2">Hora</label>
                <div className="relative">
                   <input 
                     type="time" 
                     value={time} onChange={e => setTime(e.target.value)}
                     className="w-full border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm outline-none focus:border-amber-500 transition-all text-gray-800 appearance-none"
                   />
                   <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
             </div>
          </div>

          {/* Notas */}
          <div>
             <label className="text-sm font-medium text-gray-600 block mb-2">Notas</label>
             <textarea 
               value={notes} onChange={e => setNotes(e.target.value)}
               placeholder="Observacoes opcionais..."
               className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none h-28 text-gray-800"
             />
          </div>

        </div>

        {/* Footer */}
        <div className="mt-6 shrink-0">
          <button 
             onClick={handleSubmit}
             disabled={!title.trim() || !date}
             className="w-full py-3 bg-[#F8AB00] hover:bg-[#E59E00] text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
             {activity ? "Salvar Alteracoes" : "Salvar Atividade"}
          </button>
        </div>

      </div>
    </div>
  );
}
