"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCrm } from "@/contexts/crm-context";
import { MoreHorizontal, Search, Edit2, Trophy, XCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface KanbanListViewProps {
  pipelineId: string;
}

function RowMenu({
  dealId,
  onEdit,
  onGanho,
  onPerdido,
  onExcluir,
}: {
  dealId: string;
  onEdit: () => void;
  onGanho: () => void;
  onPerdido: () => void;
  onExcluir: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-md hover:bg-zinc-100 transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 bg-white border border-zinc-200 rounded-xl shadow-xl w-48 py-1 text-[13px]">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
            className="flex items-center gap-2.5 w-full px-4 py-2 text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <Edit2 size={14} className="text-zinc-400" /> Editar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onGanho(); }}
            className="flex items-center gap-2.5 w-full px-4 py-2 text-green-600 hover:bg-green-50 transition-colors"
          >
            <Trophy size={14} className="text-green-500" /> Marcar como ganho
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onPerdido(); }}
            className="flex items-center gap-2.5 w-full px-4 py-2 text-red-500 hover:bg-red-50 transition-colors"
          >
            <XCircle size={14} className="text-red-400" /> Marcar como perdido
          </button>
          <div className="my-1 border-t border-zinc-100" />
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onExcluir(); }}
            className="flex items-center gap-2.5 w-full px-4 py-2 text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} className="text-red-400" /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}

export function KanbanListView({ pipelineId }: KanbanListViewProps) {
  const router = useRouter();
  const { state, markDealStatus, deleteDeal } = useCrm();
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const pipeline = state.pipelines.find(p => p.id === pipelineId);
  if (!pipeline) return null;

  const deals = state.deals.filter(d => {
    if (d.pipelineId !== pipelineId) return false;
    if (stageFilter !== "all" && d.stageId !== stageFilter) return false;
    if (statusFilter !== "all") {
      const map: Record<string, string> = { ativo: "Ativo", ganho: "Ganho", perdido: "Perdido" };
      if (d.status !== map[statusFilter]) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const company = state.companies.find(c => c.id === d.companyId);
      const contact = state.contacts.find(c => c.id === d.contactId);
      if (!d.title.toLowerCase().includes(q) &&
          !company?.name.toLowerCase().includes(q) &&
          !contact?.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

      {/* Secondary Filter Bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50 shrink-0 flex-wrap">
        <select
          value={pipelineId}
          disabled
          className="bg-white border border-gray-200 text-gray-700 text-[13px] font-medium rounded-lg px-3 py-1.5 outline-none"
        >
          <option>{pipeline.name}</option>
        </select>
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="bg-white border border-gray-200 text-gray-700 text-[13px] font-medium rounded-lg px-3 py-1.5 outline-none hover:border-gray-300"
        >
          <option value="all">Todas as etapas</option>
          {pipeline.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 text-gray-700 text-[13px] font-medium rounded-lg px-3 py-1.5 outline-none hover:border-gray-300"
        >
          <option value="all">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="ganho">Ganhos</option>
          <option value="perdido">Perdidos</option>
        </select>
        <button className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-[13px] font-medium rounded-lg px-3 py-1.5 hover:bg-gray-50">
          <div className="w-2 h-2 rounded-full bg-gray-400" /> Etiqueta
        </button>
        <div className="flex-1 relative min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar negócio..."
            className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-[13px] outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/80 sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="p-3 w-10 text-center"><input type="checkbox" className="rounded border-gray-300" /></th>
              <th className="p-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Título</th>
              <th className="p-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Valor</th>
              <th className="p-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Etapa</th>
              <th className="p-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pipeline</th>
              <th className="p-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Empresa</th>
              <th className="p-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Contato</th>
              <th className="p-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Proprietário</th>
              <th className="p-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="p-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {deals.map(deal => {
              const stage = pipeline.stages.find(s => s.id === deal.stageId);
              const company = state.companies.find(c => c.id === deal.companyId);
              const contact = state.contacts.find(c => c.id === deal.contactId);

              return (
                <tr
                  key={deal.id}
                  className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                  onClick={() => router.push(`/negocios/${deal.id}`)}
                >
                  <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-gray-300" />
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-gray-900 text-[13px] group-hover:text-amber-600 transition-colors">
                      {deal.title}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-medium text-gray-900 text-[13px]">
                      {deal.value > 0 ? deal.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 truncate max-w-[130px]">
                      {stage?.name}
                    </span>
                  </td>
                  <td className="p-3 text-[13px] text-gray-500 font-medium">{pipeline.name}</td>
                  <td className="p-3 text-[13px] text-gray-700 font-medium">{company?.name || "-"}</td>
                  <td className="p-3 text-[13px] text-gray-500 font-medium">{contact?.name || "-"}</td>
                  <td className="p-3 text-[13px] text-gray-500 font-medium">Pixeo Digital Business</td>
                  <td className="p-3">
                    <span className={cn(
                      "px-2 py-0.5 text-[11px] font-semibold rounded-full",
                      deal.status === "Ativo" ? "bg-amber-50 text-amber-600" :
                      deal.status === "Ganho" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                    )}>
                      {deal.status === "Ativo" ? "Aberto" : deal.status}
                    </span>
                  </td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <RowMenu
                      dealId={deal.id}
                      onEdit={() => router.push(`/negocios/${deal.id}`)}
                      onGanho={() => markDealStatus(deal.id, "Ganho")}
                      onPerdido={() => markDealStatus(deal.id, "Perdido")}
                      onExcluir={() => deleteDeal(deal.id)}
                    />
                  </td>
                </tr>
              );
            })}

            {deals.length === 0 && (
              <tr>
                <td colSpan={10} className="p-12 text-center text-[13px] font-medium text-gray-400">
                  Nenhum negócio encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
