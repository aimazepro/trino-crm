"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Key,
  Copy,
  Trash2,
  Check,
  CirclePlay,
  BookOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Permission = { label: string; key: string };

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  owner_name: string;
  created_at: string;
};

type UserRow = { id: string; full_name: string; role: string };

const ALL_PERMISSIONS: Permission[] = [
  { label: "Acesso total", key: "all" },
  { label: "Ler negocios", key: "read_deals" },
  { label: "Criar/editar negocios", key: "edit_deals" },
  { label: "Excluir negocios", key: "delete_deals" },
  { label: "Ler contatos", key: "read_contacts" },
  { label: "Criar/editar contatos", key: "edit_contacts" },
  { label: "Ler empresas", key: "read_companies" },
  { label: "Criar/editar empresas", key: "edit_companies" },
  { label: "Ler atividades", key: "read_activities" },
  { label: "Criar/editar atividades", key: "edit_activities" },
  { label: "Ler pipelines", key: "read_pipelines" },
  { label: "Ler campos custom", key: "read_custom_fields" },
  { label: "Criar campos custom", key: "create_custom_fields" },
  { label: "Ler usuarios", key: "read_users" },
];

async function hashKey(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function ApiKeysPage() {
  const supabase = createClient();

  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [formName, setFormName] = useState("");
  const [formOwner, setFormOwner] = useState("");
  const [formPerms, setFormPerms] = useState<Set<string>>(new Set(["all"]));

  // Load keys and users
  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setCurrentUserId(user.id);
    setFormOwner(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("workspace_id", (await supabase.from("profiles").select("workspace_id").eq("id", user.id).single()).data?.workspace_id)
      .order("full_name");
    setUsers(
      (profile ?? []).map((p: { id: string; full_name: string; role: string }) => ({
        id: p.id,
        full_name: p.full_name ?? "Usuário",
        role: p.role ?? "",
      }))
    );
    if (!formOwner) setFormOwner(user.id);

    const { data: keysData } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, permissions, owner_name, created_at")
      .eq("user_id", user.id)
      .eq("revoked", false)
      .order("created_at", { ascending: false });

    setKeys(keysData ?? []);
    setLoading(false);
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const togglePerm = (key: string) => {
    const next = new Set(formPerms);
    if (key === "all") {
      next.has("all") ? next.delete("all") : next.add("all");
      setFormPerms(next);
      return;
    }
    if (next.has("all")) next.delete("all");
    next.has(key) ? next.delete(key) : next.add(key);
    setFormPerms(next);
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const raw = `dmh_${crypto.randomUUID().replace(/-/g, "")}`;
    const keyHash = await hashKey(raw);
    const keyPrefix = raw.slice(0, 12);
    const ownerUser = users.find((u) => u.id === formOwner);
    const ownerName = ownerUser
      ? `${ownerUser.full_name}${ownerUser.role ? ` (${ownerUser.role.toUpperCase()})` : ""}`
      : "Usuário";
    const permissionsArr = Array.from(formPerms);

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        user_id: user.id,
        name: formName.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions: permissionsArr,
        owner_name: ownerName,
      })
      .select("id, name, key_prefix, permissions, owner_name, created_at")
      .single();

    setSaving(false);
    if (!error && data) {
      setKeys((prev) => [data, ...prev]);
      setNewRawKey(raw);
    }
    setFormName("");
    setFormPerms(new Set(["all"]));
    setShowForm(false);
  };

  const handleRevoke = async (id: string) => {
    await supabase.from("api_keys").update({ revoked: true }).eq("id", id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const handleCopyKey = () => {
    if (!newRawKey) return;
    navigator.clipboard.writeText(newRawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openForm = () => {
    setNewRawKey(null);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setFormName("");
    setFormPerms(new Set(["all"]));
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString("pt-BR")}, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">API Keys</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Gerencie chaves de acesso para integracoes externas (Facebook Ads, Zapier, etc)
            </p>
          </div>
          <button
            onClick={openForm}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova API Key
          </button>
        </div>

        {/* New key success banner */}
        {newRawKey && (
          <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-5">
            <div className="flex items-start gap-3">
              <Key className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800 mb-1">
                  API Key criada com sucesso
                </p>
                <p className="text-xs text-emerald-600 mb-3">
                  Copie esta chave agora. Ela nao sera mostrada novamente.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white rounded-lg px-3 py-2 text-sm font-mono text-zinc-800 border border-emerald-200 select-all">
                    {newRawKey}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <div className="mb-6 rounded-xl bg-white border border-zinc-200 p-5">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">Nova API Key</h3>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Nome</label>
                <input
                  placeholder="Ex: Facebook Ads, Zapier, Meu sistema..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                  type="text"
                />
              </div>

              {/* Owner */}
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">
                  Proprietario padrao
                </label>
                <p className="text-xs text-zinc-400 mb-2">
                  Negocios e atividades criados via esta key serao atribuidos a este usuario
                </p>
                <select
                  value={formOwner}
                  onChange={(e) => setFormOwner(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                >
                  {users.length > 0 ? (
                    users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                        {u.role ? ` (${u.role.toUpperCase()})` : ""}
                      </option>
                    ))
                  ) : (
                    <option value={currentUserId}>Você</option>
                  )}
                </select>
              </div>

              {/* Permissions */}
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">
                  Permissoes
                </label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {ALL_PERMISSIONS.map((perm) => {
                    const checked =
                      formPerms.has(perm.key) ||
                      (perm.key !== "all" && formPerms.has("all"));
                    const highlight = formPerms.has(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                          highlight
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                        }`}
                      >
                        <input
                          className="sr-only"
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerm(perm.key)}
                        />
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            highlight
                              ? "bg-amber-500 border-amber-500"
                              : "border-zinc-300"
                          }`}
                        >
                          {highlight && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        {perm.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={cancelForm}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!formName.trim() || saving}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 transition-colors disabled:opacity-50"
              >
                {saving ? "Criando..." : "Criar API Key"}
              </button>
            </div>
          </div>
        )}

        {/* Keys list */}
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          </div>
        ) : keys.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
              <Key className="h-7 w-7 text-zinc-400" />
            </div>
            <p className="text-sm font-semibold text-zinc-700">Nenhuma API key criada</p>
            <p className="text-xs text-zinc-400 max-w-xs">
              Crie uma API key para permitir que sistemas externos (Facebook Ads, Zapier, etc) se
              conectem ao seu CRM.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => {
              const perms = Array.isArray(k.permissions)
                ? k.permissions.filter((p) => p !== "all")
                : [];
              const isAll = Array.isArray(k.permissions) && k.permissions.includes("all");
              const permLabels = isAll
                ? ["Acesso total"]
                : perms.map(
                    (p) =>
                      ALL_PERMISSIONS.find((a) => a.key === p)?.label ?? p
                  );

              return (
                <div
                  key={k.id}
                  className="rounded-xl bg-white border border-zinc-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 mt-0.5">
                        <Key className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{k.name}</p>
                        <code className="text-xs text-zinc-400 font-mono">
                          {k.key_prefix}...
                        </code>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                          {k.owner_name && <span>Dono: {k.owner_name}</span>}
                          <span>Criada: {formatDate(k.created_at)}</span>
                        </div>
                        {permLabels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {permLabels.map((label) => (
                              <span
                                key={label}
                                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="rounded-lg p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Revogar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Promo cards */}
        <a
          className="mt-8 flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5 hover:bg-amber-100/50 transition-colors group"
          href="/ajuda/integracao-leads-externos"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 group-hover:bg-amber-200 transition-colors shrink-0">
            <CirclePlay className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-800 mb-0.5">
              Veja como integrar leads externos
            </h3>
            <p className="text-xs text-amber-600">
              Tutorial em video e guia passo a passo para receber leads do Facebook, Elementor,
              WordPress e outras plataformas.
            </p>
          </div>
        </a>

        <a
          className="mt-4 flex items-center gap-4 rounded-xl bg-blue-50 border border-blue-100 p-5 hover:bg-blue-100/50 transition-colors group"
          href="/configuracoes/api/docs"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors shrink-0">
            <BookOpen className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-0.5">Documentacao da API</h3>
            <p className="text-xs text-blue-600">
              Veja todos os endpoints, exemplos de uso e como integrar com Facebook Ads, Zapier e
              outros sistemas.
            </p>
          </div>
        </a>

      </div>
    </main>
  );
}
