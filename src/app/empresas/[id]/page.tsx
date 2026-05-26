"use client";

import { use, useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCrm } from "@/contexts/crm-context";
import {
  ArrowLeft, Briefcase, History, ArrowRight, CheckCircle,
  Plus, Search, X, Users, AlertCircle, Link2, Pen,
  Globe, ExternalLink,
} from "lucide-react";
import { Company } from "@/lib/crm-types";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

type Tab = "negocios" | "timeline";

// ── Editable field (label top, value + pen below) ─────────────────────────────
function EditableField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setVal(value); }, [value, editing]);
  const commit = () => { onSave(val); setEditing(false); };

  return (
    <div className="py-2.5 border-b border-zinc-100 last:border-0">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      {editing ? (
        <div className="space-y-1.5">
          <input
            ref={ref}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(value); setEditing(false); } }}
            className="w-full rounded-md border border-amber-300 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200 text-zinc-900 bg-white"
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => { setVal(value); setEditing(false); }} className="px-2.5 py-1 rounded text-xs text-zinc-500 hover:bg-zinc-100 border border-zinc-200">Cancelar</button>
            <button onClick={commit} className="px-2.5 py-1 rounded text-xs text-white bg-green-600 hover:bg-green-700 font-medium">Salvar</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 group w-full">
          <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left rounded hover:bg-zinc-50 transition-colors">
            <span className="text-sm font-medium text-zinc-800 break-words">
              {value || <span className="text-zinc-300 font-normal">-</span>}
            </span>
          </button>
          <button onClick={() => setEditing(true)} className="shrink-0 rounded p-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 transition-all">
            <Pen className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Contact search ─────────────────────────────────────────────────────────────
