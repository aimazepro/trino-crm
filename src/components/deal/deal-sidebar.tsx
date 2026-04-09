"use client";

import { useState } from "react";
import { useCrm } from "@/contexts/crm-context";
import { DollarSign, Calendar, Clock, Hash, Tag, Plus, Phone, Mail, Building, Briefcase } from "lucide-react";
import Link from "next/link";
import { Label } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

interface DealSidebarProps {
  dealId: string;
}

export function DealSidebar({ dealId }: DealSidebarProps) {
  const { state, updateContact } = useCrm();
  const deal = state.deals.find(d => d.id === dealId);
  const contact = state.contacts.find(c => c.id === deal?.contactId);
  const company = state.companies.find(c => c.id === deal?.companyId);

  const [isEditingContact, setIsEditingContact] = useState(false);
  const [tempPhone, setTempPhone] = useState(contact?.phone || "");
  const [tempEmail, setTempEmail] = useState(contact?.email || "");

  if (!deal || !contact) return null;

  const handleSaveContact = () => {
    updateContact(contact.id, { phone: tempPhone, email: tempEmail });
    setIsEditingContact(false);
  };

  return (
    <div className="w-80 border-r border-gray-100 bg-gray-50/30 p-6 flex flex-col gap-6 overflow-y-auto hide-scrollbar shrink-0">
      
      {/* Resumo */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resumo</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-2 text-gray-500">
              <DollarSign size={16} />
              <span className="text-sm font-medium">Adicionar valor</span>
            </div>
            <button className="text-amber-500 font-bold text-xs hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
              + Produtos
            </button>
          </div>

          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-2 text-gray-900">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm font-medium">Previsão</span>
            </div>
            <span className="text-sm text-gray-400 font-medium cursor-pointer hover:text-gray-600">Definir data</span>
          </div>

          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-2 text-gray-900">
              <Clock size={16} className="text-gray-400" />
              <span className="text-sm font-medium">Na etapa</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{deal.daysInStage} dias</span>
          </div>

          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-2 text-gray-500">
              <Hash size={16} />
              <span className="text-sm font-medium">Probabilidade</span>
            </div>
            <span className="text-xs text-gray-300 font-medium">Adicionar</span>
          </div>

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

      {/* Pessoa */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <span>Pessoa</span>
        </h3>

        <Link href={`/contatos/${contact.id}`} className="flex items-center gap-3 group">
           <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs shrink-0 group-hover:scale-105 transition-transform">
             {contact.name.charAt(0).toUpperCase()}
           </div>
           <span className="font-bold text-sm text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
             {contact.name}
           </span>
        </Link>

        {isEditingContact ? (
          <div className="space-y-3 pt-2 text-sm">
             <div>
               <label className="text-xs text-gray-500 mb-1 block">Email</label>
               <input value={tempEmail} onChange={e => setTempEmail(e.target.value)} className="w-full border rounded p-1.5" />
             </div>
             <div>
               <label className="text-xs text-gray-500 mb-1 block">Telefone</label>
               <input value={tempPhone} onChange={e => setTempPhone(e.target.value)} className="w-full border rounded p-1.5" />
             </div>
             <button onClick={handleSaveContact} className="w-full bg-amber-500 text-white font-bold rounded py-1.5">Salvar</button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 text-sm">
              <Mail size={16} className="text-gray-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-gray-900 truncate max-w-[150px]">{contact.email || "Sem email"}</div>
                {!contact.email && <button onClick={() => setIsEditingContact(true)} className="text-xs font-bold text-amber-500 mt-1">+ Adicionar e-mail</button>}
              </div>
            </div>
            
            <div className="flex items-start gap-3 text-sm">
              <Phone size={16} className="text-gray-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-gray-900">{contact.phone || "Sem telefone"}</div>
                <button onClick={() => setIsEditingContact(true)} className="text-xs font-bold text-amber-500 mt-1">+ Adicionar telefone</button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Briefcase size={16} className="text-gray-400 shrink-0" />
              <div className="text-gray-900 font-medium">{contact.role || "Cargo não informado"}</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-50">
           <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-600 font-medium text-xs hover:bg-gray-50">
             <Phone size={14} /> Ligar
           </button>
           <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#25D366] text-white font-medium text-xs hover:bg-[#1DA851] shadow-sm">
             WhatsApp
           </button>
        </div>
      </div>

      {/* Empresa */}
      {company && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>Empresa</span>
          </h3>

          <Link href={`/empresas/${company.id}`} className="flex items-center gap-3 group">
             <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs shrink-0 group-hover:scale-105 transition-transform">
               {company.name.charAt(0).toUpperCase()}
             </div>
             <span className="font-bold text-sm text-gray-900 line-clamp-2 leading-tight group-hover:text-orange-600 transition-colors">
               {company.name}
             </span>
          </Link>

          <div className="space-y-2 pt-2">
             <div className="flex gap-2 text-xs">
                <span className="text-gray-400 w-20">Segmento</span>
                <span className="text-gray-900 font-medium">{company.segment || "-"}</span>
             </div>
             <div className="flex gap-2 text-xs">
                <span className="text-gray-400 w-20">Porte</span>
                <span className="text-gray-900 font-medium">{company.size || "-"}</span>
             </div>
             <div className="flex gap-2 text-xs">
                <span className="text-gray-400 w-20">CNPJ</span>
                <span className="text-gray-900 font-medium">{company.cnpj || "-"}</span>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
