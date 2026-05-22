"use client";

import { useState, useEffect } from "react";
import { Plus, X, Phone, Users, Video, Mail, MessageCircle, Camera, Briefcase, ClipboardList, Activity } from "lucide-react";

const DEFAULT_TYPES = [
  { id: "Ligação", icon: "Phone" },
  { id: "Reunião", icon: "Users" },
  { id: "Videochamada", icon: "Video" },
  { id: "Email", icon: "Mail" },
  { id: "WhatsApp", icon: "MessageCircle" },
  { id: "Instagram", icon: "Camera" },
  { id: "LinkedIn", icon: "Briefcase" },
  { id: "Outros", icon: "ClipboardList" },
];

const ICON_MAP: Record<string, any> = {
  Phone,
  Users,
  Video,
  Mail,
  MessageCircle,
  Camera,
  Briefcase,
  ClipboardList,
};

export default function TiposAtividadePage() {
  const [items, setItems] = useState<{ id: string; icon: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("crm_activity_types");
      if (stored) {
        try {
          setItems(JSON.parse(stored));
        } catch (e) {
          setItems(DEFAULT_TYPES);
        }
      } else {
        localStorage.setItem("crm_activity_types", JSON.stringify(DEFAULT_TYPES));
        setItems(DEFAULT_TYPES);
      }
      setLoading(false);
    }
  }, []);

  const saveItems = (newItems: { id: string; icon: string }[]) => {
    setItems(newItems);
    localStorage.setItem("crm_activity_types", JSON.stringify(newItems));
  };

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed || items.some((i) => i.id.toLowerCase() === trimmed.toLowerCase())) return;
    const newItems = [...items, { id: trimmed, icon: "ClipboardList" }];
    saveItems(newItems);
    setInput("");
  };

  const handleRemove = (id: string) => {
    const newItems = items.filter((i) => i.id !== id);
    saveItems(newItems);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-full bg-[#F4F4F5]">
        <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Tipos de Atividade</h1>
            <p className="text-sm font-medium text-zinc-400 mt-0.5">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      {/* Header */}
      <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Tipos de Atividade</h1>
            <p className="text-sm font-medium text-zinc-400 mt-0.5">
              Gerencie os tipos de atividade disponíveis para registrar interações com os seus contatos e negócios.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-lg space-y-4">
          
          {/* Add input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Novo tipo de atividade..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1 bg-white border border-zinc-200 text-[13px] font-medium rounded-xl px-4 py-2.5 outline-none focus:border-amber-500 transition-all placeholder:text-zinc-400"
            />
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>

          {/* List */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            {items.map((item, i) => {
              const IconComp = ICON_MAP[item.icon] || ClipboardList;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-5 py-3.5 group hover:bg-zinc-50/50 transition-colors ${
                    i > 0 ? "border-t border-zinc-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComp size={16} className="text-zinc-400" />
                    <span className="text-[14px] font-medium text-zinc-800">{item.id}</span>
                  </div>
                  
                  {items.length > 1 && (
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[12px] font-medium text-zinc-400 text-center">
            Estes tipos serão exibidos como opções ao agendar ou registrar uma nova atividade.
          </p>
        </div>
      </div>
    </div>
  );
}
