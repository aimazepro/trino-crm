"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCrm } from "@/contexts/crm-context";
import { useTeam } from "@/hooks/use-team";
import { OwnerBadge } from "@/components/team/owner-badge";
import { OwnerSelect } from "@/components/team/owner-select";
import { BulkFieldSelect } from "@/components/ui/BulkFieldSelect";
import { CustomizeColumnsModal, ALL_COLUMNS, DEFAULT_COLUMNS } from "@/components/contact/customize-columns-modal";
import {
  Plus, Search, Download, Settings, X, ChevronDown,
  GripVertical, AlertTriangle, Users, Mail, Phone,
} from "lucide-react";
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
        className="flex items-center gap-1 px-3 py-2 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-600 bg-white hover:bg-zinc-50 transition-colors whitespace-nowrap">
        {value} <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden min-w-[110px]">
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


function CompanySearchInput({ companies, selectedId, onSelect }: { companies: { id: string; name: string }[]; selectedId: string; onSelect: (id: string) => void }) {
  const { addCompany } = useCrm();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = companies.find(c => c.id === selectedId);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => { if (selected) setQuery(selected.name); }, [selected]);
  const filtered = query.trim() ? companies.filter(c => c.name.toLowerCase().includes(query.toLowerCase())) : companies.slice(0, 6);

  const handleCreate = async (e: React.MouseEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      const newId = await addCompany({ id: "", name: trimmed });
      if (newId) {
        onSelect(newId);
        setQuery(trimmed);
        setOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center border border-zinc-200 rounded-lg px-3 py-2.5 bg-white focus-within:border-amber-400 transition-colors">
        <Search size={13} className="text-zinc-400 mr-2 shrink-0" />
        <input value={query} onChange={e => { setQuery(e.target.value); onSelect(""); setOpen(true); }}
          onFocus={() => setOpen(true)} placeholder="Buscar ou criar empresa..."
          className="flex-1 text-sm outline-none bg-transparent text-zinc-800 placeholder:text-zinc-400" />
        {selectedId && (
          <button type="button" onClick={() => { onSelect(""); setQuery(""); }} className="text-zinc-300 hover:text-red-400 transition-colors ml-1">
            <X size={12} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden p-1 space-y-1">
          {filtered.map(c => (
            <button key={c.id} type="button" onMouseDown={() => { onSelect(c.id); setQuery(c.name); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50 text-left text-sm font-medium text-zinc-900 transition-colors rounded-lg">
              <div className="w-5 h-5 rounded bg-amber-50 text-amber-600 text-[10px] font-black flex items-center justify-center shrink-0">{c.name.charAt(0).toUpperCase()}</div>
              <span className="truncate">{c.name}</span>
            </button>
          ))}
          {query.trim() !== "" && (
            <button
              type="button"
              disabled={isCreating}
              onMouseDown={handleCreate}
              className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors font-medium cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{isCreating ? "Criando..." : `Criar "${query.trim()}"`}</span>
            </button>
          )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-[17px] font-bold text-zinc-900">Novo Contato</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Preencha os dados da pessoa.</p>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors mt-0.5"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700">Nome <span className="text-red-400">*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700">E-mail</label>
            <div className="flex gap-2">
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com"
                className="flex-1 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors" />
              <TypeSelector value={emailType} options={EMAIL_TYPES} onChange={setEmailType} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700">Telefone</label>
            <div className="flex gap-2">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999"
                className="flex-1 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors" />
              <TypeSelector value={phoneType} options={PHONE_TYPES} onChange={setPhoneType} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700">Cargo</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="Ex: CEO, Diretor Comercial..."
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700">Empresa</label>
            <CompanySearchInput companies={state.companies} selectedId={companyId} onSelect={setCompanyId} />
          </div>
          <button onClick={() => { if (!name.trim()) return; onSave({ name: name.trim(), email, emailType, phone, phoneType, role, companyId }); }}
            disabled={!name.trim()}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors mt-2">
            Criar Contato
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContatosPage() {
  const router = useRouter();
  const { state, addContact, updateContact, deleteContact } = useCrm();
  const { map: ownerNameMap } = useTeam();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [showCustomizeColumnsModal, setShowCustomizeColumnsModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [dragColId, setDragColId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("trino_crm_contacts_list_columns");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setVisibleColumns(parsed);
      } catch (e) {
        console.error("Failed to parse saved columns", e);
      }
    }
  }, []);

  const handleSaveColumns = (newCols: string[]) => {
    setVisibleColumns(newCols);
    localStorage.setItem("trino_crm_contacts_list_columns", JSON.stringify(newCols));
    setShowCustomizeColumnsModal(false);
  };

  // Reorder table headers by dragging (mirrors "Personalizar colunas" ordering)
  const handleColHeaderDrop = (targetId: string) => {
    if (!dragColId || dragColId === targetId || dragColId === "name") {
      setDragColId(null);
      return;
    }
    const cols = [...visibleColumns];
    const fromIndex = cols.indexOf(dragColId);
    let toIndex = cols.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) { setDragColId(null); return; }
    if (toIndex === 0) toIndex = 1; // never displace pinned Nome column
    cols.splice(fromIndex, 1);
    cols.splice(toIndex, 0, dragColId);
    setDragColId(null);
    handleSaveColumns(cols);
  };

  // Bulk edit field states
  const [cargoMode, setCargoMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [cargoValue, setCargoValue] = useState("");

  const [propMode, setPropMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [propValue, setPropValue] = useState<string | null>(null);

  const [acaoValue, setAcaoValue] = useState<"Manter valor atual" | "Excluir registros">("Manter valor atual");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const resetBulkStates = () => {
    setCargoMode("Manter valor atual");
    setCargoValue("");
    setPropMode("Manter valor atual");
    setPropValue(null);
    setAcaoValue("Manter valor atual");
    setShowDeleteConfirm(false);
  };

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

  const bulkChanged =
    cargoMode !== "Manter valor atual" ||
    propMode !== "Manter valor atual" ||
    acaoValue !== "Manter valor atual";

  const handleBulkSave = () => {
    selectedIds.forEach(id => {
      const patch: Partial<Contact> = {};
      if (cargoMode === "Substituir por...") patch.role = cargoValue;
      else if (cargoMode === "Limpar") patch.role = "";
      
      updateContact(id, patch);
    });
    setBulkEditOpen(false);
    setSelectedIds(new Set());
    resetBulkStates();
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => {
      deleteContact(id);
    });
    setBulkEditOpen(false);
    setSelectedIds(new Set());
    resetBulkStates();
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

  // Text value for a column id, used by both CSV export and any plain-text needs.
  const getCellText = (colId: string, c: Contact) => {
    const company = getCompany(c);
    switch (colId) {
      case "name": return c.name;
      case "email": return c.emails?.[0]?.value || "";
      case "phone": return c.phones?.[0]?.value || "";
      case "company": return company?.name || "";
      case "owner": return c.ownerId ? (ownerNameMap[c.ownerId] ?? "Usuário removido") : "";
      case "deals": return String(getDealsCount(c));
      case "role": return c.role || "";
      case "createdAt": return "";
      case "companyCity": return company?.city || "";
      case "companyCnpj": return company?.cnpj || "";
      case "companyState": return company?.state || "";
      case "companySize": return company?.size || "";
      case "companySegment": return company?.segment || "";
      case "companyWebsite": return company?.website || "";
      default: return "";
    }
  };

  const columnLabel = (colId: string) => ALL_COLUMNS.find(c => c.id === colId)?.label || colId;

  const exportCSV = (scope: "all" | "selected" = "all") => {
    const source = scope === "selected" ? filtered.filter(c => selectedIds.has(c.id)) : filtered;
    const rows = [visibleColumns.map(columnLabel)];
    source.forEach(c => {
      rows.push(visibleColumns.map(colId => getCellText(colId, c)));
    });
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "contatos.csv";
    a.click();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-zinc-800">Pessoas</h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">{state.contacts.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-400">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contato..."
              className="outline-none text-zinc-700 placeholder-zinc-400 w-48" />
          </div>
          <button
            title="Personalizar colunas"
            onClick={() => setShowCustomizeColumnsModal(true)}
            className="flex items-center justify-center rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
          <button onClick={() => exportCSV("all")}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50 transition-colors">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-1.5 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo Contato
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead className="sticky top-0 bg-zinc-50 z-10 border-b border-zinc-300">
            <tr>
              <th className="px-2 py-2 w-10 border-r border-zinc-200">
                <button
                  onClick={toggleAll}
                  className="flex h-4 w-4 items-center justify-center rounded border border-zinc-300 hover:border-zinc-400 transition-colors"
                  style={{ backgroundColor: allSelected ? "#f59e0b" : "white" }}>
                  {allSelected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
              </th>
              {visibleColumns.map(colId => (
                <th key={colId}
                  draggable={colId !== "name"}
                  onDragStart={() => setDragColId(colId)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleColHeaderDrop(colId)}
                  className={cn(
                    "group px-3 py-2 text-left text-xs font-semibold text-zinc-500 border-r border-zinc-200",
                    dragColId === colId && "opacity-40"
                  )}>
                  <button type="button" className={cn(
                    "text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity touch-none align-middle inline-block mr-1.5",
                    colId === "name" ? "cursor-not-allowed" : "cursor-grab"
                  )} title="Arraste para reordenar">
                    <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {columnLabel(colId)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="py-16 text-center text-[13px] font-medium text-zinc-400">
                  {search ? "Nenhum contato encontrado." : "Nenhum contato cadastrado ainda."}
                </td>
              </tr>
            ) : (
              filtered.map(c => {
                const company = getCompany(c);
                const dealsCount = getDealsCount(c);
                const selected = selectedIds.has(c.id);
                return (
                  <tr key={c.id}
                    className={cn("border-b border-zinc-200 cursor-pointer transition-colors h-10", selected ? "bg-amber-50" : "hover:bg-zinc-50")}
                    onClick={() => router.push(`/contatos/${c.id}`)}>
                    <td className="px-2 py-1.5 w-10 border-r border-zinc-100" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => toggleOne(c.id)}
                        className="flex h-4 w-4 items-center justify-center rounded border border-zinc-300 hover:border-zinc-400 transition-colors"
                        style={{ backgroundColor: selected ? "#f59e0b" : "white" }}>
                        {selected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </button>
                    </td>
                    {visibleColumns.map(colId => (
                      <td key={colId} className={cn(
                        "px-3 py-1.5 border-r border-zinc-100 truncate overflow-hidden whitespace-nowrap text-zinc-600",
                        colId === "name" && "max-w-[220px]"
                      )}>
                        {colId === "name" && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 font-medium text-sm shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-zinc-800">{c.name}</span>
                          </div>
                        )}
                        {colId === "email" && (
                          c.emails?.[0]?.value ? (
                            <a href={`mailto:${c.emails[0].value}`} onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-zinc-400 hover:text-amber-500 text-xs">
                              <Mail className="h-3.5 w-3.5" aria-hidden="true" />{c.emails[0].value}
                            </a>
                          ) : <span className="text-zinc-300">-</span>
                        )}
                        {colId === "phone" && (
                          c.phones?.[0]?.value ? (
                            <a href={`tel:${c.phones[0].value}`} onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-zinc-400 hover:text-amber-500 text-xs">
                              <Phone className="h-3.5 w-3.5" aria-hidden="true" />{c.phones[0].value}
                            </a>
                          ) : <span className="text-zinc-300">-</span>
                        )}
                        {colId === "role" && (
                          c.role ? <span className="text-zinc-500">{c.role}</span> : <span className="text-zinc-500">-</span>
                        )}
                        {colId === "company" && (
                          company ? <span className="text-zinc-500">{company.name}</span> : <span className="text-zinc-500">-</span>
                        )}
                        {colId === "deals" && <span className="text-zinc-500">{dealsCount}</span>}
                        {colId === "owner" && <OwnerBadge ownerId={c.ownerId ?? null} />}
                        {colId === "createdAt" && <span className="text-zinc-300">-</span>}
                        {colId === "companyCity" && <span className="text-zinc-500">{company?.city || <span className="text-zinc-300">-</span>}</span>}
                        {colId === "companyCnpj" && <span className="text-zinc-500">{company?.cnpj || <span className="text-zinc-300">-</span>}</span>}
                        {colId === "companyState" && <span className="text-zinc-500">{company?.state || <span className="text-zinc-300">-</span>}</span>}
                        {colId === "companySize" && <span className="text-zinc-500">{company?.size || <span className="text-zinc-300">-</span>}</span>}
                        {colId === "companySegment" && <span className="text-zinc-500">{company?.segment || <span className="text-zinc-300">-</span>}</span>}
                        {colId === "companyWebsite" && <span className="text-zinc-500">{company?.website || <span className="text-zinc-300">-</span>}</span>}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
          <button onClick={() => exportCSV("selected")}
            className="px-4 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[12px] font-semibold rounded-lg transition-colors">
            Exportar CSV
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bulk edit drawer */}
      {bulkEditOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setBulkEditOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-[420px] bg-white shadow-2xl border-l border-zinc-200 flex flex-col" role="dialog" aria-label="Editar contatos em massa">
            <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Editar {selectedIds.size} {selectedIds.size === 1 ? "contato" : "contatos"}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Selecione os campos que deseja atualizar</p>
              </div>
              <button onClick={() => setBulkEditOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 -mr-1" aria-label="Fechar">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex gap-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p>Ações em massa não disparam automações, webhooks nem eventos da timeline.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              
              {/* Cargo */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Cargo</label>
                <BulkFieldSelect
                  label="Cargo"
                  value={cargoMode}
                  options={["Manter valor atual", "Substituir por...", "Limpar"]}
                  onChange={setCargoMode}
                />
                {cargoMode === "Substituir por..." && (
                  <input
                    placeholder=""
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                    type="text"
                    value={cargoValue}
                    onChange={e => setCargoValue(e.target.value)}
                  />
                )}
              </div>

              {/* Proprietário */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Proprietário</label>
                <BulkFieldSelect
                  label="Proprietário"
                  value={propMode}
                  options={["Manter valor atual", "Substituir por...", "Limpar"]}
                  onChange={setPropMode}
                />
                {propMode === "Substituir por..." && (
                  <OwnerSelect
                    value={propValue}
                    onChange={setPropValue}
                  />
                )}
              </div>

              {/* Ações */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Ações</label>
                <BulkFieldSelect
                  label="Ações"
                  value={acaoValue}
                  options={["Manter valor atual", "Excluir registros"]}
                  onChange={setAcaoValue}
                />
                {acaoValue === "Excluir registros" && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Esta ação não pode ser revertida. Os registros serão excluídos permanentemente.</span>
                  </div>
                )}
              </div>

            </div>
            <footer className="border-t border-zinc-200 p-4">
              {acaoValue === "Excluir registros" ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={!bulkChanged}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
                >
                  Excluir {selectedIds.size} {selectedIds.size === 1 ? "contato" : "contatos"}
                </button>
              ) : (
                <button
                  onClick={handleBulkSave}
                  disabled={!bulkChanged}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600"
                >
                  Salvar alterações
                </button>
              )}
            </footer>
          </aside>
        </>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-zinc-800">
              Excluir {selectedIds.size} {selectedIds.size === 1 ? "contato" : "contatos"}?
            </h2>
            <p className="text-sm text-zinc-500 mt-2">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors bg-red-500 hover:bg-red-600"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && <NewContactModal onClose={() => setShowModal(false)} onSave={handleCreate} />}

      {showCustomizeColumnsModal && (
        <CustomizeColumnsModal
          initialColumns={visibleColumns}
          onClose={() => setShowCustomizeColumnsModal(false)}
          onSave={handleSaveColumns}
        />
      )}
    </div>
  );
}
