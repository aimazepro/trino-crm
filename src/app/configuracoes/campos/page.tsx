"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Plus, 
  X, 
  ChevronDown, 
  Lock, 
  FolderPlus, 
  Type, 
  DollarSign, 
  List, 
  Hash, 
  Calendar, 
  CheckSquare, 
  Mail, 
  Phone, 
  Link as LinkIcon,
  Trash2,
  Pencil,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type FieldType = 
  | "Texto" 
  | "Número" 
  | "Data" 
  | "Seleção" 
  | "Booleano" 
  | "Moeda" 
  | "Email" 
  | "Telefone" 
  | "URL"
  | "Multi-seleção";

type Field = {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  system: boolean;
  group: string;
};

const SYSTEM_FIELDS: Record<string, Field[]> = {
  negocios: [
    { id: "n1", name: "Titulo", type: "Texto", required: false, system: true, group: "Campos padrao" },
    { id: "n2", name: "Valor", type: "Moeda", required: false, system: true, group: "Campos padrao" },
    { id: "n3", name: "Etapa", type: "Seleção", required: false, system: true, group: "Campos padrao" },
    { id: "n4", name: "Pipeline", type: "Seleção", required: false, system: true, group: "Campos padrao" },
    { id: "n5", name: "Empresa", type: "Texto", required: false, system: true, group: "Campos padrao" },
    { id: "n6", name: "Contato", type: "Texto", required: false, system: true, group: "Campos padrao" },
    { id: "n7", name: "Probabilidade", type: "Número", required: false, system: true, group: "Campos padrao" },
    { id: "n8", name: "Etiquetas", type: "Multi-seleção", required: false, system: true, group: "Campos padrao" },
    { id: "n9", name: "Data prevista", type: "Data", required: false, system: true, group: "Campos padrao" },
    { id: "n10", name: "Status", type: "Seleção", required: false, system: true, group: "Campos padrao" },
    { id: "n11", name: "Criado em", type: "Data", required: false, system: true, group: "Campos padrao" },
  ],
  pessoas: [
    { id: "c1", name: "Nome", type: "Texto", required: true, system: true, group: "Campos padrao" },
    { id: "c2", name: "Email", type: "Email", required: false, system: true, group: "Campos padrao" },
    { id: "c3", name: "Telefone", type: "Telefone", required: false, system: true, group: "Campos padrao" },
    { id: "c4", name: "Cargo", type: "Texto", required: false, system: true, group: "Campos padrao" },
    { id: "c5", name: "Empresa", type: "Texto", required: false, system: true, group: "Campos padrao" },
    { id: "c6", name: "Etiqueta", type: "Seleção", required: false, system: true, group: "Campos padrao" },
    { id: "c7", name: "Responsável", type: "Texto", required: false, system: true, group: "Campos padrao" },
    { id: "c8", name: "Observações", type: "Texto", required: false, system: true, group: "Campos padrao" },
    { id: "c9", name: "Criado em", type: "Data", required: false, system: true, group: "Campos padrao" },
  ],
  empresas: [
    { id: "e1", name: "Nome", type: "Texto", required: true, system: true, group: "Campos padrao" },
    { id: "e2", name: "Telefone", type: "Telefone", required: false, system: true, group: "Campos padrao" },
    { id: "e3", name: "Email", type: "Email", required: false, system: true, group: "Campos padrao" },
    { id: "e4", name: "Cargo", type: "Texto", required: false, system: true, group: "Campos padrao" },
    { id: "e5", name: "Etiqueta", type: "Seleção", required: false, system: true, group: "Campos padrao" },
    { id: "e6", name: "Responsável", type: "Texto", required: false, system: true, group: "Campos padrao" },
    { id: "e7", name: "Observações", type: "Texto", required: false, system: true, group: "Campos padrao" },
    { id: "e8", name: "Negócios", type: "Número", required: false, system: true, group: "Campos padrao" },
    { id: "e9", name: "Criado em", type: "Data", required: false, system: true, group: "Campos padrao" },
  ],
};

const TAB_TO_ENTITY: Record<string, string> = {
  negocios: "deal",
  pessoas: "contact",
  empresas: "company",
};

const TABS = [
  { id: "negocios", label: "Negocio" },
  { id: "pessoas", label: "Pessoa" },
  { id: "empresas", label: "Empresa" },
];

