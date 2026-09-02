"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Plus, Search, X } from "lucide-react";
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
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounts");
    const json = await res.json();
    setWorkspaces(res.ok ? json.data.workspaces : []);
    setOrphans(res.ok ? json.data.orphans : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mesma chamada que o detalhe do workspace já faz pros membros
  // (src/app/painel/(app)/contas/[id]/page.tsx) -- a conta órfã não tem
  // detalhe pra onde ir, então o botão precisa viver aqui, na única tela que
  // a mostra. Era o que o /admin/contas antigo fazia e o v2 tinha perdido.
  async function toggleOrphanBlock(userId: string, email: string | null, blocked: boolean) {
    const quem = email ?? "esta conta";
    if (
      !confirm(
        blocked
          ? `Desbloquear ${quem}?`
          : `Bloquear ${quem}? O acesso é cortado na próxima ação dela — o histórico dela continua assinado.`
      )
    )
      return;
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-zinc-900">Contas</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {workspaces.length} workspace(s) · {orphans.length} conta(s) sem workspace
          </p>
        </div>
        {/* §9: com o cadastro público fechado, o painel é um dos dois únicos
            lugares onde uma conta nasce (o outro é o convite). Sem este botão
            o onboarding de cliente novo exigiria curl. */}
        <button
          onClick={() => setShowCreate(true)}
          className="flex shrink-0 items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-[13px] font-bold rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <Plus size={16} /> Criar conta
        </button>
      </div>

      {error && (
        <p className="mb-4 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

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
                      <button
                        onClick={() => toggleOrphanBlock(o.id, o.email, o.blocked)}
                        disabled={busy}
                        className="rounded-lg border border-zinc-200 px-2.5 py-1 font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                      >
                        {o.blocked ? "Desbloquear" : "Bloquear"}
                      </button>
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

      {showCreate && (
        <CriarContaModal
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

/** Formulário mínimo de nascimento de conta: cria o usuário dono, o workspace
 * e o vínculo de admin numa chamada só (POST /api/admin/workspaces, que já
 * audita e já faz rollback se qualquer etapa falhar). */
function CriarContaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("trial");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, plan, ownerEmail, ownerPassword }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      // SLUG_TAKEN e EMAIL_EXISTS são os dois 409 esperados desta rota e já
      // vêm com a mensagem pronta em português; qualquer outro código cai no
      // mesmo caminho -- mostrar o que a API disse é sempre melhor do que um
      // "algo deu errado" genérico.
      setError(json?.error?.message ?? "Falha ao criar conta");
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-zinc-900">Criar conta</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da empresa"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-900"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug-do-workspace"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-900"
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
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-900"
          />
          <input
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            placeholder="Senha temporária (8+ caracteres)"
            type="text"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-900"
          />
        </div>

        {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200"
          >
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
