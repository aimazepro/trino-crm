"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCrm } from "@/contexts/crm-context";
import { Plus, Search, Download, Settings, X, ChevronDown, GripVertical, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Contact } from "@/lib/crm-types";

interface NewContactData {
  name: string;
  email: string;
  emailType: string;
  phone: string;
  phoneType: string;
  role: string;
  companyId: string;
}

const EMAIL_TYPES = ["Comercial", "Pessoal", "Outro"];
const PHONE_TYPES = ["Celular", "Comercial", "Residencial", "Outro"];
const CARGO_OPTIONS = ["Manter valor atual", "CEO", "Diretor Comercial", "Gerente", "Analista", "Vendedor", "Outro"];
const ACAO_OPTIONS = ["Manter valor atual", "Excluir contatos"];

function TypeSelector({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 bg-white hover:bg-gray-50 transition-colors whitespace-nowrap">
        {value} <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[110px]">
          {options.map(o => (
            <button key={o} type="button" onMouseDown={() => { onChange(o); setOpen(false); }}
              className={cn("w-full text-left px-3 py-2 text-xs font-medium hover:bg-amber-50 transition-colors", o === value && "text-amber-600 font-bold")}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BulkFieldSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-600">{label}</label>
      <div ref={ref} className="relative">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white hover:border-gray-300 transition-colors">
          <span className={value === options[0] ? "text-gray-400" : "text-gray-800"}>{value}</span>
          <ChevronDown size={14} className="text-gray-400 shrink-0" />
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-full">
            {options.map(o => (
              <button key={o} type="button" onMouseDown={() => { onChange(o); setOpen(false); }}
                className={cn("w-full text-left px-3 py-2.5 text-sm hover:bg-amber-50 transition-colors", o === value && "text-amber-600 font-semibold")}>
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompanySearchInput({ companies, selectedId, onSelect }: { companies: { id: string; name: string }[]; selectedId: string; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = companies.find(c => c.id === selectedId);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => { if (selected) setQuery(selected.name); }, [selected]);
  const filtered = query.trim() ? companies.filter(c => c.name.toLowerCase().includes(query.toLowerCase())) : companies.slice(0, 6);
  return (
    <div ref={ref} className="relative">
      <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus-within:border-amber-400 transition-colors">
        <Search size={13} className="text-gray-400 mr-2 shrink-0" />
        <input value={query} onChange={e => { setQuery(e.target.value); onSelect(""); setOpen(true); }}
          onFocus={() => setOpen(true)} placeholder="Buscar empresa por nome..."
          className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400" />
        {selectedId && (
          <button type="button" onClick={() => { onSelect(""); setQuery(""); }} className="text-gray-300 hover:text-red-400 transition-colors ml-1">
            <X size={12} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.map(c => (
            <button key={c.id} type="button" onMouseDown={() => { onSelect(c.id); setQuery(c.name); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-50 text-left text-sm font-medium text-gray-900 transition-colors">
              <div className="w-5 h-5 rounded bg-orange-100 text-orange-600 text-[10px] font-black flex items-center justify-center shrink-0">{c.name.charAt(0)}</div>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewContactModal({ onClose, onSave }: { onClose: () => void; onSave: (data: NewContactData) => void }) {
  const { state } = useCrm();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailType, setEmailType] = useState("Comercial");
  const [phone, setPhone] = useState("");
  const [phoneType, setPhoneType] = useState("Celular");
  const [role, setRole] = useState("");
  const [companyId, setCompanyId] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">Novo Contato</h2>
            <p className="text-xs text-gray-400 mt-0.5">Preencha os dados da pessoa.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors mt-0.5"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Nome <span className="text-red-400">*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">E-mail</label>
            <div className="flex gap-2">
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors" />
              <TypeSelector value={emailType} options={EMAIL_TYPES} onChange={setEmailType} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Telefone</label>
            <div className="flex gap-2">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors" />
              <TypeSelector value={phoneType} options={PHONE_TYPES} onChange={setPhoneType} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Cargo</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="Ex: CEO, Diretor Comercial..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Empresa</label>
            <CompanySearchInput companies={state.companies} selectedId={companyId} onSelect={setCompanyId} />
          </div>
          <button onClick={() => { if (!name.trim()) return; onSave({ name: name.trim(), email, emailType, phone, phoneType, role, companyId }); }}
            disabled={!name.trim()}
            className="w-full py-3 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors mt-2">
            Criar Contato
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContatosPage() {
  const router = useRouter();
  const { state, addContact, updateContact } = useCrm();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkCargo, setBulkCargo] = useState(CARGO_OPTIONS[0]);
  const [bulkAcao, setBulkAcao] = useState(ACAO_OPTIONS[0]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return state.contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.emails?.[0]?.value?.toLowerCase().includes(q) ||
      c.phones?.[0]?.value?.includes(q)
    );
  }, [state.contacts, search]);

  const getCompany = (c: Contact) => state.companies.find(co => co.id === c.companyId);
  const getDealsCount = (c: Contact) => state.deals.filter(d => d.contactId === c.id).length;

  const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkChanged = bulkCargo !== CARGO_OPTIONS[0] || bulkAcao !== ACAO_OPTIONS[0];

  const handleBulkSave = () => {
    selectedIds.forEach(id => {
      const patch: Partial<Contact> = {};
      if (bulkCargo !== CARGO_OPTIONS[0]) patch.role = bulkCargo;
      updateContact(id, patch);
    });
    setBulkEditOpen(false);
    setSelectedIds(new Set());
    setBulkCargo(CARGO_OPTIONS[0]);
    setBulkAcao(ACAO_OPTIONS[0]);
  };

  const handleCreate = (data: NewContactData) => {
    const id = `cont_${Date.now()}`;
    addContact({
      id,
      name: data.name,
      emails: data.email ? [{ value: data.email, type: data.emailType }] : [],
      phones: data.phone ? [{ value: data.phone, type: data.phoneType }] : [],
      role: data.role,
      companyId: data.companyId || undefined,
    });
    setShowModal(false);
    router.push(`/contatos/${id}`);
  };

  const exportCSV = () => {
    const rows = [["Nome", "Email", "Telefone", "Cargo", "Empresa", "Negócios"]];
    filtered.filter(c => selectedIds.has(c.id)).forEach(c => {
      const company = getCompany(c);
      rows.push([c.name, c.emails?.[0]?.value || "", c.phones?.[0]?.value || "", c.role || "", company?.name || "", String(getDealsCount(c))]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "contatos.csv";
    a.click();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">Pessoas</h1>
          <span className="bg-gray-100 text-gray-600 font-bold text-[11px] px-2 py-0.5 rounded-full">{state.contacts.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contato..."
              className="pl-8 pr-4 py-1.5 text-[13px] border border-gray-200 rounded-lg bg-white outline-none focus:border-amber-500 w-56 shadow-sm placeholder:text-gray-400 font-medium transition-colors" />
          </div>
          <button className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors border border-gray-200 hover:bg-gray-50 rounded-lg bg-white shadow-sm ml-1">
            <Settings size={15} />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 font-medium text-[12px] rounded-lg hover:bg-gray-50 transition-colors shadow-sm ml-1">
            <Download size={14} className="text-gray-400" />
            Exportar
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white font-bold text-[13px] rounded-lg shadow-sm shadow-amber-500/20 hover:bg-amber-600 transition-colors whitespace-nowrap ml-1">
            <Plus size={15} /> Novo Contato
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-gray-200 rounded-[24px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="rounded border-gray-300 accent-amber-500 cursor-pointer" />
                  </th>
                  {["Nome", "Email", "Telefone", "Cargo", "Empresa", "Negócios", "Proprietário"].map(col => (
                    <th key={col} className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <GripVertical size={12} className="text-zinc-300 shrink-0" />
                        {col}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-[13px] font-medium text-gray-400">
                      {search ? "Nenhum contato encontrado para a busca." : "Nenhum contato cadastrado ainda."}
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => {
                    const company = getCompany(c);
                    const dealsCount = getDealsCount(c);
                    const selected = selectedIds.has(c.id);
                    return (
                      <tr key={c.id}
                        className={cn("transition-colors group cursor-pointer", selected ? "bg-amber-50" : "hover:bg-gray-50/80")}
                        onClick={() => router.push(`/contatos/${c.id}`)}>
                        <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected} onChange={() => toggleOne(c.id)}
                            className="rounded border-gray-300 accent-amber-500 cursor-pointer" />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 font-bold flex items-center justify-center text-[10px] shrink-0 uppercase">
                              {c.name.charAt(0)}
                            </div>
                            <span className="font-semibold text-[13px] text-gray-900 group-hover:text-amber-600 transition-colors">
                              {c.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[13px] text-gray-600">{c.emails?.[0]?.value || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-[13px] text-gray-600">{c.phones?.[0]?.value || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-[13px] text-gray-600">{c.role || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-[13px] text-gray-700 font-medium">{company?.name || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-[13px] font-bold text-gray-700">{dealsCount || <span className="text-gray-400 font-normal">0</span>}</td>
                        <td className="py-3 px-4 text-[13px] text-gray-500">—</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating bottom bar */}
      {someSelected && !bulkEditOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white border border-zinc-200 rounded-2xl shadow-xl px-5 py-3">
          <span className="text-[13px] font-semibold text-zinc-700">
            {selectedIds.size} {selectedIds.size === 1 ? "contato selecionado" : "contatos selecionados"}
          </span>
          <div className="w-px h-4 bg-zinc-200" />
          <button onClick={() => setBulkEditOpen(true)}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold rounded-lg transition-colors">
            Editar {selectedIds.size} {selectedIds.size === 1 ? "contato" : "contatos"}
          </button>
          <button onClick={exportCSV}
            className="px-4 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[12px] font-semibold rounded-lg transition-colors">
            Exportar CSV
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bulk edit drawer */}
      {bulkEditOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setBulkEditOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-[420px] z-50 bg-white shadow-2xl border-l border-zinc-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <h2 className="text-[15px] font-bold text-gray-900">
                Editar {selectedIds.size} {selectedIds.size === 1 ? "contato" : "contatos"}
              </h2>
              <button onClick={() => setBulkEditOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-700 font-medium leading-relaxed">
                Os campos preenchidos serão aplicados a todos os {selectedIds.size} contatos selecionados. Campos com "Manter valor atual" não serão alterados.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <BulkFieldSelect label="Cargo" value={bulkCargo} options={CARGO_OPTIONS} onChange={setBulkCargo} />
              <BulkFieldSelect label="Proprietário" value="Manter valor atual" options={["Manter valor atual"]} onChange={() => {}} />
              <BulkFieldSelect label="Ações" value={bulkAcao} options={ACAO_OPTIONS} onChange={setBulkAcao} />
            </div>

            <div className="px-6 py-4 border-t border-zinc-100">
              <button onClick={handleBulkSave} disabled={!bulkChanged}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors">
                Salvar alterações
              </button>
            </div>
          </div>
        </>
      )}

      {showModal && <NewContactModal onClose={() => setShowModal(false)} onSave={handleCreate} />}
    </div>
  );
}
