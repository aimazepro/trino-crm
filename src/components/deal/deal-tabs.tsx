"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCrm } from "@/contexts/crm-context";
import { createClient } from "@/lib/supabase/client";
import { ActivityTab } from "./activity-tab";
import { ArrowRight, MessageCircleOff, Settings, Paperclip, Mic, LayoutTemplate, PhoneOff, WifiOff, Mail, History, Phone, MessageCircle, FileText, Pencil, Trash2, X, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface DealTabsProps {
  dealId: string;
}

const TABS = ["Atividades", "Notas", "Histórico", "Ligações", "WhatsApp", "Email"];

const TAB_ICONS: Record<string, React.ReactNode> = {
  "Histórico": <History className="h-3.5 w-3.5" />,
  "Ligações": <Phone className="h-3.5 w-3.5" />,
  "WhatsApp": <MessageCircle className="h-3.5 w-3.5" />,
  "Email": <Mail className="h-3.5 w-3.5" />,
};

const TAB_ACTIVE_COLOR: Record<string, string> = {
  "WhatsApp": "border-green-500 text-green-600",
  "Email": "border-blue-500 text-blue-600",
};

export function DealTabs({ dealId }: DealTabsProps) {
  const { state, addDealNote, deleteDealNote, updateDealNote } = useCrm();
  const deal = state.deals.find(d => d.id === dealId);
  const contact = deal && deal.contactId ? state.contacts.find(c => c.id === deal.contactId) : null;
  
  const [activeTab, setActiveTab] = useState("Atividades");
  const [gmailConnected, setGmailConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("integrations").select("id").eq("user_id", user.id).eq("provider", "gmail").eq("active", true).maybeSingle().then(({ data }) => {
        setGmailConnected(!!data);
      });
    });
  }, []);
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

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
      <div className="flex items-center gap-1 px-6 border-b border-zinc-100 shrink-0">
        {TABS.map(tab => {
          const isActive = activeTab === tab;
          const activeColor = TAB_ACTIVE_COLOR[tab] ?? "border-amber-500 text-amber-600";
          const icon = TAB_ICONS[tab];
          return (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                isActive ? activeColor : "border-transparent text-zinc-400 hover:text-zinc-600"
              )}
            >
              {icon}
              {tab}
              {tab === "Atividades" && deal.activities && deal.activities.length > 0 && (
                <span className="ml-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                  {deal.activities.length}
                </span>
              )}
              {tab === "Notas" && deal.notes.length > 0 && (
                <span className="ml-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                  {deal.notes.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-auto p-6 bg-zinc-50/50">
        
        {/* Atividades Tab */}
        {activeTab === "Atividades" && <ActivityTab deal={deal} />}

        {/* Ligações Tab */}
        {activeTab === "Ligações" && (
          <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                <Phone className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-700">Nenhuma ligação registrada</p>
              <p className="text-xs text-zinc-500 mt-1">As ligações realizadas aparecerão aqui</p>
            </div>
          </div>
        )}

        {/* Notas Tab */}
        {activeTab === "Notas" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-xs font-medium text-zinc-400 tracking-wide mb-3">NOTAS</h2>
              <div className="rounded-xl bg-white overflow-hidden border border-zinc-100">
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder="Adicione uma nota sobre este negócio..."
                  rows={3}
                  className="w-full resize-none px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none"
                />
                <div className="flex items-center justify-end px-3 py-2 border-t border-zinc-100 bg-zinc-50">
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteContent.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-semibold text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" /> Salvar Nota
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {deal.notes.map(note => (
                <div key={note.id} className="rounded-xl bg-white p-4 group border border-zinc-100">
                  {editingNoteId === note.id ? (
                    <>
                      <textarea
                        value={editingNoteContent}
                        onChange={e => setEditingNoteContent(e.target.value)}
                        rows={3}
                        className="w-full resize-none text-sm text-zinc-900 outline-none border border-zinc-200 rounded-lg px-3 py-2 focus:border-amber-400"
                        autoFocus
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => { updateDealNote(dealId, note.id, editingNoteContent); setEditingNoteId(null); }}
                          className="flex items-center gap-1 rounded-md bg-amber-400 hover:bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors"
                        >
                          <Check className="h-3 w-3" /> Salvar
                        </button>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-50 transition-colors"
                        >
                          <X className="h-3 w-3" /> Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-zinc-800 whitespace-pre-wrap flex-1">{note.content}</p>
                        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content); }}
                            className="text-zinc-300 hover:text-blue-500 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteDealNote(dealId, note.id)}
                            className="text-zinc-300 hover:text-red-400 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 mt-2">
                        {new Date(note.createdAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      <div className="mt-3">
                        <div className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2">
                          <button type="button" className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 border border-zinc-200 hover:bg-zinc-50 transition-colors">
                            <Paperclip className="h-3.5 w-3.5" /> Anexar
                          </button>
                          <span className="text-xs text-zinc-500">ou arraste</span>
                          <input type="file" multiple className="hidden" />
                        </div>
                      </div>
                    </>
                  )}
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
              {deal.history.map((log) => (
                <div key={log.id} className="relative">
                   <div className="absolute -left-[27px] top-0 w-8 h-8 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center border-4 border-white">
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

        {/* Email Tab */}
        {activeTab === "Email" && (
          <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              {(!contact || !contact.emails || contact.emails.length === 0) ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                    <Mail className="h-6 w-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">Contato sem email</p>
                  <p className="text-xs text-zinc-500 mt-1">Adicione um email ao contato para enviar mensagens</p>
                </>
              ) : gmailConnected ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                    <Mail className="h-6 w-6 text-blue-500" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">Gmail conectado</p>
                  <p className="text-xs text-zinc-500 mt-1">{contact?.emails?.[0]?.value}</p>
                </>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                    <WifiOff className="h-6 w-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">Gmail nao conectado</p>
                  <p className="text-xs text-zinc-500 mt-1 mb-4">Conecte sua conta Gmail nas configuracoes</p>
                  <Link href="/configuracoes/gmail" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                    <Settings className="h-4 w-4" /> Configurar Gmail
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        {/* WhatsApp Tab */}
        {activeTab === "WhatsApp" && (
          <div className="h-full min-h-[400px] flex flex-col bg-[#F0F2F5] rounded-xl overflow-hidden border border-gray-200/60">
             {(!contact || !contact.phones || contact.phones.length === 0) ? (
               <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                  <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                     <PhoneOff className="h-6 w-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">Contato sem telefone</p>
                  <p className="text-xs text-zinc-500 mt-1">Adicione um telefone ao contato para enviar mensagens</p>
               </div>
             ) : state.whatsappConnected ? (
               <>
                 {/* WhatsApp Header */}
                 <div className="bg-white px-6 py-3 flex items-center justify-between border-b border-gray-200 shrink-0 w-full relative z-10">
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
                    
                    <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center">
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
               <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                 <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                    <WifiOff className="h-6 w-6 text-zinc-400" />
                 </div>
                 <p className="text-sm font-medium text-zinc-700">WhatsApp nao conectado</p>
                 <p className="text-xs text-zinc-500 mt-1 mb-4">Conecte seu WhatsApp nas configuracoes</p>
                 <Link href="/configuracoes/whatsapp" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                   <Settings className="h-4 w-4" /> Configurar WhatsApp
                 </Link>
               </div>
             )}
          </div>
        )}

      </div>
    </div>
  );
}