const FIELD_TYPES: FieldType[] = [
  "Texto",
  "Número",
  "Data",
  "Seleção",
  "Booleano",
  "Moeda",
  "Email",
  "Telefone",
  "URL",
  "Multi-seleção"
];

const TAB_ENTITY_LABEL: Record<string, string> = {
  negocios: "Negócio",
  pessoas: "Pessoa",
  empresas: "Empresa",
};

function normalizeFieldType(type: string): FieldType {
  const t = type.toLowerCase();
  if (t === "texto") return "Texto";
  if (t === "número" || t === "numero") return "Número";
  if (t === "data") return "Data";
  if (t === "seleção" || t === "selecao") return "Seleção";
  if (t === "booleano") return "Booleano";
  if (t === "moeda") return "Moeda";
  if (t === "email") return "Email";
  if (t === "telefone") return "Telefone";
  if (t === "url") return "URL";
  if (t === "multi-seleção" || t === "multi-selecao") return "Multi-seleção";
  return "Texto";
}

function getFieldIcon(type: FieldType) {
  switch (type) {
    case "Texto":
      return <Type className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "Moeda":
      return <DollarSign className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "Seleção":
      return <List className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "Número":
      return <Hash className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "Data":
      return <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "Booleano":
      return <CheckSquare className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "Email":
      return <Mail className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "Telefone":
      return <Phone className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "URL":
      return <LinkIcon className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "Multi-seleção":
      return <List className="h-4 w-4 text-zinc-400 shrink-0" />;
    default:
      return <Type className="h-4 w-4 text-zinc-400 shrink-0" />;
  }
}

