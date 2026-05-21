"use client";

import { useState, useEffect, useRef } from "react";
import { useCrm } from "@/contexts/crm-context";
import { MoreHorizontal, Pencil, Trophy, CircleX, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DEFAULT_COLUMNS } from "@/components/deal/customize-columns-modal";
import type { Deal } from "@/lib/crm-types";

interface KanbanListViewProps {
  pipelineId: string;
  statusFilter?: "Ativo" | "Ganho" | "Perdido";
  columns?: string[];
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

export function KanbanListView({ pipelineId, columns = DEFAULT_COLUMNS }: KanbanListViewProps) {
  const { state, markDealStatus, deleteDeal } = useCrm();
  const [activePipelineId, setActivePipelineId] = useState(pipelineId);
  const [stageFilter, setStageFilter] = useState("");
  const [statusLocalFilter, setStatusLocalFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownContainerRef = useRef<HTMLTableCellElement | null>(null);

  // Sync pipeline when prop changes
  useEffect(() => {
    setActivePipelineId(pipelineId);
    setStageFilter("");
  }, [pipelineId]);

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
    if (d.pipelineId !== activePipelineId) return false;
    if (statusLocalFilter === "aberto" && d.status !== "Ativo") return false;
    if (statusLocalFilter === "ganho" && d.status !== "Ganho") return false;
    if (statusLocalFilter === "perdido" && d.status !== "Perdido") return false;
    if (stageFilter && d.stageId !== stageFilter) return false;
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
        return <span className="text-sm text-zinc-650">João Paulo Olivera</span>;
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

  return (
    <div className="h-full flex flex-col bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">

      {/* Filter Bar */}
      <div className="flex items-center gap-3 border-b border-zinc-100 bg-white px-6 py-3 flex-wrap shrink-0">
        {/* Pipeline selector */}
        <select
          value={activePipelineId}
          onChange={e => { setActivePipelineId(e.target.value); setStageFilter(""); }}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-300 bg-white cursor-pointer"
        >
          {state.pipelines.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Stage filter */}
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-300 bg-white cursor-pointer"
        >
          <option value="">Todas as etapas</option>
          {pipeline.stages.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusLocalFilter}
          onChange={e => setStatusLocalFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-300 bg-white cursor-pointer"
        >
          <option value="todos">Todos os status</option>
          <option value="aberto">Abertos</option>
          <option value="ganho">Ganhos</option>
          <option value="perdido">Perdidos</option>
        </select>

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
                <button className="flex h-4 w-4 items-center justify-center rounded border border-zinc-300 hover:border-zinc-400 transition-colors mx-auto bg-white" />
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
            {filteredDeals.map(deal => (
              <tr
                key={deal.id}
                className="border-b border-zinc-200 hover:bg-zinc-50/70 transition-colors group h-10 cursor-pointer"
                onClick={() => window.location.href = `/negocios/${deal.id}`}
              >
                <td className="px-2 py-1.5 w-10 border-r border-zinc-100 text-center" onClick={e => e.stopPropagation()}>
                  <button className="flex h-4 w-4 items-center justify-center rounded border border-zinc-300 hover:border-zinc-400 transition-colors mx-auto bg-white" />
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
                        className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                        href={`/negocios/${deal.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                        Editar
                      </a>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50"
                        onClick={() => { markDealStatus(deal.id, "Ganho"); setOpenDropdownId(null); }}
                      >
                        <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                        Marcar como ganho
                      </button>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                        onClick={() => { markDealStatus(deal.id, "Perdido"); setOpenDropdownId(null); }}
                      >
                        <CircleX className="h-3.5 w-3.5" aria-hidden="true" />
                        Marcar como perdido
                      </button>
                      <div className="border-t border-zinc-100 mt-1 pt-1">
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                          onClick={() => { deleteDeal(deal.id); setOpenDropdownId(null); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}

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
  );
}
