"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCrm } from "@/contexts/crm-context";
import { Plus, Search, Download, Settings, Building2, X, ChevronDown, GripVertical, AlertTriangle } from "lucide-react";
import { Company } from "@/lib/crm-types";

const PORTE_OPTIONS = ["Selecionar", "MEI", "Micro", "Pequena", "Media", "Grande"];
const SEGMENTO_BULK_OPTIONS = ["Manter valor atual", "Tecnologia", "Saúde", "Educação", "Varejo", "Serviços", "Indústria", "Outro"];
const PORTE_BULK_OPTIONS = ["Manter valor atual", "MEI", "Micro", "Pequena", "Media", "Grande"];
const ACAO_OPTIONS = ["Manter valor atual", "Excluir empresas"];

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
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-amber-50 transition-colors ${o === value ? "text-amber-600 font-semibold" : ""}`}>
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewCompanyModal({ onClose, onSave, companies }: {
  onClose: () => void;
  onSave: (data: Partial<Company> & { name: string }) => void;
  companies: Company[];
}) {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [website, setWebsite] = useState("");
  const [segment, setSegment] = useState("");
  const [size, setSize] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const formatCnpj = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 14);
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d*)$/, "$1.$2.$3/$4-$5")
      .replace(/^(\d{2})(\d{3})(\d{3})(\d*)$/, "$1.$2.$3/$4")
      .replace(/^(\d{2})(\d{3})(\d*)$/, "$1.$2.$3")
      .replace(/^(\d{2})(\d*)$/, "$1.$2");
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder:text-gray-300 text-gray-800 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Nova Empresa</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition mt-0.5"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-400 mb-5">Preencha os dados da empresa.</p>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nome <span className="text-red-400">*</span></label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Razão Social ou Nome Fantasia" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">CNPJ</label>
            <input value={cnpj} onChange={e => setCnpj(formatCnpj(e.target.value))} placeholder="00.000.000/0001-00" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Site</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Segmento</label>
            <input value={segment} onChange={e => setSegment(e.target.value)} placeholder="Ex: Tecnologia" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Porte</label>
            <select value={size} onChange={e => setSize(e.target.value === "Selecionar" ? "" : e.target.value)}
              className={inputClass + " cursor-pointer bg-white"}>
              {PORTE_OPTIONS.map(o => <option key={o} value={o === "Selecionar" ? "" : o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cidade</label>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="São Paulo" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Estado</label>
            <input value={state} onChange={e => setState(e.target.value)} placeholder="SP" maxLength={2} className={inputClass} />
          </div>
        </div>
        <button
          onClick={() => name.trim() && onSave({ name: name.trim(), cnpj: cnpj || undefined, website: website || undefined, segment: segment || undefined, size: size || undefined, city: city || undefined, state: state || undefined })}
          disabled={!name.trim()}
          className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-xl text-sm transition disabled:opacity-40 shadow-sm">
          Criar Empresa
        </button>
      </div>
    </div>
  );
}

export default function EmpresasPage() {
  const router = useRouter();
  const { state, addCompany, updateCompany } = useCrm();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkSegmento, setBulkSegmento] = useState(SEGMENTO_BULK_OPTIONS[0]);
  const [bulkPorte, setBulkPorte] = useState(PORTE_BULK_OPTIONS[0]);
  const [bulkCidade, setBulkCidade] = useState("");
  const [bulkEstado, setBulkEstado] = useState("");
  const [bulkAcao, setBulkAcao] = useState(ACAO_OPTIONS[0]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return state.companies.filter(c => c.name.toLowerCase().includes(q));
  }, [state.companies, search]);

  const getContactsCount = (c: Company) => state.contacts.filter(ct => ct.companyId === c.id).length;
  const getDealsCount = (c: Company) => state.deals.filter(d => d.companyId === c.id).length;

  const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(c => c.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkChanged = bulkSegmento !== SEGMENTO_BULK_OPTIONS[0] || bulkPorte !== PORTE_BULK_OPTIONS[0] || bulkCidade.trim() !== "" || bulkEstado.trim() !== "" || bulkAcao !== ACAO_OPTIONS[0];

  const handleBulkSave = () => {
    selectedIds.forEach(id => {
      const patch: Partial<Company> = {};
      if (bulkSegmento !== SEGMENTO_BULK_OPTIONS[0]) patch.segment = bulkSegmento;
      if (bulkPorte !== PORTE_BULK_OPTIONS[0]) patch.size = bulkPorte;
      if (bulkCidade.trim()) patch.city = bulkCidade.trim();
      if (bulkEstado.trim()) patch.state = bulkEstado.trim();
      updateCompany(id, patch);
    });
    setBulkEditOpen(false);
    setSelectedIds(new Set());
    setBulkSegmento(SEGMENTO_BULK_OPTIONS[0]);
    setBulkPorte(PORTE_BULK_OPTIONS[0]);
    setBulkCidade("");
    setBulkEstado("");
    setBulkAcao(ACAO_OPTIONS[0]);
  };

  const handleCreate = (data: Partial<Company> & { name: string }) => {
    const id = `comp_${Date.now()}`;
    addCompany({ id, ...data });
    setShowModal(false);
    router.push(`/empresas/${id}`);
  };

  const exportCSV = () => {
    const rows = [["Empresa", "Website", "Segmento", "Porte", "Cidade", "Estado", "CNPJ", "Contatos", "Negócios"]];
    filtered.filter(c => selectedIds.has(c.id)).forEach(c => {
      rows.push([c.name, c.website || "", c.segment || "", c.size || "", c.city || "", c.state || "", c.cnpj || "", String(getContactsCount(c)), String(getDealsCount(c))]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "empresas.csv";
    a.click();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">Empresas</h1>
          <span className="bg-gray-100 text-gray-600 font-bold text-[11px] px-2 py-0.5 rounded-full">{state.companies.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa..."
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
            <Plus size={15} /> Nova Empresa
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-gray-200 rounded-[24px] overflow-hidden shadow-sm">
          {state.companies.length === 0 && !search ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                <Building2 size={28} className="text-gray-300" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Nenhuma empresa cadastrada</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-xs">Comece adicionando empresas para organizar seus negócios.</p>
              <button onClick={() => setShowModal(true)}
                className="px-6 py-2.5 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 shadow-sm transition-colors">
                + Cadastrar Empresa
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    <th className="py-3 px-4 w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="rounded border-gray-300 accent-amber-500 cursor-pointer" />
                    </th>
                    {["Empresa", "Website", "Segmento", "Porte", "Cidade", "Estado", "CNPJ", "Contatos", "Negócios", "Proprietário"].map(col => (
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
                      <td colSpan={12} className="py-16 text-center text-[13px] font-medium text-gray-400">
                        Nenhuma empresa encontrada para &quot;{search}&quot;
                      </td>
                    </tr>
                  ) : (
                    filtered.map(c => {
                      const contacts = getContactsCount(c);
                      const deals = getDealsCount(c);
                      const selected = selectedIds.has(c.id);
                      return (
                        <tr key={c.id}
                          className={`transition-colors group cursor-pointer ${selected ? "bg-amber-50" : "hover:bg-gray-50/80"}`}
                          onClick={() => router.push(`/empresas/${c.id}`)}>
                          <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selected} onChange={() => toggleOne(c.id)}
                              className="rounded border-gray-300 accent-amber-500 cursor-pointer" />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs shrink-0 uppercase">
                                {c.name.charAt(0)}
                              </div>
                              <span className="font-semibold text-[13px] text-gray-900 group-hover:text-amber-600 transition-colors">
                                {c.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[13px] text-blue-500">{c.website || <span className="text-gray-300">—</span>}</td>
                          <td className="py-3 px-4 text-[13px] text-gray-600">{c.segment || <span className="text-gray-300">—</span>}</td>
                          <td className="py-3 px-4 text-[13px] text-gray-600">{c.size || <span className="text-gray-300">—</span>}</td>
                          <td className="py-3 px-4 text-[13px] text-gray-600">{c.city || <span className="text-gray-300">—</span>}</td>
                          <td className="py-3 px-4 text-[13px] text-gray-600">{c.state || <span className="text-gray-300">—</span>}</td>
                          <td className="py-3 px-4 text-[13px] text-gray-500">{c.cnpj || <span className="text-gray-300">—</span>}</td>
                          <td className="py-3 px-4 text-[13px] font-bold text-gray-700">{contacts}</td>
                          <td className="py-3 px-4 text-[13px] font-bold text-gray-700">{deals}</td>
                          <td className="py-3 px-4 text-[13px] text-gray-500">—</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Floating bottom bar */}
      {someSelected && !bulkEditOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white border border-zinc-200 rounded-2xl shadow-xl px-5 py-3">
          <span className="text-[13px] font-semibold text-zinc-700">
            {selectedIds.size} {selectedIds.size === 1 ? "empresa selecionada" : "empresas selecionadas"}
          </span>
          <div className="w-px h-4 bg-zinc-200" />
          <button onClick={() => setBulkEditOpen(true)}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold rounded-lg transition-colors">
            Editar {selectedIds.size} {selectedIds.size === 1 ? "empresa" : "empresas"}
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
                Editar {selectedIds.size} {selectedIds.size === 1 ? "empresa" : "empresas"}
              </h2>
              <button onClick={() => setBulkEditOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-700 font-medium leading-relaxed">
                Os campos preenchidos serão aplicados a todas as {selectedIds.size} empresas selecionadas. Campos com "Manter valor atual" não serão alterados.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <BulkFieldSelect label="Segmento" value={bulkSegmento} options={SEGMENTO_BULK_OPTIONS} onChange={setBulkSegmento} />
              <BulkFieldSelect label="Porte" value={bulkPorte} options={PORTE_BULK_OPTIONS} onChange={setBulkPorte} />
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-600">Cidade</label>
                <input value={bulkCidade} onChange={e => setBulkCidade(e.target.value)} placeholder="Manter valor atual"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-400 placeholder:text-gray-400 text-gray-800 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-600">Estado</label>
                <input value={bulkEstado} onChange={e => setBulkEstado(e.target.value)} placeholder="Manter valor atual" maxLength={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-400 placeholder:text-gray-400 text-gray-800 transition-colors" />
              </div>
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

      {showModal && <NewCompanyModal onClose={() => setShowModal(false)} onSave={handleCreate} companies={state.companies} />}
    </div>
  );
}
