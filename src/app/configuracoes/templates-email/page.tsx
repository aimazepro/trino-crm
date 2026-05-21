"use client";

import { useState } from "react";
import { Plus, Mail, X, Trash2, Edit2, Eye, Copy, Bold, Italic, Underline, Check } from "lucide-react";

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

const MODEL_OPTIONS = [
  { value: "", label: "Selecione um modelo pronto..." },
  {
    value: "cold_mail",
    label: "Cold Mail",
    name: "Cold Mail",
    subject: "{{contato_nome}}, tenho uma ideia para {{empresa_nome}}",
    body: "Olá {{contato_nome}},\n\nSou {{vendedor_nome}} da {{empresa_vendedor}}.\n\nVi que a {{empresa_nome}} atua em [segmento] e acredito que podemos ajudar a [benefício principal].\n\nPodemos conversar 15 minutos esta semana?\n\nAbraços,\n{{vendedor_nome}}",
  },
  {
    value: "followup_prospeccao",
    label: "Follow Up Prospecção",
    name: "Follow Up Prospecção",
    subject: "Re: {{contato_nome}}, ainda faz sentido conversar?",
    body: "Olá {{contato_nome}},\n\nPassei pelo nosso último contato e queria verificar se ainda faz sentido conversar sobre [assunto].\n\nSe não for o momento certo, sem problema — só me avise e não te incomodo mais.\n\nAbraços,\n{{vendedor_nome}}",
  },
  {
    value: "breakup_prospeccao",
    label: "Break Up Prospecção",
    name: "Break Up Prospecção",
    subject: "{{contato_nome}}, último contato",
    body: "Olá {{contato_nome}},\n\nTentei entrar em contato algumas vezes, mas entendo que talvez não seja o momento.\n\nEste será meu último email sobre o assunto. Se no futuro fizer sentido retomar, estou à disposição.\n\nSuccesso,\n{{vendedor_nome}}",
  },
  {
    value: "formalizacao_proposta",
    label: "Formalização de Proposta",
    name: "Formalização de Proposta",
    subject: "Proposta Comercial — {{negocio_nome}}",
    body: "Olá {{contato_nome}},\n\nConforme conversamos, segue em anexo nossa proposta comercial para {{empresa_nome}}.\n\nO valor total é de {{negocio_valor}} e as condições estão detalhadas no documento.\n\nFico à disposição para qualquer dúvida.\n\nAbraços,\n{{vendedor_nome}}",
  },
  {
    value: "followup_proposta",
    label: "Follow Up Proposta",
    name: "Follow Up Proposta",
    subject: "Re: Proposta — {{empresa_nome}}",
    body: "Olá {{contato_nome}},\n\nEnviei nossa proposta há alguns dias e gostaria de saber se tiveram a oportunidade de analisar.\n\nHá algum ponto que podemos ajustar ou alguma dúvida que posso esclarecer?\n\nAbraços,\n{{vendedor_nome}}",
  },
  {
    value: "breakup_proposta",
    label: "Break Up Proposta",
    name: "Break Up Proposta",
    subject: "{{contato_nome}}, encerrando nossa proposta",
    body: "Olá {{contato_nome}},\n\nComo não recebi retorno sobre a proposta que enviei, vou encerrar este processo por agora.\n\nCaso queiram retomar no futuro, é só entrar em contato.\n\nSuccesso,\n{{vendedor_nome}}",
  },
];

// Extract {{variables}} from text
function extractVars(text: string): string[] {
  const matches = text.match(/\{\{[^}]+\}\}/g) || [];
  return [...new Set(matches)];
}

const LS_KEY = "trino_crm_email_templates";

export function loadEmailTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