export default function CamposPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("negocios");
  const [customFields, setCustomFields] = useState<Record<string, Field[]>>({
    negocios: [],
    pessoas: [],
    empresas: []
  });
  
  // Track all user-created groups per tab
  const [groups, setGroups] = useState<Record<string, string[]>>({
    negocios: ["Desagrupado"],
    pessoas: ["Desagrupado"],
    empresas: ["Desagrupado"]
  });

  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [editingField, setEditingField] = useState<Field | null>(null);

  const [fieldForm, setFieldForm] = useState({
    name: "",
    type: "Texto" as FieldType,
    group: "Desagrupado",
    required: false
  });
  const [groupForm, setGroupForm] = useState({ name: "" });

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Campos padrao": true
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: prev[groupName] === undefined ? false : !prev[groupName] }));
  };

  const isGroupExpanded = (groupName: string) => {
    return expandedGroups[groupName] !== false;
  };

  const loadCustomFields = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order");

    let savedGroups: Record<string, string[]> = { negocios: [], pessoas: [], empresas: [] };
    try {
      const stored = localStorage.getItem(`custom_groups_${user.id}`);
      if (stored) {
        savedGroups = JSON.parse(stored);
      }
    } catch (e) {}

    const allGroups: Record<string, string[]> = {
      negocios: savedGroups.negocios?.length ? savedGroups.negocios : ["Desagrupado"],
      pessoas: savedGroups.pessoas?.length ? savedGroups.pessoas : ["Desagrupado"],
      empresas: savedGroups.empresas?.length ? savedGroups.empresas : ["Desagrupado"]
    };

    const grouped: Record<string, Field[]> = { negocios: [], pessoas: [], empresas: [] };
    
    for (const row of data ?? []) {
      const tab = Object.keys(TAB_TO_ENTITY).find(k => TAB_TO_ENTITY[k] === row.entity);
      if (tab) {
        const fieldGroup = row.field_group || "Desagrupado";
        if (!allGroups[tab].includes(fieldGroup)) {
          allGroups[tab].push(fieldGroup);
        }
        grouped[tab].push({
          id: row.id,
          name: row.label,
          type: normalizeFieldType(row.field_type),
          required: row.required ?? false,
          system: false,
          group: fieldGroup
        });
      }
    }
    
    localStorage.setItem(`custom_groups_${user.id}`, JSON.stringify(allGroups));
    
    setCustomFields(grouped);
    setGroups(allGroups);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadCustomFields();
  }, [loadCustomFields]);

  const handleAddGroup = async () => {
    if (!groupForm.name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const groupName = groupForm.name.trim();
    setGroups(prev => {
      const newGroups = { ...prev };
      if (!newGroups[activeTab].includes(groupName)) {
        newGroups[activeTab] = [...newGroups[activeTab], groupName];
        localStorage.setItem(`custom_groups_${user.id}`, JSON.stringify(newGroups));
      }
      return newGroups;
    });

    setGroupForm({ name: "" });
    setShowGroupModal(false);
  };

  const handleDeleteGroup = async (groupName: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setGroups(prev => {
      const newGroups = { ...prev };
      newGroups[activeTab] = newGroups[activeTab].filter(g => g !== groupName);
      localStorage.setItem(`custom_groups_${user.id}`, JSON.stringify(newGroups));
      return newGroups;
    });
  };

  const handleAddField = async () => {
    if (!fieldForm.name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const entity = TAB_TO_ENTITY[activeTab];
    const sortOrder = (customFields[activeTab] ?? []).length;

    const { data, error } = await supabase.from("custom_fields").insert({
      user_id: user.id,
      entity,
      label: fieldForm.name.trim(),
      field_type: fieldForm.type.toLowerCase(),
      required: fieldForm.required,
      field_group: fieldForm.group,
      sort_order: sortOrder,
    }).select().single();

    setSaving(false);
    if (!error && data) {
      const newField: Field = {
        id: data.id,
        name: data.label,
        type: normalizeFieldType(data.field_type),
        required: data.required,
        system: false,
        group: data.field_group || "Desagrupado"
      };
      setCustomFields(prev => ({
        ...prev,
        [activeTab]: [...prev[activeTab], newField]
      }));
    }
    setFieldForm({ name: "", type: "Texto", group: "Desagrupado", required: false });
    setShowFieldModal(false);
  };

  const handleUpdateField = async () => {
    if (!editingField || !fieldForm.name.trim()) return;
    setSaving(true);
    
    const { error } = await supabase.from("custom_fields").update({
      label: fieldForm.name.trim(),
      field_type: fieldForm.type.toLowerCase(),
      required: fieldForm.required,
      field_group: fieldForm.group,
    }).eq("id", editingField.id);

    setSaving(false);
    if (!error) {
      setCustomFields(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].map(f => f.id === editingField.id ? {
          ...f,
          name: fieldForm.name.trim(),
          type: fieldForm.type,
          required: fieldForm.required,
          group: fieldForm.group
        } : f)
      }));
    }
    
    setEditingField(null);
    setFieldForm({ name: "", type: "Texto", group: "Desagrupado", required: false });
  };

  const handleRemoveField = async (id: string) => {
    await supabase.from("custom_fields").delete().eq("id", id);
    setCustomFields(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter(f => f.id !== id)
    }));
  };

  const openEditModal = (field: Field) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      type: field.type,
      group: field.group,
      required: field.required
    });
  };

  const standardFields = SYSTEM_FIELDS[activeTab] ?? [];
  const userFields = customFields[activeTab] ?? [];
  const currentTabGroups = groups[activeTab] ?? ["Desagrupado"];

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Campos de dados</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Crie campos personalizados para seus negocios, pessoas e empresas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGroupModal(true)}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors bg-white"
          >
            <FolderPlus className="h-4 w-4" />
            Grupo
          </button>
          <button
            onClick={() => {
              setEditingField(null);
              setFieldForm({ name: "", type: "Texto", group: "Desagrupado", required: false });
              setShowFieldModal(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Campo personalizado
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-100 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Accordions */}
      <div className="space-y-6">
        {/* Standard Fields */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <button 
              onClick={() => toggleGroup("Campos padrao")}
              className="flex items-center gap-2 group outline-none"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", !isGroupExpanded("Campos padrao") && "-rotate-90")} />
              <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Campos padrao</span>
              <span className="text-xs text-zinc-300">{standardFields.length}</span>
            </button>
          </div>

          {isGroupExpanded("Campos padrao") && (
            <div className="rounded-xl bg-white overflow-hidden border border-zinc-100 shadow-none">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide w-8"></th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Nome do campo</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Tipo</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Obrigatorio</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {standardFields.map(field => (
                    <tr key={field.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-3">
                        {getFieldIcon(field.type)}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{field.name}</td>
                      <td className="px-4 py-3 text-zinc-500">{field.type}</td>
                      <td className="px-4 py-3 text-center">
                        {field.required && <Check className="h-4 w-4 text-amber-500 inline" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <Lock className="h-3.5 w-3.5 text-zinc-200" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Custom Field Groups */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          </div>
        ) : (
          currentTabGroups.map(groupName => {
            const groupFields = userFields.filter(f => f.group === groupName);
            // Dont show 'Desagrupado' if it's empty and there are other groups
            if (groupName === "Desagrupado" && groupFields.length === 0 && currentTabGroups.length > 1) {
              return null;
            }

            return (
              <div key={groupName}>
                <div className="flex items-center justify-between mb-2">
                  <button 
                    onClick={() => toggleGroup(groupName)}
                    className="flex items-center gap-2 group outline-none"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", !isGroupExpanded(groupName) && "-rotate-90")} />
                    <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">{groupName}</span>
                    <span className="text-xs text-zinc-300">{groupFields.length}</span>
                  </button>
                  {groupName !== "Desagrupado" && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleDeleteGroup(groupName)}
                        className="text-zinc-300 hover:text-red-400 transition-colors"
                        title="Excluir grupo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {isGroupExpanded(groupName) && (
                  groupFields.length > 0 ? (
                    <div className="rounded-xl bg-white overflow-hidden border border-zinc-100 shadow-none">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-50">
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide w-8"></th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Nome do campo</th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Tipo</th>
                            <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Obrigatorio</th>
                            <th className="w-20"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {groupFields.map(field => (
                            <tr key={field.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors group/row">
                              <td className="px-4 py-3">
                                {getFieldIcon(field.type)}
                              </td>
                              <td className="px-4 py-3 font-medium text-zinc-900">{field.name}</td>
                              <td className="px-4 py-3 text-zinc-500">{field.type}</td>
                              <td className="px-4 py-3 text-center">
                                {field.required && <Check className="h-4 w-4 text-amber-500 inline" />}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => openEditModal(field)}
                                    className="p-1 text-zinc-300 hover:text-zinc-600 transition-colors rounded"
                                    title="Editar campo"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveField(field.id)}
                                    className="p-1 text-zinc-300 hover:text-red-400 transition-colors rounded"
                                    title="Excluir campo"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-lg bg-white/50 shadow-none">
                      Nenhum campo neste grupo.
                    </div>
                  )
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowGroupModal(false)}>
          <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-sm mx-4 p-6 shadow-none" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-zinc-900">Novo grupo de campo</h2>
              <button onClick={() => setShowGroupModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Nome do grupo</label>
                <input
                  type="text"
                  placeholder={`Criar grupos para o/a ${TAB_ENTITY_LABEL[activeTab]}`}
                  value={groupForm.name}
                  onChange={e => setGroupForm({ name: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all shadow-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowGroupModal(false)} 
                className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors shadow-none"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddGroup} 
                disabled={!groupForm.name.trim()}
                className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-none disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Modal (New / Edit) */}
      {(showFieldModal || editingField) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowFieldModal(false); setEditingField(null); }}>
          <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-sm mx-4 p-6 shadow-none" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-zinc-900">
                {editingField ? "Editar campo" : "Novo campo personalizado"}
              </h2>
              <button onClick={() => { setShowFieldModal(false); setEditingField(null); }} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">
                  Nome do campo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Data de Vencimento"
                  value={fieldForm.name}
                  onChange={e => setFieldForm({ ...fieldForm, name: e.target.value })}
                  className={cn(
                    "w-full bg-white border text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all shadow-none",
                    fieldForm.name === "" ? "border-red-300 bg-red-50" : "border-zinc-200"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Tipo</label>
                <select
                  value={fieldForm.type}
                  onChange={e => setFieldForm({ ...fieldForm, type: e.target.value as FieldType })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all cursor-pointer shadow-none"
                >
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Grupo de campo</label>
                <select
                  value={fieldForm.group}
                  onChange={e => setFieldForm({ ...fieldForm, group: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all cursor-pointer shadow-none"
                >
                  {currentTabGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldForm.required}
                  onChange={e => setFieldForm({ ...fieldForm, required: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
                <span className="text-[13px] font-semibold text-zinc-700">Obrigatório</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button 
                onClick={() => { setShowFieldModal(false); setEditingField(null); }} 
                className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors shadow-none"
              >
                Cancelar
              </button>
              <button
                onClick={editingField ? handleUpdateField : handleAddField}
                disabled={!fieldForm.name.trim() || saving}
                className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-none disabled:opacity-50"
              >
                {saving ? "Salvando..." : editingField ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
