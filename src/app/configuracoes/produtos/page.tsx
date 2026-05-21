"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, Package, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  unit: string | null;
  active: boolean;
};

const UNITS = ["Selecionar unidade", "Unidade", "Hora", "Mês", "Licença", "Projeto", "Outro"];

export default function ProdutosConfigPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "", code: "", unit: "Selecionar unidade" });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at");

    setProducts(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await supabase.from("products").insert({
      user_id: user.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      sku: form.code.trim() || null,
      price: parseFloat(form.price) || 0,
      unit: form.unit === "Selecionar unidade" ? null : form.unit,
      active: true,
    }).select().single();

    setSaving(false);
    if (!error && data) {
      setProducts(prev => [...prev, data]);
    }
    setForm({ name: "", description: "", price: "", code: "", unit: "Selecionar unidade" });
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("products").delete().eq("id", id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">

      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Catálogo de Produtos</h1>
          <p className="text-sm font-medium text-zinc-400 mt-0.5">Gerencie os produtos e serviços do seu workspace.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus size={15} /> Novo Produto
        </button>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-4xl space-y-4">

          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500 transition-all placeholder:text-zinc-400"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm py-16 flex flex-col items-center justify-center">
              <Package size={36} className="text-zinc-300 mb-3" />
              <p className="text-[14px] font-semibold text-zinc-500 mb-1">Nenhum produto cadastrado</p>
              <button
                onClick={() => setShowModal(true)}
                className="text-[13px] font-bold text-amber-600 hover:text-amber-700 transition-colors"
              >
                Criar primeiro produto
              </button>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">NOME</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">CÓDIGO</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">PREÇO</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">UNIDADE</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-3 text-[13px] font-semibold text-zinc-900">{p.name}</td>
                      <td className="px-6 py-3 text-[13px] font-medium text-zinc-400">{p.sku || "—"}</td>
                      <td className="px-6 py-3 text-[13px] font-medium text-zinc-700">
                        R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 text-[13px] font-medium text-zinc-600">{p.unit || "—"}</td>
                      <td className="px-6 py-3">
                        <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                          {p.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 size={13} />
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
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-zinc-900">Novo Produto</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Nome <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="Ex: Consultoria Mensal"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Descrição</label>
                <textarea
                  placeholder="Descrição opcional do produto..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-zinc-700">Preço <span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-zinc-700">Código / SKU</label>
                  <input
                    type="text"
                    placeholder="SKU-001"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-zinc-700">Unidade</label>
                <select
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all"
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="px-5 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 shadow-sm disabled:opacity-50"
              >
                {saving ? "Criando..." : "Criar Produto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
