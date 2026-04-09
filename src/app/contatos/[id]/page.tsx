"use client";

import { use } from "react";
import Link from "next/link";
import { useCrm } from "@/contexts/crm-context";
import { ArrowLeft, Building, Mail, Phone, Briefcase, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ContatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state } = useCrm();

  const contact = state.contacts.find(c => c.id === id);
  const company = state.companies.find(c => c.id === contact?.companyId);
  const deals = state.deals.filter(d => d.contactId === id);

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full">
        <h2 className="text-xl font-bold mb-4">Contato não encontrado</h2>
        <Link href="/contatos" className="px-6 py-2 bg-amber-500 text-white rounded-xl shadow-sm">
          Ir para contatos
        </Link>
      </div>
    );
  }

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col h-full animate-in fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8 shrink-0">
         <div className="flex items-center gap-4">
           <button onClick={() => window.history.back()} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-transparent">
             <ArrowLeft size={20} />
           </button>
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-lg border border-blue-100 shadow-sm">
               {contact.name.charAt(0).toUpperCase()}
             </div>
             <div>
               <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-none mb-1">{contact.name}</h1>
               <div className="text-sm text-gray-500 font-medium">{contact.role || "Sem cargo definido"}</div>
             </div>
           </div>
         </div>

         <div className="flex items-center gap-3">
           <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors shadow-sm bg-white">
             <Phone size={16} /> Ligar
           </button>
           <button className="flex items-center gap-2 px-6 py-2 bg-[#25D366] text-white font-bold text-sm rounded-xl hover:bg-[#1DA851] transition-colors shadow-sm shadow-[#25D366]/20">
             WhatsApp
           </button>
         </div>
      </div>

      <div className="flex gap-8 flex-1 h-[calc(100%-100px)]">
        
        {/* Main Content (Left) */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          
          {company && (
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <Link href={`/empresas/${company.id}`} className="block border border-amber-200/50 bg-amber-50/30 rounded-xl p-4 hover:border-amber-300 transition-colors group">
                 <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-lg border border-orange-200 shadow-sm group-hover:scale-105 transition-transform">
                     {company.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <p className="text-xs font-bold text-gray-400 mb-0.5 tracking-wider uppercase">Empresa Vinculada</p>
                     <h3 className="font-bold text-gray-900 group-hover:text-amber-600 text-base">{company.name}</h3>
                   </div>
                 </div>
              </Link>
            </div>
          )}

          {/* Internal Tabs */}
          <div className="flex gap-8 px-6 border-b border-gray-100">
             <button className="py-4 text-sm font-bold border-b-2 border-amber-500 text-amber-600">
                Negócios <span className="ml-1 text-xs text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full">{deals.length}</span>
             </button>
             <button className="py-4 text-sm font-bold border-b-2 border-transparent text-gray-400 hover:text-gray-600">
                Timeline
             </button>
          </div>

          <div className="p-6 overflow-y-auto">
             {deals.map(deal => (
               <Link 
                 key={deal.id} 
                 href={`/pipeline/${deal.id}`}
                 className="block mb-4 border border-gray-200 rounded-xl p-4 hover:border-amber-500 hover:shadow-md transition-all group bg-white"
               >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-amber-500 group-hover:scale-150 transition-transform"></div>
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                           <h4 className="font-bold text-gray-900 group-hover:text-amber-600">{deal.title}</h4>
                           <span className={cn(
                             "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded",
                             deal.status === 'Ativo' ? "bg-amber-100 text-amber-700" :
                             deal.status === 'Ganho' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                           )}>
                             {deal.status}
                           </span>
                         </div>
                         <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                            {state.pipelines.find(p => p.id === deal.pipelineId)?.name} 
                            <span className="text-gray-300">/</span> 
                            {state.pipelines.flatMap(p=>p.stages).find(s=>s.id === deal.stageId)?.name}
                         </p>
                       </div>
                    </div>
                    <div className="text-right">
                       <span className="font-bold text-gray-900 text-sm">
                         {deal.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                       </span>
                    </div>
                  </div>
               </Link>
             ))}
             {deals.length === 0 && (
               <div className="text-center py-12 text-gray-400 font-medium text-sm">
                 Nenhum negócio vinculado a este contato.
               </div>
             )}
          </div>
        </div>

        {/* Sidebar (Informações) */}
        <div className="w-80 shrink-0 space-y-6">
           <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Informações</h3>
              
              <div className="space-y-5">
                 <div className="flex items-start gap-4">
                   <Mail size={16} className="text-gray-400 mt-1 shrink-0" />
                   <div>
                     <div className="text-xs font-bold text-gray-500 mb-0.5">Email</div>
                     <div className="text-sm font-medium text-gray-900">{contact.email || "Não informado"}</div>
                   </div>
                 </div>

                 <div className="flex items-start gap-4">
                   <Phone size={16} className="text-gray-400 mt-1 shrink-0" />
                   <div>
                     <div className="text-xs font-bold text-gray-500 mb-0.5">Telefone</div>
                     <div className="text-sm font-medium text-gray-900">{contact.phone || "Não informado"}</div>
                   </div>
                 </div>

                 <div className="flex items-start gap-4">
                   <Briefcase size={16} className="text-gray-400 mt-1 shrink-0" />
                   <div>
                     <div className="text-xs font-bold text-gray-500 mb-0.5">Cargo</div>
                     <div className="text-sm font-medium text-gray-900">{contact.role || "Não informado"}</div>
                   </div>
                 </div>
              </div>
           </div>

           <div className="bg-gray-50 border border-gray-200 border-dashed rounded-2xl p-6 text-center">
              <Settings size={20} className="text-gray-400 mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-medium">Configure campos personalizados nas <span className="text-amber-500 cursor-pointer hover:underline">configurações</span></p>
           </div>

           <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Resumo Financeiro</h3>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-sm font-bold text-gray-500">Negócios Ativos</span>
                <span className="text-sm font-bold text-gray-900">{deals.filter(d=>d.status==='Ativo').length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">Valor Total</span>
                <span className="text-sm font-bold text-green-600">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
