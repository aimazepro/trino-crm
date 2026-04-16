"use client";

import { useState } from "react";
import { Plus, Key, Copy, Trash2, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type Permission = {
  label: string;
  key: string;
};

type ApiKey = {
  id: string;
  nickname: string;
  owner: string;
  key: string;
  createdAt: string;
  accessTotal: boolean;
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

const OWNERS = [
  "Pixeo Digital Business (ADMIN)",
  "João Paulo",
  "Maria Silva",
];

const EMPTY_FORM = { nickname: "", owner: OWNERS[0], accessTotal: true, permissions: new Set<string>() };

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyData, setNewKeyData] = useState<ApiKey | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, permissions: new Set<string>() });
  const [copied, setCopied] = useState<string | null>(null);

  const togglePermission = (key: string) => {
    if (form.accessTotal) return;
    const next = new Set(form.permissions);
    next.has(key) ? next.delete(key) : next.add(key);
    setForm({ ...form, permissions: next });
  };

  const toggleAccessTotal = (checked: boolean) => {
    setForm({ ...form, accessTotal: checked, permissions: new Set() });
  };

  const handleCreate = () => {
    if (!form.nickname.trim()) return;
    const generated = `dm_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 40);
    const newKey: ApiKey = {
      id: Date.now().toString(),
      nickname: form.nickname,
      owner: form.owner,
      key: generated,
      createdAt: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
      accessTotal: form.accessTotal,
    };
    setKeys([...keys, newKey]);
    setNewKeyData(newKey);
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

  const handleDelete = (id: string) => setKeys(keys.filter(k => k.id !== id));

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

          {/* Success banner */}
          {newKeyData && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 space-y-2">
              <p className="text-[13px] font-bold text-green-700">API Key criada com sucesso!</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[12px] font-mono text-green-800 bg-green-100 px-3 py-1.5 rounded-lg overflow-hidden text-ellipsis whitespace-nowrap">
                  {newKeyData.key}
                </code>
                <button
                  onClick={() => handleCopy(newKeyData.key, "new")}
                  className="p-1.5 text-green-600 hover:bg-green-200 rounded-lg transition-colors"
                >
                  {copied === "new" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-[11px] font-medium text-green-600">Copie agora — ela não será exibida novamente.</p>
            </div>
          )}

          {/* Inline create form — shown only when showForm is true */}
          {showForm && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100">
                <p className="text-[14px] font-bold text-zinc-900">Nova API Key</p>
              </div>
              <div className="px-6 py-5 space-y-5">

                {/* Nome */}
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

                {/* Proprietário padrão */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-zinc-700">Proprietário padrão</label>
                  <p className="text-[12px] font-medium text-zinc-400">Negócios e atividades criados via esta key serão atribuídos a este usuário</p>
                  <select
                    value={form.owner}
                    onChange={e => setForm({ ...form, owner: e.target.value })}
                    className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                  >
                    {OWNERS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>

                {/* Permissões */}
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-zinc-700">Permissões</label>

                  {/* Acesso total */}
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

                  {/* Permission grid — always visible */}
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

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm transition-colors"
                >
                  Criar API Key
                </button>
              </div>
            </div>
          )}

          {/* Keys list or empty state */}
          {keys.length === 0 && !showForm ? (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm py-14 flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-3">
                <Key size={22} className="text-zinc-300" />
              </div>
              <p className="text-[14px] font-semibold text-zinc-600 mb-1">Nenhuma API key criada</p>
              <p className="text-[12px] font-medium text-zinc-400 text-center max-w-xs">
                Crie uma API key para permitir que sistemas externos (Facebook Ads, Zapier, etc) se conectem ao seu CRM.
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
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-zinc-800">{k.nickname}</p>
                        {k.accessTotal && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Acesso total</span>
                        )}
                      </div>
                      <code className="text-[11px] font-mono text-zinc-400 block mt-0.5">{k.key.slice(0, 16)}…</code>
                    </div>
                    <button
                      onClick={() => handleCopy(k.key, k.id)}
                      className="p-1.5 text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {copied === k.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                    </button>
                    <button
                      onClick={() => handleDelete(k.id)}
                      className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Docs card */}
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
