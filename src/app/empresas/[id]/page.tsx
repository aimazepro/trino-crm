"use client";

import { use, useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCrm } from "@/contexts/crm-context";
import {
  ArrowLeft, Briefcase, Clock, ArrowRight, CheckCircle,
  Plus, Search, X, Globe, Users, ChevronRight, AlertCircle
} from "lucide-react";
import { Company } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

type Tab = "negocios" | "timeline";

// ── Inline editable field ─────────────────────────────────────────────────────
function EditableField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setVal(value); }, [value, editing]);
  const commit = () => { onSave(val); setEditing(false); };

  return (
    <div className="py-2.5 border-b border-gray-50 last:border-0 group">
      <span className="block text-xs font-medium text-gray-400 mb-0.5">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={ref}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(value); setEditing(false); } }}
            className="flex-1 text-sm border-b-2 border-amber-400 outline-none bg-transparent py-0.5 text-gray-900 font-medium"
          />
          <button onClick={commit} className="text-green-500 p-0.5 hover:bg-green-50 rounded"><CheckCircle size={13} /></button>
          <button onClick={() => { setVal(value); setEditing(false); }} className="text-red-400 p-0.5 hover:bg-red-50 rounded"><X size={13} /></button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full text-left text-sm font-medium text-gray-900 hover:text-amber-600 transition-colors truncate"
        >
          {value || <span className="text-gray-300 italic font-normal">{placeholder}</span>}
        </button>
      )}
    </div>
  );
}

// ── Timeline Item ─────────────────────────────────────────────────────────────
function TimelineItem({ icon: Icon, title, sub, time, color, isOverdue }: {
  icon: React.ElementType; title: string; sub: string; time: string; color: string; isOverdue?: boolean;
}) {
  return (
    <div className="flex gap-4 pb-5 relative">
      <div className="flex flex-col items-center">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors", color)}>
          <Icon size={14} />
        </div>
        <div className="w-px flex-1 bg-gray-100 mt-2" />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className={cn("text-sm font-bold", isOverdue ? "text-red-700" : "text-gray-900")}>
          {title}
          {isOverdue && <span className="ml-2 text-[9px] uppercase font-black text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full tracking-wider">Atrasada</span>}
        </p>
        <p className="text-xs text-gray-400 font-medium mt-0.5">{sub}</p>
        <p className={cn("text-[10px] mt-1 font-medium", isOverdue ? "text-red-400" : "text-gray-300")}>{time}</p>
      </div>
    </div>
  );
}

