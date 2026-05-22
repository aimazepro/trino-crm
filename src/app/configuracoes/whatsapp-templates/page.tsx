"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, MessageSquare, X, Trash2, Pencil, CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Template = { id: string; name: string; message: string };

const VARS = [
  "{{nome_contato}}",
  "{{nome_empresa}}",
  "{{nome_negocio}}",
  "{{nome_vendedor}}",
];

function extractVars(text: string): string[] {
  const matches = text.match(/\{\{[^}]+\}\}/g) || [];
  return [...new Set(matches)];
}

type FormMode =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; templateId: string };

export default function TemplatesWhatsAppPage() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<FormMode>({ type: "none" });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", message: "" });
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (message: string) => {
    setToast({ message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at");
    setTemplates(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const openCreate = () => {
    setForm({ name: "", message: "" });
    setMode({ type: "create" });
  };

  const openEdit = (t: Template) => {
    setForm({ name: t.name, message: t.message });
    setMode({ type: "edit", templateId: t.id });
  };

  const closeForm = () => {
    setMode({ type: "none" });
    setForm({ name: "", message: "" });
  };

  const insertVar = (v: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setForm((f) => ({ ...f, message: f.message + v }));
      return;
    }
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const newMessage =
      form.message.substring(0, start) + v + form.message.substring(end);
    setForm((f) => ({ ...f, message: newMessage }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + v.length, start + v.length);
    }, 0);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.message.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    if (mode.type === "edit") {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .update({ name: form.name.trim(), message: form.message.trim() })
        .eq("id", mode.templateId)
        .select()
        .single();
      if (!error && data) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === mode.templateId ? data : t))
        );
        showToast("Template atualizado!");
      }
    } else {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .insert({
          user_id: user.id,
          name: form.name.trim(),
          message: form.message.trim(),
        })
        .select()
        .single();
      if (!error && data) {
        setTemplates((prev) => [...prev, data]);
        showToast("Template criado!");
      }
    }

    setSaving(false);
    closeForm();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("whatsapp_templates")
      .delete()
      .eq("id", id);
    if (!error) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      showToast("Template excluído!");
    }
  };

  const isFormValid = !!(form.name.trim() && form.message.trim());
  const showForm = mode.type !== "none";
  const isEdit = mode.type === "edit";

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-sm px-4 py-3 rounded-lg flex items-center gap-3 border border-zinc-800">
          <CircleCheck className="h-4 w-4 text-green-400 shrink-0" />
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto py-8 px-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">
              Templates de WhatsApp
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Mensagens prontas para enviar rapidamente pelo chat
            </p>
          </div>
          {!showForm && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Novo Template
            </button>
          )}
        </div>

        {/* Inline Create / Edit Form */}
        {showForm && (
          <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 space-y-4">
            {/* Form Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-800">
                {isEdit ? "Editar template" : "Novo template"}
              </h2>
              <button
                onClick={closeForm}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Name Input */}
            <div>
              <label className="text-xs font-medium text-zinc-500">
                Nome do template
              </label>
              <input
                type="text"
                placeholder="Ex: Primeira abordagem"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Message Textarea */}
            <div>
              <label className="text-xs font-medium text-zinc-500">
                Mensagem
              </label>
              <textarea
                ref={textareaRef}
                rows={4}
                placeholder={`Olá {{nome_contato}}, tudo bem? Sou {{nome_vendedor}} da...`}
                value={form.message}
                onChange={(e) =>
                  setForm((f) => ({ ...f, message: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              />
              {/* Variable Pills */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {VARS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVar(v)}
                    className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeForm}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!isFormValid || saving}
                onClick={handleSave}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving
                  ? isEdit
                    ? "Salvando..."
                    : "Criando..."
                  : isEdit
                  ? "Salvar"
                  : "Criar"}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : templates.length === 0 && !showForm ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <MessageSquare className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">Nenhum template criado</p>
            <p className="text-xs mt-1">
              Crie templates para enviar mensagens rapidamente pelo WhatsApp
            </p>
            <button
              onClick={openCreate}
              className="mt-4 flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Novo Template
            </button>
          </div>
        ) : templates.length > 0 ? (
          /* Template List */
          <div className="space-y-2">
            {templates.map((t) => {
              const vars = extractVars(t.message);
              const isBeingEdited =
                mode.type === "edit" && mode.templateId === t.id;
              return (
                <div
                  key={t.id}
                  className={`flex items-start gap-3 rounded-lg border bg-white p-4 transition-colors ${
                    isBeingEdited
                      ? "border-amber-300"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <MessageSquare className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800">{t.name}</p>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2 whitespace-pre-wrap">
                      {t.message}
                    </p>
                    {vars.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {vars.map((v) => (
                          <span
                            key={v}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(t)}
                      title="Editar"
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      title="Excluir"
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </main>
  );
}
