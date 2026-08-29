"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  memberCount: number;
  createdAt: string;
  trialEndsAt: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  suspended: "bg-red-50 text-red-700 border-red-200/60",
  deleted: "bg-zinc-100 text-zinc-500 border-zinc-200/60",
};

const PLAN_LABELS: Record<string, string> = { trial: "Trial", pro: "Pro", business: "Business" };

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/admin/workspaces?${params.toString()}`);
    const json = await res.json();
    setWorkspaces(res.ok ? json.data.workspaces : []);
    setLoading(false);
  }, [q, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Workspaces</h2>
          <p className="text-sm text-zinc-500 mt-1">{workspaces.length} workspace(s)</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-[13px] font-bold rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <Plus size={16} /> Criar workspace
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou slug"
            className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-zinc-200 rounded-lg px-2.5 py-2 outline-none"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="suspended">Suspenso</option>
          <option value="deleted">Apagado</option>
        </select>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Membros</th>
              <th className="px-4 py-3">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && workspaces.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  Nenhum workspace encontrado
                </td>
              </tr>
            )}
            {workspaces.map((w) => (
              <tr key={w.id} className="border-t border-zinc-50 hover:bg-zinc-50/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/${w.id}`} className="font-semibold text-zinc-900 hover:text-amber-600">
                    {w.name}
                  </Link>
                  <div className="text-xs text-zinc-400">{w.slug}</div>
                </td>
                <td className="px-4 py-3 text-zinc-600">{PLAN_LABELS[w.plan] ?? w.plan}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                      STATUS_BADGE[w.status] ?? STATUS_BADGE.deleted
                    )}
                  >
                    {w.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600">{w.memberCount}</td>
                <td className="px-4 py-3 text-zinc-500">{new Date(w.createdAt).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateWorkspaceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateWorkspaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("trial");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, plan, ownerEmail, ownerPassword }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Falha ao criar workspace");
      return;
    }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-900">Criar workspace</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug-do-workspace"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
          />
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none"
          >
            <option value="trial">Trial</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
          <input
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="E-mail do dono"
            type="email"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
          />
          <input
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            placeholder="Senha temporária (8+ caracteres)"
            type="text"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
          />
        </div>

        {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !name || !slug || !ownerEmail || ownerPassword.length < 8}
            className="px-4 py-2 bg-zinc-900 text-white text-[13px] font-bold rounded-lg hover:bg-zinc-800 disabled:opacity-40"
          >
            {saving ? "Criando…" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
