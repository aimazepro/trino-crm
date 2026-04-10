"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCrm } from "@/contexts/crm-context";
import { ActivityTab } from "./activity-tab";
import { AppointmentsTab } from "./appointments-tab";
import { ArrowRight, MessageCircleOff, Settings, Paperclip, Mic, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";

interface DealTabsProps {
  dealId: string;
}

const TABS = ["Atividades", "Agendamentos", "Notas", "Histórico", "WhatsApp"];

export function DealTabs({ dealId }: DealTabsProps) {
  const { state, addDealNote } = useCrm();
  const deal = state.deals.find(d => d.id === dealId);
  const contact = deal ? state.contacts.find(c => c.id === deal.contactId) : null;
  
  const [activeTab, setActiveTab] = useState("Atividades");
  const [noteContent, setNoteContent] = useState("");

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    router.push(`${pathname}?tab=${tab}`, { scroll: false });
  };

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
            onClick={() => handleTabClick(tab)}
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
          <div className="h-full min-h-[400px] flex flex-col bg-[#F0F2F5] rounded-xl overflow-hidden border border-gray-200/60 shadow-inner">
             {state.whatsappConnected ? (
               <>
                 {/* WhatsApp Header */}
                 <div className="bg-white px-6 py-3 flex items-center justify-between border-b border-gray-200 shrink-0 shadow-sm z-10 w-full relative">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-green-50 text-[#25D366] flex items-center justify-center shrink-0">
                         <MessageCircleOff size={20} className="hidden" />
                         <span className="font-bold text-lg">{contact?.name.charAt(0).toUpperCase()}</span>
                       </div>
                       <div>
                         <h4 className="font-bold text-gray-900 leading-none text-sm mb-0.5">{contact?.name}</h4>
                         <p className="text-xs text-gray-500 font-medium">
                           {contact?.phones[0]?.value || "Sem Telefone"}
                         </p>
                       </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full">
                       <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-[11px] font-bold tracking-wide">Conectado</span>
                    </div>
                 </div>

                 {/* Chat Area */}
                 <div className="flex-1 flex flex-col items-center justify-center bg-[#F0F2F5] p-6 relative">
                    <div className="text-center">
                       <div className="w-14 h-14 rounded-full bg-gray-200/50 flex items-center justify-center mx-auto mb-4 text-gray-400">
                          <MessageCircleOff size={28} />
                       </div>
                       <p className="text-sm font-bold text-gray-400 mb-1">Nenhuma mensagem ainda</p>
                       <p className="text-xs font-medium text-gray-400">Envie a primeira mensagem para {contact?.name}</p>
                    </div>
                 </div>

                 {/* Input Area */}
                 <div className="bg-white p-3 flexItems-end gap-3 border-t border-gray-200 shrink-0 w-full relative z-10 flex">
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                      <Paperclip size={20} />
                    </button>
                    <button className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg hidden sm:flex items-center gap-1.5 transition-colors shrink-0">
                      <LayoutTemplate size={14} /> Templates
                    </button>
                    
                    <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center shadow-sm">
                      <input 
                         placeholder="Digite uma mensagem..."
                         className="w-full text-sm outline-none bg-transparent"
                      />
                    </div>
                    
                    <button className="p-2 text-gray-400 hover:text-[#25D366] transition-colors">
                      <Mic size={20} />
                    </button>
                 </div>
               </>
             ) : (
               <div className="flex flex-col items-center justify-center h-full m-auto w-full">
                 <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-6 border border-gray-200 shadow-sm">
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
        )}

      </div>
    </div>
  );
}
