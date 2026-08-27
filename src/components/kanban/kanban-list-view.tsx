"use client";

import { useState, useEffect, useRef } from "react";
import { useCrm } from "@/contexts/crm-context";
import { MoreHorizontal, Pencil, Trophy, CircleX, Trash2, Search, ChevronDown, X, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DEFAULT_COLUMNS } from "@/components/deal/customize-columns-modal";
import { DeleteDealModal } from "@/components/deal/delete-deal-modal";
import { BulkFieldSelect } from "@/components/ui/BulkFieldSelect";
import type { Deal } from "@/lib/crm-types";
import { createClient } from "@/lib/supabase/client";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { useWorkspace } from "@/lib/workspace";

interface KanbanListViewProps {
  pipelineId: string;
  statusFilter?: "Ativo" | "Ganho" | "Perdido";
  columns?: string[];
  ownerFilter?: string | null;
}



const COLUMN_HEADERS: Record<string, { label: string; align: "left" | "right" | "center" }> = {
  title: { label: "Título", align: "left" },
  value: { label: "Valor", align: "right" },
  stage: { label: "Etapa", align: "left" },
  pipeline: { label: "Pipeline", align: "left" },
  company: { label: "Empresa", align: "left" },
  contact: { label: "Contato", align: "left" },
  owner: { label: "Proprietário", align: "left" },
  status: { label: "Status", align: "left" },
  createdAt: { label: "Criado em", align: "left" },
  expectedCloseDate: { label: "Data prevista", align: "left" },
  labels: { label: "Etiquetas", align: "left" },
  probability: { label: "Probabilidade", align: "right" },
  contactRole: { label: "Cargo", align: "left" },
  contactEmail: { label: "Email", align: "left" },
  contactPhone: { label: "Telefone", align: "left" },
  companyCity: { label: "Cidade", align: "left" },
  companyCnpj: { label: "CNPJ", align: "left" },
  companyState: { label: "Estado", align: "left" },
  companySize: { label: "Porte", align: "left" },
  companySegment: { label: "Segmento", align: "left" },
  companyWebsite: { label: "Website", align: "left" },
};

