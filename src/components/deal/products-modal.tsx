"use client";

import { useState } from "react";
import { X, Trash2, Plus } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { DealProduct, Deal } from "@/lib/crm-types";

interface ProductsModalProps {
  deal: Deal;
  onClose: () => void;
}

export function ProductsModal({ deal, onClose }: ProductsModalProps) {
  const { updateDealFields } = useCrm();
  const [products, setProducts] = useState<DealProduct[]>(deal.products || []);
  
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newPrice, setNewPrice] = useState("");

  const handleAddProduct = () => {
    if (!newName.trim()) return;
    const priceNum = parseFloat(newPrice.replace(/[^0-9.-]+/g, "")) || 0;
    
    const newProduct: DealProduct = {
      id: `prod_${Date.now()}`,
      name: newName,
      quantity: newQuantity,
      price: priceNum
    };
    
    setProducts([...products, newProduct]);
    setNewName("");
    setNewQuantity(1);
    setNewPrice("");
  };

  const handleRemoveProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const handleSave = () => {
    // Also recalculate total value?
    const total = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    updateDealFields(deal.id, { products, value: total });
    onClose();
  };

  const totalCurrentValue = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] flex flex-col max-h-full animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2 shrink-0 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Produtos</h2>
            <p className="text-sm text-gray-500 mt-1">Adicione ou remova produtos deste negócio.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors self-start">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Add Form */}
          <div className="flex items-end gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
             <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-gray-600">Produto</label>
                <input 
                  value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Nome do produto/serviço..."
                  className="w-full text-sm py-2 px-3 border rounded-lg outline-none focus:border-amber-500 shadow-sm"
                />
             </div>
             <div className="w-20 space-y-1">
                <label className="text-xs font-bold text-gray-600">Qtd.</label>
                <input 
                  type="number" min="1"
                  value={newQuantity} onChange={e => setNewQuantity(parseInt(e.target.value) || 1)}
                  className="w-full text-sm py-2 px-3 border rounded-lg outline-none focus:border-amber-500 shadow-sm text-center"
                />
             </div>
             <div className="w-32 space-y-1">
                <label className="text-xs font-bold text-gray-600">Preço Un.</label>
                <input 
                  value={newPrice} onChange={e => setNewPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-sm py-2 px-3 border rounded-lg outline-none focus:border-amber-500 shadow-sm"
                />
             </div>
             <button 
               onClick={handleAddProduct}
               className="bg-gray-900 text-white font-bold h-[38px] px-4 rounded-lg hover:bg-black transition-colors flex items-center justify-center shadow-sm"
             >
                <Plus size={16} />
             </button>
          </div>

          {/* List */}
          <div className="space-y-3">
             {products.length === 0 ? (
               <div className="text-center py-8 text-gray-400 text-sm">Nenhum produto adicionado.</div>
             ) : (
               products.map(p => (
                 <div key={p.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-amber-200 transition-colors">
                    <div className="flex-1">
                       <h4 className="font-bold text-sm text-gray-900">{p.name}</h4>
                       <div className="text-xs text-gray-500 mt-0.5">
                         {p.quantity}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price)}
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="font-bold text-green-600 text-sm">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price * p.quantity)}
                       </span>
                       <button onClick={() => handleRemoveProduct(p.id)} className="text-red-400 hover:text-red-600 p-1">
                         <Trash2 size={16} />
                       </button>
                    </div>
                 </div>
               ))
             )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between">
           <div className="text-gray-500 text-sm font-medium">
             Total: <strong className="text-gray-900 text-lg ml-1">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCurrentValue)}</strong>
           </div>
           <div className="flex gap-3">
             <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-bold text-gray-600 bg-white hover:bg-gray-50">Cancelar</button>
             <button onClick={handleSave} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-sm shadow-amber-500/20">Salvar Produtos</button>
           </div>
        </div>

      </div>
    </div>
  );
}
