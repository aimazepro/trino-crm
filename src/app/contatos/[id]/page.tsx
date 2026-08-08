"use client";

import { use, useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCrm } from "@/contexts/crm-context";
import {
  ArrowLeft, Mail, Plus, Phone, Briefcase, Building2,
  History, ArrowRight, CheckCircle, X, AlertCircle, Users, Pen,
} from "lucide-react";
import { UseEmailTemplateModal } from "@/components/email/use-email-template-modal";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";

type Tab = "negocios" | "timeline";

// ─── Inline editable field row ────────────────────────────────────────────────
function FieldRow({
  label,
  value,
  placeholder,
  icon: Icon,
  addLabel,
  onSave,
  onAdd,
}: {
  label: string;
  value: string;
  placeholder?: string;
  icon?: React.ElementType;
  addLabel?: string;
  onSave: (v: string) => void;
  onAdd?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setVal(value); }, [value, editing]);

  const commit = () => { onSave(val); setEditing(false); };

  return (
    <>
      <div className="flex items-center justify-between py-3 border-b border-zinc-50 last:border-0">
        <div className="flex items-center gap-2 text-sm text-zinc-500 w-28 shrink-0">
          {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
          {label}
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            <input
              ref={ref}
              value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") { setVal(value); setEditing(false); }
              }}
              className="flex-1 text-sm border-b-2 border-amber-400 outline-none bg-transparent py-0.5 text-zinc-900 text-right"
            />
            <button onClick={commit} className="text-green-500 hover:bg-green-50 p-0.5 rounded transition-colors">
              <CheckCircle className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setVal(value); setEditing(false); }} className="text-red-400 hover:bg-red-50 p-0.5 rounded transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 justify-end group min-w-0">
            <span className="text-sm text-zinc-800 truncate">
              {value || <span className="text-zinc-300">-</span>}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-zinc-500 transition-opacity shrink-0"
            >
              <Pen className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {addLabel && (
        <div className="px-1 pb-2 -mt-1">
          <div className="mt-1">
            <button
              onClick={onAdd}
              className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium mt-0.5"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              {addLabel}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Company search combobox ──────────────────────────────────────────────────
function CompanySearch({
  companies,
  selectedId,
  onSelect,
}: {
  companies: { id: string; name: string }[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = companies.find(c => c.id === selectedId);
  const filtered = query.trim()
    ? companies.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : companies;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (selected && !open) {
    return (
      <div onClick={() => setOpen(true)} className="flex items-center gap-2 w-full">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 text-xs font-semibold shrink-0">
          {selected.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-zinc-800 truncate">
          {selected.name}
        </span>
        <Pen className="h-3.5 w-3.5 text-zinc-300 opacity-0 group-hover:opacity-100 ml-auto shrink-0" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 text-zinc-400">
        <Building2 className="h-4 w-4" aria-hidden="true" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar empresa..."
          className="flex-1 text-sm outline-none bg-transparent text-zinc-700 placeholder:text-zinc-400"
        />
        <Plus className="h-3.5 w-3.5 ml-auto" aria-hidden="true" />
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
          {selectedId && (
            <button
              onMouseDown={() => { onSelect(""); setQuery(""); setOpen(false); }}
              className="w-full px-3 py-2.5 hover:bg-red-50 text-left text-sm font-medium text-red-600 transition-colors border-b border-zinc-100"
            >
              Desvincular empresa
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
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ContatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { state, updateContact } = useCrm();

  const contact = state.contacts.find(c => c.id === id);
  const company = contact ? state.companies.find(c => c.id === contact.companyId) : null;
  const deals = state.deals.filter(d => d.contactId === id);
  const [activeTab, setActiveTab] = useState<Tab>("negocios");
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const [contactHistory, setContactHistory] = useState<{ id: string; description: string; subtext: string; created_at: string }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("contact_history").select("id, description, subtext, created_at")
      .eq("contact_id", id).order("created_at", { ascending: false })
      .then(({ data }) => setContactHistory(data ?? []));
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
    for (const h of contactHistory) {
      items.push({ id: h.id, type: "history", title: h.description, sub: h.subtext, dealName: "", dealId: "", date: h.created_at });
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [deals, contactHistory]);

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full">
        <h2 className="text-xl font-semibold mb-4 text-zinc-900">Contato não encontrado</h2>
        <Link href="/contatos" className="px-6 py-2 bg-amber-500 text-white rounded-xl shadow-sm">Ir para contatos</Link>
      </div>
    );
  }

  const totalValue = deals.reduce((s, d) => s + d.value, 0);

  const handleUpdateEmail = (value: string) => {
    const emails = [...(contact.emails || [])];
    if (emails[0]) emails[0] = { ...emails[0], value };
    else emails.push({ value, type: "principal" });
    updateContact(id, { emails });
  };

  const handleUpdatePhone = (value: string) => {
    const phones = [...(contact.phones || [])];
    if (phones[0]) phones[0] = { ...phones[0], value };
    else phones.push({ value, type: "principal" });
    updateContact(id, { phones });
  };

  const handleLinkCompany = (companyId: string) => {
    updateContact(id, { companyId: companyId || undefined });
  };

  return (
    <>
    <div className="flex h-full flex-col">

      {/* Header — identical structure to list page */}
      <div className="flex items-center gap-3 bg-white px-6 py-4">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-zinc-600 pointer-events-auto">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 font-medium shrink-0">
          {contact.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-base font-semibold text-zinc-800 cursor-pointer hover:text-amber-600 transition-colors">
            {contact.name}
          </h1>
          {contact.role && (
            <p className="text-xs text-zinc-400">{contact.role}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {contact.phones?.[0]?.value && (
            <>
              <a href={`tel:${contact.phones[0].value}`}
                className="flex items-center gap-1.5 rounded-xl bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 transition-colors">
                <Phone className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                Ligar
              </a>
              <a href={`https://wa.me/${contact.phones[0].value.replace(/\D/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600 transition-colors">
                WhatsApp
              </a>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: template button + tabs + content */}
        <div className="flex-1 overflow-auto p-6 space-y-5 bg-zinc-50/50">

          {/* Company Card if linked */}
          {company && (
            <Link
              href={`/empresas/${company.id}`}
              className="flex items-center gap-3 rounded-xl bg-white p-4 cursor-pointer hover:bg-amber-50/30 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-semibold shrink-0">
                {company.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-zinc-400">Empresa</p>
                <p className="text-sm font-medium text-zinc-800">{company.name}</p>
              </div>
              <Building2 className="h-4 w-4 text-zinc-300 ml-auto" aria-hidden="true" />
            </Link>
          )}

          {/* Template button */}
          <div className="flex justify-end">
            <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 transition-colors">
              <Mail className="h-3 w-3" aria-hidden="true" /> Usar template de email
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 pb-0">
            <button
              onClick={() => setActiveTab("negocios")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === "negocios" ? "border-amber-500 text-amber-600" : "border-transparent text-zinc-400 hover:text-zinc-600"
              )}
            >
              <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
              Negócios
              <span className="ml-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">{deals.length}</span>
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === "timeline" ? "border-amber-500 text-amber-600" : "border-transparent text-zinc-400 hover:text-zinc-600"
              )}
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              Timeline
            </button>
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
                ) : (
                  deals.map(deal => {
                    const pipeline = state.pipelines.find(p => p.id === deal.pipelineId);
                    const stage = pipeline?.stages.find(s => s.id === deal.stageId);
                    return (
                      <Link
                        key={deal.id}
                        href={`/negocios/${deal.id}`}
                        className="flex items-center gap-3 rounded-xl bg-white p-3.5 cursor-pointer hover:bg-amber-50/30 transition-colors"
                      >
                        <div className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          deal.status === "Ativo" ? "bg-amber-400" :
                          deal.status === "Ganho" ? "bg-green-500" : "bg-red-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-zinc-800 truncate">{deal.title}</p>
                            <span className={cn(
                              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
                              deal.status === "Ativo" ? "bg-amber-100 text-amber-700" :
                              deal.status === "Ganho" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            )}>
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
                  })
                )}
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-0">
                {timeline.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <History className="h-9 w-9 text-zinc-200 mb-3" />
                    <p className="text-sm text-zinc-400">Nenhuma atividade registrada ainda</p>
                  </div>
                ) : (
                  timeline.map(item => {
                    const isActivity = item.type.startsWith("activity");
                    const isDone = item.type === "activity_done";
                    const isOverdue = isActivity && !isDone && isPast(new Date(item.date)) && !isToday(new Date(item.date));
                    const Icon = isActivity ? (isDone ? CheckCircle : (isOverdue ? AlertCircle : History)) : ArrowRight;
                    return (
                      <div key={item.id} className="flex gap-4">
                        <div className="flex flex-col items-center w-10 shrink-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-zinc-200 shadow-sm">
                            <Icon className={cn(
                              "h-4 w-4",
                              isDone ? "text-green-500" : isOverdue ? "text-red-500" : isActivity ? "text-amber-500" : "text-zinc-500"
                            )} aria-hidden="true" />
                          </div>
                          <div className="w-px flex-1 bg-zinc-200 my-1" />
                        </div>
                        <div className="flex-1 min-w-0 pb-6 pt-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-zinc-500">
                              {item.type === "history" ? "Evento" : isDone ? "Atividade" : isOverdue ? "Atrasada" : "Atividade"}
                            </span>
                          </div>
                          <p className={cn("text-sm font-medium leading-snug", isOverdue ? "text-red-700" : "text-zinc-900")}>
                            {item.title}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-zinc-400">
                              {(() => { try { return format(new Date(item.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return item.date; } })()}
                            </span>
                            {item.dealId && (
                              <Link
                                href={`/negocios/${item.dealId}`}
                                className="text-xs text-zinc-500 underline decoration-zinc-300 hover:text-zinc-700 hover:decoration-zinc-500 inline-flex items-center gap-1 transition-colors"
                              >
                                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                                {item.dealName}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right: sidebar */}
        <div className="w-80 shrink-0 overflow-auto p-5 space-y-5 bg-white">

          {/* INFORMAÇÕES */}
          <div>
            <h3 className="text-xs font-medium text-zinc-400 tracking-wide mb-3">INFORMAÇÕES</h3>
            <div className="rounded-xl bg-zinc-50 px-4">
              <FieldRow
                label="Nome"
                icon={Users}
                value={contact.name}
                onSave={v => updateContact(id, { name: v })}
              />
              <FieldRow
                label="Email"
                icon={Mail}
                value={contact.emails?.[0]?.value || ""}
                addLabel="Adicionar e-mail"
                onSave={handleUpdateEmail}
                onAdd={() => {/* focus email field */}}
              />
              <FieldRow
                label="Telefone"
                icon={Phone}
                value={contact.phones?.[0]?.value || ""}
                addLabel="Adicionar telefone"
                onSave={handleUpdatePhone}
                onAdd={() => {/* focus phone field */}}
              />
              <FieldRow
                label="Cargo"
                value={contact.role || ""}
                onSave={v => updateContact(id, { role: v })}
              />
            </div>
          </div>

          {/* EMPRESA */}
          <div>
            <h3 className="text-xs font-medium text-zinc-400 tracking-wide mb-3">EMPRESA</h3>
            <div className="rounded-xl bg-zinc-50 px-4 py-3 cursor-pointer hover:bg-zinc-100 transition-colors group">
              <CompanySearch
                companies={state.companies}
                selectedId={contact.companyId}
                onSelect={handleLinkCompany}
              />
            </div>
          </div>

          {/* Custom fields placeholder */}
          <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-center">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Configure campos personalizados nas{" "}
              <button className="text-amber-500 hover:underline">configurações</button>
            </p>
          </div>

          {/* RESUMO */}
          <div>
            <h3 className="text-xs font-medium text-zinc-400 tracking-wide mb-2">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                RESUMO
              </span>
            </h3>
            <div className="rounded-xl bg-zinc-50 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Negócios</span>
                <span className="font-semibold text-zinc-800">{deals.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Valor total</span>
                <span className="font-semibold text-zinc-800">
                  {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    {showTemplateModal && <UseEmailTemplateModal onClose={() => setShowTemplateModal(false)} />}
    </>
  );
}
