"use client";

import { useEffect, useState } from "react";

type Entry = {
  id: number;
  actorEmail: string | null;
  actorRole: string | null;
  actorVia: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  metadata: unknown;
  createdAt: string;
};

export default function PainelAuditoriaPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/audit?limit=200");
      const json = await res.json();
      setEntries(res.ok ? json.data.entries : []);
      setLoading(false);
    })();
  }, []);

  const needle = q.trim().toLowerCase();
  const visible = needle
    ? entries.filter(
        (e) =>
          e.action.toLowerCase().includes(needle) ||
          (e.actorEmail ?? "").toLowerCase().includes(needle) ||
          (e.targetLabel ?? "").toLowerCase().includes(needle)
      )
    : entries;

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-xl font-black text-zinc-900 mb-1">Auditoria</h2>
      <p className="text-sm text-zinc-500 mb-4">{entries.length} ação(ões) registrada(s)</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filtrar por ação, operador ou alvo"
        className="w-80 px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-900 mb-4"
      />

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Operador</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Alvo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">Carregando…</td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">Nada registrado</td>
              </tr>
            )}
            {visible.map((e) => (
              <tr key={e.id} className="border-t border-zinc-50">
                <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-2.5 text-zinc-700">
                  {e.actorEmail ?? "token"}
                  <span className="text-xs text-zinc-400"> · {e.actorRole}</span>
                </td>
                <td className="px-4 py-2.5 font-semibold text-zinc-900">{e.action}</td>
                <td className="px-4 py-2.5 text-zinc-600">
                  {e.targetLabel ?? e.targetId ?? "—"}
                  {e.targetType && <span className="text-xs text-zinc-400"> ({e.targetType})</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