export function KanbanListView({ pipelineId, columns = DEFAULT_COLUMNS, statusFilter, ownerFilter }: KanbanListViewProps) {
  const { state, markDealStatus, deleteDeal, updateDealFields, addLabel } = useCrm();
  const { map: ownerNameMap, names: ownerNames } = useOwnerNameMap();
  const { workspaceId } = useWorkspace();
  const [activePipelineId, setActivePipelineId] = useState(pipelineId);
  const [stageFilter, setStageFilter] = useState("");
  const [statusLocalFilter, setStatusLocalFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownContainerRef = useRef<HTMLTableCellElement | null>(null);

  // Checkbox selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Bulk edit field states
  const [titleMode, setTitleMode] = useState<"Manter valor atual" | "Substituir por...">("Manter valor atual");
  const [titleValue, setTitleValue] = useState("");

  const [valueMode, setValueMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [valueValue, setValueValue] = useState("");

  const [dateMode, setDateMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [dateValue, setDateValue] = useState("");

  const [stageMode, setStageMode] = useState<"Manter valor atual" | "Substituir por...">("Manter valor atual");
  const [stageValue, setStageValue] = useState("");

  const [ownerMode, setOwnerMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [ownerValue, setOwnerValue] = useState("");

  const [statusMode, setStatusMode] = useState<"Manter valor atual" | "Substituir por...">("Manter valor atual");
  const [statusValue, setStatusValue] = useState<"Ativo" | "Ganho" | "Perdido">("Ativo");

  const [lossReasonMode, setLossReasonMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [lossReasonValue, setLossReasonValue] = useState("");

  const [etiquetasMode, setEtiquetasMode] = useState<"Manter valor atual" | "Substituir" | "Adicionar" | "Limpar">("Manter valor atual");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState("");

  const [probMode, setProbMode] = useState<"Manter valor atual" | "Substituir por..." | "Limpar">("Manter valor atual");
  const [probValue, setProbValue] = useState("");

  const [acaoValue, setAcaoValue] = useState<"Manter valor atual" | "Excluir registros">("Manter valor atual");

  // Custom fields
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [customFieldsState, setCustomFieldsState] = useState<Record<string, { mode: string; value: string }>>({});

  const getCustomFieldMode = (fieldId: string) => customFieldsState[fieldId]?.mode || "Manter valor atual";
  const getCustomFieldValue = (fieldId: string) => customFieldsState[fieldId]?.value || "";
  const setCustomFieldMode = (fieldId: string, mode: string) => {
    setCustomFieldsState(prev => ({
      ...prev,
      [fieldId]: { ...(prev[fieldId] || { value: "" }), mode }
    }));
  };
  const setCustomFieldValue = (fieldId: string, value: string) => {
    setCustomFieldsState(prev => ({
      ...prev,
      [fieldId]: { ...(prev[fieldId] || { mode: "Manter valor atual" }), value }
    }));
  };

  useEffect(() => {
    const fetchCustomFields = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("custom_fields")
        .select("id, label, field_type, field_group, required")
        .eq("workspace_id", workspaceId)
        .eq("entity", "deal")
        .order("sort_order");
      if (data) {
        setCustomFields(data);
      }
    };
    fetchCustomFields();
  }, [workspaceId]);

  const resetBulkStates = () => {
    setTitleMode("Manter valor atual");
    setTitleValue("");
    setValueMode("Manter valor atual");
    setValueValue("");
    setDateMode("Manter valor atual");
    setDateValue("");
    setStageMode("Manter valor atual");
    setStageValue("");
    setOwnerMode("Manter valor atual");
    setOwnerValue("");
    setStatusMode("Manter valor atual");
    setStatusValue("Ativo");
    setLossReasonMode("Manter valor atual");
    setLossReasonValue("");
    setEtiquetasMode("Manter valor atual");
    setSelectedLabels([]);
    setLabelInput("");
    setProbMode("Manter valor atual");
    setProbValue("");
    setAcaoValue("Manter valor atual");
    setCustomFieldsState({});
    setShowDeleteConfirm(false);
  };

  // Sync pipeline when prop changes
  useEffect(() => {
    setActivePipelineId(pipelineId);
    setStageFilter("");
  }, [pipelineId]);

  // Sync status filter from parent page toolbar buttons
  useEffect(() => {
    if (statusFilter) {
      if (statusFilter === "Ativo") setStatusLocalFilter("aberto");
      else if (statusFilter === "Ganho") setStatusLocalFilter("ganho");
      else if (statusFilter === "Perdido") setStatusLocalFilter("perdido");
    }
  }, [statusFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdownId) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-dropdown-cell]")) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdownId]);

  const pipeline = state.pipelines.find(p => p.id === activePipelineId);
  if (!pipeline) return null;

  const filteredDeals = state.deals.filter(d => {
    if (d.deletedAt) return false;
    if (d.pipelineId !== activePipelineId) return false;
    if (statusLocalFilter === "aberto" && d.status !== "Ativo") return false;
    if (statusLocalFilter === "ganho" && d.status !== "Ganho") return false;
    if (statusLocalFilter === "perdido" && d.status !== "Perdido") return false;
    if (stageFilter && d.stageId !== stageFilter) return false;
    if (ownerFilter && d.ownerId !== ownerFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const company = state.companies.find(c => c.id === d.companyId);
      const contact = d.contactId ? state.contacts.find(c => c.id === d.contactId) : undefined;
      if (
        !d.title.toLowerCase().includes(q) &&
        !(company?.name.toLowerCase().includes(q)) &&
        !(contact?.name.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  const columnsList = columns.length > 0 ? columns : DEFAULT_COLUMNS;

  const renderCellContent = (colId: string, deal: Deal) => {
    const stage = pipeline.stages.find(s => s.id === deal.stageId);
    const company = state.companies.find(c => c.id === deal.companyId);
    const contact = deal.contactId ? state.contacts.find(c => c.id === deal.contactId) : undefined;

    switch (colId) {
      case "title":
        return (
          <a
            className="font-semibold text-zinc-900 hover:text-amber-500 transition-colors truncate block"
            href={`/negocios/${deal.id}`}
          >
            {deal.title}
          </a>
        );
      case "value":
        return (
          <span className="font-medium text-zinc-850">
            {deal.value > 0 ? deal.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00"}
          </span>
        );
      case "stage":
        return (
          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white whitespace-nowrap bg-zinc-300">
            {stage?.name || "-"}
          </span>
        );
      case "pipeline":
        return <span className="text-zinc-500 whitespace-nowrap">{pipeline.name}</span>;
      case "company":
        return company ? (
          <a
            className="text-zinc-700 hover:text-zinc-950 hover:underline transition-colors truncate block"
            href={`/empresas/${company.id}`}
            onClick={e => e.stopPropagation()}
          >
            {company.name}
          </a>
        ) : (
          <span className="text-zinc-300">-</span>
        );
      case "contact":
        return contact ? (
          <a
            className="text-zinc-700 hover:text-zinc-950 hover:underline transition-colors truncate block"
            href={`/contatos/${contact.id}`}
            onClick={e => e.stopPropagation()}
          >
            {contact.name}
          </a>
        ) : (
          <span className="text-zinc-300">-</span>
        );
      case "owner":
        return <span className="text-sm text-zinc-650">{ownerNameMap[deal.ownerId ?? ""] || "-"}</span>;
      case "status":
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              deal.status === "Ativo" ? "bg-zinc-100 text-zinc-600" :
              deal.status === "Ganho" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
            )}
          >
            {deal.status === "Ativo" ? "Aberto" : deal.status}
          </span>
        );
      case "createdAt":
        return (
          <span className="text-zinc-550 whitespace-nowrap">
            {deal.createdAt ? format(new Date(deal.createdAt), "dd/MM/yyyy") : "-"}
          </span>
        );
      case "expectedCloseDate":
        return (
          <span className="text-zinc-550 whitespace-nowrap">
            {deal.expectedCloseDate ? format(new Date(deal.expectedCloseDate), "dd/MM/yyyy") : "-"}
          </span>
        );
      case "labels":
        return (
          <div className="flex flex-wrap gap-1 max-w-[180px]">
            {deal.labels.length > 0 ? (
              deal.labels.map(labelId => {
                const label = state.labels.find(l => l.id === labelId);
                return label ? (
                  <span
                    key={labelId}
                    style={{ backgroundColor: label.color + "15", color: label.color, borderColor: label.color + "30" }}
                    className="px-2 py-0.5 text-[10px] font-bold rounded border"
                  >
                    {label.name}
                  </span>
                ) : null;
              })
            ) : (
              <span className="text-zinc-300">-</span>
            )}
          </div>
        );
      case "probability":
        return (
          <span className="text-zinc-700 font-medium">
            {deal.probability !== undefined ? `${deal.probability}%` : "-"}
          </span>
        );
      case "contactRole":
        return <span className="text-zinc-600 truncate block max-w-[120px]">{contact?.role || "-"}</span>;
      case "contactEmail":
        return (
          <span className="text-zinc-600 truncate block max-w-[160px]" title={contact?.emails?.[0]?.value}>
            {contact?.emails?.[0]?.value || "-"}
          </span>
        );
      case "contactPhone":
        return (
          <span className="text-zinc-650 truncate block whitespace-nowrap">
            {contact?.phones?.[0]?.value || "-"}
          </span>
        );
      case "companyCity":
        return <span className="text-zinc-600 truncate block">{company?.city || "-"}</span>;
      case "companyCnpj":
        return <span className="text-zinc-600 truncate block font-mono text-xs">{company?.cnpj || "-"}</span>;
      case "companyState":
        return <span className="text-zinc-600 truncate block">{company?.state || "-"}</span>;
      case "companySize":
        return <span className="text-zinc-600 truncate block">{company?.size || "-"}</span>;
      case "companySegment":
        return <span className="text-zinc-600 truncate block max-w-[120px]">{company?.segment || "-"}</span>;
      case "companyWebsite":
        return company?.website ? (
          <a
            href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500 hover:text-amber-600 hover:underline truncate block max-w-[140px]"
            onClick={e => e.stopPropagation()}
          >
            {company.website}
          </a>
        ) : (
          <span className="text-zinc-300">-</span>
        );
      default:
        return null;
    }
  };

  const allSelected = filteredDeals.length > 0 && filteredDeals.every(d => selectedIds.has(d.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredDeals.map(d => d.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkChanged =
    titleMode !== "Manter valor atual" ||
    valueMode !== "Manter valor atual" ||
    dateMode !== "Manter valor atual" ||
    stageMode !== "Manter valor atual" ||
    ownerMode !== "Manter valor atual" ||
    statusMode !== "Manter valor atual" ||
    lossReasonMode !== "Manter valor atual" ||
    etiquetasMode !== "Manter valor atual" ||
    probMode !== "Manter valor atual" ||
    acaoValue !== "Manter valor atual" ||
    Object.values(customFieldsState).some(s => s.mode !== "Manter valor atual");

  const handleBulkSave = async () => {
    const supabase = createClient();
    
    for (const id of selectedIds) {
      const deal = state.deals.find(d => d.id === id);
      if (!deal) continue;
      
      const patch: Partial<Deal> = {};
      
      if (titleMode === "Substituir por..." && titleValue.trim()) {
        patch.title = titleValue.trim();
      }
      
      if (valueMode === "Substituir por...") {
        patch.value = parseFloat(valueValue) || 0;
      } else if (valueMode === "Limpar") {
        patch.value = 0;
      }
      
      if (dateMode === "Substituir por...") {
        patch.expectedCloseDate = dateValue;
      } else if (dateMode === "Limpar") {
        patch.expectedCloseDate = undefined;
      }
      
      if (stageMode === "Substituir por..." && stageValue) {
        const stage = pipeline.stages.find(s => s.name === stageValue || s.id === stageValue);
        if (stage) {
          patch.stageId = stage.id;
          patch.daysInStage = 0;
        }
      }
      
      if (ownerMode === "Substituir por...") {
        patch.ownerId = ownerValue;
      } else if (ownerMode === "Limpar") {
        patch.ownerId = undefined;
      }
      
      if (statusMode === "Substituir por...") {
        patch.status = statusValue;
        if (statusValue === "Perdido" && lossReasonMode === "Substituir por...") {
          patch.lossReason = lossReasonValue;
        } else if (statusValue === "Perdido" && lossReasonMode === "Limpar") {
          patch.lossReason = "";
        }
      }
      
      if (lossReasonMode === "Substituir por..." && statusMode !== "Substituir por...") {
        patch.lossReason = lossReasonValue;
      } else if (lossReasonMode === "Limpar" && statusMode !== "Substituir por...") {
        patch.lossReason = "";
      }
      
      if (etiquetasMode === "Substituir") {
        patch.labels = selectedLabels;
      } else if (etiquetasMode === "Adicionar") {
        const union = Array.from(new Set([...(deal.labels || []), ...selectedLabels]));
        patch.labels = union;
      } else if (etiquetasMode === "Limpar") {
        patch.labels = [];
      }
      
      if (probMode === "Substituir por...") {
        patch.probability = parseInt(probValue, 10) || 0;
      } else if (probMode === "Limpar") {
        patch.probability = undefined;
      }
      
      // Update custom fields
      for (const fieldId in customFieldsState) {
        const fState = customFieldsState[fieldId];
        if (fState.mode === "Substituir por...") {
          await supabase.from("deal_field_values").upsert(
            { deal_id: id, field_id: fieldId, value: fState.value, updated_at: new Date().toISOString() },
            { onConflict: "deal_id,field_id" }
          );
        } else if (fState.mode === "Limpar") {
          await supabase.from("deal_field_values").delete().eq("deal_id", id).eq("field_id", fieldId);
        }
      }
      
      // Update local deal
      updateDealFields(id, patch);
    }
    
    setBulkEditOpen(false);
    setSelectedIds(new Set());
    resetBulkStates();
  };

  const handleBulkDelete = (reason: string, note: string) => {
    selectedIds.forEach(id => {
      deleteDeal(id, reason, note);
    });
    setShowDeleteConfirm(false);
    setBulkEditOpen(false);
    setSelectedIds(new Set());
    resetBulkStates();
  };

  const exportCSV = () => {
    const rows = [["Título", "Valor", "Etapa", "Pipeline", "Empresa", "Contato", "Proprietário", "Status", "Previsão de Fechamento", "Probabilidade"]];
    filteredDeals.filter(d => selectedIds.has(d.id)).forEach(d => {
      const stage = pipeline.stages.find(s => s.id === d.stageId);
      const company = state.companies.find(c => c.id === d.companyId);
      const contact = d.contactId ? state.contacts.find(c => c.id === d.contactId) : undefined;
      rows.push([
        d.title,
        String(d.value),
        stage?.name || "",
        pipeline.name,
        company?.name || "",
        contact?.name || "",
        ownerNameMap[d.ownerId ?? ""] || "-",
        d.status === "Ativo" ? "Aberto" : d.status,
        d.expectedCloseDate || "",
        d.probability !== undefined ? `${d.probability}%` : ""
      ]);
    });
    const csv = rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv);
    a.download = "negocios.csv";
    a.click();
  };

  return (
    <>
      <div className="h-full flex flex-col bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">

        {/* Filter Bar */}
        <div className="flex items-center gap-3 border-b border-zinc-100 bg-white px-6 py-3 flex-wrap shrink-0">
          {/* Pipeline selector */}
          <div className="relative">
            <select
              value={activePipelineId}
              onChange={e => { setActivePipelineId(e.target.value); setStageFilter(""); }}
              className="appearance-none rounded-lg border border-zinc-200 pl-3 pr-7 py-1.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-300 bg-white cursor-pointer"
            >
              {state.pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          </div>

          {/* Stage filter */}
          <div className="relative">
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="appearance-none rounded-lg border border-zinc-200 pl-3 pr-7 py-1.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-300 bg-white cursor-pointer"
            >
              <option value="">Todas as etapas</option>
              {pipeline.stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusLocalFilter}
              onChange={e => setStatusLocalFilter(e.target.value)}
              className="appearance-none rounded-lg border border-zinc-200 pl-3 pr-7 py-1.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-300 bg-white cursor-pointer"
            >
              <option value="todos">Todos os status</option>
              <option value="aberto">Abertos</option>
              <option value="ganho">Ganhos</option>
              <option value="perdido">Perdidos</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          </div>

          {/* Label filter */}
          <div className="relative">
            <button className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors border-zinc-200 text-zinc-600 hover:bg-zinc-50">
              <span className="h-2.5 w-2.5 rounded-full bg-current opacity-60"></span>
              Etiqueta
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar negócio..."
              className="w-full rounded-lg border border-zinc-200 pl-9 pr-3 py-1.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-[13px] border-collapse">
            <thead className="sticky top-0 bg-zinc-50 z-10 border-b border-zinc-300">
              <tr>
                <th className="px-2 py-2 w-10 border-r border-zinc-200 text-center">
                  <button
                    onClick={toggleAll}
                    className="flex h-4 w-4 items-center justify-center rounded border border-zinc-300 hover:border-zinc-400 transition-colors mx-auto bg-white"
                    style={{ backgroundColor: allSelected ? "#f59e0b" : "white" }}
                  >
                    {allSelected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </th>
                {columnsList.map(colId => {
                  const col = COLUMN_HEADERS[colId];
                  if (!col) return null;
                  const isRight = col.align === "right";
                  return (
                    <th
                      key={colId}
                      className={cn(
                        "group px-3 py-2 text-xs font-semibold text-zinc-500 border-r border-zinc-200 truncate",
                        isRight ? "text-right" : "text-left"
                      )}
                    >
                      <span className={cn("flex items-center gap-1 cursor-pointer select-none hover:text-zinc-800", isRight && "justify-end")}>
                        {col.label}
                      </span>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-center text-xs font-semibold text-zinc-500 w-16">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredDeals.map(deal => {
                const selected = selectedIds.has(deal.id);
                return (
                  <tr
                    key={deal.id}
                    className={cn(
                      "border-b border-zinc-200 hover:bg-zinc-50/70 transition-colors group h-10 cursor-pointer",
                      selected ? "bg-amber-50" : ""
                    )}
                    onClick={() => window.location.href = `/negocios/${deal.id}`}
                  >
                    <td className="px-2 py-1.5 w-10 border-r border-zinc-100 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => toggleOne(deal.id)}
                        className="flex h-4 w-4 items-center justify-center rounded border border-zinc-300 hover:border-zinc-400 transition-colors mx-auto"
                        style={{ backgroundColor: selected ? "#f59e0b" : "white" }}
                      >
                        {selected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </td>

                    {columnsList.map(colId => {
                      const col = COLUMN_HEADERS[colId];
                      if (!col) return null;
                      const isRight = col.align === "right";
                      return (
                        <td
                          key={colId}
                          className={cn(
                            "px-3 py-1.5 border-r border-zinc-100 truncate overflow-hidden whitespace-nowrap text-zinc-600 max-w-[220px]",
                            isRight ? "text-right" : "text-left"
                          )}
                        >
                          {renderCellContent(colId, deal)}
                        </td>
                      );
                    })}

                    {/* Actions cell */}
                    <td
                      className="px-2 py-1.5 text-center relative w-16"
                      onClick={e => e.stopPropagation()}
                      data-dropdown-cell="true"
                    >
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === deal.id ? null : deal.id)}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-650 transition-colors"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {openDropdownId === deal.id && (
                        <div className="absolute right-4 top-full mt-1 z-20 w-44 rounded-lg border border-zinc-200 bg-white shadow-md py-1">
                          <a
                            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 text-left"
                            href={`/negocios/${deal.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                            Editar
                          </a>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 text-left"
                            onClick={() => { markDealStatus(deal.id, "Ganho"); setOpenDropdownId(null); }}
                          >
                            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                            Marcar como ganho
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 text-left"
                            onClick={() => { markDealStatus(deal.id, "Perdido"); setOpenDropdownId(null); }}
                          >
                            <CircleX className="h-3.5 w-3.5" aria-hidden="true" />
                            Marcar como perdido
                          </button>
                          <div className="border-t border-zinc-100 mt-1 pt-1">
                            <button
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 text-left"
                              onClick={() => { setSelectedIds(new Set([deal.id])); setShowDeleteConfirm(true); setOpenDropdownId(null); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Excluir
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredDeals.length === 0 && (
                <tr>
                  <td colSpan={columnsList.length + 2} className="p-10 text-center text-sm font-medium text-zinc-450 bg-white">
                    Nenhum negócio encontrado nesta visualização.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating bottom bar */}
      {someSelected && !bulkEditOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white border border-zinc-200 rounded-2xl shadow-xl px-5 py-3">
          <span className="text-[13px] font-semibold text-zinc-700">
            {selectedIds.size} {selectedIds.size === 1 ? "negócio selecionado" : "negócios selecionados"}
          </span>
          <div className="w-px h-4 bg-zinc-200" />
          <button onClick={() => setBulkEditOpen(true)}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold rounded-lg transition-colors">
            Editar {selectedIds.size} {selectedIds.size === 1 ? "negócio" : "negócios"}
          </button>
          <button onClick={exportCSV}
            className="px-4 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[12px] font-semibold rounded-lg transition-colors">
            Exportar CSV
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="p-1.5 text-zinc-400 hover:text-zinc-650 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bulk edit drawer */}
      {bulkEditOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setBulkEditOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-[420px] bg-white shadow-2xl border-l border-zinc-200 flex flex-col" role="dialog" aria-label="Editar negócios em massa">
            <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Editar {selectedIds.size} {selectedIds.size === 1 ? "negócio" : "negócios"}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Selecione os campos que deseja atualizar</p>
              </div>
              <button onClick={() => setBulkEditOpen(false)} className="text-zinc-400 hover:text-zinc-650 transition-colors p-1 -mr-1" aria-label="Fechar">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex gap-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p>Ações em massa não disparam automações, webhooks nem eventos da timeline.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              
              {/* Título */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Título</label>
                <BulkFieldSelect
                  label="Título"
                  value={titleMode}
                  options={["Manter valor atual", "Substituir por..."]}
                  onChange={setTitleMode}
                />
                {titleMode === "Substituir por..." && (
                  <input
                    placeholder=""
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 text-zinc-800"
                    type="text"
                    value={titleValue}
                    onChange={e => setTitleValue(e.target.value)}
                  />
                )}
              </div>

              {/* Valor */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Valor</label>
                <BulkFieldSelect
                  label="Valor"
                  value={valueMode}
                  options={["Manter valor atual", "Substituir por...", "Limpar"]}
                  onChange={setValueMode}
                />
                {valueMode === "Substituir por..." && (
                  <input
                    placeholder=""
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 text-zinc-800"
                    type="number"
                    value={valueValue}
                    onChange={e => setValueValue(e.target.value)}
                  />
                )}
              </div>

              {/* Previsão de fechamento */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Previsão de fechamento</label>
                <BulkFieldSelect
                  label="Previsão de fechamento"
                  value={dateMode}
                  options={["Manter valor atual", "Substituir por...", "Limpar"]}
                  onChange={setDateMode}
                />
                {dateMode === "Substituir por..." && (
                  <input
                    placeholder=""
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 text-zinc-800"
                    type="date"
                    value={dateValue}
                    onChange={e => setDateValue(e.target.value)}
                  />
                )}
              </div>

              {/* Etapa */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Etapa</label>
                <BulkFieldSelect
                  label="Etapa"
                  value={stageMode}
                  options={["Manter valor atual", "Substituir por..."]}
                  onChange={setStageMode}
                />
                {stageMode === "Substituir por..." && (
                  <BulkFieldSelect
                    label="Selecione..."
                    value={stageValue || "Selecione..."}
                    options={["Selecione...", ...pipeline.stages.map(s => s.name)]}
                    onChange={v => setStageValue(v === "Selecione..." ? "" : v)}
                  />
                )}
              </div>

              {/* Proprietário */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Proprietário</label>
                <BulkFieldSelect
                  label="Proprietário"
                  value={ownerMode}
                  options={["Manter valor atual", "Substituir por...", "Limpar"]}
                  onChange={setOwnerMode}
                />
                {ownerMode === "Substituir por..." && (
                  <BulkFieldSelect
                    label="Selecione Proprietário"
                    value={ownerValue || "Selecione..."}
                    options={["Selecione...", ...ownerNames]}
                    onChange={v => setOwnerValue(v === "Selecione..." ? "" : v)}
                  />
                )}
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Status</label>
                <BulkFieldSelect
                  label="Status"
                  value={statusMode}
                  options={["Manter valor atual", "Substituir por..."]}
                  onChange={setStatusMode}
                />
                {statusMode === "Substituir por..." && (
                  <BulkFieldSelect
                    label="Status"
                    value={statusValue === "Ativo" ? "Aberto" : statusValue === "Ganho" ? "Ganho" : "Perdido"}
                    options={["Aberto", "Ganho", "Perdido"]}
                    onChange={v => setStatusValue(v === "Aberto" ? "Ativo" : v as any)}
                  />
                )}
              </div>

              {/* Motivo da perda */}
              {(statusValue === "Perdido" || statusMode === "Manter valor atual") && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">Motivo da perda (texto livre)</label>
                  <BulkFieldSelect
                    label="Motivo da perda"
                    value={lossReasonMode}
                    options={["Manter valor atual", "Substituir por...", "Limpar"]}
                    onChange={setLossReasonMode}
                  />
                  {lossReasonMode === "Substituir por..." && (
                    <input
                      placeholder="Ex: Sem resposta"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 text-zinc-800"
                      type="text"
                      value={lossReasonValue}
                      onChange={e => setLossReasonValue(e.target.value)}
                    />
                  )}
                </div>
              )}

              {/* Etiquetas */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Etiquetas</label>
                <BulkFieldSelect
                  label="Etiquetas"
                  value={etiquetasMode}
                  options={["Manter valor atual", "Substituir", "Adicionar", "Limpar"]}
                  onChange={setEtiquetasMode}
                />
                {(etiquetasMode === "Substituir" || etiquetasMode === "Adicionar") && (
                  <div className="space-y-2">
                    {/* Render current selected labels */}
                    {selectedLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-50 border border-zinc-200 rounded-lg">
                        {selectedLabels.map(lid => {
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
                                type="button"
                                onClick={() => setSelectedLabels(prev => prev.filter(id => id !== lid))}
                                className="hover:bg-black/5 rounded-full p-0.5 animate-in fade-in"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="relative">
                      <input
                        placeholder="Digite e pressione Enter pra criar nova"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 text-zinc-800"
                        type="text"
                        value={labelInput}
                        onChange={e => setLabelInput(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && labelInput.trim()) {
                            e.preventDefault();
                            const existing = state.labels.find(l => l.name.toLowerCase() === labelInput.trim().toLowerCase());
                            if (existing) {
                              if (!selectedLabels.includes(existing.id)) {
                                setSelectedLabels(prev => [...prev, existing.id]);
                              }
                            } else {
                              const colors = ["#3B82F6", "#14B8A6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6"];
                              const randomColor = colors[Math.floor(Math.random() * colors.length)];
                              const newId = await addLabel({
                                id: `label_${Date.now()}`,
                                name: labelInput.trim(),
                                color: randomColor
                              });
                              if (newId) {
                                setSelectedLabels(prev => [...prev, newId]);
                              }
                            }
                            setLabelInput("");
                          }
                        }}
                      />
                      {labelInput.trim() && (
                        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden w-full max-h-36 overflow-y-auto">
                          {state.labels
                            .filter(l => l.name.toLowerCase().includes(labelInput.toLowerCase()) && !selectedLabels.includes(l.id))
                            .map(l => (
                              <button
                                key={l.id}
                                type="button"
                                onClick={() => {
                                  setSelectedLabels(prev => [...prev, l.id]);
                                  setLabelInput("");
                                }}
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-amber-50 transition-colors flex items-center justify-between text-zinc-805"
                              >
                                <span style={{ color: l.color }} className="font-semibold">{l.name}</span>
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Probabilidade */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Probabilidade</label>
                <BulkFieldSelect
                  label="Probabilidade"
                  value={probMode}
                  options={["Manter valor atual", "Substituir por...", "Limpar"]}
                  onChange={setProbMode}
                />
                {probMode === "Substituir por..." && (
                  <input
                    placeholder=""
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 text-zinc-800"
                    type="number"
                    min="0"
                    max="100"
                    value={probValue}
                    onChange={e => {
                      let val = parseInt(e.target.value, 10);
                      if (isNaN(val)) val = 0;
                      if (val > 100) val = 100;
                      if (val < 0) val = 0;
                      setProbValue(String(val));
                    }}
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

              {/* Campos personalizados */}
              {customFields.length > 0 && (
                <div className="pt-4 mt-4 border-t border-zinc-200">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Campos personalizados</h3>
                  <div className="space-y-4">
                    {customFields.map(field => {
                      const fMode = getCustomFieldMode(field.id);
                      return (
                        <div key={field.id} className="space-y-1.5">
                          <label className="block text-sm font-medium text-zinc-700">{field.label}</label>
                          <BulkFieldSelect
                            label={field.label}
                            value={fMode}
                            options={["Manter valor atual", "Substituir por...", "Limpar"]}
                            onChange={v => setCustomFieldMode(field.id, v)}
                          />
                          {fMode === "Substituir por..." && (
                            <input
                              placeholder=""
                              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 text-zinc-800"
                              type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                              value={getCustomFieldValue(field.id)}
                              onChange={e => setCustomFieldValue(field.id, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
            <footer className="border-t border-zinc-200 p-4">
              {acaoValue === "Excluir registros" ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={!bulkChanged}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
                >
                  Excluir {selectedIds.size} {selectedIds.size === 1 ? "negócio" : "negócios"}
                </button>
              ) : (
                <button
                  onClick={handleBulkSave}
                  disabled={!bulkChanged}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700"
                >
                  Editar {selectedIds.size} {selectedIds.size === 1 ? "negócio" : "negócios"}
                </button>
              )}
            </footer>
          </aside>
        </>
      )}

      {showDeleteConfirm && (
        <DeleteDealModal
          count={selectedIds.size}
          onConfirm={(reason, note) => handleBulkDelete(reason, note)}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
