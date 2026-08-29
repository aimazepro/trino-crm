// src/app/admin/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/feature-flags";

type WorkspaceDetail = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  featureFlags: Partial<Record<FeatureKey, boolean>>;
  createdAt: string;
  trialEndsAt: string | null;
};

type Usage = {
  members: { accepted: number; pending: number; suspended: number };
  telephony: {
    balanceCents: number;
    reservedCents: number;
    recentLedger: { id: string; kind: string; amountCents: number; description: string | null; createdAt: string }[];
  } | null;
  whatsappMessages30d: number;
  deals: { count: number; lastActivityAt: string | null };
};

const FEATURE_LABELS: Record<FeatureKey, string> = {
  whatsapp: "WhatsApp",
  voip: "VoIP / Telefonia",
  automacoes: "Automações",
  api_v1: "API pública (v1)",
  custom_fields: "Campos customizados",
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminWorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [features, setFeatures] = useState<Record<FeatureKey, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/workspaces/${id}`);
    if (res.ok) {
      const json = await res.json();
      setWorkspace(json.data.workspace);
      setUsage(json.data.usage);
      setFeatures(json.data.features);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch(`/api/admin/workspaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) load();
  };

  const toggleFeature = (key: FeatureKey, value: boolean) => {
    patch({ featureFlags: { [key]: value } });
  };

  const setStatus = (status: string) => {
    const question =
      status === "suspended"
        ? "Suspender este workspace? Membros perdem acesso ao app imediatamente (chaves de API v1, se houver, continuam ativas — ver backlog)."
        : status === "deleted"
          ? "Apagar este workspace? Corta acesso ao app na hora (reversível reativando o status; chaves de API v1, se houver, continuam ativas — ver backlog)."
          : "Reativar este workspace?";
    if (!confirm(question)) return;
    patch({ status });
  };

  if (loading) return <div className="max-w-3xl mx-auto text-center text-zinc-400 py-20">Carregando…</div>;
  if (!workspace || !usage || !features) {
    return <div className="max-w-3xl mx-auto text-center text-zinc-400 py-20">Workspace não encontrado</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => router.push("/admin")} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">{workspace.name}</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              {workspace.slug} · criado em {new Date(workspace.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
              workspace.status === "active" && "bg-emerald-50 text-emerald-700 border-emerald-200/60",
              workspace.status === "suspended" && "bg-red-50 text-red-700 border-red-200/60",
              workspace.status === "deleted" && "bg-zinc-100 text-zinc-500 border-zinc-200/60"
            )}
          >
            {workspace.status}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <select
            value={workspace.plan}
            onChange={(e) => patch({ plan: e.target.value })}
            disabled={saving}
            className="text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-none"
          >
            <option value="trial">Trial</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>

          {workspace.status !== "active" && (
            <button
              onClick={() => setStatus("active")}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100"
            >
              <CheckCircle2 size={14} /> Ativar
            </button>
          )}
          {workspace.status === "active" && (
            <button
              onClick={() => setStatus("suspended")}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 border border-zinc-200 rounded-lg hover:border-red-200 hover:bg-red-50"
            >
              <Ban size={14} /> Suspender
            </button>
          )}
          {workspace.status !== "deleted" && (
            <button
              onClick={() => setStatus("deleted")}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-500 border border-zinc-200 rounded-lg hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={14} /> Apagar
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Features</h3>
        <div className="grid grid-cols-2 gap-3">
          {FEATURE_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between px-3 py-2.5 border border-zinc-100 rounded-lg">
              <span className="text-sm font-medium text-zinc-700">{FEATURE_LABELS[key]}</span>
              <input
                type="checkbox"
                checked={features[key]}
                disabled={saving}
                onChange={(e) => toggleFeature(key, e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Uso</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase">Membros</p>
            <p className="text-sm font-bold text-zinc-800 mt-0.5">
              {usage.members.accepted} ativos · {usage.members.pending} pendentes · {usage.members.suspended} suspensos
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase">Mensagens WhatsApp (30d)</p>
            <p className="text-sm font-bold text-zinc-800 mt-0.5">{usage.whatsappMessages30d}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase">Negócios</p>
            <p className="text-sm font-bold text-zinc-800 mt-0.5">
              {usage.deals.count} · última atividade{" "}
              {usage.deals.lastActivityAt ? new Date(usage.deals.lastActivityAt).toLocaleDateString("pt-BR") : "—"}
            </p>
          </div>
        </div>

        {usage.telephony && (
          <div className="pt-4 border-t border-zinc-100">
            <p className="text-[11px] font-bold text-zinc-400 uppercase mb-2">
              Telefonia — saldo {centsToBRL(usage.telephony.balanceCents)} ({centsToBRL(usage.telephony.reservedCents)} reservado)
            </p>
            <div className="space-y-1">
              {usage.telephony.recentLedger.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{entry.description ?? entry.kind}</span>
                  <span className={cn("font-semibold", entry.amountCents < 0 ? "text-red-600" : "text-emerald-600")}>
                    {centsToBRL(entry.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
