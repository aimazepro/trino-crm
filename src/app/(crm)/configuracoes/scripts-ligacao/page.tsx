"use client";

import { useState, useEffect } from "react";
import { Plus, Phone, X, Trash2, Edit2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";

type Script = { id: string; name: string; content: string };

const VARS = ["{nome_contato}", "{nome_empresa}", "{nome_negócio}", "{nome_vendedor}", "{produto_negócio}"];

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [showModal, setShowModal] = useState(false);
  // null = criando. Com id = editando aquele script. O botão de lápis existia
  // desde sempre, mas sem onClick nenhum: dava para criar e excluir, nunca
  // editar.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", content: "" });

  const openNew = () => { setEditingId(null); setForm({ name: "", content: "" }); setShowModal(true); };
  const openEdit = (s: Script) => { setEditingId(s.id); setForm({ name: s.name, content: s.content ?? "" }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingId(null); setForm({ name: "", content: "" }); };
  const supabase = createClient();
  const { workspaceId } = useWorkspace();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("scripts").select("id, name, content").order("created_at");
      setScripts(data ?? []);
    }
    load();
  }, [supabase]);

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editingId) {
      const { data, error } = await supabase.from("scripts")
        .update({ name: form.name, content: form.content })
        .eq("id", editingId)
        .select("id, name, content")
        .single();
      if (error || !data) {
        console.error("[scripts] update falhou:", error);
        alert(`Erro ao salvar script: ${error?.message ?? "desconhecido"}`);
        return;
      }
      setScripts(prev => prev.map(s => s.id === editingId ? data : s));
    } else {
      const { data, error } = await supabase.from("scripts").insert({
        workspace_id: workspaceId, name: form.name, content: form.content,
      }).select("id, name, content").single();
      if (error || !data) {
        console.error("[scripts] insert falhou:", error);
        alert(`Erro ao criar script: ${error?.message ?? "desconhecido"}`);
        return;
      }
      setScripts(prev => [...prev, data]);
    }

    closeModal();
  };

  const handleDelete = async (id: string) => {
    // Tirava da tela antes de saber se o banco aceitou: script recusado sumia
    // e voltava no reload.
    const { error } = await supabase.from("scripts").delete().eq("id", id);
    if (error) {
      console.error("[scripts] delete falhou:", error);
      alert(`Erro ao excluir script: ${error.message}`);
      return;
    }
    setScripts(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Scripts de Ligacao</h1>
          <p className="text-sm font-medium text-zinc-400 mt-0.5">Roteiros para seguir durante ligações com leads.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm">
          <Plus size={15} /> Novo Script
        </button>
      </div>

      <div className="flex-1 p-8">
        {scripts.length === 0 ? (
          <div className="max-w-3xl bg-white border border-zinc-200 rounded-xl shadow-sm py-20 flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
              <Phone size={26} className="text-zinc-300" />
            </div>
            <p className="text-[14px] font-medium text-zinc-400">Nenhum script criado ainda.</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-3">
            {scripts.map(s => (
              <div key={s.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-4 shadow-sm flex items-start justify-between group">
                <div>
                  <p className="text-[14px] font-bold text-zinc-900">{s.name}</p>
                  <p className="text-[12px] font-medium text-zinc-400 mt-0.5 line-clamp-2">{s.content}</p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-3">
                  <button onClick={() => openEdit(s)} title="Editar script" className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-900">{editingId ? "Editar Script" : "Novo Script"}</h2>
              <button onClick={closeModal} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">NOME DO SCRIPT <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="Ex: Script de primeira ligação"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">CONTEÚDO</label>
                <textarea
                  rows={5}
                  placeholder={`Olá ${"{nome_contato}"}, tudo bem? Meu nome é...`}
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all resize-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {VARS.map(v => (
                    <button
                      key={v}
                      onClick={() => setForm(f => ({ ...f, content: f.content + v }))}
                      className="text-[11px] font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-md transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100">
              <button onClick={closeModal} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200">Cancelar</button>
              <button onClick={handleSave} className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
