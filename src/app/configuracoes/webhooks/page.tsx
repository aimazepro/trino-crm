"use client";

import { useState, useEffect } from "react";
import { Plus, X, Zap, Trash2, Link2, CircleCheck, CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";

type WebhookItem = {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  active: boolean;
};

const EVENTS = [
  { key: "deal_created", label: "Negocio criado", code: "DEAL_CREATED" },
  { key: "deal_won", label: "Negocio ganho", code: "DEAL_WON" },
  { key: "deal_lost", label: "Negocio perdido", code: "DEAL_LOST" },
  { key: "contact_created", label: "Contato criado", code: "CONTACT_CREATED" },
  { key: "activity_created", label: "Atividade criada", code: "ACTIVITY_CREATED" },
  { key: "email_open", label: "Email aberto", code: "EMAIL_OPENED" },
];

const MOCK_PAYLOADS: Record<string, any> = {
  deal_created: {
    event: "DEAL_CREATED",
    timestamp: new Date().toISOString(),
    payload: {
      id: "cmpga01qo019yhyn4ra8slrc4",
      number: 7,
      title: "negocio teste",
      value: "1000",
      expectedCloseAt: null,
      stageId: "cmpeq9xeh0nhlhyn4e2ehxqe7",
      pipelineId: "cmpeq9xed0nhkhyn40h9g2hjf",
      accountId: "cmpg7azex016shyn4n2ak798q",
      contactId: "cmpg7azos0170hyn4selcbb26",
      ownerId: "user_3E0iKg8G9xU4ld6q6nryL8WNQ4z",
      workspaceId: "cmpeq9xe30nhihyn45v70us45",
      won: null,
      lostAt: null,
      lostReason: null,
      lostReasonId: null,
      lostReasonNote: null,
      closedAt: null,
      stageEnteredAt: new Date().toISOString(),
      labels: [],
      probability: 0,
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      deletedBy: null,
      stage: {
        id: "cmpeq9xeh0nhlhyn4e2ehxqe7",
        name: "Entrada de Leads",
        color: "#a1a1aa",
        order: 0,
        stagnationDays: 7,
        pipelineId: "cmpeq9xed0nhkhyn40h9g2hjf",
        createdAt: "2026-05-21T00:03:48.171Z",
      },
      pipeline: {
        name: "Prospeccao",
      },
      contact: {
        id: "cmpg7azos0170hyn4selcbb26",
        name: "Pedro Lima",
        phone: null,
        email: "pedro@gamma.com",
      },
      account: {
        id: "cmpg7azex016shyn4n2ak798q",
        name: "Beta Ltda",
      },
    },
  },
  deal_won: {
    event: "DEAL_WON",
    timestamp: new Date().toISOString(),
    payload: {
      id: "cmpg7azcw016nhyn4d9k766sw",
    },
  },
  deal_lost: {
    event: "DEAL_LOST",
    timestamp: new Date().toISOString(),
    payload: {
      id: "cmpga01qo019yhyn4ra8slrc4",
      lostReason: "Preço",
      lostReasonId: "cmpeqafr60nighyn4v46ui7iu",
      lostReasonNote: "dsd",
    },
  },
  contact_created: {
    event: "CONTACT_CREATED",
    timestamp: new Date().toISOString(),
    payload: {
      id: "cmpg7azos0170hyn4selcbb26",
      name: "Pedro Lima",
      email: "pedro@gamma.com",
      phone: "+55 11 99999-9999",
      jobTitle: "Gerente Comercial",
      ownerId: "user_3E0iKg8G9xU4ld6q6nryL8WNQ4z",
      workspaceId: "cmpeq9xe30nhihyn45v70us45",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  activity_created: {
    event: "ACTIVITY_CREATED",
    timestamp: new Date().toISOString(),
    payload: {
      id: "cmpg7actx0180hyn4act1bb26",
      title: "Apresentação do CRM",
      type: "reuniao",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      done: false,
      dealId: "cmpga01qo019yhyn4ra8slrc4",
      contactId: "cmpg7azos0170hyn4selcbb26",
      ownerId: "user_3E0iKg8G9xU4ld6q6nryL8WNQ4z",
      workspaceId: "cmpeq9xe30nhihyn45v70us45",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  email_open: {
    event: "EMAIL_OPENED",
    timestamp: new Date().toISOString(),
    payload: {
      email: {
        id: "cmpg7email0180hyn4eml1bb26",
        subject: "Proposta Comercial — Beta Ltda",
        to: "pedro@gamma.com",
        openedAt: new Date().toISOString(),
      },
      contact: {
        id: "cmpg7azos0170hyn4selcbb26",
        name: "Pedro Lima",
        email: "pedro@gamma.com",
        phone: "+55 11 99999-9999",
      },
      deal: {
        id: "cmpga01qo019yhyn4ra8slrc4",
        title: "negocio teste",
        value: "1000",
      },
      company: {
        id: "cmpg7azex016shyn4n2ak798q",
        name: "Beta Ltda",
      },
    },
  },
};

const isValidUrl = (str: string) => {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<Set<string>>(new Set());
  const [formSecret, setFormSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const supabase = createClient();
  const { workspaceId, role } = useWorkspace();

  // Load webhooks from Supabase
  const loadWebhooks = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("webhooks")
      .select("id, url, events, secret, active")
      .order("created_at");

    setWebhooks(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadWebhooks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleEvent = (key: string) => {
    const next = new Set(formEvents);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setFormEvents(next);
  };

  const handleCreate = async () => {
    if (!isValidUrl(formUrl) || formEvents.size === 0) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const newWebhook = {
      workspace_id: workspaceId,
      url: formUrl.trim(),
      events: Array.from(formEvents),
      secret: formSecret.trim() || null,
      active: true,
    };

    // Optimistically add to local state to make UI super responsive
    const tempId = `temp_${Date.now()}`;
    const tempItem: WebhookItem = {
      id: tempId,
      url: newWebhook.url,
      events: newWebhook.events,
      secret: newWebhook.secret,
      active: true,
    };

    setWebhooks((prev) => [...prev, tempItem]);
    setShowModal(false);
    setToastType("success");
    setToast("Webhook criado.");
    setTimeout(() => setToast(null), 4000);

    // Reset Form
    setFormUrl("");
    setFormEvents(new Set());
    setFormSecret("");
    setSaving(false);

    // Save in background
    const { data } = await supabase
      .from("webhooks")
      .insert(newWebhook)
      .select("id, url, events, secret, active")
      .single();

    if (data) {
      setWebhooks((prev) =>
        prev.map((item) => (item.id === tempId ? data : item))
      );
    }
  };

  const handleDelete = async (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    if (!id.startsWith("temp_")) {
      await supabase.from("webhooks").delete().eq("id", id);
    }
  };

  const toggleActive = async (item: WebhookItem) => {
    const nextActive = !item.active;
    setWebhooks((prev) =>
      prev.map((w) => (w.id === item.id ? { ...w, active: nextActive } : w))
    );
    if (!item.id.startsWith("temp_")) {
      await supabase
        .from("webhooks")
        .update({ active: nextActive })
        .eq("id", item.id);
    }
  };

  const handleTest = async (wh: WebhookItem) => {
    setTestingId(wh.id);
    const firstEvent = wh.events[0] || "deal_created";
    const eventCode = EVENTS.find((e) => e.key === firstEvent)?.code || "DEAL_CREATED";
    const mockPayload = MOCK_PAYLOADS[firstEvent] || MOCK_PAYLOADS.deal_created;

    // Refresh dynamic fields of payload
    const payload = {
      ...mockPayload,
      timestamp: new Date().toISOString(),
    };
    if (payload.payload) {
      if (payload.payload.createdAt) payload.payload.createdAt = new Date().toISOString();
      if (payload.payload.updatedAt) payload.payload.updatedAt = new Date().toISOString();
      if (payload.payload.stageEnteredAt) payload.payload.stageEnteredAt = new Date().toISOString();
    }

    try {
      // Trigger a real server-side request to the webhook URL via the proxy
      const res = await fetch("/api/webhooks/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: wh.url,
          event: eventCode,
          payload: payload,
          secret: wh.secret,
          webhookId: wh.id.startsWith("temp_") ? undefined : wh.id,
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (res.ok && result.success) {
        setToastType("success");
        setToast(`Teste enviado! (HTTP ${result.status ?? res.status})`);
      } else {
        const detail = result.error || `HTTP ${result.status ?? res.status}`;
        setToastType("error");
        setToast(`Falha no teste: ${detail}`);
      }
    } catch (e) {
      console.warn("Test webhook request failed: ", e);
      setToastType("error");
      setToast("Falha no teste: não foi possível contatar o servidor.");
    }

    setTestingId(null);
    setTimeout(() => setToast(null), 6000);
  };

  const getEventLabel = (key: string) => {
    return EVENTS.find((e) => e.key === key)?.label ?? key;
  };

  if (role !== "admin") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-3 py-20 bg-zinc-50/30">
        <p className="text-[13px] font-semibold text-zinc-500">Só administradores acessam webhooks.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        {/* Success Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-up">
            {toastType === "success" ? (
              <CircleCheck className="h-4 w-4 text-green-400 shrink-0" />
            ) : (
              <CircleAlert className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span>{toast}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-zinc-400 hover:text-white"
            >
              x
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Webhooks</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Notifique sistemas externos sobre eventos do CRM.
            </p>
          </div>
          <button
            onClick={() => {
              setToastType("success");
              setToast(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Webhook
          </button>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : webhooks.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16 text-zinc-400 text-sm">
            Nenhum webhook configurado.
          </div>
        ) : (
          /* Table list of Webhooks */
          <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    URL
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Eventos
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {webhooks.map((wh) => (
                  <tr key={wh.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span
                          className="font-mono text-xs text-zinc-700 truncate max-w-[200px]"
                          title={wh.url}
                        >
                          {wh.url}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {wh.events.map((ev) => (
                          <span
                            key={ev}
                            className="text-xs font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full"
                          >
                            {getEventLabel(ev)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(wh)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                          wh.active
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        {wh.active ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleTest(wh)}
                          disabled={testingId === wh.id}
                          className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Zap className="h-3 w-3" />
                          {testingId === wh.id ? "Testando..." : "Testar"}
                        </button>
                        <button
                          onClick={() => handleDelete(wh.id)}
                          className="text-zinc-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-semibold text-zinc-900">Novo Webhook</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* URL */}
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  URL de destino
                </label>
                <input
                  className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="https://sua-api.com/webhook"
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Events List */}
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Eventos
                </label>
                <div className="mt-2 space-y-2">
                  {EVENTS.map((event) => {
                    const isChecked = formEvents.has(event.key);
                    return (
                      <label
                        key={event.key}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <input
                          className="accent-amber-500 h-4 w-4"
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEvent(event.key)}
                        />
                        <span className="text-sm text-zinc-700">
                          {event.label}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono ml-auto">
                          {event.code}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Secret */}
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Secret (opcional)
                </label>
                <input
                  className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300 font-mono"
                  placeholder="Chave para assinar o payload (HMAC-SHA256)"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !isValidUrl(formUrl) || formEvents.size === 0}
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md text-white rounded-lg disabled:opacity-60 transition-colors"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
