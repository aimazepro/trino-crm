"use client";

import { useState, useRef, useEffect } from "react";
import { X, Calendar as CalendarIcon, Check } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Deal, Contact, Company, HistoryLog } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

interface NewDealModalProps {
  onClose: () => void;
  activePipelineId: string;
}

export function NewDealModal({ onClose, activePipelineId }: NewDealModalProps) {
  const { state, addDeal, addContact, addCompany } = useCrm();

  const pipeline = state.pipelines.find(p => p.id === activePipelineId);
  
  // Deal Form State
  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState(pipeline?.stages[0]?.id || "");
  const [value, setValue] = useState("");
  const [date, setDate] = useState("");

  // Contact Selection / Creation State
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // Company Selection / Creation State
  const [companyName, setCompanyName] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Handlers for "Create / Save"
  const handleSave = () => {
    if (!title.trim() || !contactName.trim() || !companyName.trim()) return;

    let finalContactId = selectedContactId;
    let finalCompanyId = selectedCompanyId;

    // Create Company if needed
    if (!finalCompanyId) {
       finalCompanyId = `comp_${Date.now()}`;
       addCompany({
         id: finalCompanyId,
         name: companyName,
       });
    }

    // Create Contact if needed
    if (!finalContactId) {
       finalContactId = `cont_${Date.now()}`;
       addContact({
         id: finalContactId,
         name: contactName,
         phone: contactPhone,
         email: "", // User can add later
         role: "",
         companyId: finalCompanyId
       });
    }

    // Create Deal
    const dealId = `deal_${Date.now()}`;
    const initialLog: HistoryLog = {
      id: `log_${Date.now()}`,
      description: "Negócio criado",
      subtext: "Criado manualmente",
      createdAt: new Date().toISOString()
    };

    const newDeal: Deal = {
       id: dealId,
       title,
       value: Number(value.replace(/[^0-9.-]+/g, "")) || 0,
       contactId: finalContactId,
       companyId: finalCompanyId,
       pipelineId: activePipelineId,
       stageId,
       status: "Ativo",
       daysInStage: 0,
       labels: [],
       notes: [],
       history: [initialLog],
       products: [],
       expectedCloseDate: date ? new Date(date).toISOString() : undefined,
    };

    addDeal(newDeal);
    onClose();
  };

  // Helper arrays for matching (mocking a search)
  const contactMatches = state.contacts.filter(c => contactName && c.name.toLowerCase().includes(contactName.toLowerCase()) && c.id !== selectedContactId);
  const companyMatches = state.companies.filter(c => companyName && c.name.toLowerCase().includes(companyName.toLowerCase()) && c.id !== selectedCompanyId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in pt-10 pb-10">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-full animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Novo Negócio</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto hide-scrollbar space-y-6">
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">Título do Negócio *</label>
            <input 
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Proposta Agencia XYZ"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">Etapa</label>
            <div className="flex flex-wrap gap-2">
              {pipeline?.stages.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => setStageId(stage.id)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-lg border transition-all",
                    stageId === stage.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  )}
                >
                  {stage.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-semibold text-gray-900">Valor (R$)</label>
               <input 
                 type="number"
                 value={value} onChange={e => setValue(e.target.value)}
                 placeholder="0.00"
                 className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
               />
             </div>
             <div className="space-y-2">
               <label className="text-sm font-semibold text-gray-900">Previsão de Fechamento</label>
               <div className="relative">
                 <input 
                   type="date"
                   value={date} onChange={e => setDate(e.target.value)}
                   className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                 />
               </div>
             </div>
          </div>

          {/* Contact Group */}
          <div className="p-4 bg-amber-50/30 border border-amber-200/50 rounded-xl space-y-4 relative">
             <h3 className="text-sm font-bold text-gray-900 absolute -top-2.5 left-4 bg-white px-1">Contato (Pessoa)</h3>
             
             <div className="relative space-y-3 pt-2">
               <div>
                 <input 
                   value={contactName} 
                   onChange={e => { setContactName(e.target.value); setSelectedContactId(null); }}
                   placeholder="Nome do contato"
                   className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500"
                 />
                 {/* Contact Suggestions */}
                 {contactMatches.length > 0 && (
                   <div className="absolute z-10 w-full bg-white border border-gray-100 shadow-lg rounded-lg mt-1 max-h-32 overflow-y-auto pb-1">
                     <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sugestões</div>
                     {contactMatches.map(c => (
                       <div 
                         key={c.id} 
                         onClick={() => { setContactName(c.name); setContactPhone(c.phone); setSelectedContactId(c.id); }}
                         className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex justify-between"
                       >
                         <span className="font-medium text-amber-700">{c.name}</span>
                         <span className="text-gray-400 text-xs">{c.companyId ? state.companies.find(comp=>comp.id===c.companyId)?.name : c.phone}</span>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               <input 
                 value={contactPhone} 
                 onChange={e => setContactPhone(e.target.value)}
                 disabled={!!selectedContactId}
                 placeholder="Telefone (opcional)"
                 className={cn("w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500", selectedContactId && "bg-gray-50 text-gray-400")}
               />

               {selectedContactId ? (
                 <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                    <Check size={14} /> Contato vinculado existente.
                 </div>
               ) : (
                 <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                    + Será criado novo contato
                 </div>
               )}
             </div>
          </div>

          {/* Company Group */}
          <div className="p-4 bg-amber-50/30 border border-amber-200/50 rounded-xl space-y-4 relative mt-6">
             <h3 className="text-sm font-bold text-gray-900 absolute -top-2.5 left-4 bg-white px-1">Empresa</h3>
             <div className="relative pt-2">
                 <input 
                   value={companyName} 
                   onChange={e => { setCompanyName(e.target.value); setSelectedCompanyId(null); }}
                   placeholder="Nome da empresa"
                   className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500"
                 />
                 {/* Company Suggestions */}
                 {companyMatches.length > 0 && (
                   <div className="absolute z-10 w-full bg-white border border-gray-100 shadow-lg rounded-lg mt-1 max-h-32 overflow-y-auto pb-1">
                     <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sugestões</div>
                     {companyMatches.map(c => (
                       <div 
                         key={c.id} 
                         onClick={() => { setCompanyName(c.name); setSelectedCompanyId(c.id); }}
                         className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex justify-between"
                       >
                         <span className="font-medium text-amber-700">{c.name}</span>
                         <span className="text-gray-400 text-xs">{c.city} - {c.state}</span>
                       </div>
                     ))}
                   </div>
                 )}
                 
                 {selectedCompanyId ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 mt-3">
                       <Check size={14} /> Empresa vinculada existente.
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 mt-3">
                       + Será criada nova empresa
                    </div>
                  )}
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-gray-100 shrink-0">
           <button 
             onClick={handleSave}
             disabled={!title.trim() || !contactName.trim() || !companyName.trim()}
             className="w-full py-3 bg-[#F8D595] hover:bg-[#F2C979] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-sm"
           >
             Criar Negócio
           </button>
        </div>

      </div>
    </div>
  );
}
