"use client";

import { useCrm } from "@/contexts/crm-context";
import { MoreHorizontal, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface KanbanListViewProps {
  pipelineId: string;
  statusFilter?: "Ativo" | "Ganho" | "Perdido";
}

export function KanbanListView({ pipelineId, statusFilter = "Ativo" }: KanbanListViewProps) {
  const { state } = useCrm();

  const pipeline = state.pipelines.find(p => p.id === pipelineId);
  const deals = state.deals.filter(d => 
    d.pipelineId === pipelineId && 
    d.status === statusFilter
  );

  if (!pipeline) return null;

  return (
    <div className="h-full flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
       
       {/* Secondary Filter Bar */}
       <div className="flex items-center gap-3 p-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <select className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-3 py-1.5 outline-none hover:border-gray-300">
             <option>Todas as etapas</option>
             {pipeline.stages.map(s => (
               <option key={s.id}>{s.name}</option>
             ))}
          </select>
          <select className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-3 py-1.5 outline-none hover:border-gray-300">
             <option>Todos os status</option>
             <option>Ativos</option>
             <option>Ganhos</option>
             <option>Perdidos</option>
          </select>
          <button className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-4 py-1.5 hover:bg-gray-50 flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-gray-400"></div> Etiqueta
          </button>
          
          <div className="flex-1 ml-4 relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              placeholder="Buscar negócio..." 
              className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:border-amber-500"
            />
          </div>
       </div>

       {/* Table Body */}
       <div className="flex-1 overflow-auto bg-white">
         <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 sticky top-0 z-10 border-b border-gray-200">
               <tr>
                 <th className="p-3 w-10 text-center"><input type="checkbox" className="rounded border-gray-300" /></th>
                 <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                 <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Valor</th>
                 <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Etapa</th>
                 <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                 <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                 <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
                 <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Proprietário</th>
                 <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                 <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Ações</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {deals.map(deal => {
                 const stage = pipeline.stages.find(s => s.id === deal.stageId);
                 const company = state.companies.find(c => c.id === deal.companyId);
                 const contact = deal.contactId ? state.contacts.find(c => c.id === deal.contactId) : undefined;

                 return (
                   <tr key={deal.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => window.location.href = `/negocios/${deal.id}`}>
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}><input type="checkbox" className="rounded border-gray-300" /></td>
                      <td className="p-3">
                        <span className="font-medium text-gray-900 text-sm group-hover:text-amber-600 transition-colors">{deal.title}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-medium text-gray-900 text-sm">
                          {deal.value > 0 ? deal.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 truncate max-w-[120px]">
                          {stage?.name}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-500 font-medium">{pipeline.name}</td>
                      <td className="p-3 text-sm text-gray-700 font-medium">{company?.name || '-'}</td>
                      <td className="p-3 text-sm text-gray-500 font-medium">{contact?.name || '-'}</td>
                      <td className="p-3 text-sm text-gray-500 font-medium">João Paulo</td>
                      <td className="p-3">
                        <span className={cn(
                          "px-2 py-1 text-[11px] font-medium uppercase tracking-wider rounded-md",
                          deal.status === 'Ativo' ? "bg-amber-50 text-amber-600" :
                          deal.status === 'Ganho' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                        )}>
                          {deal.status === "Ativo" ? "Aberto" : deal.status}
                        </span>
                      </td>
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <button className="p-1.5 text-gray-400 hover:text-gray-900 rounded-md hover:bg-gray-200 transition-colors">
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                   </tr>
                 );
               })}
               
               {deals.length === 0 && (
                 <tr>
                    <td colSpan={10} className="p-10 text-center text-sm font-medium text-gray-400">
                       Nenhum negócio encontrado nesta visualização.
                    </td>
                 </tr>
               )}
            </tbody>
         </table>
       </div>
    </div>
  );
}
