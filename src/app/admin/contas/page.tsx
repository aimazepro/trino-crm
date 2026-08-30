"use client";

import { useEffect, useState, useCallback } from "react";
import { Ban, CheckCircle2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type AccountRow = {
  id: string;
  email: string | null;
  createdAt: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  blocked: boolean;
  workspaces: { workspaceId: string; name: string; slug: string | null; workspaceStatus: string; role: string; memberStatus: string }[];
};

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounts");
    const json = await res.json();
    setAccounts(res.ok ? json.data.accounts : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBlock = async (account: AccountRow) => {
    const question = account.blocked
      ? `Desbloquear ${account.email}?`
      : `Bloquear ${account.email}? Acesso é cortado na próxima ação do usuário.`;
    if (!confirm(question)) return;
    setBusyId(account.id);
    const res = await fetch(`/api/admin/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: !account.blocked }),
    });
    setBusyId(null);
    if (res.ok) load();
    else {
      const json = await res.json().catch(() => null);
      alert(json?.error?.message ?? "Falha ao atualizar conta");
    }
  };

  const filtered = q
    ? accounts.filter((a) => a.email?.toLowerCase().includes(q.trim().toLowerCase()))
    : accounts;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Contas</h2>
          <p className="text-sm text-zinc-500 mt-1">{accounts.length} conta(s) — inclui contas sem workspace</p>
        </div>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por e-mail"
          className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
        />
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Workspace</th>
              <th className="px-4 py-3">Confirmado</th>
              <th className="px-4 py-3">Criado em</th>
              <th className="px-4 py-3">Último login</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                  Nenhuma conta encontrada
                </td>
              </tr>
            )}
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-zinc-50 hover:bg-zinc-50/50 align-top">
                <td className="px-4 py-3 font-semibold text-zinc-900">{a.email ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {a.workspaces.length === 0 ? (
                    <span className="text-zinc-400 italic">sem workspace</span>
                  ) : (
                    <div className="space-y-1">
                      {a.workspaces.map((w) => (
                        <div key={w.workspaceId}>
                          <a href={`/admin/${w.workspaceId}`} className="font-medium text-zinc-800 hover:text-amber-600">
                            {w.name}
                          </a>{" "}
                          <span className="text-xs text-zinc-400">
                            ({w.role}, {w.memberStatus}
                            {w.workspaceStatus !== "active" ? `, workspace ${w.workspaceStatus}` : ""})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">{a.emailConfirmedAt ? "Sim" : "Não"}</td>
                <td className="px-4 py-3 text-zinc-500">{fmt(a.createdAt)}</td>
                <td className="px-4 py-3 text-zinc-500">{fmt(a.lastSignInAt)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                      a.blocked ? "bg-red-50 text-red-700 border-red-200/60" : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                    )}
                  >
                    {a.blocked ? "bloqueada" : "ativa"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleBlock(a)}
                    disabled={busyId === a.id}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border disabled:opacity-40",
                      a.blocked
                        ? "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                        : "text-red-600 border-zinc-200 hover:border-red-200 hover:bg-red-50"
                    )}
                  >
                    {a.blocked ? (
                      <>
                        <CheckCircle2 size={14} /> Desbloquear
                      </>
                    ) : (
                      <>
                        <Ban size={14} /> Bloquear
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
