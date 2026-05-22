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
  Trash2 
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
};

const SYSTEM_FIELDS: Record<string, Field[]> = {
  negocios: [
    { id: "n1", name: "Titulo", type: "Texto", required: false, system: true },
    { id: "n2", name: "Valor", type: "Moeda", required: false, system: true },
    { id: "n3", name: "Etapa", type: "Seleção", required: false, system: true },
    { id: "n4", name: "Pipeline", type: "Seleção", required: false, system: true },
    { id: "n5", name: "Empresa", type: "Texto", required: false, system: true },
    { id: "n6", name: "Contato", type: "Texto", required: false, system: true },
    { id: "n7", name: "Probabilidade", type: "Número", required: false, system: true },
    { id: "n8", name: "Etiquetas", type: "Multi-seleção", required: false, system: true },
    { id: "n9", name: "Data prevista", type: "Data", required: false, system: true },
    { id: "n10", name: "Status", type: "Seleção", required: false, system: true },
    { id: "n11", name: "Criado em", type: "Data", required: false, system: true },
  ],
  pessoas: [
    { id: "c1", name: "Nome", type: "Texto", required: true, system: true },
    { id: "c2", name: "Email", type: "Email", required: false, system: true },
    { id: "c3", name: "Telefone", type: "Telefone", required: false, system: true },
    { id: "c4", name: "Cargo", type: "Texto", required: false, system: true },
    { id: "c5", name: "Empresa", type: "Texto", required: false, system: true },
    { id: "c6", name: "Etiqueta", type: "Seleção", required: false, system: true },
    { id: "c7", name: "Responsável", type: "Texto", required: false, system: true },
    { id: "c8", name: "Observações", type: "Texto", required: false, system: true },
    { id: "c9", name: "Criado em", type: "Data", required: false, system: true },
  ],
  empresas: [
    { id: "e1", name: "Nome", type: "Texto", required: true, system: true },
    { id: "e2", name: "Telefone", type: "Telefone", required: false, system: true },
    { id: "e3", name: "Email", type: "Email", required: false, system: true },
    { id: "e4", name: "Cargo", type: "Texto", required: false, system: true },
    { id: "e5", name: "Etiqueta", type: "Seleção", required: false, system: true },
    { id: "e6", name: "Responsável", type: "Texto", required: false, system: true },
    { id: "e7", name: "Observações", type: "Texto", required: false, system: true },
    { id: "e8", name: "Negócios", type: "Número", required: false, system: true },
    { id: "e9", name: "Criado em", type: "Data", required: false, system: true },
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
  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldForm, setFieldForm] = useState({
    name: "",
    type: "Texto" as FieldType,
    group: "Desagrupado",
    required: false
  });
  const [groupForm, setGroupForm] = useState({ name: "" });

  const [standardExpanded, setStandardExpanded] = useState(true);
  const [customExpanded, setCustomExpanded] = useState(true);

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

    const grouped: Record<string, Field[]> = { negocios: [], pessoas: [], empresas: [] };
    for (const row of data ?? []) {
      const tab = Object.keys(TAB_TO_ENTITY).find(k => TAB_TO_ENTITY[k] === row.entity);
      if (tab) {
        grouped[tab].push({
          id: row.id,
          name: row.label,
          type: normalizeFieldType(row.field_type),
          required: row.required ?? false,
          system: false,
        });
      }
    }
    setCustomFields(grouped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadCustomFields();
  }, [loadCustomFields]);

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
        system: false
      };
      setCustomFields(prev => ({
        ...prev,
        [activeTab]: [...prev[activeTab], newField]
      }));
    }
    setFieldForm({ name: "", type: "Texto", group: "Desagrupado", required: false });
    setShowFieldModal(false);
  };

  const handleRemoveField = async (id: string) => {
    await supabase.from("custom_fields").delete().eq("id", id);
    setCustomFields(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter(f => f.id !== id)
    }));
  };

  const standardFields = SYSTEM_FIELDS[activeTab] ?? [];
  const userFields = customFields[activeTab] ?? [];

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
            onClick={() => setShowFieldModal(true)}
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
      <div className="space-y-5">
        {/* Standard Fields */}
        <div>
          <button 
            onClick={() => setStandardExpanded(!standardExpanded)}
            className="flex items-center gap-2 mb-2 group outline-none"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", !standardExpanded && "-rotate-90")} />
            <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Campos padrao</span>
            <span className="text-xs text-zinc-300">{standardFields.length}</span>
          </button>

          {standardExpanded && (
            <div className="rounded-xl bg-white overflow-hidden border border-zinc-100">
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
                        <span className="inline-flex items-center justify-center">
                          <span className={cn(
                            "h-4 w-4 inline-block rounded border transition-colors",
                            field.required ? "bg-amber-500 border-amber-600" : "border-zinc-200"
                          )}>
                            {field.required && (
                              <svg className="w-3 h-3 text-white mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                        </span>
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

        {/* Custom Fields */}
        <div>
          <button 
            onClick={() => setCustomExpanded(!customExpanded)}
            className="flex items-center gap-2 mb-2 group outline-none"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", !customExpanded && "-rotate-90")} />
            <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Campos personalizados</span>
            <span className="text-xs text-zinc-300">{userFields.length}</span>
          </button>

          {customExpanded && (
            loading ? (
              <div className="flex items-center justify-center py-8 bg-white border border-zinc-100 rounded-xl">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              </div>
            ) : userFields.length > 0 ? (
              <div className="rounded-xl bg-white overflow-hidden border border-zinc-100">
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
                    {userFields.map(field => (
                      <tr key={field.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors group">
                        <td className="px-4 py-3">
                          {getFieldIcon(field.type)}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900">{field.name}</td>
                        <td className="px-4 py-3 text-zinc-500">{field.type}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center">
                            <span className={cn(
                              "h-4 w-4 inline-block rounded border transition-colors",
                              field.required ? "bg-amber-500 border-amber-600" : "border-zinc-200"
                            )}>
                              {field.required && (
                                <svg className="w-3 h-3 text-white mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => handleRemoveField(field.id)}
                              className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                              title="Excluir campo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-3 rounded-xl bg-white border border-zinc-100">
                <List className="h-8 w-8 text-zinc-300" />
                <p className="text-sm">Nenhum campo personalizado para esta entidade.</p>
                <button 
                  onClick={() => setShowFieldModal(true)}
                  className="text-sm text-amber-500 hover:underline font-medium"
                >
                  Criar primeiro campo
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowGroupModal(false)}>
          <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
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
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowGroupModal(false)} 
                className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => { setGroupForm({ name: "" }); setShowGroupModal(false); }} 
                className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 transition-colors"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Modal */}
      {showFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFieldModal(false)}>
          <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-zinc-900">Novo campo personalizado</h2>
              <button onClick={() => setShowFieldModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100">
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
                    "w-full bg-white border text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all",
                    fieldForm.name === "" ? "border-red-300 bg-red-50" : "border-zinc-200"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Tipo</label>
                <select
                  value={fieldForm.type}
                  onChange={e => setFieldForm({ ...fieldForm, type: e.target.value as FieldType })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all cursor-pointer"
                >
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Grupo de campo</label>
                <select
                  value={fieldForm.group}
                  onChange={e => setFieldForm({ ...fieldForm, group: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all cursor-pointer"
                >
                  <option value="Desagrupado">Desagrupado</option>
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
                onClick={() => setShowFieldModal(false)} 
                className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddField}
                disabled={!fieldForm.name.trim() || saving}
                className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {saving ? "Adicionando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
