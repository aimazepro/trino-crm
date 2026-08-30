"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Member = {
  userId: string | null;
  email: string;
  role: string;
  memberStatus: string;
  blocked: boolean;
  lastSignInAt: string | null;
};

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  subscriptionStatus: string;
  createdAt: string;
  trialEndsAt: string | null;
  members: Member[];
};

type OrphanRow = {
  id: string;
  email: string | null;
  createdAt: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  blocked: boolean;
};

const PLAN_LABEL: Record<string, string> = { trial: "Trial", pro: "Pro", business: "Business" };

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

export default function PainelContasPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [orphans, setOrphans] = useState<OrphanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [onlyOrphans, setOnlyOrphans] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounts?group=workspace");
    const json = await res.json();
    setWorkspaces(res.ok ? json.data.workspaces : []);
    setOrphans(res.ok ? json.data.orphans : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const needle = q.trim().toLowerCase();
  // A busca cobre e-mail de membro além de nome e slug: procurar pela pessoa
  // é o caso real de suporte ("fulano ligou reclamando").
  const visibleWorkspaces = onlyOrphans
    ? []
    : workspaces.filter((w) => {
        if (status && w.status !== status) return false;
        if (plan && w.plan !== plan) return false;
        if (!needle) return true;
        return (
          w.name.toLowerCase().includes(needle) ||
          (w.slug ?? "").toLowerCase().includes(needle) ||
          w.members.some((m) => m.email.toLowerCase().includes(needle))
        );
      });

  const visibleOrphans = orphans.filter(
    (o) => !needle || (o.email ?? "").toLowerCase().includes(needle)
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-black text-zinc-900">Contas</h2>
        <p className="text-sm text-zinc-500 mt-1">
          {workspaces.length} workspace(s) · {orphans.length} conta(s) sem workspace
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, slug ou e-mail de membro"
            className="w-72 pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-900"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none"
        >
          <option value="">Todo status</option>
          <option value="active">Ativo</option>
          <option value="suspended">Suspenso</option>
          <option value="deleted">Apagado</option>
        </select>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none"
        >
          <option value="">Todo plano</option>
          <option value="trial">Trial</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={onlyOrphans}
            onChange={(e) => setOnlyOrphans(e.target.checked)}
          />
          Só órfãs
        </label>
      </div>

      {loading && <p className="text-sm text-zinc-400">Carregando…</p>}

      {!loading && (
        <div className="space-y-3">
          {visibleWorkspaces.map((w) => {
            const isCollapsed = collapsed[w.id] ?? false;
            return (
              <div key={w.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => setCollapsed((prev) => ({ ...prev, [w.id]: !isCollapsed }))}
                      className="text-zinc-400 hover:text-zinc-900"
                      aria-label={isCollapsed ? "Expandir" : "Recolher"}
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <div className="min-w-0">
                      <Link
                        href={`/contas/${w.id}`}
                        className="font-bold text-zinc-900 hover:text-amber-600"
                      >
                        {w.name}
                      </Link>
                      <p className="text-xs text-zinc-400 truncate">
                        {w.slug ?? "sem slug"} · criado {fmtDate(w.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs shrink-0">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-bold text-zinc-600">
                      {PLAN_LABEL[w.plan] ?? w.plan}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 font-bold",
                        w.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : "bg-red-50 text-red-700 border-red-200/60"
                      )}
                    >
                      {w.status}
                    </span>
                    <span className="text-zinc-400">
                      {w.members.length} membro{w.members.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="border-t border-zinc-100 divide-y divide-zinc-50">
                    {w.members.length === 0 && (
                      <p className="px-11 py-2.5 text-xs text-zinc-400 italic">Sem membros</p>
                    )}
                    {w.members.map((m) => (
                      <div
                        key={m.email}
                        className="flex items-center justify-between px-11 py-2.5 text-sm"
                      >
                        <span className="text-zinc-800">{m.email}</span>
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span>{m.role}</span>
                          <span>{m.memberStatus}</span>
                          <span className={m.blocked ? "font-bold text-red-600" : "text-zinc-400"}>
                            {m.blocked ? "bloqueada" : "ativa"}
                          </span>
                          <span className="text-zinc-400">
                            último acesso {fmtDate(m.lastSignInAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {visibleOrphans.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <p className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-100 bg-zinc-50/80">
                Sem workspace
              </p>
              <div className="divide-y divide-zinc-50">
                {visibleOrphans.map((o) => (
                  <div key={o.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-zinc-800">{o.email ?? "—"}</span>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>cadastrou {fmtDate(o.createdAt)}</span>
                      <span>{o.emailConfirmedAt ? "confirmada" : "não confirmada"}</span>
                      <span>
                        {o.lastSignInAt ? `último acesso ${fmtDate(o.lastSignInAt)}` : "nunca entrou"}
                      </span>
                      <span className={o.blocked ? "font-bold text-red-600" : "text-zinc-400"}>
                        {o.blocked ? "bloqueada" : "ativa"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleWorkspaces.length === 0 && visibleOrphans.length === 0 && (
            <p className="text-sm text-zinc-400 py-8 text-center">Nada encontrado</p>
          )}
        </div>
      )}
    </div>
  );
}
