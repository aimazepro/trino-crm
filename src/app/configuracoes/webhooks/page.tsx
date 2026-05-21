"use client";

import { useState, useEffect } from "react";
import { Plus, Webhook, Trash2, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type WebhookItem = {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  active: boolean;
};

const EVENTS = [
  { key: "deal_created", label: "Negócio criado", code: "DEAL_CREATED" },
  { key: "deal_won", label: "Negócio ganho", code: "DEAL_WON" },
  { key: "deal_lost", label: "Negócio perdido", code: "DEAL_LOST" },
  { key: "contact_created", label: "Contato criado", code: "CONTACT_CREATED" },
  { key: "activity_created", label: "Atividade criada", code: "ACTIVITY_CREATED" },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ url: "", events: new Set<string>(), secret: "" });
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("webhooks").select("id, url, events, secret, active").eq("user_id", user.id).order("created_at");
      setWebhooks(data ?? []);
    }
    load();
  }, [supabase]);

  const toggleEvent = (key: string) => {
    const next = new Set(form.events);
    if (next.has(key)) next.delete(key); else next.add(key);
    setForm({ ...form, events: next });
  };

  const handleSave = async () => {
    if (!form.url.trim() || form.events.size === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("webhooks").insert({
      user_id: user.id, url: form.url, events: Array.from(form.events), secret: form.secret || null, active: true,
    }).select("id, url, events, secret, active").single();
    if (data) setWebhooks([...webhooks, data]);
    setForm({ url: "", events: new Set(), secret: "" });
    setShowModal(false);
  };

  const openModal = () => {
    setForm({ url: "", events: new Set(), secret: "" });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setWebhooks(webhooks.filter(w => w.id !== id));
    await supabase.from("webhooks").delete().eq("id", id);
  };

  const getEvent = (key: string) => EVENTS.find(e => e.key === key);

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Webhooks</h1>
          <p className="text-sm font-medium text-zinc-400 mt-0.5">Notifique sistemas externos sobre eventos no CRM.</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus size={15} /> Novo Webhook
        </button>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-4xl">
          {webhooks.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm py-16 flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
                <Webhook size={26} className="text-zinc-300" />
              </div>
              <p className="text-[14px] font-medium text-zinc-400">Nenhum webhook configurado.</p>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-[1fr_200px_90px_80px] border-b border-zinc-200 bg-zinc-50/50">
                <div className="px-5 py-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">URL</div>
                <div className="px-4 py-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">EVENTOS</div>
                <div className="px-4 py-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">STATUS</div>
                <div className="px-4 py-3" />
              </div>
              <div className="divide-y divide-zinc-100">
                {webhooks.map(wh => (
                  <div key={wh.id} className="grid grid-cols-[1fr_200px_90px_80px] items-center group hover:bg-zinc-50/50 transition-colors">
                    <div className="px-5 py-3.5 min-w-0">
                      <p className="text-[12px] font-mono text-zinc-600 truncate">{wh.url}</p>
                    </div>
                    <div className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {wh.events.map(ev => {
                          const event = getEvent(ev);
                          return (
                            <span key={ev} className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded font-mono">
                              {event?.code ?? ev}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="px-4 py-3.5">
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", wh.active ? "text-green-600 bg-green-50" : "text-zinc-400 bg-zinc-100")}>
                        {wh.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="px-4 py-3.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors"
                        title="Testar webhook"
                      >
                        <Zap size={11} /> Testar
                      </button>
                      <button
                        onClick={() => handleDelete(wh.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-900">Novo Webhook</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">URL DE DESTINO</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.url}
                  onChange={e => setForm({ ...form, url: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">EVENTOS</label>
                <div className="space-y-1.5">
                  {EVENTS.map(event => (
                    <label
                      key={event.key}
                      className={cn(
                        "flex items-center justify-between px-4 py-2.5 border rounded-xl cursor-pointer transition-colors",
                        form.events.has(event.key)
                          ? "border-amber-300 bg-amber-50"
                          : "border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={form.events.has(event.key)}
                          onChange={() => toggleEvent(event.key)}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <span className="text-[13px] font-semibold text-zinc-700">{event.label}</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400">{event.code}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  SECRET <span className="font-normal normal-case text-zinc-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Usado para validar assinatura HMAC-SHA256"
                  value={form.secret}
                  onChange={e => setForm({ ...form, secret: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200">Cancelar</button>
              <button onClick={handleSave} className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm">Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
