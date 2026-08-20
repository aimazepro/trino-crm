"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Check,
  GripVertical,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";

type FieldType = 
  | "Texto" 
  | "Número" 
  | "Data" 
  | "Moeda"
  | "Seleção" 
  | "Multi-seleção"
  | "Booleano" 
  | "Telefone" 
  | "Email" 
  | "Usuário"
  | "URL";

type Field = {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  requiredOnGanho?: boolean;
  requiredOnPerdido?: boolean;
  allPipelinesSelected?: boolean;
  requiredPipelineIds?: string[];
  system: boolean;
  group: string;
  options?: string[];
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
  "Moeda",
  "Seleção",
  "Multi-seleção",
  "Booleano",
  "Telefone",
  "Email",
  "Usuário"
];

const TAB_ENTITY_LABEL: Record<string, string> = {
  negocios: "Negócio",
  pessoas: "Pessoa",
  empresas: "Empresa",
};

function normalizeFieldType(type: string): FieldType {
  const t = type.toLowerCase();
  if (t === "texto" || t === "text") return "Texto";
  if (t === "número" || t === "numero" || t === "number") return "Número";
  if (t === "data" || t === "date") return "Data";
  if (t === "moeda" || t === "currency") return "Moeda";
  if (t === "seleção" || t === "selecao" || t === "select") return "Seleção";
  if (t === "multi-seleção" || t === "multi-selecao" || t === "multiselect") return "Multi-seleção";
  if (t === "booleano" || t === "boolean") return "Booleano";
  if (t === "telefone" || t === "phone") return "Telefone";
  if (t === "email") return "Email";
  if (t === "usuário" || t === "usuario" || t === "user") return "Usuário";
  if (t === "url") return "URL";
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
    case "Usuário":
      return <User className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "URL":
      return <LinkIcon className="h-4 w-4 text-zinc-400 shrink-0" />;
    case "Multi-seleção":
      return <List className="h-4 w-4 text-zinc-400 shrink-0" />;
    default:
      return <Type className="h-4 w-4 text-zinc-400 shrink-0" />;
  }
}

function parseFieldOptions(rawOptions: any) {
  let choices: string[] = [];
  let requiredOnGanho = true;
  let requiredOnPerdido = true;
  let allPipelinesSelected = true;
  let requiredPipelineIds: string[] = [];

  if (Array.isArray(rawOptions)) {
    choices = rawOptions;
  } else if (rawOptions && typeof rawOptions === "object") {
    choices = Array.isArray(rawOptions.choices) ? rawOptions.choices : (Array.isArray(rawOptions.options) ? rawOptions.options : []);
    if (typeof rawOptions.requiredOnGanho === "boolean") requiredOnGanho = rawOptions.requiredOnGanho;
    if (typeof rawOptions.requiredOnPerdido === "boolean") requiredOnPerdido = rawOptions.requiredOnPerdido;
    if (typeof rawOptions.allPipelinesSelected === "boolean") allPipelinesSelected = rawOptions.allPipelinesSelected;
    if (Array.isArray(rawOptions.requiredPipelineIds)) requiredPipelineIds = rawOptions.requiredPipelineIds;
  } else if (typeof rawOptions === "string") {
    try {
      const parsed = JSON.parse(rawOptions);
      return parseFieldOptions(parsed);
    } catch {
      choices = [];
    }
  }

  return { choices, requiredOnGanho, requiredOnPerdido, allPipelinesSelected, requiredPipelineIds };
}

function buildOptionsPayload(fieldForm: any) {
  const isSelectType = fieldForm.type === "Seleção" || fieldForm.type === "Multi-seleção";
  const choices = isSelectType ? (fieldForm.options || []) : [];

  return {
    choices,
    requiredOnGanho: fieldForm.requiredOnGanho ?? true,
    requiredOnPerdido: fieldForm.requiredOnPerdido ?? true,
    allPipelinesSelected: fieldForm.allPipelinesSelected ?? true,
    requiredPipelineIds: fieldForm.requiredPipelineIds ?? [],
  };
}

