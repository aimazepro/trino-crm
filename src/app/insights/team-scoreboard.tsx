"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OwnerBadge } from "@/components/team/owner-badge";
import { cn } from "@/lib/utils";

interface Row {
  user_id: string;
  name: string;
  deals_won: number;
  value_won: number;
  deals_open: number;
  activities_done: number;
  calls_made: number;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Placar do time. Visível para todos os papéis de propósito: o vendedor vê o
 * detalhe só dele, mas o comparativo agregado é o que dá contexto ao número
 * dele. Vem da RPC porque a RLS impede montar isso no cliente.
 */
export function TeamScoreboard({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase.rpc("team_scoreboard", {
        period_start: periodStart,
        period_end: periodEnd,
      });
      if (cancelled) return;
      if (err) setError(err.message);
      else setRows((data ?? []) as Row[]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [periodStart, periodEnd]);

  if (loading) return <div className="p-6 text-xs text-zinc-400">Carregando placar...</div>;
  if (error) return <div className="p-6 text-xs text-red-500">Não foi possível carregar o placar: {error}</div>;
  if (rows.length === 0) return <div className="p-6 text-xs text-zinc-400">Nenhum membro ativo no período.</div>;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h3 className="text-sm font-bold text-zinc-900">Placar do time</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80">
              {["", "VENDEDOR", "GANHOS", "VALOR", "ABERTOS", "ATIVIDADES", "LIGAÇÕES"].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r, i) => (
              <tr key={r.user_id} className="hover:bg-zinc-50/30">
                <td className={cn("px-4 py-3 text-xs font-bold w-8", i === 0 ? "text-amber-500" : "text-zinc-300")}>
                  {i + 1}
                </td>
                <td className="px-4 py-3"><OwnerBadge ownerId={r.user_id} size="md" /></td>
                <td className="px-4 py-3 text-[13px] font-bold text-zinc-800">{r.deals_won}</td>
                <td className="px-4 py-3 text-[13px] font-bold text-emerald-600">{brl(Number(r.value_won))}</td>
                <td className="px-4 py-3 text-[13px] text-zinc-500">{r.deals_open}</td>
                <td className="px-4 py-3 text-[13px] text-zinc-500">{r.activities_done}</td>
                <td className="px-4 py-3 text-[13px] text-zinc-500">{r.calls_made}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
