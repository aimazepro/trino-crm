"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DollarSign, Calendar, Clock, Hash, Tag, Plus, Edit2, Check, X, Search, User, Building2, Link2, CircleX, ChevronDown, Pencil } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { InlineEdit } from "./inline-edit";
import { ContactAccordion } from "./contact-accordion";
import { CompanyAccordion } from "./company-accordion";
import { ProductsModal } from "./products-modal";
import { Contact, Company } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getDaysInStage, getStageTimeColor } from "@/lib/stage-time";

interface DealSidebarProps {
  dealId: string;
}

const LABEL_COLORS = [
  "#3B82F6", // Blue
  "#14B8A6", // Teal
  "#10B981", // Green
  "#F59E0B", // Orange
  "#EF4444", // Red
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#6366F1", // Indigo
  "#6B7280"  // Slate
];

export function DealSidebar({ dealId }: DealSidebarProps) {
  const { state, updateDealFields, addLabel } = useCrm();
  const deal = state.deals.find(d => d.id === dealId);
  const contact = state.contacts.find(c => c.id === deal?.contactId);
  const company = state.companies.find(c => c.id === deal?.companyId);
  const pipeline = state.pipelines.find(p => p.id === deal?.pipelineId);
  const currentStage = pipeline?.stages.find(s => s.id === deal?.stageId);

  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [tempValue, setTempValue] = useState("");

  const [isEditingProbability, setIsEditingProbability] = useState(false);
  const [tempProbability, setTempProbability] = useState("");

  // Labels states
  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const [labelSearchQuery, setLabelSearchQuery] = useState("");
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  const labelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
        setIsLabelPickerOpen(false);
        setIsCreatingLabel(false);
        setLabelSearchQuery("");
        setNewLabelName("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  if (!deal) return null;

  const handleUpdate = (field: string, val: any) => {
    updateDealFields(dealId, { [field]: val });
  };

  const handleProbabilityChange = (v: string) => {
    let num = parseInt(v.replace(/\D/g, ""), 10);
    if (isNaN(num)) num = 0;
    if (num > 100) num = 100;
    handleUpdate("probability", num);
  };

  const handleRemoveLabel = (labelId: string) => {
    const updated = (deal.labels || []).filter(id => id !== labelId);
    handleUpdate("labels", updated);
  };

  const handleAddExistingLabel = (labelId: string) => {
    const current = deal.labels || [];
    if (!current.includes(labelId)) {
      handleUpdate("labels", [...current, labelId]);
    }
    setLabelSearchQuery("");
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    const newId = await addLabel({
      id: `label_${Date.now()}`,
      name: newLabelName,
      color: newLabelColor
    });
    if (newId) {
      handleUpdate("labels", [...(deal.labels || []), newId]);
    }
    setNewLabelName("");
    setIsCreatingLabel(false);
    setIsLabelPickerOpen(false);
  };

  const probability = deal.probability || 0;

  // Filter labels for search
  const availableLabels = state.labels.filter(l => !(deal.labels || []).includes(l.id));
  const filteredLabels = availableLabels.filter(l => 
    l.name.toLowerCase().includes(labelSearchQuery.toLowerCase())
  );

  return (
    <div className="w-[360px] shrink-0 overflow-y-auto p-5 space-y-5 bg-white border-r border-zinc-100 hide-scrollbar">
      
      {/* Resumo */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 tracking-wider mb-3">RESUMO</h3>
        
        <div className="space-y-3">
          {/* Value — Editable Inline */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm text-zinc-500 shrink-0">
                <DollarSign size={16} className="text-zinc-300 shrink-0" />
                {isEditingValue ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={tempValue}
                      onChange={e => setTempValue(e.target.value)}
                      autoFocus
                      className="w-24 px-2 py-0.5 text-sm border-2 border-amber-300 rounded outline-none font-bold text-zinc-800 bg-white"
                      onKeyDown={e => {
                        if (e.key === "Enter") { 
                          handleUpdate("value", parseFloat(tempValue) || 0); 
                          setIsEditingValue(false); 
                        }
                        if (e.key === "Escape") setIsEditingValue(false);
                      }}
                    />
                    <button 
                      onClick={() => { 
                        handleUpdate("value", parseFloat(tempValue) || 0); 
                        setIsEditingValue(false); 
                      }} 
                      className="text-green-500 hover:bg-zinc-50 p-0.5 rounded transition-colors"
                    >
                      <Check size={14}/>
                    </button>
                    <button onClick={() => setIsEditingValue(false)} className="text-red-400 hover:bg-zinc-50 p-0.5 rounded transition-colors"><X size={14}/></button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setTempValue(String(deal.value)); setIsEditingValue(true); }}
                    className="text-sm font-semibold text-zinc-800 hover:text-amber-600 text-right transition-colors rounded-md px-1.5 py-0.5 -mr-1.5 hover:bg-zinc-50 group flex items-center gap-1"
                  >
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                    <Edit2 size={12} className="text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}
              </span>
              {!isEditingValue && (
                <button 
                  onClick={() => setIsProductsOpen(true)}
                  className="flex items-center gap-1 text-xs font-medium text-amber-500 hover:text-amber-600 transition-colors shrink-0"
                >
                  <Plus size={14} className="h-3.5 w-3.5"/> Produtos
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm text-zinc-500 shrink-0">
              <Calendar size={16} className="text-zinc-300" />
              Previsao
            </span>
            <div className="flex justify-end min-w-0">
               <InlineEdit 
                 type="date"
                 value={deal.expectedCloseDate ? deal.expectedCloseDate.substring(0,10) : ""} 
                 onSave={(v) => handleUpdate("expectedCloseDate", v)} 
               />
            </div>
          </div>

          {deal.status === "Perdido" && (() => {
            const raw = deal.lossReason ?? "";
            const colonIdx = raw.indexOf(": ");
            const category = colonIdx > -1 ? raw.slice(0, colonIdx) : raw;
            const observation = colonIdx > -1 ? raw.slice(colonIdx + 2) : "";
            const lostDate = deal.updatedAt
              ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(deal.updatedAt))
              : null;
            return (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm text-zinc-500 shrink-0">
                    <CircleX size={16} className="text-red-500 shrink-0" />
                    Perdido em
                  </span>
                  {lostDate && <span className="text-sm font-medium text-zinc-800">{lostDate}</span>}
                </div>
                {raw && (
                  <div className="flex flex-col gap-1 rounded-lg border border-red-100 bg-red-50/50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-red-500">Motivo</span>
                      {category && <span className="text-sm font-medium text-zinc-800">{category}</span>}
                    </div>
                    {observation && (
                      <p className="text-sm text-zinc-700 whitespace-pre-wrap break-words">{observation}</p>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-zinc-500">
              <Clock size={16} className="text-zinc-300" />
              Na etapa
            </span>
            {(() => {
              const days = getDaysInStage(deal.stageEnteredAt);
              const color = getStageTimeColor(days, currentStage?.maxDays ?? 0);
              return (
                <span className={cn(
                  "text-sm font-medium",
                  color === "red" ? "text-red-600" : color === "yellow" ? "text-amber-600" : "text-zinc-800"
                )}>
                  {days} dias
                </span>
              );
            })()}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm text-zinc-500 shrink-0">
                <Hash size={16} className="text-zinc-300" />
                Probabilidade
              </span>
              {isEditingProbability ? (
                <div className="flex items-center gap-1">
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={tempProbability}
                    onChange={e => setTempProbability(e.target.value)}
                    className="w-14 px-1 py-0.5 text-center text-sm border-2 border-amber-300 rounded outline-none font-bold text-zinc-800 bg-white"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        let num = parseInt(tempProbability, 10);
                        if (isNaN(num)) num = 0;
                        if (num > 100) num = 100;
                        if (num < 0) num = 0;
                        handleUpdate("probability", num);
                        setIsEditingProbability(false);
                      }
                      if (e.key === "Escape") setIsEditingProbability(false);
                    }}
                  />
                  <button 
                    onClick={() => {
                      let num = parseInt(tempProbability, 10);
                      if (isNaN(num)) num = 0;
                      if (num > 100) num = 100;
                      if (num < 0) num = 0;
                      handleUpdate("probability", num);
                      setIsEditingProbability(false);
                    }}
                    className="text-green-500 hover:bg-zinc-50 p-0.5 rounded"
                  >
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => { setTempProbability(String(probability)); setIsEditingProbability(true); }}
                  className="text-sm font-semibold text-zinc-800 hover:text-amber-600 transition-colors"
                >
                  {probability}%
                </button>
              )}
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-100">
              <div className="h-1.5 rounded-full bg-amber-400 transition-all" style={{ width: `${probability}%` }}></div>
            </div>
          </div>

          {/* Etiquetas / Labels Section */}
          <div className="relative" ref={labelPickerRef}>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                <Tag size={16} className="text-zinc-300" />
                Etiquetas
              </span>
              <button 
                onClick={() => setIsLabelPickerOpen(!isLabelPickerOpen)} 
                className="text-xs text-amber-500 hover:text-amber-600 font-medium transition-colors"
              >
                Editar
              </button>
            </div>

            {/* Render Current Deal Labels */}
            <div className="flex flex-wrap gap-1.5">
              {(deal.labels || []).map(lid => {
                const lbl = state.labels.find(l => l.id === lid);
                if (!lbl) return null;
                return (
                  <span 
                    key={lid} 
                    className="text-xs px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1"
                    style={{ backgroundColor: `${lbl.color}15`, borderColor: `${lbl.color}30`, color: lbl.color }}
                  >
                    {lbl.name}
                    <button 
                      onClick={() => handleRemoveLabel(lid)} 
                      className="hover:bg-black/5 rounded-full p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
              
              <button 
                onClick={() => setIsLabelPickerOpen(!isLabelPickerOpen)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-400 hover:border-amber-400 hover:text-amber-500 transition-colors"
              >
                <Plus size={12} /> Adicionar etiqueta
              </button>
            </div>

            {/* Custom Labels Popover Picker */}
            {isLabelPickerOpen && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-xl p-3 space-y-3">
                {!isCreatingLabel ? (
                  <>
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        value={labelSearchQuery}
                        onChange={e => setLabelSearchQuery(e.target.value)}
                        placeholder="Buscar etiqueta..."
                        className="w-full text-xs pl-8 pr-3 py-1.5 border rounded-lg outline-none focus:border-amber-500"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1 py-1">
                      {filteredLabels.map(l => (
                        <button
                          key={l.id}
                          onClick={() => handleAddExistingLabel(l.id)}
                          className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-zinc-50 rounded-lg flex items-center justify-between"
                        >
                          <span style={{ color: l.color }} className="font-semibold">{l.name}</span>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                        </button>
                      ))}
                      {filteredLabels.length === 0 && labelSearchQuery.trim() !== "" && (
                        <p className="text-[10px] text-zinc-400 text-center py-2">Nenhuma etiqueta encontrada</p>
                      )}
                    </div>

                    <button
                      onClick={() => setIsCreatingLabel(true)}
                      className="w-full py-1.5 text-center text-xs font-bold text-amber-500 hover:bg-amber-50 rounded-lg transition-colors border border-dashed border-amber-200"
                    >
                      + Adicionar etiqueta
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Nova etiqueta</p>
                    <input
                      value={newLabelName}
                      onChange={e => setNewLabelName(e.target.value)}
                      placeholder="Nome da etiqueta..."
                      className="w-full text-xs px-2.5 py-1.5 border rounded-lg outline-none focus:border-amber-500"
                      autoFocus
                    />
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-zinc-500">Cor da etiqueta</p>
                      <div className="flex flex-wrap gap-1.5">
                        {LABEL_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setNewLabelColor(color)}
                            className="w-6 h-6 rounded-full border border-zinc-100 flex items-center justify-center relative shrink-0 transition-transform hover:scale-110"
                            style={{ backgroundColor: color }}
                          >
                            {newLabelColor === color && (
                              <Check size={12} className="text-white" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button 
                        onClick={() => { setIsCreatingLabel(false); setNewLabelName(""); }} 
                        className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleCreateLabel} 
                        className="text-xs bg-amber-500 text-white px-3 py-1 rounded font-bold hover:bg-amber-600"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-px bg-zinc-100 my-3"></div>

      <DealCustomFields dealId={dealId} />

      {/* Accordions */}
      {contact ? (
        <ContactAccordion contact={contact} dealId={dealId} />
      ) : (
        <ContactLinkSearch dealId={dealId} contacts={state.contacts} onLink={(cid) => handleUpdate("contactId", cid)} />
      )}
      
      {company ? (
        <CompanyAccordion company={company} dealId={dealId} />
      ) : (
        <CompanyLinkSearch dealId={dealId} companies={state.companies} onLink={(cid) => handleUpdate("companyId", cid)} />
      )}

      {isProductsOpen && <ProductsModal deal={deal} onClose={() => setIsProductsOpen(false)} />}
    </div>
  );
}

// ── Deal Custom Fields ───────────────────────────────────────────────────────

type CustomFieldDef = {
  id: string;
  label: string;
  field_type: string;
  field_group: string;
  required: boolean;
};

function DealCustomFields({ dealId }: { dealId: string }) {
  const supabase = createClient();
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempVal, setTempVal] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: fRows }, { data: vRows }] = await Promise.all([
      supabase.from("custom_fields").select("id,label,field_type,field_group,required").eq("user_id", user.id).eq("entity", "deal").order("sort_order"),
      supabase.from("deal_field_values").select("field_id,value").eq("deal_id", dealId),
    ]);

    setFields(fRows ?? []);
    const map: Record<string, string> = {};
    for (const v of vRows ?? []) map[v.field_id] = v.value ?? "";
    setValues(map);
    const groups = [...new Set((fRows ?? []).map(f => f.field_group || "Desagrupado"))];
    setExpandedGroups(prev => {
      const next = { ...prev };
      for (const g of groups) if (!(g in next)) next[g] = true;
      return next;
    });
  }, [supabase, dealId]);

  useEffect(() => { load(); }, [load]);

  const saveValue = async (fieldId: string, val: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field?.required && !val.trim()) {
      alert(`"${field.label}" é obrigatório.`);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("deal_field_values").upsert(
      { deal_id: dealId, field_id: fieldId, value: val, updated_at: new Date().toISOString() },
      { onConflict: "deal_id,field_id" }
    );
    setValues(prev => ({ ...prev, [fieldId]: val }));
  };

  if (fields.length === 0) return null;

  const groups = [...new Set(fields.map(f => f.field_group || "Desagrupado"))];

  return (
    <div className="rounded-xl overflow-hidden bg-zinc-50">
      <div className="flex items-center gap-2 px-4 py-3">
        <ChevronDown size={16} className="text-zinc-500" />
        <span className="text-sm font-semibold text-zinc-800">Detalhes</span>
      </div>

      <div className="px-4 py-1">
        {groups.map(group => {
          const groupFields = fields.filter(f => (f.field_group || "Desagrupado") === group);
          const filled = groupFields.filter(f => values[f.id]).length;
          const expanded = expandedGroups[group] !== false;

          return (
            <div key={group} className="mt-1">
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, [group]: !expanded }))}
                className="flex items-center gap-2 w-full py-2 mt-1 border-t border-zinc-100"
              >
                <ChevronDown
                  size={14}
                  className={cn("text-zinc-400 transition-transform", !expanded && "-rotate-90")}
                />
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{group}</span>
                <span className="text-xs text-zinc-400 ml-auto bg-zinc-100 rounded-full px-1.5 py-0.5">
                  {filled}/{groupFields.length}
                </span>
              </button>

              {expanded && groupFields.map(field => (
                <div key={field.id} className="grid grid-cols-[72px_1fr] gap-x-2 py-2 border-b border-zinc-100 last:border-0 items-start">
                  <p className="text-xs text-zinc-500 pt-1.5 break-words leading-tight">{field.label}</p>
                  <div className="min-w-0">
                    {editingId === field.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={tempVal}
                          onChange={e => setTempVal(e.target.value)}
                          className="flex-1 text-sm px-2 py-1 border-2 border-amber-300 rounded outline-none bg-white"
                          onKeyDown={e => {
                            if (e.key === "Enter") { saveValue(field.id, tempVal); setEditingId(null); }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button onClick={() => { saveValue(field.id, tempVal); setEditingId(null); }} className="text-green-500 p-0.5 rounded hover:bg-zinc-100"><Check size={13} /></button>
                        <button onClick={() => setEditingId(null)} className="text-red-400 p-0.5 rounded hover:bg-zinc-100"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group -mx-2">
                        <button
                          onClick={() => { setTempVal(values[field.id] ?? ""); setEditingId(field.id); }}
                          className="flex-1 min-w-0 text-left rounded-md px-2 py-1 hover:bg-zinc-100 transition-colors"
                        >
                          <span className={cn(
                            "text-sm",
                            values[field.id] ? "text-zinc-800"
                              : field.required ? "text-red-400 group-hover:text-red-500"
                              : "text-zinc-300 group-hover:text-zinc-500"
                          )}>
                            {values[field.id] || (field.required ? "Obrigatório" : "-")}
                          </span>
                        </button>
                        <button
                          onClick={() => { setTempVal(values[field.id] ?? ""); setEditingId(field.id); }}
                          className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Link Search Components ───────────────────────────────────────────────────

function ContactLinkSearch({ contacts, onLink }: { dealId: string; contacts: Contact[]; onLink: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const filtered = query.trim() ? contacts.filter(c => c.name.toLowerCase().includes(query.toLowerCase())) : [];
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setIsSearching(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!isSearching) {
    return (
      <button
        onClick={() => {
          setIsSearching(true);
          setOpen(true);
        }}
        className="w-full flex items-center justify-between bg-zinc-50 border border-zinc-100 hover:bg-zinc-100/50 hover:border-zinc-200/50 transition-all rounded-2xl px-5 py-4 cursor-pointer text-zinc-500 font-semibold text-[13px] active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <User size={18} className="text-zinc-400 shrink-0" />
          <span>Vincular contato</span>
        </div>
        <Link2 size={16} className="text-zinc-400 shrink-0" />
      </button>
    );
  }

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex items-center justify-between bg-white border border-amber-400 rounded-2xl px-5 py-4 transition-all">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <User size={18} className="text-zinc-400 shrink-0" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar contato..."
            className="flex-1 text-[13.5px] font-semibold outline-none bg-transparent text-zinc-900 placeholder:text-zinc-300 min-w-0"
            autoFocus
          />
        </div>
        <button 
          onClick={() => { setIsSearching(false); setQuery(""); }}
          className="text-zinc-400 hover:text-zinc-600 shrink-0 ml-2"
        >
          <X size={16} />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-white border border-zinc-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
          {query.trim() !== "" ? (
            filtered.length > 0 ? (
              filtered.slice(0, 5).map(c => (
                <button
                  key={c.id}
                  onMouseDown={() => { onLink(c.id); setQuery(""); setOpen(false); setIsSearching(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-amber-50/50 text-left text-xs font-semibold text-zinc-900 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black flex items-center justify-center shrink-0">{c.name.charAt(0)}</div>
                  {c.name}
                </button>
              ))
            ) : (
              <div className="px-4 py-2.5 text-[10px] text-zinc-400">Nenhum resultado</div>
            )
          ) : (
            contacts.slice(0, 5).map(c => (
              <button
                key={c.id}
                onMouseDown={() => { onLink(c.id); setQuery(""); setOpen(false); setIsSearching(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-amber-50/50 text-left text-xs font-semibold text-zinc-900 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black flex items-center justify-center shrink-0">{c.name.charAt(0)}</div>
                {c.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CompanyLinkSearch({ companies, onLink }: { dealId: string; companies: Company[]; onLink: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const filtered = query.trim() ? companies.filter(c => c.name.toLowerCase().includes(query.toLowerCase())) : [];
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setIsSearching(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!isSearching) {
    return (
      <button
        onClick={() => {
          setIsSearching(true);
          setOpen(true);
        }}
        className="w-full flex items-center justify-between bg-zinc-50 border border-zinc-100 hover:bg-zinc-100/50 hover:border-zinc-200/50 transition-all rounded-2xl px-5 py-4 cursor-pointer text-zinc-500 font-semibold text-[13px] active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <Building2 size={18} className="text-zinc-400 shrink-0" />
          <span>Vincular empresa</span>
        </div>
        <Link2 size={16} className="text-zinc-400 shrink-0" />
      </button>
    );
  }

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex items-center justify-between bg-white border border-amber-400 rounded-2xl px-5 py-4 transition-all">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Building2 size={18} className="text-zinc-400 shrink-0" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar empresa..."
            className="flex-1 text-[13.5px] font-semibold outline-none bg-transparent text-zinc-900 placeholder:text-zinc-300 min-w-0"
            autoFocus
          />
        </div>
        <button 
          onClick={() => { setIsSearching(false); setQuery(""); }}
          className="text-zinc-400 hover:text-zinc-600 shrink-0 ml-2"
        >
          <X size={16} />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-white border border-zinc-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
          {query.trim() !== "" ? (
            filtered.length > 0 ? (
              filtered.slice(0, 5).map(c => (
                <button
                  key={c.id}
                  onMouseDown={() => { onLink(c.id); setQuery(""); setOpen(false); setIsSearching(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-amber-50/50 text-left text-xs font-semibold text-zinc-900 transition-colors"
                >
                  <div className="w-5 h-5 rounded bg-orange-50 text-orange-600 text-[10px] font-black flex items-center justify-center shrink-0">{c.name.charAt(0)}</div>
                  {c.name}
                </button>
              ))
            ) : (
              <div className="px-4 py-2.5 text-[10px] text-zinc-400">Nenhum resultado</div>
            )
          ) : (
            companies.slice(0, 5).map(c => (
              <button
                key={c.id}
                onMouseDown={() => { onLink(c.id); setQuery(""); setOpen(false); setIsSearching(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-amber-50/50 text-left text-xs font-semibold text-zinc-900 transition-colors"
              >
                <div className="w-5 h-5 rounded bg-orange-50 text-orange-600 text-[10px] font-black flex items-center justify-center shrink-0">{c.name.charAt(0)}</div>
                {c.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
