"use client";

import { useState } from "react";
import { Plus, MessageCircle, X, Trash2, Check } from "lucide-react";

type Template = { id: string; name: string; message: string };

const VARS = ["{{nome_contato}}", "{{nome_empresa}}", "{{nome_negócio}}", "{{nome_vendedor}}"];

// Extract {{variables}} from text
function extractVars(text: string): string[] {
  const matches = text.match(/\{\{[^}]+\}\}/g) || [];
  return [...new Set(matches)];
}

function TemplateCard({
  template,
  onDelete,
}: {
  template: Template;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: template.name, message: template.message });

  const vars = extractVars(template.message);

  const insertVar = (v: string) => setEditForm(f => ({ ...f, message: f.message + v }));

  if (editing) {
    return (
      <div className="bg-white border border-amber-300 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">NOME</label>
            <input
              type="text"
              value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-3 py-2 outline-none focus:border-amber-500 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">MENSAGEM</label>
            <textarea
              rows={4}
              value={editForm.message}
              onChange={e => setEditForm({ ...editForm, message: e.target.value })}
              className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-3 py-2 outline-none focus:border-amber-500 transition-all resize-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {VARS.map(v => (
                <button
                  key={v}
                  onClick={() => insertVar(v)}
                  className="text-[11px] font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded-md transition-colors font-mono"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-100 bg-zinc-50/50">
          <button
            onClick={() => { setEditing(false); setEditForm({ name: template.name, message: template.message }); }}
            className="px-3 py-1.5 text-[12px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200"
          >
            Cancelar
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            <Check size={12} /> Salvar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 shadow-sm group hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
            <MessageCircle size={14} className="text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-zinc-900">{template.name}</p>
            <p className="text-[12px] font-medium text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">{template.message}</p>
            {vars.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {vars.map(v => (
                  <span key={v} className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded font-mono">{v}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-3">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg text-[12px] font-bold"
          >
            Editar
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesWhatsAppPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", message: "" });

  const insertVar = (v: string) => setForm(f => ({ ...f, message: f.message + v }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    setTemplates([...templates, { id: Date.now().toString(), ...form }]);
    setForm({ name: "", message: "" });
    setShowModal(false);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <MessageCircle size={20} className="text-green-500" />
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Templates de WhatsApp</h1>
            <p className="text-sm font-medium text-zinc-400 mt-0.5">Mensagens prontas para envio pelo chat.</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm">
          <Plus size={15} /> Novo Template
        </button>
      </div>

      <div className="flex-1 p-8">
        {templates.length === 0 ? (
          <div className="max-w-3xl bg-white border border-zinc-200 rounded-xl shadow-sm py-20 flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
              <MessageCircle size={26} className="text-green-400" />
            </div>
            <p className="text-[15px] font-bold text-zinc-700 mb-1">Nenhum template criado</p>
            <p className="text-[13px] font-medium text-zinc-400">Crie templates para enviar mensagens rapidamente pelo WhatsApp.</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-3">
            {templates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                onDelete={() => setTemplates(templates.filter(x => x.id !== t.id))}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-900">Novo template</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Nome do template</label>
                <input
                  type="text"
                  placeholder="Ex: Primeira abordagem"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Mensagem</label>
                <textarea
                  rows={4}
                  placeholder={`Use ${VARS[0]}, ${VARS[1]}, etc.`}
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all resize-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {VARS.map(v => (
                    <button
                      key={v}
                      onClick={() => insertVar(v)}
                      className="text-[11px] font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-md transition-colors font-mono"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200">Cancelar</button>
              <button onClick={handleSave} className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