// ── Contact search for linking ────────────────────────────────────────────────
function ContactSearch({
  allContacts,
  onLink,
}: {
  allContacts: { id: string; name: string }[];
  onLink: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = query.trim()
    ? allContacts.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : [];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 border border-gray-100 rounded-xl px-3 py-2 bg-white shadow-sm">
        <Search size={12} className="text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar pessoa para vincular..."
          className="flex-1 text-xs outline-none bg-transparent text-gray-700 placeholder:text-gray-300"
        />
      </div>
      {open && query.trim() && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {filtered.slice(0, 5).map(c => (
            <button
              key={c.id}
              onMouseDown={() => { onLink(c.id); setQuery(""); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-50 text-left text-sm font-medium text-gray-900 transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-black flex items-center justify-center shrink-0">{c.name.charAt(0)}</div>
              {c.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-gray-400">Nenhum resultado</div>
          )}
        </div>
      )}
    </div>
  );
}

function ParentCompanySearch({
  companies,
  onLink,
}: {
  companies: Company[];
  onLink: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = query.trim()
    ? companies.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : companies;
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 border border-gray-100 rounded-xl px-3 py-1.5 bg-white shadow-sm">
        <Search size={12} className="text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Vincular empresa mãe..."
          className="flex-1 text-xs outline-none bg-transparent text-gray-700 placeholder:text-gray-300"
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {filtered.slice(0, 5).map(c => (
            <button
              key={c.id}
              onMouseDown={() => { onLink(c.id); setQuery(""); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50 text-left text-xs font-semibold text-gray-900 transition-colors"
            >
              <div className="w-5 h-5 rounded bg-orange-100 text-orange-600 text-[10px] font-black flex items-center justify-center shrink-0">{c.name.charAt(0)}</div>
              {c.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-gray-400">Nenhum resultado</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { state, updateCompany, updateContact } = useCrm();

  const company = state.companies.find(c => c.id === id);
  const employees = state.contacts.filter(c => c.companyId === id);
  const deals = state.deals.filter(d => d.companyId === id);

  const [activeTab, setActiveTab] = useState<Tab>("negocios");

  // Build timeline from all deals of this company
  const timeline = useMemo(() => {
    const items: { id: string; type: string; title: string; sub: string; dealName: string; date: string }[] = [];
    for (const deal of deals) {
      for (const log of deal.history) {
        items.push({ id: log.id, type: "history", title: log.description, sub: log.subtext || deal.title, dealName: deal.title, date: log.createdAt });
      }
      for (const a of deal.activities) {
        items.push({ id: a.id, type: a.completed ? "activity_done" : "activity", title: a.title, sub: `${a.type} — ${deal.title}`, dealName: deal.title, date: a.date });
      }
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [deals]);

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full">
        <h2 className="text-xl font-bold mb-4">Empresa não encontrada</h2>
        <Link href="/empresas" className="px-6 py-2 bg-amber-500 text-white rounded-xl shadow-sm">Ir para empresas</Link>
      </div>
    );
  }

  const totalValue = deals.reduce((s, d) => s + d.value, 0);
  const upd = (field: string, value: string) => updateCompany(id, { [field]: value });

  const handleLinkContact = (contactId: string) => {
    updateContact(contactId, { companyId: id });
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in bg-[#F4F4F5] p-8">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 font-black flex items-center justify-center text-sm">
            {company.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-lg font-bold text-gray-900">{company.name}</h1>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">

        {/* ── Left ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

          {/* Pessoas vinculadas */}
          <div className="p-4 border-b border-gray-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Users size={12} /> Pessoas ({employees.length})
              </span>
              <div className="text-amber-500 text-xs font-bold cursor-pointer hover:text-amber-600">+ Vincular</div>
            </div>
            {employees.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 font-medium mb-2">Nenhuma pessoa vinculada.</p>
                <ContactSearch
                  allContacts={state.contacts}
                  onLink={handleLinkContact}
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {employees.map(emp => (
                  <Link
                    key={emp.id}
                    href={`/contatos/${emp.id}`}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 hover:border-blue-200 hover:bg-blue-50 transition-colors group"
                  >
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center">{emp.name.charAt(0)}</div>
                    <span className="text-xs font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{emp.name}</span>
                  </Link>
                ))}
                <ContactSearch allContacts={state.contacts.filter(c => c.companyId !== id)} onLink={handleLinkContact} />
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-gray-100 px-4 shrink-0">
            {[
              { key: "negocios", label: "Negócios", count: deals.length },
              { key: "timeline", label: "Timeline" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as Tab)}
                className={cn(
                  "flex items-center gap-2 py-4 px-2 mr-4 text-sm font-bold border-b-2 transition-colors",
                  activeTab === tab.key ? "border-amber-500 text-amber-600" : "border-transparent text-gray-400 hover:text-gray-600"
                )}
              >
                {tab.key === "negocios" && <Briefcase size={14} />}
                {tab.key === "timeline" && <Clock size={14} />}
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn(
                    "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                    activeTab === tab.key ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-500"
                  )}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

            {activeTab === "negocios" && (
              <div className="space-y-3">
                {deals.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <Briefcase size={36} className="text-gray-200 mb-3" />
                    <p className="text-sm font-medium text-gray-400">Nenhum negócio vinculado</p>
                  </div>
                ) : (
                  deals.map(deal => {
                    const pipeline = state.pipelines.find(p => p.id === deal.pipelineId);
                    const stage = pipeline?.stages.find(s => s.id === deal.stageId);
                    return (
                      <Link
                        key={deal.id}
                        href={`/pipeline/${deal.id}`}
                        className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-amber-200 hover:shadow-sm transition-all group bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            deal.status === "Ativo" ? "bg-amber-400" :
                            deal.status === "Ganho" ? "bg-green-500" : "bg-red-400"
                          )} />
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold text-sm text-gray-900 group-hover:text-amber-600 transition-colors">{deal.title}</span>
                              <span className={cn(
                                "text-[9px] uppercase font-black px-1.5 py-0.5 rounded tracking-wider",
                                deal.status === "Ativo" ? "bg-amber-100 text-amber-700" :
                                deal.status === "Ganho" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              )}>{deal.status}</span>
                            </div>
                            <p className="text-xs text-gray-400 font-medium">{pipeline?.name} / {stage?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-900 text-sm">
                            {deal.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <ArrowRight size={14} className="text-gray-300 group-hover:text-amber-400 transition-colors" />
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-0">
                {timeline.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <Clock size={36} className="text-gray-200 mb-3" />
                    <p className="text-sm font-medium text-gray-400">Nenhuma atividade registrada ainda</p>
                  </div>
                ) : (
                  timeline.map(item => {
                    const isActivity = item.type.startsWith("activity");
                    const isDone = item.type === "activity_done";
                    const isOverdue = isActivity && !isDone && isPast(new Date(item.date)) && !isToday(new Date(item.date));
                    
                    return (
                      <TimelineItem
                        key={item.id}
                        icon={isActivity ? (isDone ? CheckCircle : (isOverdue ? AlertCircle : Clock)) : ArrowRight}
                        title={item.title}
                        sub={`${item.sub}  ·  ${item.dealName}`}
                        time={(() => {
                          try { return format(new Date(item.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
                          catch { return item.date; }
                        })()}
                        isOverdue={isOverdue}
                        color={
                          isDone ? "bg-green-50 border-green-100 text-green-600" :
                          isOverdue ? "bg-red-50 border-red-100 text-red-600" :
                          isActivity ? "bg-amber-50 border-amber-100 text-amber-600" :
                          "bg-gray-50 border-gray-100 text-gray-400"
                        }
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Info Sidebar ─────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col gap-0 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

          {/* Empresa Mãe */}
          <div className="p-5 border-b border-gray-50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Empresa Mãe</p>
            {(() => {
              const parentCompany = company.parentCompanyId
                ? state.companies.find(c => c.id === company.parentCompanyId)
                : null;

              if (parentCompany) {
                return (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <Link
                      href={`/empresas/${parentCompany.id}`}
                      className="flex items-center gap-2 text-xs font-bold text-gray-700 hover:text-amber-600 transition-colors truncate"
                    >
                      <div className="w-5 h-5 rounded bg-orange-100 text-orange-600 text-[10px] font-black flex items-center justify-center shrink-0">
                        {parentCompany.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{parentCompany.name}</span>
                    </Link>
                    <button
                      onClick={() => updateCompany(id, { parentCompanyId: undefined })}
                      className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              }

              return (
                <ParentCompanySearch
                  companies={state.companies.filter(c => c.id !== company.id)}
                  onLink={(parentCid) => updateCompany(id, { parentCompanyId: parentCid })}
                />
              );
            })()}
          </div>

          {/* INFORMAÇÕES */}
          <div className="p-5 flex-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Informações</p>
            <EditableField label="Nome" value={company.name} placeholder="—" onSave={v => upd("name", v)} />
            <EditableField label="Website" value={company.website || ""} placeholder="—" onSave={v => upd("website", v)} />
            <EditableField label="Segmento" value={company.segment || ""} placeholder="—" onSave={v => upd("segment", v)} />
            <EditableField label="Porte" value={company.size || ""} placeholder="—" onSave={v => upd("size", v)} />
            <EditableField label="Cidade" value={company.city || ""} placeholder="—" onSave={v => upd("city", v)} />
            <EditableField label="Estado" value={company.state || ""} placeholder="—" onSave={v => upd("state", v)} />
            <EditableField label="CNPJ" value={company.cnpj || ""} placeholder="—" onSave={v => upd("cnpj", v)} />
          </div>

          {/* Resumo */}
          <div className="p-5 border-t border-gray-50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Resumo</p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Negócios</span>
                <span className="text-sm font-black text-gray-900">{deals.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Valor total</span>
                <span className="text-sm font-black text-amber-600">
                  {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
