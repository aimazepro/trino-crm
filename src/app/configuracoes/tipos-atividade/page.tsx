"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  Phone,
  Video,
  Mail,
  MessageCircle,
  Circle,
  Calendar,
  CheckSquare,
  ClipboardList,
  Coffee,
  FileText,
  Flag,
  Gift,
  Globe,
  Handshake,
  Headphones,
  Heart,
  Home,
  Image,
  Key,
  Lightbulb,
  Map,
  GripVertical,
  Plus,
  X
} from "lucide-react";

// Custom SVG components to resolve missing icons in standard lucide-react library
const Instagram = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const Linkedin = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

type ActivityType = {
  id: string;
  name: string;
  icon: string;
  isSystem: boolean;
  active: boolean;
};

const DEFAULT_TYPES: ActivityType[] = [
  { id: "system_meeting", name: "Reunião", icon: "Users", isSystem: true, active: true },
  { id: "system_call", name: "Ligação", icon: "Phone", isSystem: true, active: true },
  { id: "system_video", name: "Videochamada", icon: "Video", isSystem: true, active: true },
  { id: "system_email", name: "E-mail", icon: "Mail", isSystem: true, active: true },
  { id: "system_whatsapp", name: "WhatsApp", icon: "MessageCircle", isSystem: true, active: true },
  { id: "system_instagram", name: "Instagram", icon: "Instagram", isSystem: true, active: true },
  { id: "system_linkedin", name: "LinkedIn", icon: "Linkedin", isSystem: true, active: true },
  { id: "system_outro", name: "Outro", icon: "Circle", isSystem: true, active: true },
];

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Users, Phone, Video, Mail, MessageCircle, Instagram, Linkedin, Circle,
  Calendar, CheckSquare, ClipboardList, Coffee, FileText, Flag, Gift, Globe,
  Handshake, Headphones, Heart, Home, Image, Key, Lightbulb, Map
};

const ALL_ICONS = [
  { name: "Users", label: "users" },
  { name: "Phone", label: "phone" },
  { name: "Video", label: "video" },
  { name: "Mail", label: "mail" },
  { name: "MessageCircle", label: "message-circle" },
  { name: "Instagram", label: "instagram" },
  { name: "Linkedin", label: "linkedin" },
  { name: "Circle", label: "circle" },
  { name: "Calendar", label: "calendar" },
  { name: "CheckSquare", label: "check-square" },
  { name: "ClipboardList", label: "clipboard-list" },
  { name: "Coffee", label: "coffee" },
  { name: "FileText", label: "file-text" },
  { name: "Flag", label: "flag" },
  { name: "Gift", label: "gift" },
  { name: "Globe", label: "globe" },
  { name: "Handshake", label: "handshake" },
  { name: "Headphones", label: "headphones" },
  { name: "Heart", label: "heart" },
  { name: "Home", label: "home" },
  { name: "Image", label: "image" },
  { name: "Key", label: "key" },
  { name: "Lightbulb", label: "lightbulb" },
  { name: "Map", label: "map" },
];

type ActivityTypeRow = {
  id: string;
  name: string;
  icon: string;
  is_system: boolean;
  active: boolean;
  sort_order: number;
};

const toRows = (rows: ActivityTypeRow[] | null): ActivityType[] =>
  (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    isSystem: r.is_system,
    active: r.active,
  }));