export default function TemplatesEmailPage() {
  const [templates, setTemplates] = useState<Template[]>(() => loadEmailTemplates());
  const [showModal, setShowModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [form, setForm] = useState({ model: "", name: "", subject: "", body: "" });

  const persist = (list: Template[]) => {
    setTemplates(list);
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  };

  const handleModelSelect = (value: string) => {
    const found = MODEL_OPTIONS.find(m => m.value === value);
    if (found && found.value) {
      setForm({ model: value, name: found.name || "", subject: found.subject || "", body: found.body || "" });
    } else {
      setForm({ ...form, model: value });
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    persist([...templates, { id: Date.now().toString(), name: form.name, subject: form.subject, body: form.body }]);
    setForm({ model: "", name: "", subject: "", body: "" });
    setShowModal(false);
  };

  const handleDelete = (id: string) => persist(templates.filter(t => t.id !== id));

  const handleCopyPreview = () => {
    if (!previewTemplate) return;
    navigator.clipboard.writeText(previewTemplate.body);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 1500);
  };

  const openModal = () => {
    setForm({ model: "", name: "", subject: "", body: "" });
    setShowModal(true);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <Mail size={20} className="text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Templates de Email</h1>
            <p className="text-sm font-medium text-zinc-400 mt-0.5">Crie templates reutilizáveis com variáveis dinâmicas.</p>
          </div>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus size={15} /> Novo Template
        </button>
      </div>

      <div className="flex-1 p-8">
        {templates.length === 0 ? (
          <div className="max-w-3xl bg-white border border-zinc-200 rounded-xl shadow-sm py-20 flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
              <Mail size={26} className="text-amber-400" />
            </div>
            <p className="text-[15px] font-bold text-zinc-700 mb-1">Nenhum template criado</p>
            <p className="text-[13px] font-medium text-zinc-400 mb-5">Crie templates para agilizar o envio de emails.</p>
            <button
              onClick={openModal}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
            >
              <Plus size={14} /> Criar Template
            </button>
          </div>
        ) : (
          <div className="max-w-3xl space-y-3">
            {templates.map(t => {
              const vars = extractVars(t.subject + " " + t.body);
              return (
                <div key={t.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-4 shadow-sm flex items-start justify-between group hover:border-zinc-300 transition-colors">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Mail size={14} className="text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-zinc-900">{t.name}</p>
                      <p className="text-[12px] font-medium text-zinc-400 mt-0.5 truncate">{t.subject}</p>
                      {vars.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {vars.map(v => (
                            <span key={v} className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded font-mono">{v}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-3">
                    <button
                      onClick={() => setPreviewTemplate(t)}
                      className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Eye size={13} />
                    </button>
                    <button className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
              <div>
                <h2 className="text-base font-bold text-zinc-900">Novo Template</h2>
                <p className="text-[12px] font-medium text-zinc-400 mt-0.5">Use {"{{variáveis}}"} no assunto ou corpo para criar variáveis dinâmicas.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Usar modelo pronto</label>
                <select
                  value={form.model}
                  onChange={e => handleModelSelect(e.target.value)}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                >
                  {MODEL_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Nome do Template <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="Ex: Follow Up, Proposta"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Assunto <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="Ex: {{contato_nome}}, tenho uma proposta para você"
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Corpo do Email</label>
                <div className="border border-zinc-200 rounded-lg overflow-hidden focus-within:border-amber-500 transition-all">
                  <div className="flex items-center gap-1 px-3 py-2 bg-zinc-50 border-b border-zinc-200">
                    <button className="p-1.5 text-zinc-500 hover:bg-zinc-200 rounded"><Bold size={13} /></button>
                    <button className="p-1.5 text-zinc-500 hover:bg-zinc-200 rounded"><Italic size={13} /></button>
                    <button className="p-1.5 text-zinc-500 hover:bg-zinc-200 rounded"><Underline size={13} /></button>
                  </div>
                  <textarea
                    rows={6}
                    placeholder={"Ex: {{contato_nome}}, recebi uma proposta para você..."}
                    value={form.body}
                    onChange={e => setForm({ ...form, body: e.target.value })}
                    className="w-full px-4 py-3 text-[13px] font-medium text-zinc-700 outline-none resize-none bg-white"
                  />
                </div>
                {/* Variable chips preview */}
                {extractVars(form.subject + " " + form.body).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-[11px] font-medium text-zinc-400">Variáveis detectadas:</span>
                    {extractVars(form.subject + " " + form.body).map(v => (
                      <span key={v} className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-mono">{v}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200">Cancelar</button>
              <button onClick={handleSave} className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm">Criar Template</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewTemplate(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
              <h2 className="text-base font-bold text-zinc-900">{previewTemplate.name}</h2>
              <button onClick={() => setPreviewTemplate(null)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Assunto</span>
                <p className="text-[13px] font-medium text-zinc-700 mt-1">{previewTemplate.subject}</p>
              </div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Corpo</span>
                <pre className="text-[13px] font-medium text-zinc-700 mt-2 whitespace-pre-wrap font-sans leading-relaxed">{previewTemplate.body}</pre>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 shrink-0">
              <button
                onClick={handleCopyPreview}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200"
              >
                {copiedPreview ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                Copiar conteudo
              </button>
              <button onClick={() => setPreviewTemplate(null)} className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
