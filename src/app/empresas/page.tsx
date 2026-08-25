"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCrm } from "@/contexts/crm-context";
import { createClient } from "@/lib/supabase/client";
import { BulkFieldSelect } from "@/components/ui/BulkFieldSelect";
import { CustomizeColumnsModal, ALL_COLUMNS, DEFAULT_COLUMNS } from "@/components/company/customize-columns-modal";
import {
  Plus, Search, Download, Settings, Building2, X,
  ChevronDown, GripVertical, AlertTriangle, Globe, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Company } from "@/lib/crm-types";

const PORTE_OPTIONS = ["Selecionar", "MEI", "Micro", "Pequena", "Media", "Grande"];
const SEGMENTO_BULK_OPTIONS = ["Manter valor atual", "Tecnologia", "Saúde", "Educação", "Varejo", "Serviços", "Indústria", "Outro"];
const PORTE_BULK_OPTIONS = ["Manter valor atual", "MEI", "Micro", "Pequena", "Media", "Grande"];
const ACAO_OPTIONS = ["Manter valor atual", "Excluir empresas"];



function NewCompanyModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: Partial<Company> & { name: string }) => void;
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

  const inputClass = "w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder:text-zinc-300 text-zinc-800 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-zinc-900">Nova Empresa</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition mt-0.5"><X size={18} /></button>
        </div>
        <p className="text-sm text-zinc-400 mb-5">Preencha os dados da empresa.</p>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Nome <span className="text-red-400">*</span></label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Razão Social ou Nome Fantasia" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">CNPJ</label>
            <input value={cnpj} onChange={e => setCnpj(formatCnpj(e.target.value))} placeholder="00.000.000/0001-00" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Site</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Segmento</label>
            <input value={segment} onChange={e => setSegment(e.target.value)} placeholder="Ex: Tecnologia" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Porte</label>
            <select value={size} onChange={e => setSize(e.target.value === "Selecionar" ? "" : e.target.value)}
              className={inputClass + " cursor-pointer bg-white"}>
              {PORTE_OPTIONS.map(o => <option key={o} value={o === "Selecionar" ? "" : o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Cidade</label>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="São Paulo" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Estado</label>
            <input value={state} onChange={e => setState(e.target.value)} placeholder="SP" maxLength={2} className={inputClass} />
          </div>
        </div>
        <button
          onClick={() => name.trim() && onSave({ name: name.trim(), cnpj: cnpj || undefined, website: website || undefined, segment: segment || undefined, size: size || undefined, city: city || undefined, state: state || undefined })}
          disabled={!name.trim()}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-white font-bold rounded-xl text-sm transition disabled:opacity-40 shadow-sm">
          Criar Empresa
        </button>
      </div>
    </div>
  );
}

export default function EmpresasPage() {
  const router = useRouter();
  const { state, addCompany, updateCompany, deleteCompany } = useCrm();
  const [currentUserName, setCurrentUserName] = useState("");
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserName(user.user_metadata?.full_name || user.user_metadata?.name || user.email || "");
    });
  }, []);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [showCustomizeColumnsModal, setShowCustomizeColumnsModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [dragColId, setDragColId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("trino_crm_companies_list_columns");
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
    localStorage.setItem("trino_crm_companies_list_columns", JSON.stringify(newCols));
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
    if (toIndex === 0) toIndex = 1; // never displace pinned Empresa column
    cols.splice(fromIndex, 1);
    cols.splice(toIndex, 0, dragColId);
    setDragColId(null);
    handleSaveColumns(cols);
  };

  // Bulk edit field states
  const [segMode, setSegMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [segValue, setSegValue] = useState("");

  const [porteMode, setPorteMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [porteValue, setPorteValue] = useState("");

  const [cidadeMode, setCidadeMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [cidadeValue, setCidadeValue] = useState("");

  const [estMode, setEstMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [estValue, setEstValue] = useState("");

  const [propMode, setPropMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [propValue, setPropValue] = useState("");

  const [acaoValue, setAcaoValue] = useState<"Manter valor atual" | "Excluir registros">("Manter valor atual");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const resetBulkStates = () => {
    setSegMode("Manter valor atual");
    setSegValue("");
    setPorteMode("Manter valor atual");
    setPorteValue("");
    setCidadeMode("Manter valor atual");
    setCidadeValue("");
    setEstMode("Manter valor atual");
    setEstValue("");
    setPropMode("Manter valor atual");
    setPropValue("");
    setAcaoValue("Manter valor atual");
    setShowDeleteConfirm(false);
  };

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

  const bulkChanged =
    segMode !== "Manter valor atual" ||
    porteMode !== "Manter valor atual" ||
    cidadeMode !== "Manter valor atual" ||
    estMode !== "Manter valor atual" ||
    propMode !== "Manter valor atual" ||
    acaoValue !== "Manter valor atual";

  const handleBulkSave = () => {
    selectedIds.forEach(id => {
      const patch: Partial<Company> = {};
      if (segMode === "Substituir por...") patch.segment = segValue;
      else if (segMode === "Limpar") patch.segment = "";

      if (porteMode === "Substituir por...") patch.size = porteValue;
      else if (porteMode === "Limpar") patch.size = "";

      if (cidadeMode === "Substituir por...") patch.city = cidadeValue.trim();
      else if (cidadeMode === "Limpar") patch.city = "";

      if (estMode === "Substituir por...") patch.state = estValue.trim();
      else if (estMode === "Limpar") patch.state = "";

      updateCompany(id, patch);
    });
    setBulkEditOpen(false);
    setSelectedIds(new Set());
    resetBulkStates();
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => {
      deleteCompany(id);
    });
    setBulkEditOpen(false);
    setSelectedIds(new Set());
    resetBulkStates();
  };

  const handleCreate = (data: Partial<Company> & { name: string }) => {
    const id = `comp_${Date.now()}`;
    addCompany({ id, ...data });
    setShowModal(false);
    router.push(`/empresas/${id}`);
  };

  const getCellText = (colId: string, c: Company) => {
    switch (colId) {
      case "name": return c.name;
      case "website": return c.website || "";
      case "segment": return c.segment || "";
      case "size": return c.size || "";
      case "city": return c.city || "";
      case "state": return c.state || "";
      case "cnpj": return c.cnpj || "";
      case "contacts": return String(getContactsCount(c));
      case "deals": return String(getDealsCount(c));
      case "owner": return currentUserName || "";
      case "createdAt": return "";
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
    a.download = "empresas.csv";
    a.click();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-zinc-800">Empresas</h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">{state.companies.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-400">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa..."
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
            Nova Empresa
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {state.companies.length === 0 && !search ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-50 flex items-center justify-center mb-4">
              <Building2 size={28} className="text-zinc-300" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-1">Nenhuma empresa cadastrada</h3>
            <p className="text-sm text-zinc-400 mb-6 max-w-xs">Comece adicionando empresas para organizar seus negócios.</p>
            <button onClick={() => setShowModal(true)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 text-white font-bold text-sm rounded-xl hover:from-amber-600 hover:to-amber-500 shadow-sm transition-colors">
              + Cadastrar Empresa
            </button>
          </div>
        ) : (
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
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const contacts = getContactsCount(c);
                  const deals = getDealsCount(c);
                  const selected = selectedIds.has(c.id);
                  return (
                    <tr key={c.id}
                      className={cn("border-b border-zinc-200 cursor-pointer transition-colors h-10", selected ? "bg-amber-50" : "hover:bg-zinc-50")}
                      onClick={() => router.push(`/empresas/${c.id}`)}>
                      <td className="px-2 py-1.5 w-10 border-r border-zinc-100" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => toggleOne(c.id)}
                          className="flex h-4 w-4 items-center justify-center rounded border border-zinc-300 hover:border-zinc-400 transition-colors"
                          style={{ backgroundColor: selected ? "#f59e0b" : "white" }}>
                          {selected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </button>
                      </td>
                      {visibleColumns.map(colId => (
                        <td key={colId} className="px-3 py-1.5 border-r border-zinc-100 truncate overflow-hidden whitespace-nowrap text-zinc-600">
                          {colId === "name" && (
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-semibold text-sm shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-zinc-800">{c.name}</p>
                                {c.website && (
                                  <p className="text-xs text-zinc-400 flex items-center gap-1">
                                    <Globe className="h-3 w-3" aria-hidden="true" />{c.website.replace(/^https?:\/\//, "")}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          {colId === "website" && (
                            c.website ? (
                              <span className="text-zinc-500 flex items-center gap-1">
                                <Globe className="h-3.5 w-3.5 text-zinc-300" aria-hidden="true" />
                                {c.website.replace(/^https?:\/\//, "")}
                              </span>
                            ) : <span className="text-zinc-300">-</span>
                          )}
                          {colId === "segment" && (
                            c.segment ? <span className="text-zinc-500">{c.segment}</span> : <span className="text-zinc-500">-</span>
                          )}
                          {colId === "size" && (
                            c.size ? <span className="text-zinc-500">{c.size}</span> : <span className="text-zinc-300">-</span>
                          )}
                          {colId === "city" && (
                            c.city ? (
                              <span className="flex items-center gap-1 text-zinc-500">
                                <MapPin className="h-3.5 w-3.5 text-zinc-300" aria-hidden="true" />{c.city}
                              </span>
                            ) : <span className="text-zinc-300">-</span>
                          )}
                          {colId === "state" && (
                            c.state ? <span className="text-zinc-500">{c.state}</span> : <span className="text-zinc-300">-</span>
                          )}
                          {colId === "cnpj" && (
                            c.cnpj ? <span className="text-zinc-500">{c.cnpj}</span> : <span className="text-zinc-300">-</span>
                          )}
                          {colId === "contacts" && <span className="text-zinc-500">{contacts}</span>}
                          {colId === "deals" && <span className="text-zinc-500">{deals}</span>}
                          {colId === "owner" && <span className="text-sm text-zinc-600">{currentUserName || "—"}</span>}
                          {colId === "createdAt" && <span className="text-zinc-300">-</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
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
          <aside className="fixed inset-y-0 right-0 z-50 w-[420px] bg-white shadow-2xl border-l border-zinc-200 flex flex-col" role="dialog" aria-label="Editar empresas em massa">
            <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Editar {selectedIds.size} {selectedIds.size === 1 ? "empresa" : "empresas"}
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
              
              {/* Segmento */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Segmento</label>
                <BulkFieldSelect
                  label="Segmento"
                  value={segMode}
                  options={["Manter valor atual", "Substituir por...", "Limpar"]}
                  onChange={setSegMode}
                />
                {segMode === "Substituir por..." && (
                  <input
                    placeholder=""
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                    type="text"
                    value={segValue}
                    onChange={e => setSegValue(e.target.value)}
                  />
                )}
              </div>

              {/* Porte */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Porte</label>
                <BulkFieldSelect
                  label="Porte"
                  value={porteMode}
                  options={["Manter valor atual", "Substituir por...", "Limpar"]}
                  onChange={setPorteMode}
                />
                {porteMode === "Substituir por..." && (
                  <input
                    placeholder=""
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                    type="text"
                    value={porteValue}
                    onChange={e => setPorteValue(e.target.value)}
                  />
                )}
              </div>

              {/* Cidade */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Cidade</label>
                <BulkFieldSelect
                  label="Cidade"
                  value={cidadeMode}
                  options={["Manter valor atual", "Substituir por...", "Limpar"]}
                  onChange={setCidadeMode}
                />
                {cidadeMode === "Substituir por..." && (
                  <input
                    placeholder=""
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                    type="text"
                    value={cidadeValue}
                    onChange={e => setCidadeValue(e.target.value)}
                  />
                )}
              </div>

              {/* Estado */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Estado</label>
                <BulkFieldSelect
                  label="Estado"
                  value={estMode}
                  options={["Manter valor atual", "Substituir por...", "Limpar"]}
                  onChange={setEstMode}
                />
                {estMode === "Substituir por..." && (
                  <input
                    placeholder=""
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                    type="text"
                    value={estValue}
                    onChange={e => setEstValue(e.target.value)}
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
                  <BulkFieldSelect
                    label="Selecione Proprietário"
                    value={propValue || "Selecione..."}
                    options={["Selecione...", ...(currentUserName ? [currentUserName] : [])]}
                    onChange={v => setPropValue(v === "Selecione..." ? "" : v)}
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
                  Excluir {selectedIds.size} {selectedIds.size === 1 ? "empresa" : "empresas"}
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
              Excluir {selectedIds.size} {selectedIds.size === 1 ? "empresa" : "empresas"}?
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

      {showModal && <NewCompanyModal onClose={() => setShowModal(false)} onSave={handleCreate} />}

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
