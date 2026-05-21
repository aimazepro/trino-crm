"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2, Plus, Search } from "lucide-react";
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
  const [newDiscount, setNewDiscount] = useState(0);

  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("crm_catalog_products");
    if (saved) {
      try {
        setCatalogProducts(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleAddProduct = () => {
    if (!newName.trim()) return;
    const priceNum = parseFloat(String(newPrice).replace(/[^0-9.-]+/g, "")) || 0;
    const discountNum = parseFloat(String(newDiscount)) || 0;
    
    // Apply discount to unit price
    const finalPrice = priceNum * (1 - discountNum / 100);
    
    const newProduct: DealProduct = {
      id: `prod_${Date.now()}`,
      name: newName,
      quantity: newQuantity,
      price: finalPrice
    };
    
    setProducts([...products, newProduct]);
    setNewName("");
    setNewQuantity(1);
    setNewPrice("");
    setNewDiscount(0);
    setIsDropdownOpen(false);
  };

  const handleRemoveProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const handleSave = () => {
    const total = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    updateDealFields(deal.id, { products, value: total });
    onClose();
  };

  const totalCurrentValue = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);

  const filteredCatalog = newName.trim()
    ? catalogProducts.filter(p => p.name.toLowerCase().includes(newName.toLowerCase()))
    : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-[600px] flex flex-col max-h-full animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 shrink-0 border-b border-gray-100 relative">
          <div className="flex-1 text-center">
            <h2 className="text-xl font-bold text-gray-900">Produtos</h2>
          </div>
          <button onClick={onClose} className="absolute right-6 top-6 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Add Form */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
             {/* Autocomplete Product Search */}
             <div className="relative space-y-1" ref={dropdownRef}>
                <label className="text-xs font-bold text-gray-600">Buscar produto...</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    value={newName} 
                    onChange={e => {
                      setNewName(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Busque no catálogo ou digite um produto customizado..."
                    className="w-full text-sm py-2 pl-9 pr-3 border rounded-lg bg-white outline-none focus:border-amber-500"
                  />
                </div>

                {isDropdownOpen && filteredCatalog.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {filteredCatalog.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setNewName(p.name);
                          setNewPrice(String(p.price));
                          setIsDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 text-left text-xs font-semibold text-gray-900 transition-colors"
                      >
                        <span>{p.name}</span>
                        <span className="text-amber-600">R$ {p.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </button>
                    ))}
                  </div>
                )}
             </div>

             {/* Details Inputs (Qtd, Preço, Desc %) */}
             <div className="grid grid-cols-3 gap-3">
               <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">Qtd.</label>
                  <input 
                    type="number" min="1"
                    value={newQuantity} 
                    onChange={e => setNewQuantity(parseInt(e.target.value) || 1)}
                    className="w-full text-sm py-2 px-3 border rounded-lg bg-white outline-none focus:border-amber-500 text-center font-semibold"
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">Preço Un.</label>
                  <input 
                    value={newPrice} 
                    onChange={e => setNewPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-sm py-2 px-3 border rounded-lg bg-white outline-none focus:border-amber-500 font-semibold"
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">Desc %</label>
                  <input 
                    type="number" min="0" max="100"
                    value={newDiscount} 
                    onChange={e => setNewDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full text-sm py-2 px-3 border rounded-lg bg-white outline-none focus:border-amber-500 text-center font-semibold"
                  />
               </div>
             </div>

             <button 
               onClick={handleAddProduct}
               className="w-full bg-amber-500 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-1.5 text-sm"
             >
                <Plus size={16} /> Adicionar produto
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
             <button onClick={handleSave} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-amber-500 hover:bg-amber-600">Salvar Produtos</button>
           </div>
        </div>

      </div>
    </div>
  );
}