function ContactSearch({ allContacts, onLink, onClose }: { allContacts: { id: string; name: string }[]; onLink: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const filtered = query.trim()
    ? allContacts.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="mt-2 rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100">
        <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar contato..."
          className="flex-1 text-sm outline-none bg-transparent text-zinc-700 placeholder:text-zinc-400"
        />
      </div>
      {filtered.map(c => (
        <button key={c.id} onClick={() => onLink(c.id)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-50 text-left text-sm font-medium text-zinc-900 transition-colors border-b border-zinc-50 last:border-0">
          <div className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-bold flex items-center justify-center shrink-0">{c.name.charAt(0)}</div>
          {c.name}
        </button>
      ))}
      {query.trim() && filtered.length === 0 && (
        <div className="px-3 py-2.5 text-xs text-zinc-400">Nenhum resultado</div>
      )}
      <button onClick={onClose} className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
        Cancelar
      </button>
    </div>
  );
}


function ParentCompanySelector({
  companies,
  currentId,
  parentCompanyId,
  onSelect,
}: {
  companies: Company[];
  currentId: string;
  parentCompanyId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const parentCompany = companies.find(c => c.id === parentCompanyId);
  const filtered = query.trim()
    ? companies.filter(c => c.id !== currentId && c.name.toLowerCase().includes(query.toLowerCase()))
    : companies.filter(c => c.id !== currentId);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (parentCompany && !open) {
    return (
      <div onClick={() => setOpen(true)} className="rounded-xl bg-zinc-50 px-4 py-3 cursor-pointer hover:bg-zinc-100 transition-colors group">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 text-xs font-semibold shrink-0">
            {parentCompany.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-zinc-800 truncate flex-1">
            {parentCompany.name}
          </span>
          <Pen className="h-3.5 w-3.5 text-zinc-300 opacity-0 group-hover:opacity-100 ml-auto shrink-0" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      {open ? (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100">
            <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); }}
              placeholder="Buscar empresa..."
              className="flex-1 text-sm outline-none bg-transparent text-zinc-700 placeholder:text-zinc-400"
            />
          </div>
          {parentCompanyId && (
            <button
              onMouseDown={() => { onSelect(null); setQuery(""); setOpen(false); }}
              className="w-full px-3 py-2.5 hover:bg-red-50 text-left text-sm font-medium text-red-600 transition-colors border-b border-zinc-100"
            >
              Remover vínculo
            </button>
          )}
          {filtered.slice(0, 5).map(c => (
            <button
              key={c.id}
              onMouseDown={() => { onSelect(c.id); setQuery(""); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-50 text-left text-sm font-medium text-zinc-900 transition-colors border-b border-zinc-50 last:border-0"
            >
              <div className="w-5 h-5 rounded bg-amber-50 text-amber-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                {c.name.charAt(0)}
              </div>
              {c.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-zinc-400">Nenhuma empresa encontrada</div>
          )}
          <button
            onMouseDown={() => { setQuery(""); setOpen(false); }}
            className="w-full px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-50 text-left border-t border-zinc-100 transition-colors"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 w-full rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-sm text-zinc-400 hover:border-amber-300 hover:text-amber-500 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Vincular empresa mae
        </button>
      )}
    </div>
  );
}


// ── Main page ──────────────────────────────────────────────────────────────────
export default function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { state, updateCompany, updateContact } = useCrm();

  const company = state.companies.find(c => c.id === id);
  const linkedContact = state.contacts.find(c => c.companyId === id) ?? null;
  const deals = state.deals.filter(d => d.companyId === id);
  const [activeTab, setActiveTab] = useState<Tab>("negocios");
  const [showVincularPessoa, setShowVincularPessoa] = useState(false);
  const [parentCompanyId, setParentCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`parent_company_${id}`);
    setParentCompanyId(stored);
  }, [id]);

  const timeline = useMemo(() => {
    const items: { id: string; type: string; title: string; sub: string; dealName: string; dealId: string; date: string }[] = [];
    for (const deal of deals) {
      for (const log of deal.history) {
        items.push({ id: log.id, type: "history", title: log.description, sub: log.subtext || deal.title, dealName: deal.title, dealId: deal.id, date: log.createdAt });
      }
      for (const a of deal.activities) {
        items.push({ id: a.id, type: a.completed ? "activity_done" : "activity", title: a.title, sub: `${a.type} — ${deal.title}`, dealName: deal.title, dealId: deal.id, date: a.date });
      }
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [deals]);

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full">
        <h2 className="text-xl font-semibold mb-4 text-zinc-900">Empresa não encontrada</h2>
        <Link href="/empresas" className="px-6 py-2 bg-amber-500 text-white rounded-xl shadow-sm">Ir para empresas</Link>
      </div>
    );
  }

  const upd = (field: string, value: string) => updateCompany(id, { [field]: value });

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 bg-white px-6 py-4">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-zinc-600 pointer-events-auto">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-semibold shrink-0">
          {company.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-base font-semibold text-zinc-800 cursor-pointer hover:text-amber-600 transition-colors">
            {company.name}
          </h1>
          {company.segment && (
            <p className="text-xs text-zinc-400">{company.segment}</p>
          )}
        </div>
        {company.website && (
          <a
            href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-amber-500 hover:underline"
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            Site
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left */}
        <div className="flex-1 overflow-auto p-6 space-y-6 bg-zinc-50/50">

          {/* PESSOAS */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-zinc-400 tracking-wide flex items-center gap-2">
                <Users className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                PESSOAS ({linkedContact ? 1 : 0})
              </h2>
              <button
                onClick={() => setShowVincularPessoa(v => !v)}
                className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-600 font-medium"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Vincular
              </button>
            </div>
            <div className="space-y-2">
              {linkedContact && !showVincularPessoa && (
                <Link
                  href={`/contatos/${linkedContact.id}`}
                  className="flex items-center gap-3 rounded-xl bg-white p-3.5 cursor-pointer hover:bg-amber-50/30 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 font-medium text-sm shrink-0">
                    {linkedContact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800">{linkedContact.name}</p>
                    {linkedContact.role && (
                      <p className="text-xs text-zinc-400">{linkedContact.role}</p>
                    )}
                  </div>
                  {linkedContact.emails?.[0]?.value && (
                    <p className="text-xs text-zinc-400 truncate max-w-[140px]">
                      {linkedContact.emails[0].value}
                    </p>
                  )}
                </Link>
              )}
              {showVincularPessoa && (
                <ContactSearch
                  allContacts={state.contacts.filter(c => c.id !== linkedContact?.id)}
                  onLink={cid => {
                    if (linkedContact) updateContact(linkedContact.id, { companyId: undefined });
                    updateContact(cid, { companyId: id });
                    setShowVincularPessoa(false);
                  }}
                  onClose={() => setShowVincularPessoa(false)}
                />
              )}
            </div>
          </section>

          {/* Tabs */}
          <div className="flex items-center gap-1 pb-0">
            {([
              { key: "negocios", label: "Negocios", count: deals.length },
              { key: "timeline", label: "Timeline" },
            ] as { key: Tab; label: string; count?: number }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                  activeTab === tab.key ? "border-amber-500 text-amber-600" : "border-transparent text-zinc-400 hover:text-zinc-600"
                )}
              >
                {tab.key === "negocios" && <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />}
                {tab.key === "timeline" && <History className="h-3.5 w-3.5" aria-hidden="true" />}
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <section>
            {activeTab === "negocios" && (
              <div className="space-y-2">
                {deals.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <Briefcase className="h-9 w-9 text-zinc-200 mb-3" />
                    <p className="text-sm text-zinc-400">Nenhum negócio vinculado</p>
                  </div>
                ) : deals.map(deal => {
                  const pipeline = state.pipelines.find(p => p.id === deal.pipelineId);
                  const stage = pipeline?.stages.find(s => s.id === deal.stageId);
                  return (
                    <Link key={deal.id} href={`/negocios/${deal.id}`}
                      className="flex items-center gap-3 rounded-xl bg-white p-3.5 cursor-pointer hover:bg-amber-50/30 transition-colors">
                      <div className={cn("h-2 w-2 rounded-full shrink-0",
                        deal.status === "Ativo" ? "bg-amber-400" : deal.status === "Ganho" ? "bg-green-500" : "bg-red-400")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-800 truncate">{deal.title}</p>
                          <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
                            deal.status === "Ativo" ? "bg-amber-100 text-amber-700" :
                            deal.status === "Ganho" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                            {deal.status === "Ativo" ? "Aberto" : deal.status}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">{pipeline?.name} / {stage?.name}</p>
                      </div>
                      <span className="text-sm font-semibold text-zinc-700 shrink-0">
                        {deal.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-0">
                {timeline.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <History className="h-9 w-9 text-zinc-200 mb-3" />
                    <p className="text-sm text-zinc-400">Nenhuma atividade registrada ainda</p>
                  </div>
                ) : timeline.map(item => {
                  const isActivity = item.type.startsWith("activity");
                  const isDone = item.type === "activity_done";
                  const isOverdue = isActivity && !isDone && isPast(new Date(item.date)) && !isToday(new Date(item.date));
                  const Icon = isActivity ? (isDone ? CheckCircle : (isOverdue ? AlertCircle : History)) : ArrowRight;
                  return (
                    <div key={item.id} className="flex gap-4">
                      <div className="flex flex-col items-center w-10 shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-zinc-200 shadow-sm">
                          <Icon className={cn("h-4 w-4", isDone ? "text-green-500" : isOverdue ? "text-red-500" : isActivity ? "text-amber-500" : "text-zinc-500")} aria-hidden="true" />
                        </div>
                        <div className="w-px flex-1 bg-zinc-200 my-1" />
                      </div>
                      <div className="flex-1 min-w-0 pb-6 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-zinc-500">{item.type === "history" ? "Evento" : isDone ? "Atividade" : isOverdue ? "Atrasada" : "Atividade"}</span>
                        </div>
                        <p className={cn("text-sm font-medium leading-snug", isOverdue ? "text-red-700" : "text-zinc-900")}>{item.title}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-zinc-400">
                            {(() => { try { return format(new Date(item.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return item.date; } })()}
                          </span>
                          <Link href={`/negocios/${item.dealId}`}
                            className="text-xs text-zinc-500 underline decoration-zinc-300 hover:text-zinc-700 inline-flex items-center gap-1 transition-colors">
                            <ArrowRight className="h-3 w-3" aria-hidden="true" /> {item.dealName}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right: sidebar */}
        <div className="w-80 shrink-0 overflow-auto p-5 space-y-5 bg-white">

          {/* EMPRESA MAE */}
          <div>
            <h3 className="text-xs font-medium text-zinc-400 tracking-wide mb-3 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              EMPRESA MAE
            </h3>
            <ParentCompanySelector
              companies={state.companies}
              currentId={id}
              parentCompanyId={parentCompanyId}
              onSelect={(parentId) => {
                if (parentId) {
                  localStorage.setItem(`parent_company_${id}`, parentId);
                  setParentCompanyId(parentId);
                } else {
                  localStorage.removeItem(`parent_company_${id}`);
                  setParentCompanyId(null);
                }
              }}
            />
          </div>

          {/* INFORMAÇÕES */}
          <div>
            <h3 className="text-xs font-medium text-zinc-400 tracking-wide mb-3">INFORMACOES</h3>
            <div className="rounded-xl bg-zinc-50 px-4">
              <EditableField label="Nome" value={company.name} onSave={v => upd("name", v)} />
              <EditableField label="Website" value={company.website || ""} onSave={v => upd("website", v)} />
              <EditableField label="Segmento" value={company.segment || ""} onSave={v => upd("segment", v)} />
              <EditableField label="Porte" value={company.size || ""} onSave={v => upd("size", v)} />
              <EditableField label="Cidade" value={company.city || ""} onSave={v => upd("city", v)} />
              <EditableField label="Estado" value={company.state || ""} onSave={v => upd("state", v)} />
              <EditableField label="CNPJ" value={company.cnpj || ""} onSave={v => upd("cnpj", v)} />
            </div>
          </div>

          {/* Custom fields placeholder */}
          <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-center">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Configure campos personalizados nas{" "}
              <button className="text-amber-500 hover:underline">configuracoes</button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
