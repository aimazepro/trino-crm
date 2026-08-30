"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Mail,
  X,
  Trash2,
  Pencil,
  Eye,
  Copy,
  Bold,
  Italic,
  Underline,
  Check,
  ChevronDown,
  Braces,
  List,
  ListOrdered,
  Link,
  CircleCheck
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

const MODEL_OPTIONS = [
  { value: "", label: "Selecione um modelo pronto..." },
  {
    value: "Cold Mail",
    label: "Cold Mail",
    name: "Cold Mail",
    subject: "Ola {{contact_name}}, temos uma proposta para voce",
    body: "Ola {{contact_name}},\n\nMeu nome e {{owner_name}} e gostaria de apresentar {{deal_title}}...\n\nComo a {{company_name}} esta lidando com [processo] hoje?\n\nAbracos,\n{{owner_name}}",
  },
  {
    value: "Follow Up Prospecção",
    label: "Follow Up Prospecção",
    name: "Follow Up Prospecção",
    subject: "Re: {{contact_name}}, ainda faz sentido conversar?",
    body: "Olá {{contact_name}},\n\nPassei pelo nosso último contato e queria verificar se ainda faz sentido conversar sobre [assunto].\n\nSe não for o momento certo, sem problema — só me avise e não te incomodo mais.\n\nAbraços,\n{{owner_name}}",
  },
  {
    value: "Break Up Prospecção",
    label: "Break Up Prospecção",
    name: "Break Up Prospecção",
    subject: "{{contact_name}}, último contato",
    body: "Olá {{contact_name}},\n\nTentei entrar em contato algumas vezes, mas entendo que talvez não seja o momento.\n\nEste será meu último email sobre o assunto. Se no futuro fizer sentido retomar, estou à disposição.\n\nSuccesso,\n{{owner_name}}",
  },
  {
    value: "Formalização de Proposta",
    label: "Formalização de Proposta",
    name: "Formalização de Proposta",
    subject: "Proposta Comercial — {{deal_title}}",
    body: "Olá {{contact_name}},\n\nConforme conversamos, segue em anexo nossa proposta comercial para {{company_name}}.\n\nO valor total é de {{deal_value}} e as condições estão detalhadas no documento.\n\nFico à disposição para qualquer dúvida.\n\nAbraços,\n{{owner_name}}",
  },
  {
    value: "Follow Up Proposta",
    label: "Follow Up Proposta",
    name: "Follow Up Proposta",
    subject: "Re: Proposta — {{company_name}}",
    body: "Olá {{contact_name}},\n\nEnviei nossa proposta há alguns dias e gostaria de saber se tiveram a oportunidade de analisar.\n\nHá algum ponto que podemos ajustar ou alguma dúvida que posso esclarecer?\n\nAbraços,\n{{owner_name}}",
  },
  {
    value: "Break Up Proposta",
    label: "Break Up Proposta",
    name: "Break Up Proposta",
    subject: "{{contact_name}}, encerrando nossa proposta",
    body: "Olá {{contact_name}},\n\nComo não recebi retorno sobre a proposta que enviei, vou encerrar este processo por agora.\n\nCaso queiram retomar no futuro, é só entrar em contato.\n\nSuccesso,\n{{owner_name}}",
  },
];

const AVAILABLE_VARIABLES = [
  { key: "contact_name", label: "Nome do Contato" },
  { key: "company_name", label: "Nome da Empresa" },
  { key: "deal_title", label: "Nome do Negócio" },
  { key: "deal_value", label: "Valor do Negócio" },
  { key: "owner_name", label: "Nome do Vendedor" },
  { key: "contact_email", label: "Email do Contato" },
  { key: "contact_phone", label: "Telefone do Contato" },
];

function extractVars(text: string): string[] {
  const matches = text.match(/\{\{[^}]+\}\}/g) || [];
  return [...new Set(matches)];
}

