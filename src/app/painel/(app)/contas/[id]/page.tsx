"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Detail = {
  workspace: {
    id: string;
    name: string;
    slug: string | null;
    plan: string;
    status: string;
    featureFlags: Record<string, boolean>;
    createdAt: string;
    trialEndsAt: string | null;
  };
  usage: {
    members: { accepted: number; pending: number; suspended: number };
    telephony: { balanceCents: number; reservedCents: number } | null;
    whatsappMessages30d: number;
    deals: { count: number; lastActivityAt: string | null };
  };
  features: Record<string, boolean>;
  members: { userId: string | null; email: string; role: string; memberStatus: string; blocked: boolean }[];
  billing: {
    plan: string;
    subscriptionStatus: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: string | null;
  };
  audit: { id: number; actorEmail: string | null; action: string; targetLabel: string | null; createdAt: string }[];
};

const PLANS = ["trial", "pro", "business"] as const;
const STATUSES = ["active", "suspended", "deleted"] as const;

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

export default function PainelContaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/workspaces/${id}`);
    const json = await res.json();
    setDetail(res.ok ? json.data : null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/workspaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? "Falha ao atualizar");
      return;
    }
    load();
  }

  async function toggleMemberBlock(userId: string, email: string, blocked: boolean) {
    if (!confirm(blocked ? `Desbloquear ${email}?` : `Bloquear ${email}? O acesso é cortado na próxima ação dela — o histórico dela continua assinado.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: !blocked }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? "Falha ao atualizar conta");
      return;
    }
    load();
  }

  if (loading) return <p className="text-sm text-zinc-400">Carregando…</p>;
  if (!detail) return <p className="text-sm text-red-600">Conta não encontrada.</p>;

  const { workspace, usage, features, members, billing, audit } = detail;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Link href="/contas" className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900">
        <ArrowLeft size={14} /> Contas
      </Link>

      {error && (
        <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <section className="bg-white border border-zinc-200 rounded-xl p-4">
        <h2 className="text-lg font-black text-zinc-900">{workspace.name}</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {workspace.slug ?? "sem slug"} · {workspace.id} · criado {fmt(workspace.createdAt)}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select
            value={workspace.plan}
            disabled={busy}
            onChange={(e) => patch({ plan: e.target.value })}
            className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none"
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={workspace.status}
            disabled={busy}
            onChange={(e) => patch({ status: e.target.value })}
            className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">Membros</h3>
        <div className="divide-y divide-zinc-50">
          {members.map((m) => (
            <div key={m.email} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="text-zinc-800">{m.email}</p>
                <p className="text-xs text-zinc-400">{m.role} · {m.memberStatus}</p>
              </div>
              {m.userId && (
                <button
                  disabled={busy}
                  onClick={() => toggleMemberBlock(m.userId!, m.email, m.blocked)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg border disabled:opacity-40",
                    m.blocked
                      ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                      : "text-red-600 border-zinc-200 hover:border-red-200 hover:bg-red-50"
                  )}
                >
                  {m.blocked ? "Desbloquear" : "Bloquear"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">Features</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(features).map(([key, enabled]) => (
            <button
              key={key}
              disabled={busy}
              onClick={() => patch({ featureFlags: { [key]: !enabled } })}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg border disabled:opacity-40",
                enabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                  : "bg-zinc-50 text-zinc-500 border-zinc-200"
              )}
            >
              {key}: {enabled ? "on" : "off"}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">Uso</h3>
          <p className="text-zinc-600">Membros aceitos: {usage.members.accepted}</p>
          <p className="text-zinc-600">Negócios: {usage.deals.count}</p>
          <p className="text-zinc-600">WhatsApp (30d): {usage.whatsappMessages30d}</p>
          <p className="text-zinc-600">
            Telefonia: {usage.telephony ? money(usage.telephony.balanceCents) : "sem conta"}
          </p>
          <p className="text-zinc-400 text-xs mt-1">
            Última atividade em negócios: {fmt(usage.deals.lastActivityAt)}
          </p>
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">Cobrança</h3>
          <p className="text-zinc-600">Plano: {billing.plan}</p>
          <p className="text-zinc-600">
            Stripe:{" "}
            {billing.stripeCustomerId
              ? `${billing.stripeCustomerId} (${billing.subscriptionStatus})`
              : "não conectado"}
          </p>
          <p className="text-zinc-400 text-xs mt-1">
            {billing.subscriptionStatus === "manual"
              ? "Plano definido manualmente no painel."
              : `Período atual até ${fmt(billing.currentPeriodEnd)}`}
          </p>
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">
          Últimas ações nesta conta
        </h3>
        {audit.length === 0 && <p className="text-xs text-zinc-400">Nenhuma ação registrada.</p>}
        <div className="divide-y divide-zinc-50">
          {audit.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2 text-xs">
              <span className="font-semibold text-zinc-700">{a.action}</span>
              <span className="text-zinc-400">
                {a.actorEmail ?? "token"} · {fmt(a.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
