"use client";

import { useState } from "react";
import { X, Calendar as CalendarIcon, Check } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Deal, HistoryLog } from "@/lib/crm-types";
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

  // Contact State
  const [isNewContact, setIsNewContact] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [newContactName, setNewContactName] = useState("");

  // Company State
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");

  // Handlers for "Create / Save"
  const handleSave = () => {
    if (!title.trim()) return;
    
    // Validate contact/company rules
    if (isNewContact && !newContactName.trim()) return;
    if (!isNewContact && !selectedContactId) return;
    
    if (isNewCompany && !newCompanyName.trim()) return;
    if (!isNewCompany && !selectedCompanyId) return;

    let finalContactId = selectedContactId;
    let finalCompanyId = selectedCompanyId;

    // Create Company if needed
    if (isNewCompany) {
       finalCompanyId = `comp_${Date.now()}`;
       addCompany({
         id: finalCompanyId,
         name: newCompanyName,
       });
    }

    // Create Contact if needed
    if (isNewContact) {
       finalContactId = `cont_${Date.now()}`;
       addContact({
         id: finalContactId,
         name: newContactName,
         phone: "",
         email: "",
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

  const isSaveDisabled = !title.trim() || 
    (isNewContact ? !newContactName.trim() : !selectedContactId) || 
    (isNewCompany ? !newCompanyName.trim() : !selectedCompanyId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in pt-10 pb-10">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] flex flex-col max-h-full animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Novo Negócio</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 pt-2 overflow-y-auto hide-scrollbar space-y-6">
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Título do Negócio *</label>
            <input 
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Proposta Agencia XYZ"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-amber-500 shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Etapa</label>
            <div className="flex flex-wrap gap-2">
              {pipeline?.stages.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => setStageId(stage.id)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-lg border transition-all",
                    stageId === stage.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  )}
                >
                  {stage.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-semibold text-gray-700">Valor (R$)</label>
               <input 
                 type="number"
                 value={value} onChange={e => setValue(e.target.value)}
                 placeholder="0.00"
                 className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-amber-500 shadow-sm"
               />
             </div>
             <div className="space-y-2">
               <label className="text-sm font-semibold text-gray-700">Previsão de Fechamento</label>
               <div className="relative">
                 <input 
                   type="date"
                   value={date} onChange={e => setDate(e.target.value)}
                   className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-600 outline-none focus:border-amber-500 shadow-sm min-h-[42px]"
                 />
               </div>
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-sm font-semibold text-gray-700">Contato (Pessoa)</label>
             <div className="flex gap-3">
               {isNewContact ? (
                 <input 
                   value={newContactName} onChange={e => setNewContactName(e.target.value)}
                   placeholder="Nome do novo contato"
                   autoFocus
                   className="flex-1 bg-white border border-amber-300 shadow-[0_0_0_2px_rgba(245,158,11,0.1)] rounded-lg px-4 py-2.5 text-sm outline-none placeholder:text-gray-400"
                 />
               ) : (
                 <div className="flex-1 relative">
                   <select 
                     value={selectedContactId} 
                     onChange={e => setSelectedContactId(e.target.value)}
                     className={cn(
                        "w-full appearance-none bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-2.5 text-sm outline-none focus:border-amber-500 shadow-sm transition-colors",
                        !selectedContactId && "text-gray-400"
                     )}
                   >
                     <option value="" disabled>Selecionar contato</option>
                     {state.contacts.map(c => <option key={c.id} value={c.id} className="text-gray-900">{c.name}</option>)}
                   </select>
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                   </div>
                 </div>
               )}
               <button 
                 onClick={() => {
                    setIsNewContact(!isNewContact);
                    if (!isNewContact) setSelectedContactId("");
                    else setNewContactName("");
                 }}
                 className={cn(
                    "px-4 py-2.5 bg-white border rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                    isNewContact ? "border-amber-500 text-amber-600 shadow-sm" : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300"
                  )}
               >
                 {isNewContact ? "✓ Voltar" : "+ Novo"}
               </button>
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-sm font-semibold text-gray-700">Empresa</label>
             <div className="flex gap-3">
               {isNewCompany ? (
                 <input 
                   value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}
                   placeholder="Nome da nova empresa"
                   autoFocus
                   className="flex-1 bg-white border border-amber-300 shadow-[0_0_0_2px_rgba(245,158,11,0.1)] rounded-lg px-4 py-2.5 text-sm outline-none placeholder:text-gray-400"
                 />
               ) : (
                 <div className="flex-1 relative">
                   <select 
                     value={selectedCompanyId} 
                     onChange={e => setSelectedCompanyId(e.target.value)}
                     className={cn(
                        "w-full appearance-none bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-2.5 text-sm outline-none focus:border-amber-500 shadow-sm transition-colors",
                        !selectedCompanyId && "text-gray-400"
                     )}
                   >
                     <option value="" disabled>Selecionar empresa</option>
                     {state.companies.map(c => <option key={c.id} value={c.id} className="text-gray-900">{c.name}</option>)}
                   </select>
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                   </div>
                 </div>
               )}
               <button 
                 onClick={() => {
                    setIsNewCompany(!isNewCompany);
                    if (!isNewCompany) setSelectedCompanyId("");
                    else setNewCompanyName("");
                 }}
                 className={cn(
                    "px-4 py-2.5 bg-white border rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                    isNewCompany ? "border-amber-500 text-amber-600 shadow-sm" : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300"
                  )}
               >
                 {isNewCompany ? "✓ Voltar" : "+ Nova"}
               </button>
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 pt-4 shrink-0">
           <button 
             onClick={handleSave}
             disabled={isSaveDisabled}
             className="w-full py-3 bg-[#FCE5B5] hover:bg-[#F2C979] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors shadow-sm"
           >
             Criar Negócio
           </button>
        </div>

      </div>
    </div>
  );
}
