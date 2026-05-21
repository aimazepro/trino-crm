"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Key, Copy, Trash2, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Permission = { label: string; key: string };

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  revoked: boolean;
  created_at: string;
};

const ALL_PERMISSIONS: Permission[] = [
  { label: "Ler negócios", key: "read_deals" },
  { label: "Excluir negócios", key: "delete_deals" },
  { label: "Criar/editar negócios", key: "edit_deals" },
  { label: "Criar/editar contatos", key: "edit_contacts" },
  { label: "Ler contatos", key: "read_contacts" },
  { label: "Criar/editar empresas", key: "edit_companies" },
  { label: "Ler empresas", key: "read_companies" },
  { label: "Criar/editar atividades", key: "edit_activities" },
  { label: "Ler atividades", key: "read_activities" },
  { label: "Ler campos custom", key: "read_custom_fields" },
  { label: "Ler pipelines", key: "read_pipelines" },
  { label: "Ler usuários", key: "read_users" },
  { label: "Criar campos custom", key: "create_custom_fields" },
  { label: "Criar usuários", key: "create_users" },
];

const EMPTY_FORM = { nickname: "", accessTotal: true, permissions: new Set<string>() };

async function hashKey(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function ApiKeysPage() {
  const supabase = createClient();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, permissions: new Set<string>() });
  const [copied, setCopied] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, revoked, created_at")
      .eq("user_id", user.id)
      .eq("revoked", false)
      .order("created_at", { ascending: false });

    setKeys(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const togglePermission = (key: string) => {
    if (form.accessTotal) return;
    const next = new Set(form.permissions);
    next.has(key) ? next.delete(key) : next.add(key);
    setForm({ ...form, permissions: next });
  };

  const toggleAccessTotal = (checked: boolean) => {
    setForm({ ...form, accessTotal: checked, permissions: new Set() });
  };

  const handleCreate = async () => {
    if (!form.nickname.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const raw = `dm_${crypto.randomUUID().replace(/-/g, "")}`;
    const keyHash = await hashKey(raw);
    const keyPrefix = raw.slice(0, 8);

    const { data, error } = await supabase.from("api_keys").insert({
      user_id: user.id,
      name: form.nickname.trim(),
      key_hash: keyHash,
      key_prefix: keyPrefix,
    }).select("id, name, key_prefix, revoked, created_at").single();

    setSaving(false);
    if (!error && data) {
      setKeys(prev => [data, ...prev]);
      setNewRawKey(raw);
    }
    setForm({ ...EMPTY_FORM, permissions: new Set() });
    setShowForm(false);
  };

  const handleCancel = () => {
    setForm({ ...EMPTY_FORM, permissions: new Set() });
    setShowForm(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleRevoke = async (id: string) => {
    await supabase.from("api_keys").update({ revoked: true }).eq("id", id);
    setKeys(prev => prev.filter(k => k.id !== id));
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">API Keys</h1>
          <p className="text-sm font-medium text-zinc-400 mt-0.5">Gerencie chaves de acesso para integrações externas (Facebook Ads, Zapier, etc).</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Plus size={15} /> Nova API Key
          </button>
        )}
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-3xl space-y-4">

          {newRawKey && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 space-y-2">
              <p className="text-[13px] font-bold text-green-700">API Key criada com sucesso!</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[12px] font-mono text-green-800 bg-green-100 px-3 py-1.5 rounded-lg overflow-hidden text-ellipsis whitespace-nowrap">
                  {newRawKey}
                </code>
                <button
                  onClick={() => handleCopy(newRawKey, "new")}
                  className="p-1.5 text-green-600 hover:bg-green-200 rounded-lg transition-colors"
                >
                  {copied === "new" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-[11px] font-medium text-green-600">Copie agora — ela não será exibida novamente.</p>
            </div>
          )}

          {showForm && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100">
                <p className="text-[14px] font-bold text-zinc-900">Nova API Key</p>
              </div>
              <div className="px-6 py-5 space-y-5">

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-zinc-700">Nome</label>
                  <input
                    type="text"
                    placeholder="Ex: Facebook Ads, Zapier, Meu sistema..."
                    value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })}
                    className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-zinc-700">Permissões</label>

                  <label
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition-colors w-full",
                      form.accessTotal ? "border-amber-400 bg-amber-500" : "border-zinc-200 hover:bg-zinc-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.accessTotal}
                      onChange={e => toggleAccessTotal(e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className={cn("text-[13px] font-bold", form.accessTotal ? "text-white" : "text-zinc-800")}>
                      Acesso total
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_PERMISSIONS.map(perm => {
                      const isChecked = form.accessTotal || form.permissions.has(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 border rounded-lg cursor-pointer transition-colors text-[12px] font-medium",
                            form.accessTotal
                              ? "border-zinc-200 text-zinc-400 bg-zinc-50 cursor-default"
                              : isChecked
                                ? "border-amber-300 bg-amber-50 text-amber-800"
                                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(perm.key)}
                            disabled={form.accessTotal}
                            className="w-3.5 h-3.5 accent-amber-500"
                          />
                          {perm.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.nickname.trim() || saving}
                  className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm transition-colors disabled:opacity-50"
                >
                  {saving ? "Criando..." : "Criar API Key"}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-14">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
          ) : keys.length === 0 && !showForm ? (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm py-14 flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-3">
                <Key size={22} className="text-zinc-300" />
              </div>
              <p className="text-[14px] font-semibold text-zinc-600 mb-1">Nenhuma API key criada</p>
              <p className="text-[12px] font-medium text-zinc-400 text-center max-w-xs">
                Crie uma API key para permitir que sistemas externos se conectem ao seu CRM.
              </p>
            </div>
          ) : keys.length > 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="divide-y divide-zinc-100">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center px-5 py-3.5 gap-3 group hover:bg-zinc-50/50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                      <Key size={13} className="text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-zinc-800">{k.name}</p>
                      <code className="text-[11px] font-mono text-zinc-400 block mt-0.5">{k.key_prefix}…</code>
                    </div>
                    <span className="text-[11px] font-medium text-zinc-400">
                      {new Date(k.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Revogar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <ExternalLink size={15} className="text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-zinc-900">Documentação da API</p>
              <p className="text-[12px] font-medium text-zinc-400">Veja todos os endpoints, exemplos de uso e como integrar com Facebook Ads, Zapier e outros sistemas.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