export default function TiposAtividadePage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ActivityType | null>(null);
  const [modalIcon, setModalIcon] = useState("Users");
  const [modalName, setModalName] = useState("");

  // `loading` starts true, so this must not set it synchronously — doing so
  // would make the mount effect trigger a cascading render.
  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setItems(DEFAULT_TYPES);
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data } = await supabase
      .from("activity_types")
      .select("id, name, icon, is_system, active, sort_order")
      .eq("user_id", user.id)
      .order("sort_order");

    // First visit for this user: seed the system defaults so the list is never empty.
    if (!data || data.length === 0) {
      const seeds = DEFAULT_TYPES.map((t, idx) => ({
        user_id: user.id,
        name: t.name,
        icon: t.icon,
        is_system: true,
        active: true,
        sort_order: idx,
      }));
      const { data: inserted } = await supabase
        .from("activity_types")
        .insert(seeds)
        .select("id, name, icon, is_system, active, sort_order");
      setItems(toRows(inserted));
      setLoading(false);
      return;
    }

    setItems(toRows(data));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Persist optimistically: update local state first, then write through.
  const saveItems = async (newItems: ActivityType[]) => {
    const previous = items;
    setItems(newItems);
    if (!userId) return;
    const { error } = await supabase.from("activity_types").upsert(
      newItems.map((item, idx) => ({
        id: item.id,
        user_id: userId,
        name: item.name,
        icon: item.icon,
        is_system: item.isSystem,
        active: item.active,
        sort_order: idx,
      }))
    );
    if (error) {
      setItems(previous);
      setError("Não foi possível salvar. Tente novamente.");
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null) return;
    if (draggedIndex === index) return;
    const list = [...items];
    const item = list[draggedIndex];
    list.splice(draggedIndex, 1);
    list.splice(index, 0, item);
    setDraggedIndex(null);
    saveItems(list);
  };

  const openAddModal = () => {
    setEditingType(null);
    setModalIcon("Users");
    setModalName("");
    setModalOpen(true);
  };

  const openEditModal = (item: ActivityType) => {
    setEditingType(item);
    setModalIcon(item.icon);
    setModalName(item.name);
    setModalOpen(true);
  };

  const handleSaveModal = async () => {
    const trimmed = modalName.trim();
    if (!trimmed) return;
    setError(null);

    if (editingType) {
      await saveItems(
        items.map((item) =>
          item.id === editingType.id ? { ...item, name: trimmed, icon: modalIcon } : item
        )
      );
    } else {
      if (items.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
        setError("Já existe um tipo com esse nome.");
        return;
      }
      if (!userId) return;
      // Let Postgres mint the id so it stays a real uuid.
      const { data, error: insertError } = await supabase
        .from("activity_types")
        .insert({
          user_id: userId,
          name: trimmed,
          icon: modalIcon,
          is_system: false,
          active: true,
          sort_order: items.length,
        })
        .select("id, name, icon, is_system, active, sort_order")
        .single();
      if (insertError || !data) {
        setError("Não foi possível criar o tipo.");
        return;
      }
      setItems([...items, ...toRows([data])]);
    }
    setModalOpen(false);
  };

  const handleDeleteModal = async () => {
    if (!editingType || editingType.isSystem) return;
    setError(null);
    const { error: deleteError } = await supabase
      .from("activity_types")
      .delete()
      .eq("id", editingType.id);
    if (deleteError) {
      setError("Não foi possível excluir o tipo.");
      return;
    }
    setItems(items.filter((item) => item.id !== editingType.id));
    setModalOpen(false);
  };

  const handleToggleActive = (id: string) => {
    const updated = items.map(item => {
      if (item.id === id) {
        if (item.isSystem) return item;
        return { ...item, active: !item.active };
      }
      return item;
    });
    saveItems(updated);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-xl font-semibold text-zinc-900">Tipos de Atividade</h1>
        <p className="text-sm text-zinc-500 mt-1">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Tipos de Atividade</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Personalize os tipos disponíveis ao criar atividades. Os tipos do sistema podem ser renomeados, mas não excluídos. Use o toggle pra ativar ou desativar tipos custom. Arraste pra reordenar.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            Adicionar tipo
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {items.map((item, idx) => {
              const IconComponent = ICON_MAP[item.icon] || Circle;
              return (
                <li
                  key={item.id}
                  draggable
                  onDragStart={e => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, idx)}
                  className={`flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 transition-colors ${
                    draggedIndex === idx ? "opacity-40 bg-zinc-50" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors touch-none"
                    aria-label="Arrastar pra reordenar"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 shrink-0">
                    <IconComponent className="h-4 w-4" />
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    title="Clique para editar o tipo de atividade"
                    className="flex-1 text-left text-sm font-medium text-zinc-800 hover:text-zinc-900 hover:underline decoration-zinc-300 underline-offset-4 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {item.name}
                      {item.isSystem && (
                        <span className="rounded bg-zinc-100 text-zinc-500 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider">
                          SISTEMA
                        </span>
                      )}
                    </span>
                  </button>

                  {item.isSystem ? (
                    <button
                      disabled
                      title="Tipos do sistema não podem ser desativados"
                      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors bg-emerald-500 cursor-not-allowed opacity-60"
                    >
                      <span className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform translate-x-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        item.active ? "bg-emerald-500" : "bg-zinc-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          item.active ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl border border-zinc-200 w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h3 className="text-base font-semibold text-zinc-900">
                {editingType ? "Editar tipo de atividade" : "Adicionar tipo de atividade"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-2 block">
                  Ícone do tipo de atividade
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {ALL_ICONS.map(ico => {
                    const TargetIcon = ICON_MAP[ico.name] || Circle;
                    const isSelected = modalIcon === ico.name;
                    return (
                      <button
                        key={ico.name}
                        type="button"
                        onClick={() => setModalIcon(ico.name)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        }`}
                        title={ico.label}
                      >
                        <TargetIcon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-2 block">
                  Nome do tipo de atividade
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  placeholder="Ex: Demo, Onboarding, Follow-up"
                  maxLength={40}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div className="flex gap-3 justify-between pt-4 border-t border-zinc-100 w-full">
                {editingType && !editingType.isSystem ? (
                  <button
                    type="button"
                    onClick={handleDeleteModal}
                    className="text-red-500 hover:text-red-600 text-sm font-semibold transition-colors"
                  >
                    Excluir
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveModal}
                    disabled={!modalName.trim()}
                    className="px-4 py-2 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
