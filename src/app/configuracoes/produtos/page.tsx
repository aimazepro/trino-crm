"use client";

import { useState } from "react";
import { Plus, Search, Tag, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  price: number | null;
  maxDiscount: number;
  tags: string[];
};

const MOCK_PRODUCTS: Product[] = [
  { id: "1", name: "Mentoria de Vendas", price: 5000, maxDiscount: 10, tags: ["Serviço", "Avançado"] },
  { id: "2", name: "Implantação CRM", price: null, maxDiscount: 0, tags: ["Serviço"] },
  { id: "3", name: "Licença Anual", price: 1200, maxDiscount: 5, tags: ["Software"] },
];

export default function ProdutosConfigPage() {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [searchTerm, setSearchTerm] = useState("");
  
  return (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Catálogo de Produtos</h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">Gerencie os produtos ou serviços do seu negócio</p>
        </div>
      </div>

      {/* Toolbox */}
      <div className="flex items-center justify-between px-8 py-4 bg-zinc-50/50 border-b border-zinc-100 shrink-0">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Pesquisar produtos..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-[13px] font-medium text-zinc-700 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-zinc-400"
          />
        </div>

        <button className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm">
          <Plus size={15} /> Novo Produto
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider w-1/3">Nome do Produto</th>
                <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-right">Preço Base</th>
                <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-right">Desc. Máx</th>
                <th className="px-6 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Tags</th>
                <th className="px-6 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-[13px] font-semibold text-zinc-900">{product.name}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[13px] font-medium text-zinc-600">
                      {product.price ? `R$ ${product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[13px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      {product.maxDiscount}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {product.tags.map(tag => (
                        <span key={tag} className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
                          <Tag size={10} /> {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-zinc-400 hover:bg-zinc-100 rounded-md opacity-0 group-hover:opacity-100 transition-all">
                      <MoreHorizontal size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400 text-sm font-medium">
                    Nenhum produto cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