export default function TemplatesEmailPage() {
  const supabase = createClient();
  const { workspaceId } = useWorkspace();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [form, setForm] = useState({ model: "", name: "", subject: "", body: "" });
  const [showVarsDropdown, setShowVarsDropdown] = useState(false);
  const [lastFocusedField, setLastFocusedField] = useState<"subject" | "body">("body");
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at");

    setTemplates(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleModelSelect = (value: string) => {
    const found = MODEL_OPTIONS.find(m => m.value === value);
    if (found && found.value) {
      setForm({
        model: value,
        name: found.name || "",
        subject: found.subject || "",
        body: found.body || "",
      });
    } else {
      setForm(prev => ({ ...prev, model: value }));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    if (editingTemplateId) {
      const { error } = await supabase
        .from("email_templates")
        .update({
          name: form.name.trim(),
          subject: form.subject.trim(),
          body: form.body.trim(),
        })
        .eq("id", editingTemplateId);

      if (!error) {
        setTemplates(prev =>
          prev.map(t =>
            t.id === editingTemplateId
              ? { ...t, name: form.name.trim(), subject: form.subject.trim(), body: form.body.trim() }
              : t
          )
        );
        showToast("Template atualizado com sucesso!");
      } else {
        showToast("Erro ao atualizar o template.");
      }
    } else {
      const { data, error } = await supabase
        .from("email_templates")
        .insert({
          workspace_id: workspaceId,
          name: form.name.trim(),
          subject: form.subject.trim(),
          body: form.body.trim(),
        })
        .select()
        .single();

      if (!error && data) {
        setTemplates(prev => [...prev, data]);
        showToast("Template criado com sucesso!");
      } else {
        showToast("Erro ao criar o template.");
      }
    }

    setSaving(false);
    setForm({ model: "", name: "", subject: "", body: "" });
    setShowModal(false);
    setEditingTemplateId(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      showToast("Template excluído com sucesso!");
    } else {
      showToast("Erro ao excluir o template.");
    }
  };

  const handleCopyPreview = () => {
    if (!previewTemplate) return;
    navigator.clipboard.writeText(previewTemplate.body);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 1500);
  };

  const openModal = () => {
    setForm({ model: "", name: "", subject: "", body: "" });
    setEditingTemplateId(null);
    setShowModal(true);
  };

  const handleEditClick = (t: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    setForm({
      model: "",
      name: t.name,
      subject: t.subject,
      body: t.body,
    });
    setEditingTemplateId(t.id);
    setShowModal(true);
  };

  const handleInsertVariable = (variable: string) => {
    const isSubject = lastFocusedField === "subject";
    const ref = isSubject ? subjectRef : textareaRef;
    const currentVal = isSubject ? form.subject : form.body;
    const setVal = (newVal: string) => {
      setForm(prev => ({
        ...prev,
        [isSubject ? "subject" : "body"]: newVal,
      }));
    };

    const element = ref.current;
    if (!element) {
      const replacement = `{{${variable}}}`;
      setForm(prev => ({ ...prev, body: prev.body + replacement }));
      setShowVarsDropdown(false);
      return;
    }

    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    const replacement = `{{${variable}}}`;
    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    setVal(newVal);

    setTimeout(() => {
      element.focus();
      element.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 0);
    setShowVarsDropdown(false);
  };

  const handleFormat = (type: "bold" | "italic" | "underline" | "list" | "ordered" | "link") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let prefix = "";
    let suffix = "";

    switch (type) {
      case "bold":
        prefix = "**";
        suffix = "**";
        break;
      case "italic":
        prefix = "*";
        suffix = "*";
        break;
      case "underline":
        prefix = "__";
        suffix = "__";
        break;
      case "list":
        prefix = "\n- ";
        suffix = "";
        break;
      case "ordered":
        prefix = "\n1. ";
        suffix = "";
        break;
      case "link":
        prefix = "[";
        suffix = "](url)";
        break;
    }

    const replacement = prefix + selectedText + suffix;
    const newBody = text.substring(0, start) + replacement + text.substring(end);
    setForm(prev => ({ ...prev, body: newBody }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const isFormValid = !!(form.name.trim() && form.subject.trim() && form.body.trim());

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        
        {/* Toast Notification Component */}
        {toast && toast.visible && (
          <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-sm px-4 py-3 rounded-lg flex items-center gap-3 border border-zinc-800 transition-all">
            <CircleCheck className="h-4 w-4 text-green-400 shrink-0" />
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-zinc-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-500" />
              Templates de Email
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Crie templates reutilizaveis com variaveis dinamicas.</p>
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 transition-colors border border-transparent outline-none"
          >
            <Plus className="h-4 w-4" />
            Novo Template
          </button>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : templates.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 gap-4 border border-zinc-200 rounded-xl bg-white">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
              <Mail className="h-8 w-8 text-amber-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-zinc-800">Nenhum template criado</p>
              <p className="text-sm text-zinc-400 mt-1">Crie templates para agilizar sua comunicacao por email.</p>
            </div>
            <button
              onClick={openModal}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 transition-colors border border-transparent outline-none"
            >
              <Plus className="h-4 w-4" />
              Criar Template
            </button>
          </div>
        ) : (
          /* Template List */
          <div className="grid grid-cols-1 gap-3">
            {templates.map(t => {
              const vars = extractVars(t.subject + " " + t.body);
              return (
                <div
                  key={t.id}
                  onClick={(e) => setPreviewTemplate(t)}
                  className="bg-white border border-zinc-200 rounded-xl px-5 py-4 flex items-start justify-between group hover:border-zinc-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5 border border-amber-100">
                      <Mail size={14} className="text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-zinc-900">{t.name}</p>
                      <p className="text-xs font-medium text-zinc-400 mt-0.5 truncate max-w-xl">{t.subject}</p>
                      {vars.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {vars.map(v => (
                            <span
                              key={v}
                              className="text-[10px] font-semibold text-zinc-600 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-mono"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTemplate(t);
                      }}
                      title="Visualizar"
                      className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => handleEditClick(t, e)}
                      title="Editar"
                      className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(t.id, e)}
                      title="Excluir"
                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Novo / Editar Template Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setShowModal(false);
            setEditingTemplateId(null);
          }}
        >
          <div
            className="relative w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowModal(false);
                setEditingTemplateId(null);
              }}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-zinc-900">
              {editingTemplateId ? "Editar Template" : "Novo Template"}
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Use {"{{variavel}}"} no assunto ou corpo para criar variaveis dinamicas.
            </p>

            <div className="mt-5 space-y-4">
              {/* Usar Modelo Dropdown (Only when creating) */}
              {!editingTemplateId && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Usar modelo</label>
                  <select
                    value={form.model}
                    onChange={e => handleModelSelect(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-zinc-600 bg-white"
                  >
                    {MODEL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Template Name Input */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Nome do Template *</label>
                <input
                  type="text"
                  placeholder="Ex: Cold Mail, Follow Up, Proposta"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Subject Input */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Assunto *</label>
                <input
                  ref={subjectRef}
                  type="text"
                  placeholder="Ex: Ola {{contact_name}}, temos uma proposta para voce"
                  value={form.subject}
                  onFocus={() => setLastFocusedField("subject")}
                  onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Body Textarea with Rich Formatting Toolbar */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Corpo do Email *</label>
                <div className="rounded-lg border border-zinc-200 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 bg-white overflow-hidden transition-all">
                  
                  {/* Toolbar */}
                  <div className="flex items-center gap-0.5 px-2 py-1 border-b border-zinc-100 bg-zinc-50/80">
                    <button
                      type="button"
                      onClick={() => handleFormat("bold")}
                      className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      title="Negrito"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormat("italic")}
                      className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      title="Italico"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormat("underline")}
                      className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      title="Sublinhado"
                    >
                      <Underline className="h-3.5 w-3.5" />
                    </button>

                    <div className="w-px h-4 bg-zinc-200 mx-0.5"></div>

                    <button
                      type="button"
                      onClick={() => handleFormat("list")}
                      className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      title="Lista"
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormat("ordered")}
                      className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      title="Lista numerada"
                    >
                      <ListOrdered className="h-3.5 w-3.5" />
                    </button>

                    <div className="w-px h-4 bg-zinc-200 mx-0.5"></div>

                    <button
                      type="button"
                      onClick={() => handleFormat("link")}
                      className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      title="Link"
                    >
                      <Link className="h-3.5 w-3.5" />
                    </button>

                    <div className="w-px h-4 bg-zinc-200 mx-0.5"></div>

                    {/* Variable insertion dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowVarsDropdown(!showVarsDropdown)}
                        className="flex items-center gap-0.5 rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
                        title="Inserir variavel"
                      >
                        <Braces className="h-3.5 w-3.5" />
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>

                      {showVarsDropdown && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowVarsDropdown(false)} />
                          <div className="absolute left-0 mt-1 w-48 rounded-lg border border-zinc-200 bg-white py-1 z-20">
                            {AVAILABLE_VARIABLES.map(v => (
                              <button
                                key={v.key}
                                type="button"
                                onClick={() => handleInsertVariable(v.key)}
                                className="w-full text-left px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors font-medium"
                              >
                                {v.label} ({"{" + v.key + "}"})
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Textarea disguised as editor */}
                  <div>
                    <textarea
                      ref={textareaRef}
                      value={form.body}
                      onFocus={() => setLastFocusedField("body")}
                      onChange={e => setForm(prev => ({ ...prev, body: e.target.value }))}
                      placeholder="Ola {{contact_name}}, meu nome e {{owner_name}} e gostaria de apresentar {{deal_title}}..."
                      className="w-full px-3 py-2 text-sm text-zinc-900 outline-none resize-none bg-white font-sans"
                      style={{ minHeight: "200px" }}
                    />
                  </div>
                </div>
              </div>

              {/* Variables detector section exactly matching mockup */}
              <div>
                <p className="text-xs font-medium text-zinc-600 mb-2">Variaveis detectadas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {extractVars(form.subject + " " + form.body).map(v => (
                    <span key={v} className="rounded bg-blue-50 px-2 py-1 text-xs font-mono text-blue-600">
                      {v}
                    </span>
                  ))}
                  {extractVars(form.subject + " " + form.body).length === 0 && (
                    <span className="text-xs text-zinc-400 italic">Nenhuma variavel detectada</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  Variaveis disponiveis: {"{{contact_name}}, {{company_name}}, {{deal_title}}, {{deal_value}}, {{owner_name}}, {{contact_email}}, {{contact_phone}}"}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingTemplateId(null);
                }}
                className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors outline-none"
              >
                Cancelar
              </button>
              <button
                disabled={!isFormValid || saving}
                onClick={handleSave}
                className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 py-2.5 text-sm font-bold text-white hover:from-amber-600 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors border border-transparent outline-none"
              >
                {saving
                  ? (editingTemplateId ? "Salvando..." : "Criando...")
                  : (editingTemplateId ? "Salvar Alterações" : "Criar Template")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            className="bg-white rounded-xl border border-zinc-200 w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
              <h2 className="text-base font-bold text-zinc-900">{previewTemplate.name}</h2>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="bg-zinc-50/50 border border-zinc-200 rounded-lg px-4 py-2.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Assunto</span>
                <p className="text-sm font-medium text-zinc-800 mt-1">{previewTemplate.subject}</p>
              </div>
              <div className="bg-zinc-50/50 border border-zinc-200 rounded-lg px-4 py-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Corpo</span>
                <pre className="text-sm font-medium text-zinc-800 mt-2 whitespace-pre-wrap font-sans leading-relaxed">
                  {previewTemplate.body}
                </pre>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 shrink-0 bg-zinc-50/30">
              <button
                onClick={handleCopyPreview}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors"
              >
                {copiedPreview ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                {copiedPreview ? "Copiado!" : "Copiar conteúdo"}
              </button>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-white text-sm font-semibold rounded-lg transition-colors border border-transparent"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
