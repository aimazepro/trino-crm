"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// As listas chegam vazias e os *Count preenchidos quando o papel do operador
// não tem "read_customer_data" (ver o comentário em
// src/app/api/admin/dashboard/route.ts). Os dois formatos são legítimos, então
// a tela renderiza os dois -- nunca "Nenhum" em cima de um número > 0.
type Stats = {
  workspaces: { total: number; active: number; suspended: number; deleted: number; trial: number };
  trialsExpiring: { id: string; name: string; slug: string | null; trialEndsAt: string }[];
  trialsExpiringCount: number;
  stalled: { id: string; name: string; slug: string | null; lastActivityAt: string }[];
  stalledCount: number;
  orphanAccounts: { id: string; email: string | null; createdAt: string }[];
  orphanAccountsCount: number;
  telephony: { balanceCents: number; reservedCents: number };
  telephonySpentMonthCents: number;
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">{title}</h3>
      {children}
    </div>
  );
}

/** Lista vazia com contagem > 0 = o papel só alcança o agregado. Dizer isso é
 * mais honesto do que mostrar "Nenhum" pra quem tem 3 trials vencendo. */
function ListaOuContagem({ vazia, total }: { vazia: boolean; total: number }) {
  if (!vazia) return null;
  if (total === 0) return <p className="text-xs text-zinc-400">Nenhum.</p>;
  return (
    <div>
      <p className="text-3xl font-black text-zinc-900">{total}</p>
      <p className="text-xs text-zinc-400 mt-1">
        O detalhe exige um papel com acesso a dado de cliente.
      </p>
    </div>
  );
}

export default function PainelDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/dashboard");
      const json = await res.json();
      setStats(res.ok ? json.data : null);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-zinc-400">Carregando…</p>;
  if (!stats) return <p className="text-sm text-red-600">Falha ao carregar os números.</p>;

  return (
    <div className="max-w-5xl mx-auto grid gap-4 md:grid-cols-2">
      <Card title="Contas">
        <div className="flex items-baseline gap-4">
          <span className="text-3xl font-black text-zinc-900">{stats.workspaces.total}</span>
          <span className="text-sm text-zinc-500">
            {stats.workspaces.active} ativas · {stats.workspaces.suspended} suspensas ·{" "}
            {stats.workspaces.trial} em trial
          </span>
        </div>
      </Card>

      <Card title="Telefonia">
        <p className="text-sm text-zinc-700">Saldo somado: {money(stats.telephony.balanceCents)}</p>
        <p className="text-sm text-zinc-500">Gasto no mês: {money(stats.telephonySpentMonthCents)}</p>
      </Card>

      <Card title="Trials vencendo em 7 dias">
        <ListaOuContagem vazia={stats.trialsExpiring.length === 0} total={stats.trialsExpiringCount} />
        {stats.trialsExpiring.map((w) => (
          <Link
            key={w.id}
            href={`/contas/${w.id}`}
            className="flex items-center justify-between py-1.5 text-sm hover:text-amber-600"
          >
            <span>{w.name}</span>
            <span className="text-xs text-zinc-400">vence {fmtDate(w.trialEndsAt)}</span>
          </Link>
        ))}
      </Card>

      <Card title="Contas paradas (14+ dias)">
        <ListaOuContagem vazia={stats.stalled.length === 0} total={stats.stalledCount} />
        {stats.stalled.map((w) => (
          <Link
            key={w.id}
            href={`/contas/${w.id}`}
            className="flex items-center justify-between py-1.5 text-sm hover:text-amber-600"
          >
            <span>{w.name}</span>
            <span className="text-xs text-zinc-400">último sinal {fmtDate(w.lastActivityAt)}</span>
          </Link>
        ))}
      </Card>

      <Card title="Contas órfãs (cadastro que não converteu)">
        <ListaOuContagem vazia={stats.orphanAccounts.length === 0} total={stats.orphanAccountsCount} />
        {stats.orphanAccounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-zinc-700">{a.email ?? "—"}</span>
            <span className="text-xs text-zinc-400">cadastrou {fmtDate(a.createdAt)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
