import { Search, Info, Phone, Video, MoreVertical, CheckCircle2, CircleDashed, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_CHATS = [
  { id: 1, name: "Roberto Almeida", message: "Consegue me mandar a proposta hoje?", time: "10:42", unread: 2, platform: "whatsapp", active: true },
  { id: 2, name: "Juliana Costa", message: "Obrigada! Vou analisar com o time.", time: "Ontem", unread: 0, platform: "instagram", active: false },
  { id: 3, name: "Carlos Eduardo", message: "Que horas é a nossa call amanhã?", time: "Ontem", unread: 0, platform: "whatsapp", active: false },
  { id: 4, name: "Clínica Odonto", message: "Fechado! Aguardo o link de pgto.", time: "Segunda", unread: 0, platform: "messenger", active: false },
];

export default function ConversasPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      
      {/* Sidebar de Chats */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/30">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Mensagens</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar nas conversas..."
              className="w-full bg-white border border-gray-200 text-sm rounded-xl pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 hide-scrollbar">
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full border border-amber-200 cursor-pointer whitespace-nowrap">Todas</span>
            <span className="px-3 py-1 bg-white text-gray-500 text-xs font-semibold rounded-full border border-gray-200 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Não lidas (2)</span>
            <span className="px-3 py-1 bg-white text-gray-500 text-xs font-semibold rounded-full border border-gray-200 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Grupos</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {MOCK_CHATS.map((chat) => (
            <div 
              key={chat.id} 
              className={cn(
                "p-4 border-b border-gray-50 cursor-pointer transition-colors flex gap-3",
                chat.active ? "bg-amber-50/50 relative" : "hover:bg-gray-50"
              )}
            >
              {chat.active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r-md"></div>}
              
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 shrink-0 border border-white shadow-sm flex items-center justify-center font-bold text-gray-500">
                {chat.name.substring(0,2).toUpperCase()}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className={cn("text-sm truncate", chat.unread > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700")}>{chat.name}</h3>
                  <span className={cn("text-[10px] shrink-0", chat.unread > 0 ? "text-amber-600 font-bold" : "text-gray-400 font-medium")}>{chat.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={cn("text-sm truncate", chat.unread > 0 ? "text-gray-700 font-medium" : "text-gray-500")}>
                    {chat.message}
                  </p>
                  {chat.unread > 0 && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 ml-2 shadow-[0_2px_5px_rgba(245,158,11,0.4)]">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Janela de Chat */}
      <div className="flex-1 flex flex-col bg-[#F3F4F6] relative">
        {/* Chat Header */}
        <div className="h-16 px-6 bg-white border-b border-gray-200 flex items-center justify-between shrink-0 shadow-sm z-10">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 flex items-center justify-center font-bold text-gray-500 shadow-inner">
                RO
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Roberto Almeida</h3>
                <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online
                </p>
              </div>
           </div>
           
           <div className="flex items-center gap-4 text-gray-400">
              <button className="hover:text-amber-500 transition-colors"><Search size={20}/></button>
              <div className="w-px h-5 bg-gray-200"></div>
              <button className="hover:text-amber-500 transition-colors"><Phone size={20}/></button>
              <button className="hover:text-amber-500 transition-colors"><Video size={20}/></button>
              <button className="hover:text-gray-700 transition-colors"><Info size={20}/></button>
              <button className="hover:text-gray-700 transition-colors"><MoreVertical size={20}/></button>
           </div>
        </div>

        {/* Mensagens Area - Mock */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
           <div className="text-center font-medium text-[10px] text-gray-400 uppercase tracking-widest my-6">Hoje</div>
           
           {/* Balão 1 - Recebido */}
           <div className="flex justify-start">
             <div className="bg-white px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 max-w-md">
                <p className="text-sm text-gray-700">Fala João! Tudo bom?</p>
                <div className="text-right text-[10px] text-gray-400 mt-1">10:40</div>
             </div>
           </div>

           {/* Balão 2 - Recebido */}
           <div className="flex justify-start">
             <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-gray-100 max-w-md">
                <p className="text-sm text-gray-700">Consegue me mandar a proposta hoje?</p>
                <div className="text-right text-[10px] text-gray-400 mt-1">10:42</div>
             </div>
           </div>

        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#f0f2f5] border-t border-gray-200">
           <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-200">
              <button className="text-gray-400 hover:text-amber-500 transition-colors"><Plus size={24}/></button>
              <input type="text" placeholder="Digite uma mensagem..." className="flex-1 bg-transparent py-2 outline-none text-sm text-gray-700" />
              <button className="bg-amber-500 text-white p-2 rounded-xl shadow-md hover:bg-amber-600 hover:-translate-y-0.5 transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 ml-1">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
           </div>
        </div>
      </div>

    </div>
  );
}
