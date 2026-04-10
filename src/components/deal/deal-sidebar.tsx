"use client";

import { useState } from "react";
import { DollarSign, Calendar, Clock, Hash, Tag, Plus } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { InlineEdit } from "./inline-edit";
import { ContactAccordion } from "./contact-accordion";
import { CompanyAccordion } from "./company-accordion";
import { ProductsModal } from "./products-modal";
import { cn } from "@/lib/utils";

interface DealSidebarProps {
  dealId: string;
}

export function DealSidebar({ dealId }: DealSidebarProps) {
  const { state, updateDealFields } = useCrm();
  const deal = state.deals.find(d => d.id === dealId);
  const contact = state.contacts.find(c => c.id === deal?.contactId);
  const company = state.companies.find(c => c.id === deal?.companyId);

  const [isProductsOpen, setIsProductsOpen] = useState(false);

  if (!deal || !contact) return null;

  const handleUpdate = (field: string, val: string | number) => {
    updateDealFields(dealId, { [field]: val });
  };

  const handleProbabilityChange = (v: string) => {
    let num = parseInt(v.replace(/\D/g, ""), 10);
    if (isNaN(num)) num = 0;
    if (num > 100) num = 100;
    handleUpdate("probability", num);
  };

  const probability = deal.probability || 0;

  return (
    <div className="w-[340px] border-r border-gray-100 bg-gray-50/30 p-5 flex flex-col gap-6 overflow-y-auto hide-scrollbar shrink-0">
      
      {/* Resumo */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Resumo</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 font-bold">$</span>
              <span className="font-bold text-gray-900">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
              </span>
            </div>
            <button 
              onClick={() => setIsProductsOpen(true)}
              className="text-amber-500 font-bold text-xs hover:text-amber-600 transition-colors flex items-center gap-1"
            >
              <Plus size={12}/> Produtos
            </button>
          </div>

          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-2 text-gray-900">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm font-medium">Previsão</span>
            </div>
            <div className="w-32">
               <InlineEdit 
                 type="date"
                 value={deal.expectedCloseDate ? deal.expectedCloseDate.substring(0,10) : ""} 
                 onSave={(v) => handleUpdate("expectedCloseDate", v ? new Date(v).toISOString() : "")} 
               />
            </div>
          </div>

          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-2 text-gray-900">
              <Clock size={16} className="text-gray-400" />
              <span className="text-sm font-medium">Na etapa</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{deal.daysInStage} dias</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2 text-gray-500">
                <Hash size={16} />
                <span className="text-sm font-medium">Probabilidade</span>
              </div>
              <div className="flex items-center gap-1">
                 <input 
                   type="text" 
                   value={probability} 
                   onChange={(e) => handleProbabilityChange(e.target.value)}
                   className="w-10 px-1 py-0.5 text-center text-sm border rounded outline-none focus:border-amber-500" 
                 />
                 <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
            {/* Range Slider for Probability */}
            <div className="flex items-center gap-2">
               <input 
                  type="range" 
                  min="0" max="100" 
                  value={probability} 
                  onChange={(e) => handleUpdate("probability", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
               />
            </div>
          </div>

          <div className="h-px bg-gray-100 my-2"></div>

          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-2 text-gray-900">
              <Tag size={16} className="text-gray-400" />
              <span className="text-sm font-medium">Etiquetas</span>
            </div>
            <span className="text-xs text-amber-500 font-bold cursor-pointer">Editar</span>
          </div>
          
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-full text-xs font-medium text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors">
            <Plus size={14} /> Adicionar etiqueta
          </button>
        </div>
      </div>

      {/* Accordions */}
      <ContactAccordion contact={contact} />
      
      {company && <CompanyAccordion company={company} />}

      {isProductsOpen && <ProductsModal deal={deal} onClose={() => setIsProductsOpen(false)} />}
    </div>
  );
}
