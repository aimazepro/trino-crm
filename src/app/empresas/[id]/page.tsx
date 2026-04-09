"use client";

import { use } from "react";
import Link from "next/link";
import { useCrm } from "@/contexts/crm-context";
import { ArrowLeft, MapPin, Globe, Tags, Building2, FileText, Settings, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state } = useCrm();

  const company = state.companies.find(c => c.id === id);
  const employees = state.contacts.filter(c => c.companyId === id);
  const deals = state.deals.filter(d => d.companyId === id);

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full animate-in fade-in">
        <h2 className="text-xl font-bold mb-4">Empresa não encontrada</h2>
        <Link href="/empresas" className="px-6 py-2 bg-amber-500 text-white rounded-xl shadow-sm">
          Ir para empresas
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
             <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-lg shadow-sm border border-orange-200">
               {company.name.charAt(0).toUpperCase()}
             </div>
             <div>
               <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-none mb-1">{company.name}</h1>
               <div className="text-sm text-gray-500 font-medium flex items-center gap-2">
                 {company.city && company.state ? `${company.city} - ${company.state}` : "Localização não informada"}
                 {company.segment && <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs text-gray-600">{company.segment}</span>}
               </div>
             </div>
           </div>
         </div>
      </div>

      <div className="flex gap-8 flex-1 h-[calc(100%-100px)]">
        
        {/* Main Content (Left) */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Contatos Vinculados</h3>
             {employees.length > 0 ? (
               <div className="grid grid-cols-2 gap-4">
                 {employees.map(emp => (
                   <Link key={emp.id} href={`/contatos/${emp.id}`} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 hover:border-blue-300 hover:shadow-sm transition-all group">
                     <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs shadow-sm group-hover:scale-105 transition-transform">
                       {emp.name.charAt(0).toUpperCase()}
                     </div>
                     <div>
                       <h4 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">{emp.name}</h4>
                       <p className="text-xs text-gray-500">{emp.role || "Sem cargo"}</p>
                     </div>
                   </Link>
                 ))}
               </div>
             ) : (
                <div className="text-sm text-gray-400 font-medium">Nenhum contato adicionado a esta empresa.</div>
             )}
          </div>

          {/* Internal Tabs */}
          <div className="flex gap-8 px-6 border-b border-gray-100">
             <button className="py-4 text-sm font-bold border-b-2 border-amber-500 text-amber-600">
                Negócios <span className="ml-1 text-xs text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full">{deals.length}</span>
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
                 Nenhum negócio vinculado a esta empresa.
               </div>
             )}
          </div>
        </div>

        {/* Sidebar (Informações) */}
        <div className="w-80 shrink-0 space-y-6">
           <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Dados Cadastrais</h3>
              
              <div className="space-y-5">
                 <div className="flex items-start gap-4">
                   <Globe size={16} className="text-gray-400 mt-1 shrink-0" />
                   <div>
                     <div className="text-xs font-bold text-gray-500 mb-0.5">Website</div>
                     <div className="text-sm font-medium text-blue-600 hover:underline cursor-pointer">{company.website || "Não informado"}</div>
                   </div>
                 </div>

                 <div className="flex items-start gap-4">
                   <Tags size={16} className="text-gray-400 mt-1 shrink-0" />
                   <div>
                     <div className="text-xs font-bold text-gray-500 mb-0.5">Segmento</div>
                     <div className="text-sm font-medium text-gray-900">{company.segment || "Não informado"}</div>
                   </div>
                 </div>

                 <div className="flex items-start gap-4">
                   <Building2 size={16} className="text-gray-400 mt-1 shrink-0" />
                   <div>
                     <div className="text-xs font-bold text-gray-500 mb-0.5">Porte</div>
                     <div className="text-sm font-medium text-gray-900">{company.size || "Não informado"}</div>
                   </div>
                 </div>
                 
                 <div className="flex items-start gap-4">
                   <FileText size={16} className="text-gray-400 mt-1 shrink-0" />
                   <div>
                     <div className="text-xs font-bold text-gray-500 mb-0.5">CNPJ</div>
                     <div className="text-sm font-medium text-gray-900">{company.cnpj || "Não informado"}</div>
                   </div>
                 </div>

                 <div className="flex items-start gap-4">
                   <MapPin size={16} className="text-gray-400 mt-1 shrink-0" />
                   <div>
                     <div className="text-xs font-bold text-gray-500 mb-0.5">Localização</div>
                     <div className="text-sm font-medium text-gray-900">{company.city ? `${company.city} - ${company.state}` : "Não informado"}</div>
                   </div>
                 </div>
              </div>
           </div>

           <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Desempenho Geral</h3>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-sm font-bold text-gray-500">Negócios Ativos</span>
                <span className="text-sm font-bold text-gray-900">{deals.filter(d=>d.status==='Ativo').length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">Valor Estimado</span>
                <span className="text-sm font-bold text-green-600">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
