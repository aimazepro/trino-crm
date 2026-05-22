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

const UNITS = [
  { value: "", label: "Selecionar unidade" },
  { value: "unidade", label: "Unidade" },
  { value: "hora", label: "Hora" },
  { value: "mes", label: "Mês" },
  { value: "licenca", label: "Licença" },
  { value: "projeto", label: "Projeto" },
  { value: "outro", label: "Outro" },
];

export default function ProdutosConfigPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [form, setForm] = useState({ 
    name: "", 
    description: "", 
    price: "", 
    code: "", 
    unit: "" 
  });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Load Products from Supabase
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

  useEffect(() => { 
    loadProducts(); 
  }, [loadProducts]);

  // Handle Edit Start
  const handleStartEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      code: product.sku || "",
      unit: product.unit || ""
    });
    setShowModal(true);
  };

  // Close Modal and Reset Form
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setForm({ name: "", description: "", price: "", code: "", unit: "" });
  };

  // Handle Create or Update Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const productPayload = {
      user_id: user.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      sku: form.code.trim() || null,
      price: parseFloat(form.price) || 0,
      unit: form.unit || null,
      active: true,
    };

    if (editingProduct) {
      // Update
      const { data, error } = await supabase
        .from("products")
        .update(productPayload)
        .eq("id", editingProduct.id)
        .select()
        .single();

      if (!error && data) {
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? data : p));
      }
    } else {
      // Insert
      const { data, error } = await supabase
        .from("products")
        .insert(productPayload)
        .select()
        .single();

      if (!error && data) {
        setProducts(prev => [...prev, data]);
      }
    }

    setSaving(false);
    handleCloseModal();
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      await supabase.from("products").delete().eq("id", id);
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="p-6 max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Catálogo de Produtos</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Gerencie os produtos e serviços do seu workspace.</p>
          </div>
          <button 
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input 
            type="text"
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl bg-white border border-zinc-200 pl-9 pr-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400 transition-colors"
          />
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400 border border-zinc-200 bg-white rounded-xl">
            <Package className="h-10 w-10 text-zinc-300" />
            <p className="text-sm font-medium">Nenhum produto cadastrado</p>
            <button 
              onClick={() => {
                setEditingProduct(null);
                setShowModal(true);
              }}
              className="text-sm text-amber-500 hover:underline font-medium"
            >
              Criar primeiro produto
            </button>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">NOME</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">CÓDIGO</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">PREÇO</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">UNIDADE</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">STATUS</th>
                  <th className="px-6 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(p => {
                  const unitObj = UNITS.find(u => u.value === p.unit);
                  const unitLabel = unitObj ? unitObj.label : "—";
                  
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-3 text-sm font-semibold text-zinc-900">{p.name}</td>
                      <td className="px-6 py-3 text-sm font-medium text-zinc-400">{p.sku || "—"}</td>
                      <td className="px-6 py-3 text-sm font-medium text-zinc-700">
                        R$ {Number(p.price ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-zinc-600">{p.unit ? unitLabel : "—"}</td>
                      <td className="px-6 py-3">
                        <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200/50">
                          {p.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all justify-end">
                          <button 
                            onClick={() => handleStartEdit(p)}
                            className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(p.id)} 
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={handleCloseModal}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 border border-zinc-200/80 mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-zinc-900">
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Nome <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text"
                  placeholder="Ex: Consultoria Mensal"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Descrição</label>
                <textarea 
                  placeholder="Descrição opcional do produto..." 
                  rows={3} 
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Preço <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="number"
                    step="0.01" 
                    min="0" 
                    placeholder="0,00"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    required
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Código</label>
                  <input 
                    type="text"
                    placeholder="SKU-001"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Unidade</label>
                <select 
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 bg-white"
                >
                  {UNITS.map(u => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  type="submit" 
                  disabled={saving || !form.name.trim() || !form.price}
                  className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Salvando..." : (editingProduct ? "Salvar Alterações" : "Criar Produto")}
                </button>
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="rounded-xl bg-zinc-100 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
