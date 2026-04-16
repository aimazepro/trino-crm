"use client";

import { useState } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type FieldType = "Texto" | "Número" | "Data" | "Seleção" | "Booleano" | "Moeda" | "Email" | "Telefone" | "URL";

type Field = {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  system: boolean;
};

const TABS = [
  {
    id: "negocios",
    label: "Negócios",
    fields: [
      { id: "n1", name: "Nome", type: "Texto" as FieldType, required: true, system: true },
      { id: "n2", name: "Fase", type: "Seleção" as FieldType, required: false, system: true },
      { id: "n3", name: "Valor", type: "Moeda" as FieldType, required: false, system: true },
      { id: "n4", name: "Etiqueta", type: "Seleção" as FieldType, required: false, system: true },
      { id: "n5", name: "Criador", type: "Texto" as FieldType, required: false, system: true },
      { id: "n6", name: "Responsável", type: "Texto" as FieldType, required: false, system: true },
      { id: "n7", name: "Empresa", type: "Texto" as FieldType, required: false, system: true },
      { id: "n8", name: "Contato", type: "Texto" as FieldType, required: false, system: true },
      { id: "n9", name: "Perdido por", type: "Seleção" as FieldType, required: false, system: true },
      { id: "n10", name: "Observações", type: "Texto" as FieldType, required: false, system: true },
      { id: "n11", name: "Criado em", type: "Data" as FieldType, required: false, system: true },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas",
    fields: [
      { id: "c1", name: "Nome", type: "Texto" as FieldType, required: true, system: true },
      { id: "c2", name: "Email", type: "Email" as FieldType, required: false, system: true },
      { id: "c3", name: "Telefone", type: "Telefone" as FieldType, required: false, system: true },
      { id: "c4", name: "Cargo", type: "Texto" as FieldType, required: false, system: true },
      { id: "c5", name: "Empresa", type: "Texto" as FieldType, required: false, system: true },
      { id: "c6", name: "Etiqueta", type: "Seleção" as FieldType, required: false, system: true },
      { id: "c7", name: "Responsável", type: "Texto" as FieldType, required: false, system: true },
      { id: "c8", name: "Observações", type: "Texto" as FieldType, required: false, system: true },
      { id: "c9", name: "Criado em", type: "Data" as FieldType, required: false, system: true },
    ],
  },
  {
    id: "empresas",
    label: "Empresas",
    fields: [
      { id: "e1", name: "Nome", type: "Texto" as FieldType, required: true, system: true },
      { id: "e2", name: "Telefone", type: "Telefone" as FieldType, required: false, system: true },
      { id: "e3", name: "Email", type: "Email" as FieldType, required: false, system: true },
      { id: "e4", name: "Cargo", type: "Texto" as FieldType, required: false, system: true },
      { id: "e5", name: "Etiqueta", type: "Seleção" as FieldType, required: false, system: true },
      { id: "e6", name: "Responsável", type: "Texto" as FieldType, required: false, system: true },
      { id: "e7", name: "Observações", type: "Texto" as FieldType, required: false, system: true },
      { id: "e8", name: "Negócios", type: "Número" as FieldType, required: false, system: true },
      { id: "e9", name: "Criado em", type: "Data" as FieldType, required: false, system: true },
    ],
  },
];

const FIELD_TYPES: FieldType[] = ["Texto", "Número", "Data", "Seleção", "Booleano", "Moeda", "Email", "Telefone", "URL"];

const TAB_ENTITY_LABEL: Record<string, string> = {
  negocios: "Negócio",
  pessoas: "Pessoa",
  empresas: "Empresa",
};

export default function CamposPage() {
  const [activeTab, setActiveTab] = useState("negocios");
  const [fieldsByTab, setFieldsByTab] = useState<Record<string, Field[]>>(
    Object.fromEntries(TABS.map(t => [t.id, t.fields]))
  );
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [fieldForm, setFieldForm] = useState({ name: "", type: "Texto" as FieldType, group: "Desagrupado", required: false });
  const [groupForm, setGroupForm] = useState({ name: "" });

  const currentFields = fieldsByTab[activeTab] || [];

  const handleAddField = () => {
    if (!fieldForm.name.trim()) return;
    const newField: Field = {
      id: Date.now().toString(),
      name: fieldForm.name,
      type: fieldForm.type,
      required: fieldForm.required,
      system: false,
    };
    setFieldsByTab(prev => ({ ...prev, [activeTab]: [...prev[activeTab], newField] }));
    setFieldForm({ name: "", type: "Texto", group: "Desagrupado", required: false });
    setShowFieldModal(false);
  };

  const handleRemoveField = (id: string) => {
    setFieldsByTab(prev => ({ ...prev, [activeTab]: prev[activeTab].filter(f => f.id !== id) }));
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Campos de dados</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGroupModal(true)}
            className="flex items-center gap-2 border border-zinc-200 bg-white text-zinc-700 px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-zinc-50 transition-colors shadow-sm"
          >
            Grupos
          </button>
          <button
            onClick={() => setShowFieldModal(true)}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Plus size={15} /> Campos personalizados
          </button>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-3xl bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-zinc-200 px-4 pt-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-3 text-[13px] font-bold border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-zinc-400 hover:text-zinc-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[32px_1fr_140px_110px] border-b border-zinc-100 bg-zinc-50/50">
            <div className="px-3 py-2.5" />
            <div className="px-4 py-2.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">NOME DO CAMPO</div>
            <div className="px-4 py-2.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">TIPO</div>
            <div className="px-4 py-2.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">OBRIGATÓRIO</div>
          </div>

          {/* Section label */}
          <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">CAMPOS PADRÃO</span>
          </div>

          {/* Fields list */}
          <div className="divide-y divide-zinc-100">
            {currentFields.map(field => (
              <div key={field.id} className="grid grid-cols-[32px_1fr_140px_110px] items-center group hover:bg-zinc-50/50 transition-colors">
                <div className="flex items-center justify-center py-3">
                  <GripVertical size={14} className="text-zinc-300 group-hover:text-zinc-400" />
                </div>
                <div className="px-4 py-3">
                  <span className="text-[13px] font-semibold text-zinc-800">{field.name}</span>
                </div>
                <div className="px-4 py-3">
                  <span className="text-[12px] font-medium text-zinc-400">{field.type}</span>
                </div>
                <div className="px-4 py-3 flex items-center justify-center gap-1">
                  {field.required ? (
                    <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Sim</span>
                  ) : (
                    <span className="text-[11px] font-medium text-zinc-300">—</span>
                  )}
                  {!field.system && (
                    <button
                      onClick={() => handleRemoveField(field.id)}
                      className="p-0.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded ml-1"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Modal Novo Grupo */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowGroupModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
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
              <button onClick={() => setShowGroupModal(false)} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200">Cancelar</button>
              <button onClick={() => { setGroupForm({ name: "" }); setShowGroupModal(false); }} className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Campo */}
      {showFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFieldModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
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
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all"
                >
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Grupo de campo</label>
                <select
                  value={fieldForm.group}
                  onChange={e => setFieldForm({ ...fieldForm, group: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2 outline-none focus:border-amber-500 transition-all"
                >
                  <option value="Desagrupado">Desagrupado</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldForm.required}
                  onChange={e => setFieldForm({ ...fieldForm, required: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-[13px] font-semibold text-zinc-700">Obrigatório</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setShowFieldModal(false)} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200">Cancelar</button>
              <button onClick={handleAddField} className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm">Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
