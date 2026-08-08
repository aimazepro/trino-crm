"use client";

import { useMemo, useState } from "react";
import { GitMerge, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import type { Deal } from "@/lib/crm-types";

interface MergeDealModalProps {
  currentDeal: Deal;
  onMerged: () => void;
  onCancel: () => void;
}

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function MergeDealModal({ currentDeal, onMerged, onCancel }: MergeDealModalProps) {
  const { state, mergeDeals } = useCrm();
  const { map: ownerNameMap } = useOwnerNameMap();
  const [query, setQuery] = useState("");
  const [otherId, setOtherId] = useState<string | null>(null);
  const [conflictWinner, setConflictWinner] = useState<"current" | "other">("current");
  const [merging, setMerging] = useState(false);

  const other = state.deals.find(d => d.id === otherId) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.deals
      .filter(d => !d.deletedAt && d.id !== currentDeal.id && d.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, state.deals, currentDeal.id]);

  const describe = (d: Deal) => {
    const pipeline = state.pipelines.find(p => p.id === d.pipelineId);
    const stage = pipeline?.stages.find(s => s.id === d.stageId);
    const company = state.companies.find(c => c.id === d.companyId);
    return [stage?.name, company?.name].filter(Boolean).join(" · ");
  };

  type Row = { label: string; current: string; other: string; result: string; pickable: boolean };

  const rows: Row[] = useMemo(() => {
    const pipelineName = (d: Deal) => state.pipelines.find(p => p.id === d.pipelineId)?.name ?? "-";
    const stageName = (d: Deal) => {
      const pipeline = state.pipelines.find(p => p.id === d.pipelineId);
      return pipeline?.stages.find(s => s.id === d.stageId)?.name ?? "-";
    };
    const companyName = (d: Deal) => state.companies.find(c => c.id === d.companyId)?.name ?? "-";
    const contactName = (d: Deal) => state.contacts.find(c => c.id === d.contactId)?.name ?? "-";
    const labelNames = (d: Deal) => d.labels.length
      ? d.labels.map(id => state.labels.find(l => l.id === id)?.name).filter(Boolean).join(", ")
      : "-";
    const ownerName = (d: Deal) => ownerNameMap[d.ownerId ?? ""] || "-";
    const createdAt = (d: Deal) => d.createdAt
      ? new Date(d.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
      : "-";

    const build = (label: string, get: (d: Deal) => string, pickable = true): Row => {
      const c = get(currentDeal);
      const o = other ? get(other) : "-";
      const result = !other ? "-" : (c === o ? c : (conflictWinner === "current" ? c : o));
      return { label, current: c, other: o, result, pickable };
    };

    return [
      build("Título", d => d.title),
      build("Proprietário", ownerName),
      build("Funil", pipelineName),
      build("Etapa", stageName),
      build("Status", d => d.status),
      build("Valor", d => currency(d.value)),
      build("Empresa", companyName),
      build("Contato", contactName),
      build("Etiquetas", labelNames),
      build("Criado em", createdAt, false),
    ];
  }, [currentDeal, other, conflictWinner, state.pipelines, state.companies, state.contacts, state.labels, ownerNameMap]);

  const handleMerge = async () => {
    if (!other) return;
    setMerging(true);
    const winner = conflictWinner === "current" ? currentDeal : other;
    const resultFields: Partial<Deal> = {
      title: winner.title, ownerId: winner.ownerId, pipelineId: winner.pipelineId, stageId: winner.stageId,
      status: winner.status, value: winner.value, companyId: winner.companyId, contactId: winner.contactId,
      labels: winner.labels,
    };
    await mergeDeals(currentDeal.id, other.id, resultFields);
    setMerging(false);
    onMerged();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in" onClick={onCancel}>
      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 shrink-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <GitMerge className="h-5 w-5 text-zinc-400" aria-hidden="true" /> Mesclar negócios
          </h2>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-50 transition-colors">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Todas as atividades, notas, e-mails, conversas de WhatsApp, ligações, produtos e contatos dos dois negócios
            serão transferidos para o negócio mesclado. O outro negócio será arquivado e um administrador pode restaurá-lo depois.
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  <th className="w-32 px-4 py-3 text-left font-medium text-zinc-500">Campo</th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-900">
                    {currentDeal.title}
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">este negócio</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    {other ? (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">{other.title}</span>
                        <button
                          onClick={() => { setOtherId(null); setQuery(""); }}
                          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 transition-colors"
                          title="Trocar negócio"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                        <input
                          value={query}
                          onChange={e => setQuery(e.target.value)}
                          placeholder="Buscar negócio..."
                          className="w-full rounded-lg border border-zinc-200 py-1.5 pl-8 pr-2 text-sm font-normal focus:border-zinc-400 focus:outline-none"
                        />
                        {results.length > 0 && (
                          <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full min-w-52 overflow-y-auto rounded-xl border border-zinc-100 bg-white shadow-lg">
                            {results.map(d => (
                              <button
                                key={d.id}
                                onClick={() => { setOtherId(d.id); setQuery(""); }}
                                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-50 transition-colors"
                              >
                                <span className="font-medium text-zinc-800">{d.title}</span>
                                <span className="text-xs text-zinc-400">{describe(d)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-900 bg-emerald-50/50">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.label} className="border-b border-zinc-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-zinc-500">{row.label}</td>
                    <td className="px-4 py-2.5 text-zinc-800">{row.current}</td>
                    <td className={cn("px-4 py-2.5", other ? "text-zinc-800" : "text-zinc-300")}>{row.other}</td>
                    <td className="px-4 py-2.5 bg-emerald-50/40 font-medium text-zinc-900">{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {other && (
            <div className="mt-4 flex flex-wrap items-center gap-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm">
              <span className="font-semibold text-amber-800">Em caso de conflito</span>
              <label className="flex cursor-pointer items-center gap-2 text-zinc-700">
                <input
                  className="h-4 w-4 accent-blue-600" type="radio" name="conflict-winner"
                  checked={conflictWinner === "current"} onChange={() => setConflictWinner("current")}
                />
                Manter dados de <strong>{currentDeal.title}</strong>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-zinc-700">
                <input
                  className="h-4 w-4 accent-blue-600" type="radio" name="conflict-winner"
                  checked={conflictWinner === "other"} onChange={() => setConflictWinner("other")}
                />
                Manter dados de <strong>{other.title}</strong>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4 shrink-0">
          <button onClick={onCancel} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            Fechar
          </button>
          <button
            onClick={handleMerge}
            disabled={!other || merging}
            className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {merging ? "Mesclando..." : "Mesclar"}
          </button>
        </div>
      </div>
    </div>
  );
}