export default function CamposPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspaceId } = useWorkspace();
  const [activeTab, setActiveTab] = useState("negocios");
  const [dbPipelines, setDbPipelines] = useState<Array<{ id: string; name: string }>>([]);
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
  
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);
  const [confirmDeleteField, setConfirmDeleteField] = useState<string | null>(null);
  
  const [editingField, setEditingField] = useState<Field | null>(null);

  const [fieldForm, setFieldForm] = useState({
    name: "",
    type: "Texto" as FieldType,
    group: "Desagrupado",
    required: false,
    requiredOnGanho: true,
    requiredOnPerdido: true,
    allPipelinesSelected: true,
    requiredPipelineIds: [] as string[],
    options: [] as string[]
  });
  const [groupForm, setGroupForm] = useState({ name: "" });

  const [newOptionInput, setNewOptionInput] = useState("");
  const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null);
  const [editingOptionText, setEditingOptionText] = useState("");

  const handleAddOption = () => {
    const val = newOptionInput.trim();
    if (!val) return;
    const currentOpts = fieldForm.options || [];
    if (!currentOpts.includes(val)) {
      setFieldForm(prev => ({ ...prev, options: [...(prev.options || []), val] }));
    }
    setNewOptionInput("");
  };

  const handleRemoveOption = (index: number) => {
    setFieldForm(prev => ({
      ...prev,
      options: (prev.options || []).filter((_, i) => i !== index)
    }));
  };

  const handleStartEditOption = (index: number, text: string) => {
    setEditingOptionIndex(index);
    setEditingOptionText(text);
  };

  const handleSaveEditOption = (index: number) => {
    const val = editingOptionText.trim();
    if (val) {
      setFieldForm(prev => ({
        ...prev,
        options: (prev.options || []).map((opt, i) => (i === index ? val : opt))
      }));
    }
    setEditingOptionIndex(null);
    setEditingOptionText("");
  };

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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data }, { data: groupRows }, { data: pipelineRows }] = await Promise.all([
        supabase.from("custom_fields").select("*").order("sort_order"),
        supabase.from("custom_field_groups").select("entity, name"),
        supabase.from("pipelines").select("id, name").order("sort_order"),
      ]);

      setDbPipelines(pipelineRows ?? []);

      const allGroups: Record<string, string[]> = {
        negocios: ["Desagrupado"],
        pessoas: ["Desagrupado"],
        empresas: ["Desagrupado"],
      };

      for (const row of groupRows ?? []) {
        const tab = Object.keys(TAB_TO_ENTITY).find(k => TAB_TO_ENTITY[k] === row.entity);
        if (tab && !allGroups[tab].includes(row.name)) {
          allGroups[tab].push(row.name);
        }
      }

      const grouped: Record<string, Field[]> = { negocios: [], pessoas: [], empresas: [] };

      for (const row of data ?? []) {
        const tab = Object.keys(TAB_TO_ENTITY).find(k => TAB_TO_ENTITY[k] === row.entity);
        if (tab) {
          const fieldGroup = row.field_group || "Desagrupado";
          if (!allGroups[tab].includes(fieldGroup)) {
            allGroups[tab].push(fieldGroup);
          }
          const { choices, requiredOnGanho, requiredOnPerdido, allPipelinesSelected, requiredPipelineIds } = parseFieldOptions(row.options);

          grouped[tab].push({
            id: row.id,
            name: row.label,
            type: normalizeFieldType(row.field_type),
            required: row.required ?? false,
            requiredOnGanho,
            requiredOnPerdido,
            allPipelinesSelected,
            requiredPipelineIds,
            system: false,
            group: fieldGroup,
            options: choices
          });
        }
      }

      setCustomFields(grouped);
      setGroups(allGroups);
    } catch (err) {
      console.error("[Campos] error loading custom fields:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadCustomFields();
  }, [loadCustomFields]);

  const handleAddGroup = async () => {
    if (!groupForm.name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const groupName = groupForm.name.trim();
    const entity = TAB_TO_ENTITY[activeTab];
    const { error } = await supabase.from("custom_field_groups").insert({
      workspace_id: workspaceId, entity, name: groupName,
    });
    if (error) {
      console.error("[Campos] add group failed:", error);
      return;
    }

    setGroups(prev => {
      const newGroups = { ...prev };
      if (!newGroups[activeTab].includes(groupName)) {
        newGroups[activeTab] = [...newGroups[activeTab], groupName];
      }
      return newGroups;
    });

    setGroupForm({ name: "" });
    setShowGroupModal(false);
  };

  const handleDeleteGroup = async (groupName: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const hasFields = (customFields[activeTab] ?? []).some(f => f.group === groupName);
    if (hasFields) {
      alert("Mova ou apague os campos deste grupo antes de excluí-lo.");
      return;
    }

    const entity = TAB_TO_ENTITY[activeTab];
    const { error } = await supabase.from("custom_field_groups")
      .delete().eq("entity", entity).eq("name", groupName);
    if (error) {
      console.error("[Campos] delete group failed:", error);
      return;
    }

    setGroups(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter(g => g !== groupName),
    }));
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
    const optionsPayload = buildOptionsPayload(fieldForm);

    const { data, error } = await supabase.from("custom_fields").insert({
      workspace_id: workspaceId,
      entity,
      label: fieldForm.name.trim(),
      field_type: fieldForm.type.toLowerCase(),
      required: fieldForm.required,
      field_group: fieldForm.group,
      options: optionsPayload,
      sort_order: sortOrder,
    }).select().single();

    setSaving(false);
    if (!error && data) {
      const isSelectType = fieldForm.type === "Seleção" || fieldForm.type === "Multi-seleção";
      const newField: Field = {
        id: data.id,
        name: data.label,
        type: normalizeFieldType(data.field_type),
        required: data.required,
        requiredOnGanho: fieldForm.requiredOnGanho,
        requiredOnPerdido: fieldForm.requiredOnPerdido,
        allPipelinesSelected: fieldForm.allPipelinesSelected,
        requiredPipelineIds: fieldForm.requiredPipelineIds,
        system: false,
        group: data.field_group || "Desagrupado",
        options: isSelectType ? (fieldForm.options || []) : []
      };
      setCustomFields(prev => ({
        ...prev,
        [activeTab]: [...prev[activeTab], newField]
      }));
    }
    setFieldForm({
      name: "",
      type: "Texto",
      group: "Desagrupado",
      required: false,
      requiredOnGanho: true,
      requiredOnPerdido: true,
      allPipelinesSelected: true,
      requiredPipelineIds: [],
      options: []
    });
    setNewOptionInput("");
    setEditingOptionIndex(null);
    setShowFieldModal(false);
  };

  const handleUpdateField = async () => {
    if (!editingField || !fieldForm.name.trim()) return;
    setSaving(true);
    
    const optionsPayload = buildOptionsPayload(fieldForm);

    const { error } = await supabase.from("custom_fields").update({
      label: fieldForm.name.trim(),
      field_type: fieldForm.type.toLowerCase(),
      required: fieldForm.required,
      field_group: fieldForm.group,
      options: optionsPayload,
    }).eq("id", editingField.id);

    setSaving(false);
    if (!error) {
      const isSelectType = fieldForm.type === "Seleção" || fieldForm.type === "Multi-seleção";
      setCustomFields(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].map(f => f.id === editingField.id ? {
          ...f,
          name: fieldForm.name.trim(),
          type: fieldForm.type,
          required: fieldForm.required,
          requiredOnGanho: fieldForm.requiredOnGanho,
          requiredOnPerdido: fieldForm.requiredOnPerdido,
          allPipelinesSelected: fieldForm.allPipelinesSelected,
          requiredPipelineIds: fieldForm.requiredPipelineIds,
          group: fieldForm.group,
          options: isSelectType ? (fieldForm.options || []) : []
        } : f)
      }));
    }
    
    setEditingField(null);
    setFieldForm({
      name: "",
      type: "Texto",
      group: "Desagrupado",
      required: false,
      requiredOnGanho: true,
      requiredOnPerdido: true,
      allPipelinesSelected: true,
      requiredPipelineIds: [],
      options: []
    });
    setNewOptionInput("");
    setEditingOptionIndex(null);
  };

  const handleRemoveField = async (id: string) => {
    const { error } = await supabase.from("custom_fields").delete().eq("id", id);
    if (error) {
      console.error("[Campos] delete field failed:", error);
      alert("Não foi possível excluir o campo. Tente novamente.");
      return;
    }
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
      required: field.required,
      requiredOnGanho: field.requiredOnGanho ?? true,
      requiredOnPerdido: field.requiredOnPerdido ?? true,
      allPipelinesSelected: field.allPipelinesSelected ?? true,
      requiredPipelineIds: field.requiredPipelineIds ?? [],
      options: field.options ?? []
    });
    setNewOptionInput("");
    setEditingOptionIndex(null);
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
              setFieldForm({
                name: "",
                type: "Texto",
                group: "Desagrupado",
                required: false,
                requiredOnGanho: true,
                requiredOnPerdido: true,
                allPipelinesSelected: true,
                requiredPipelineIds: [],
                options: []
              });
              setNewOptionInput("");
              setEditingOptionIndex(null);
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
              <div key={groupName} className="group/section">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Arrastar para reordenar"
                      className="touch-none cursor-grab active:cursor-grabbing text-zinc-200 hover:text-zinc-400 transition-colors opacity-0 group-hover/section:opacity-100"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => toggleGroup(groupName)}
                      className="flex items-center gap-2 group outline-none"
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", !isGroupExpanded(groupName) && "-rotate-90")} />
                      <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">{groupName}</span>
                      <span className="text-xs text-zinc-300">{groupFields.length}</span>
                    </button>
                  </div>
                  {groupName !== "Desagrupado" && (
                    <div className="flex items-center gap-1">
                      {confirmDeleteGroup === groupName ? (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              handleDeleteGroup(groupName);
                              setConfirmDeleteGroup(null);
                            }}
                            className="text-xs text-red-500 hover:text-red-600 font-medium"
                          >
                            Excluir
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteGroup(null)}
                            className="text-zinc-400 hover:text-zinc-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmDeleteGroup(groupName)}
                          className="text-zinc-300 hover:text-red-400 transition-colors"
                          title="Excluir grupo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
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
                                  {confirmDeleteField === field.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          handleRemoveField(field.id);
                                          setConfirmDeleteField(null);
                                        }}
                                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                                      >
                                        Excluir
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteField(null)}
                                        className="text-zinc-400 hover:text-zinc-600"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => openEditModal(field)}
                                        className="p-1 text-zinc-300 hover:text-zinc-600 transition-colors rounded"
                                        title="Editar campo"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteField(field.id)}
                                        className="p-1 text-zinc-300 hover:text-red-400 transition-colors rounded"
                                        title="Excluir campo"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
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
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-900">
                {editingField ? "Editar campo" : "Novo campo personalizado"}
              </h2>
              <button 
                onClick={() => { setShowFieldModal(false); setEditingField(null); }} 
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Nome do campo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Origem do lead"
                  value={fieldForm.name}
                  onChange={e => setFieldForm({ ...fieldForm, name: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              {!editingField && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tipo</label>
                  <select
                    value={fieldForm.type}
                    onChange={e => setFieldForm({ ...fieldForm, type: e.target.value as FieldType })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 cursor-pointer"
                  >
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Grupo de campo</label>
                <select
                  value={fieldForm.group}
                  onChange={e => setFieldForm({ ...fieldForm, group: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 cursor-pointer"
                >
                  {currentTabGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {(fieldForm.type === "Seleção" || fieldForm.type === "Multi-seleção") && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Opcoes</label>
                  <div className="space-y-1.5 mb-2">
                    {(fieldForm.options || []).map((opt, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5">
                        {editingOptionIndex === index ? (
                          <input
                            type="text"
                            value={editingOptionText}
                            onChange={e => setEditingOptionText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") handleSaveEditOption(index);
                              if (e.key === "Escape") setEditingOptionIndex(null);
                            }}
                            autoFocus
                            className="flex-1 text-sm text-zinc-700 bg-white border border-zinc-200 rounded px-2 py-0.5 outline-none"
                          />
                        ) : (
                          <span className="flex-1 text-sm text-zinc-700">{opt}</span>
                        )}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {editingOptionIndex === index ? (
                            <button
                              onClick={() => handleSaveEditOption(index)}
                              className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                            >
                              Salvar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartEditOption(index, opt)}
                              title="Renomear opção (os registros que usam este valor acompanham)"
                              className="text-zinc-300 hover:text-zinc-500 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveOption(index)}
                            className="text-zinc-300 hover:text-red-400 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      placeholder="Nova opcao..."
                      value={newOptionInput}
                      onChange={e => setNewOptionInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      type="text"
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 transition-colors shrink-0"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldForm.required}
                    onChange={e => setFieldForm(prev => ({ ...prev, required: e.target.checked }))}
                    className="rounded border-zinc-300 accent-amber-500 h-4 w-4 cursor-pointer"
                  />
                  <span className="text-sm text-zinc-700 font-medium">Obrigatorio</span>
                </label>
              </div>

              {fieldForm.required && (
                <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2.5 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 mb-2">
                      Exigir o preenchimento ao marcar o negocio como:
                    </p>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldForm.requiredOnGanho}
                          onChange={e => setFieldForm(prev => ({ ...prev, requiredOnGanho: e.target.checked }))}
                          className="rounded border-zinc-300 accent-amber-500 h-4 w-4 cursor-pointer"
                        />
                        <span className="text-sm text-zinc-700">Ganho</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldForm.requiredOnPerdido}
                          onChange={e => setFieldForm(prev => ({ ...prev, requiredOnPerdido: e.target.checked }))}
                          className="rounded border-zinc-300 accent-amber-500 h-4 w-4 cursor-pointer"
                        />
                        <span className="text-sm text-zinc-700">Perdido</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100">
                    <p className="text-xs font-medium text-zinc-500 mb-2">Em quais funis:</p>
                    <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                      <input
                        type="checkbox"
                        checked={fieldForm.allPipelinesSelected}
                        onChange={e => {
                          if (e.target.checked) {
                            setFieldForm(prev => ({
                              ...prev,
                              allPipelinesSelected: true,
                              requiredPipelineIds: []
                            }));
                          } else {
                            setFieldForm(prev => ({
                              ...prev,
                              allPipelinesSelected: false
                            }));
                          }
                        }}
                        className="rounded border-zinc-300 accent-amber-500 h-4 w-4 cursor-pointer"
                      />
                      <span className="text-sm text-zinc-700 font-medium">Todos os funis</span>
                    </label>
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pl-0.5">
                      {(dbPipelines || []).map(p => {
                        const isChecked = !fieldForm.allPipelinesSelected && (fieldForm.requiredPipelineIds || []).includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  const currentIds = fieldForm.requiredPipelineIds || [];
                                  const nextIds = [...currentIds, p.id];
                                  const allSelected = (dbPipelines || []).length > 0 && nextIds.length === dbPipelines.length;
                                  setFieldForm(prev => ({
                                    ...prev,
                                    allPipelinesSelected: allSelected,
                                    requiredPipelineIds: allSelected ? [] : nextIds
                                  }));
                                } else {
                                  const currentIds = fieldForm.requiredPipelineIds || [];
                                  const nextIds = currentIds.filter(id => id !== p.id);
                                  setFieldForm(prev => ({
                                    ...prev,
                                    allPipelinesSelected: false,
                                    requiredPipelineIds: nextIds
                                  }));
                                }
                              }}
                              className="rounded border-zinc-300 accent-amber-500 h-4 w-4 cursor-pointer"
                            />
                            <span className="text-sm text-zinc-600">{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-5">
              <button 
                onClick={() => { setShowFieldModal(false); setEditingField(null); }} 
                className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingField ? handleUpdateField : handleAddField}
                disabled={!fieldForm.name.trim() || saving}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Salvando..." : editingField ? "Salvar alteracoes" : "Criar campo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
