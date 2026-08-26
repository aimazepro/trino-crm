"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { getTimelineIconConfig } from "@/lib/timeline-helpers";
import { createClient } from "@/lib/supabase/client";
import { AllTab } from "./all-tab";
import { ActivityTab } from "./activity-tab";
import { EmailTab } from "./email-tab";
import { WhatsAppThread } from "@/components/whatsapp/whatsapp-thread";
import { useWhatsAppConnection } from "@/hooks/use-whatsapp-connection";
import { DealCallsTab } from "@/components/telephony/deal-calls-tab";
import { ArrowRight, Settings, Paperclip, PhoneOff, WifiOff, Mail, History, Phone, MessageCircle, FileText, Pencil, Trash2, X, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface DealTabsProps {
  dealId: string;
}

const TABS = ["Todos", "Atividades", "Notas", "Histórico", "Ligações", "WhatsApp", "Email"];

const TAB_ICONS: Record<string, React.ReactNode> = {
  "Histórico": <History className="h-3.5 w-3.5" />,
  "Ligações": <Phone className="h-3.5 w-3.5" />,
  "WhatsApp": <MessageCircle className="h-3.5 w-3.5" />,
  "Email": <Mail className="h-3.5 w-3.5" />,
};

const TAB_ACTIVE_COLOR: Record<string, string> = {
  "Ligações": "border-purple-500 text-purple-600",
  "WhatsApp": "border-green-500 text-green-600",
  "Email": "border-blue-500 text-blue-600",
};

export function DealTabs({ dealId }: DealTabsProps) {
  const { state, addDealNote, deleteDealNote, updateDealNote } = useCrm();
  const { selfName } = useOwnerNameMap();
  const deal = state.deals.find(d => d.id === dealId);
  const contact = deal && deal.contactId ? state.contacts.find(c => c.id === deal.contactId) : null;
  const company = deal && deal.companyId ? state.companies.find(c => c.id === deal.companyId) : null;

  const whatsapp = useWhatsAppConnection();
  const contactPhone = contact?.phones?.[0]?.value ?? null;

  const [activeTab, setActiveTab] = useState("Todos");
  const [gmailAccountEmail, setGmailAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("integrations").select("account_email").eq("user_id", user.id).eq("provider", "gmail").eq("active", true).maybeSingle().then(({ data }) => {
        if (data) setGmailAccountEmail(data.account_email);
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
        
        {/* Todos Tab */}
        {activeTab === "Todos" && <AllTab deal={deal} userName={selfName || undefined} />}

        {/* Atividades Tab */}
        {activeTab === "Atividades" && <ActivityTab deal={deal} userName={selfName || undefined} />}

        {/* Ligações Tab */}
        {activeTab === "Ligações" && (
          <DealCallsTab
            dealId={dealId}
            contactId={contact?.id ?? null}
            contactPhone={contactPhone}
            contactName={contact?.name ?? null}
            companyName={company?.name ?? null}
            dealTitle={deal?.title ?? null}
          />
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
              {deal.history.map((log) => {
                const { icon: Icon, badgeClass } = getTimelineIconConfig(log.description);
                return (
                  <div key={log.id} className="relative">
                     <div className={cn(
                       "absolute -left-[27px] top-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-xs transition-colors",
                       badgeClass
                     )}>
                       <Icon size={14} />
                     </div>
                     <div className="pl-6">
                       <h5 className="font-semibold text-zinc-900 text-sm">{log.description}</h5>
                       {log.subtext && <p className="text-sm text-zinc-500 mt-0.5">{log.subtext}</p>}
                       <p className="text-xs text-zinc-400 mt-1">
                         {(() => {
                           try {
                             const d = new Date(log.createdAt);
                             const formattedDate = format(d, "dd/MM/yyyy HH:mm");
                             return selfName ? `${formattedDate} · ${selfName}` : formattedDate;
                           } catch {
                             return log.createdAt;
                           }
                         })()}
                       </p>
                     </div>
                  </div>
                );
              })}
              {deal.history.length === 0 && (
                <p className="pl-6 text-sm text-gray-400 font-medium">Nenhum evento registrado ainda.</p>
              )}
            </div>
          </div>
        )}

        {/* Email Tab */}
        {activeTab === "Email" && (
          <>
            {(!contact || !contact.emails || contact.emails.length === 0) ? (
              <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
                <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                  <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                    <Mail className="h-6 w-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">Contato sem email</p>
                  <p className="text-xs text-zinc-500 mt-1">Adicione um email ao contato para enviar mensagens</p>
                </div>
              </div>
            ) : !gmailAccountEmail ? (
              <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
                <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                  <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                    <WifiOff className="h-6 w-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">Gmail nao conectado</p>
                  <p className="text-xs text-zinc-500 mt-1 mb-4">Conecte sua conta Gmail nas configuracoes</p>
                  <Link href="/configuracoes/gmail" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                    <Settings className="h-4 w-4" /> Configurar Gmail
                  </Link>
                </div>
              </div>
            ) : (
              <EmailTab
                contactId={contact!.id}
                contactEmail={contact!.emails[0].value}
                contactName={contact!.name}
                dealId={dealId}
                gmailAccountEmail={gmailAccountEmail}
              />
            )}
          </>
        )}

        {/* WhatsApp Tab */}
        {activeTab === "WhatsApp" && (
          <div className="h-full min-h-[400px] flex flex-col rounded-xl overflow-hidden border border-border">
             {!contactPhone ? (
               <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                  <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                     <PhoneOff className="h-6 w-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">Contato sem telefone</p>
                  <p className="text-xs text-zinc-500 mt-1">Adicione um telefone ao contato para enviar mensagens</p>
               </div>
             ) : whatsapp.loading ? (
               <div className="flex items-center justify-center gap-2 h-64 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Verificando conexao...
               </div>
             ) : whatsapp.status !== "open" ? (
               <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                  <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                     <WifiOff className="h-6 w-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">WhatsApp nao conectado</p>
                  <p className="text-xs text-zinc-500 mt-1 mb-4">
                    {whatsapp.isOwner
                      ? "Conecte seu WhatsApp nas configuracoes"
                      : "O dono da conta ainda nao conectou o WhatsApp deste workspace"}
                  </p>
                  {whatsapp.isOwner && (
                    <Link href="/configuracoes/whatsapp" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                      <Settings className="h-4 w-4" /> Configurar WhatsApp
                    </Link>
                  )}
               </div>
             ) : (
               <>
                 {/* Conversation header */}
                 <div className="bg-card px-6 py-3 flex items-center justify-between border-b border-border shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                       <div className="w-10 h-10 rounded-full bg-green-50 text-[#25D366] dark:bg-green-950 flex items-center justify-center shrink-0 font-bold text-lg">
                         {contact?.name.charAt(0).toUpperCase()}
                       </div>
                       <div className="min-w-0">
                         <h4 className="font-bold leading-none text-sm mb-0.5 truncate">{contact?.name}</h4>
                         <p className="text-xs text-muted-foreground font-medium truncate">{contactPhone}</p>
                       </div>
                    </div>
                    <Link
                      href="/conversas"
                      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Ver todas
                    </Link>
                 </div>

                 <WhatsAppThread
                   target={{ phone: contactPhone, dealId, contactId: contact?.id ?? null }}
                   connected
                   emptyHint={`Envie a primeira mensagem para ${contact?.name ?? contactPhone}.`}
                   className="flex-1 min-h-0"
                   templateContext={{
                     contactName: contact?.name,
                     companyName: company?.name,
                     dealName: deal?.title,
                     vendorName: selfName || undefined,
                   }}
                 />
               </>
             )}
          </div>
        )}

      </div>
    </div>
  );
}
