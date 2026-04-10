"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCrm } from "@/contexts/crm-context";
import { ActivityTab } from "./activity-tab";
import { AppointmentsTab } from "./appointments-tab";
import { ArrowRight, MessageCircleOff, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface DealTabsProps {
  dealId: string;
}

const TABS = ["Atividades", "Agendamentos", "Notas", "Histórico", "WhatsApp"];

export function DealTabs({ dealId }: DealTabsProps) {
  const { state, addDealNote } = useCrm();
  const deal = state.deals.find(d => d.id === dealId);
  
  const [activeTab, setActiveTab] = useState("Atividades");
  const [noteContent, setNoteContent] = useState("");

  if (!deal) return null;

  const handleSaveNote = () => {
     if (!noteContent.trim()) return;
     addDealNote(dealId, noteContent);
     setNoteContent("");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      
      {/* Tabs Header */}
      <div className="flex gap-8 border-b border-gray-100 px-8 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "py-4 text-sm font-bold border-b-2 transition-all relative",
              activeTab === tab 
                ? "border-amber-500 text-amber-600" 
                : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
            )}
          >
            {tab}
            {tab === "Notas" && deal.notes.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">
                {deal.notes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-y-auto p-8 hide-scrollbar bg-gray-50/30">
        
        {/* Atividades Tab */}
        {activeTab === "Atividades" && <ActivityTab deal={deal} />}

        {/* Agendamentos Tab */}
        {activeTab === "Agendamentos" && <AppointmentsTab deal={deal} />}

        {/* Notas Tab */}
        {activeTab === "Notas" && (
          <div className="max-w-3xl space-y-6">
            <div>
               <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Notas</h4>
               <div className="bg-white border text-sm text-gray-500 font-medium border-gray-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all shadow-sm">
                 <textarea 
                   value={noteContent}
                   onChange={e => setNoteContent(e.target.value)}
                   placeholder="Adicione uma nota sobre este negócio..."
                   className="w-full min-h-[100px] p-4 bg-transparent outline-none resize-none placeholder:text-gray-400"
                 />
                 <div className="bg-gray-50/50 p-2 border-t border-gray-100 flex justify-end">
                   <button 
                     onClick={handleSaveNote}
                     disabled={!noteContent.trim()}
                     className="px-4 py-1.5 bg-amber-500 text-white font-bold text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-600 transition-colors shadow-sm"
                   >
                     Salvar
                   </button>
                 </div>
               </div>
            </div>

            <div className="space-y-4">
               {deal.notes.map(note => (
                 <div key={note.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    <div className="mt-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      {new Date(note.createdAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* Histórico Tab */}
        {activeTab === "Histórico" && (
          <div className="max-w-3xl space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Histórico</h4>
            
            <div className="space-y-6 pl-4 border-l-2 border-gray-100 ml-4 py-2">
              {deal.history.map((log, index) => (
                <div key={log.id} className="relative">
                   <div className="absolute -left-[27px] top-0 w-8 h-8 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                     <ArrowRight size={14} className="opacity-70" />
                   </div>
                   <div className="pl-6">
                     <h5 className="font-bold text-gray-900 text-sm">{log.description}</h5>
                     {log.subtext && <p className="text-sm text-gray-500 mt-0.5">{log.subtext}</p>}
                     <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                       {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ptBR })}
                     </p>
                   </div>
                </div>
              ))}
              {deal.history.length === 0 && (
                <p className="pl-6 text-sm text-gray-400 font-medium">Nenhum evento registrado ainda.</p>
              )}
            </div>
          </div>
        )}

        {/* WhatsApp Tab */}
        {activeTab === "WhatsApp" && (
          <div className="flex flex-col items-center justify-center h-full max-h-[400px]">
             <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-6 border border-gray-100 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                <MessageCircleOff size={24} className="text-gray-300" />
             </div>
             <h3 className="text-lg font-bold text-gray-900 mb-2">WhatsApp nao conectado</h3>
             <p className="text-sm text-gray-500 mb-6 font-medium">Conecte seu WhatsApp nas configuracoes</p>
             <button className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] text-white font-bold rounded-xl shadow-sm hover:opacity-90 transition-opacity">
               <Settings size={16} /> Configurar WhatsApp
             </button>
          </div>
        )}

      </div>
    </div>
  );
}
