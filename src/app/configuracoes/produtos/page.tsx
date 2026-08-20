"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

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
  const { workspaceId } = useWorkspace();
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
    unit: "",
    active: true,
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
      unit: product.unit || "",
      active: product.active ?? true,
    });
    setShowModal(true);
  };

  // Close Modal and Reset Form
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setForm({ name: "", description: "", price: "", code: "", unit: "", active: true });
  };

  // Handle Create or Update Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const productPayload = {
      workspace_id: workspaceId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      sku: form.code.trim() || null,
      price: parseFloat(form.price) || 0,
      unit: form.unit || null,
      active: form.active,
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
              setForm({ name: "", description: "", price: "", code: "", unit: "", active: true });
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors cursor-pointer"
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
            className="w-full rounded-xl bg-white pl-9 pr-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-amber-100 border border-zinc-200/80 transition-colors"
          />
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400 border border-zinc-200 bg-white rounded-2xl">
            <Package className="h-10 w-10 text-zinc-300" />
            <p className="text-sm font-medium">Nenhum produto cadastrado</p>
            <button 
              onClick={() => {
                setEditingProduct(null);
                setForm({ name: "", description: "", price: "", code: "", unit: "", active: true });
                setShowModal(true);
              }}
              className="text-sm text-amber-500 hover:underline font-medium cursor-pointer"
            >
              Criar primeiro produto
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white overflow-hidden border border-zinc-100 shadow-xs">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Preço</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Unidade</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(p => {
                  const unitObj = UNITS.find(u => u.value === p.unit);
                  const unitLabel = unitObj ? unitObj.label.toLowerCase() : p.unit;
                  
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50 group transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[200px]">{p.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {p.sku ? p.sku : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        R$&nbsp;{Number(p.price ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{p.unit ? unitLabel : "—"}</td>
                      <td className="px-4 py-3">
                        {p.active !== false ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleStartEdit(p)}
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(p.id)} 
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Excluir"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200/80 mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-zinc-900 mb-4">
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </h2>

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

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, active: !prev.active }))}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer",
                    form.active ? "bg-amber-500" : "bg-zinc-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                      form.active ? "translate-x-4.5" : "translate-x-1"
                    )}
                  />
                </button>
                <span className="text-sm text-zinc-700">{form.active ? "Ativo" : "Inativo"}</span>
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  type="submit" 
                  disabled={saving || !form.name.trim() || !form.price}
                  className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="rounded-xl bg-zinc-100 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-200 transition-colors cursor-pointer"
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
