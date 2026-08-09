"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search, Check } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Deal, HistoryLog, Contact, Company } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

interface NewDealModalProps {
  onClose: () => void;
  activePipelineId: string;
  initialStageId?: string;
}

// Combobox for searching contacts or companies with create option
function SearchCombobox({
  items,
  selectedId,
  placeholder,
  onSelect,
  onCreate,
}: {
  items: { id: string; name: string }[];
  selectedId: string;
  placeholder: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedItem = items.find(i => i.id === selectedId);

  const filtered = query.trim()
    ? items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selectedItem) {
    return (
      <div className="flex items-center gap-2 w-full border border-amber-300 bg-amber-50/30 rounded-lg px-4 py-2.5 shadow-sm">
        <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
          {selectedItem.name.charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 text-sm font-medium text-gray-900 truncate">{selectedItem.name}</span>
        <button
          onClick={() => { onSelect(""); setQuery(""); }}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2.5 shadow-sm bg-white focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/10 transition-all">
        <Search size={14} className="text-gray-400 shrink-0 mr-2" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
        />
      </div>

      {isOpen && query.trim() && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.length > 0 ? (
            filtered.slice(0, 6).map(item => (
              <button
                key={item.id}
                onMouseDown={() => { onSelect(item.id); setQuery(""); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 text-left transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
              </button>
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-gray-400">Nenhum resultado</div>
          )}
          <button
            onMouseDown={() => { onCreate(query); setQuery(""); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-amber-600 font-bold text-sm hover:bg-amber-50 transition-colors border-t border-gray-100"
          >
            + Criar &quot;{query}&quot;
          </button>
        </div>
      )}
    </div>
  );
}

export function NewDealModal({ onClose, activePipelineId, initialStageId }: NewDealModalProps) {
  const { state, addDeal, addContact, addCompany, updateContact } = useCrm();

  const pipeline = state.pipelines.find(p => p.id === activePipelineId);

  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState(initialStageId || pipeline?.stages[0]?.id || "");
  const [value, setValue] = useState("");
  const [date, setDate] = useState("");

  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const contactItems = state.contacts.map(c => ({ id: c.id, name: c.name }));
  const companyItems = state.companies.map(c => ({ id: c.id, name: c.name }));

  const [saving, setSaving] = useState(false);

  const handleCreateContact = async (name: string) => {
    const realId = await addContact({ id: "", name, emails: [], phones: [], role: "", companyId: selectedCompanyId || undefined });
    if (realId) {
      setSelectedContactId(realId);
      if (selectedCompanyId) {
        updateContact(realId, { companyId: selectedCompanyId });
      }
    }
  };

  const handleCreateCompany = async (name: string) => {
    const realId = await addCompany({ id: "", name });
    if (realId) {
      setSelectedCompanyId(realId);
      if (selectedContactId) {
        updateContact(selectedContactId, { companyId: realId });
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);

    if (selectedContactId && selectedCompanyId) {
      updateContact(selectedContactId, { companyId: selectedCompanyId });
    }

    const newDeal: Deal = {
      id: "",
      title,
      value: Number(value.replace(/[^0-9.-]+/g, "")) || 0,
      contactId: selectedContactId || undefined as unknown as string,
      companyId: selectedCompanyId || undefined,
      pipelineId: activePipelineId,
      stageId,
      status: "Ativo",
      daysInStage: 0,
      stageEnteredAt: new Date().toISOString(),
      labels: [],
      notes: [],
      history: [],
      activities: [],
      appointments: [],
      products: [],
      expectedCloseDate: date || undefined,
    };

    const id = await addDeal(newDeal);
    setSaving(false);
    if (id) onClose();
  };

  const isSaveDisabled = !title.trim() || saving;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in pt-10 pb-10">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] flex flex-col max-h-full animate-in zoom-in-95">

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Novo Negócio</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 pt-4 overflow-y-auto hide-scrollbar space-y-5">

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Título do Negócio *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Proposta Agencia XYZ"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-amber-500 shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Etapa</label>
            <div className="flex flex-wrap gap-2">
              {pipeline?.stages.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => setStageId(stage.id)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-lg border transition-all",
                    stageId === stage.id
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  )}
                >
                  {stage.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Valor (R$)</label>
              <input
                type="number"
                value={value} onChange={e => setValue(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-amber-500 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Previsão de Fechamento</label>
              <input
                type="date"
                value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-600 outline-none focus:border-amber-500 shadow-sm min-h-[42px]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Contato (Pessoa)</label>
            <SearchCombobox
              items={contactItems}
              selectedId={selectedContactId}
              placeholder="Buscar contato por nome ou email..."
              onSelect={setSelectedContactId}
              onCreate={handleCreateContact}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Empresa</label>
            <SearchCombobox
              items={companyItems}
              selectedId={selectedCompanyId}
              placeholder="Buscar empresa por nome..."
              onSelect={setSelectedCompanyId}
              onCreate={handleCreateCompany}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 pt-4 shrink-0">
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors shadow-sm"
          >
            {saving ? "Salvando..." : "Criar Negócio"}
          </button>
        </div>

      </div>
    </div>
  );
}
