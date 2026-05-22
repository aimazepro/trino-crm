"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Mail, RefreshCw, Send, Eye, FileText, X, Bold, Italic, Underline, List, ListOrdered, Link2, Braces, ChevronDown, Reply, ArrowDownLeft, SendHorizonal } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Email {
  id: string;
  direction: "sent" | "received";
  subject: string;
  body_html: string;
  from_email: string;
  to_email: string;
  opened_at: string | null;
  created_at: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface EmailTabProps {
  contactId: string;
  contactEmail: string;
  contactName: string;
  dealId?: string;
  gmailAccountEmail: string;
}

function formatEmailDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isThisYear = date.getFullYear() === now.getFullYear();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (isThisYear) {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function getSenderName(fromEmail: string, myEmail: string) {
  if (!fromEmail) return "Desconhecido";
  const match = fromEmail.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  if (fromEmail.includes(myEmail)) return "Você";
  return fromEmail.split("@")[0];
}

function decodeHtml(html: string) {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

const VARIABLES = [
  { label: "Nome do contato", value: "{{contact_name}}" },
  { label: "Email do contato", value: "{{contact_email}}" },
  { label: "Seu nome", value: "{{owner_name}}" },
];

export function EmailTab({ contactId, contactEmail, contactName, dealId, gmailAccountEmail }: EmailTabProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const fetchEmails = useCallback(async () => {
    const res = await fetch(`/api/gmail/emails?contactId=${contactId}`);
    if (res.ok) {
      const data = await res.json();
      setEmails(data.emails ?? []);
    }
    setLoading(false);
  }, [contactId]);

  const fetchTemplates = useCallback(async () => {
    const res = await fetch("/api/email-templates");
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates ?? []);
    }
  }, []);

  useEffect(() => {
    fetchEmails();
    fetchTemplates();
    // poll every 30s to update open tracking
    const interval = setInterval(fetchEmails, 30_000);
    return () => clearInterval(interval);
  }, [fetchEmails, fetchTemplates]);

  const handleSync = async () => {
    setSyncing(true);
    await fetch("/api/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactEmail, contactId, dealId }),
    });
    await fetchEmails();
    setSyncing(false);
  };

  const handleSend = async () => {
    const html = editorRef.current?.innerHTML ?? "";
    if (!subject.trim() || !html.trim()) return;
    setSending(true);

    const toEmail = replyTo
      ? (replyTo.direction === "received" ? replyTo.from_email : replyTo.to_email)
      : contactEmail;

    const res = await fetch("/api/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: toEmail,
        subject,
        bodyHtml: html,
        contactId,
        dealId,
        contactName,
        contactEmail,
      }),
    });

    if (res.ok) {
      setComposing(false);
      setReplyTo(null);
      setSubject("");
      if (editorRef.current) editorRef.current.innerHTML = "";
      await fetchEmails();
    }
    setSending(false);
  };

  const execFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const applyTemplate = (t: EmailTemplate) => {
    setSubject(t.subject);
    if (editorRef.current) editorRef.current.innerHTML = t.body;
    setShowTemplates(false);
  };

  const openReply = (email: Email) => {
    setReplyTo(email);
    setSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setComposing(true);
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
      <div className="flex flex-col" style={{ height: "calc(100vh - 320px)", minHeight: "400px" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 bg-white shrink-0">
          <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
            <Mail className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900 truncate">
              {gmailAccountEmail.split("@")[0]}
            </p>
            <p className="text-[11px] text-zinc-400">{gmailAccountEmail}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors"
              title="Sincronizar emails do Gmail"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              Sincronizar
            </button>
            <button
              onClick={() => { setReplyTo(null); setComposing(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Send className="h-3.5 w-3.5" /> Novo email
            </button>
          </div>
        </div>

        {/* Compose */}
        {composing && (
          <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3 shrink-0 relative">
            <button
              onClick={() => { setComposing(false); setReplyTo(null); }}
              className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 transition-colors"
              title="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>Para:</span>
                <span className="font-medium text-zinc-700">
                  {replyTo
                    ? (replyTo.direction === "received" ? replyTo.from_email : replyTo.to_email)
                    : contactEmail}
                </span>
              </div>
              <input
                placeholder="Assunto"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full h-9 rounded-lg bg-white border border-zinc-200 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-300 transition-colors"
              />
              <div className="max-h-[40vh] overflow-y-auto rounded-lg">
                <div className="rounded-lg border border-zinc-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/20 bg-white">
                  <div className="flex items-center gap-0.5 px-2 py-1 border-b border-zinc-100 bg-zinc-50/80">
                    <button type="button" onClick={() => execFormat("bold")} className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" title="Negrito">
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => execFormat("italic")} className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" title="Italico">
                      <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => execFormat("underline")} className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" title="Sublinhado">
                      <Underline className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-px h-4 bg-zinc-200 mx-0.5" />
                    <button type="button" onClick={() => execFormat("insertUnorderedList")} className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" title="Lista">
                      <List className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => execFormat("insertOrderedList")} className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" title="Lista numerada">
                      <ListOrdered className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-px h-4 bg-zinc-200 mx-0.5" />
                    <button type="button" onClick={() => {
                      const url = window.prompt("URL:");
                      if (url) execFormat("createLink", url);
                    }} className="rounded p-1 transition-colors text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" title="Link">
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-px h-4 bg-zinc-200 mx-0.5" />
                    <div className="relative group/vars">
                      <button
                        type="button"
                        className="flex items-center gap-0.5 rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
                        title="Inserir variável"
                      >
                        <Braces className="h-3.5 w-3.5" />
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>
                      <div className="hidden group-hover/vars:block absolute left-0 top-full z-30 w-44 bg-white rounded-lg shadow-lg border border-zinc-200 py-1">
                        {VARIABLES.map(v => (
                          <button
                            key={v.value}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              document.execCommand("insertText", false, v.value);
                              editorRef.current?.focus();
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                          >
                            <span className="font-mono text-blue-600 mr-1">{v.value}</span>
                            <span className="text-zinc-400">{v.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      className="px-3 py-2 text-sm text-zinc-900 outline-none"
                      style={{ minHeight: "100px" }}
                      data-placeholder="Escreva seu email..."
                      onInput={() => {}}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-zinc-400">Rastreamento de abertura ativado automaticamente</p>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                      onClick={() => setShowTemplates(v => !v)}
                    >
                      <FileText className="h-3.5 w-3.5" /> Template
                    </button>
                    {showTemplates && (
                      <div className="absolute right-0 bottom-8 z-20 w-64 bg-white rounded-xl shadow-xl border border-zinc-200 py-1 max-h-60 overflow-y-auto">
                        {templates.length === 0 ? (
                          <div className="px-3 py-4 text-center">
                            <p className="text-xs text-zinc-400">Nenhum template criado</p>
                            <Link href="/configuracoes/email-templates" className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                              Criar templates
                            </Link>
                          </div>
                        ) : (
                          templates.map(t => (
                            <button
                              key={t.id}
                              onClick={() => applyTemplate(t)}
                              className="w-full text-left px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
                            >
                              {t.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setComposing(false); setReplyTo(null); }}
                    className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !subject.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sending ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email list */}
        <div className="flex-1 overflow-y-auto bg-[#f8f9fa]">
          {emails.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center py-20">
              <div>
                <Mail className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-400">Nenhum email ainda</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Envie o primeiro email ou sincronize para importar conversas existentes
                </p>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-2">
              {emails.map(email => {
                const isExpanded = expandedId === email.id;
                const senderName = getSenderName(
                  email.direction === "received" ? email.from_email : "Você",
                  gmailAccountEmail
                );
                const opened = !!email.opened_at;

                return (
                  <div key={email.id} className="rounded-lg bg-white border border-zinc-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : email.id)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                    >
                      <div className="shrink-0 mt-0.5">
                        <div className="h-2 w-2 rounded-full mt-1.5 bg-zinc-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-900 truncate">{email.subject}</p>
                          {email.direction === "received" ? (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 border border-blue-200">
                              <ArrowDownLeft className="h-3 w-3" /> Recebido
                            </span>
                          ) : opened ? (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5 border border-green-200">
                              <Eye className="h-3 w-3" /> Visualizado
                            </span>
                          ) : (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-zinc-100 rounded-full px-2 py-0.5 border border-zinc-200">
                              <SendHorizonal className="h-3 w-3" /> Enviado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {decodeHtml(email.body_html.replace(/<[^>]+>/g, "")).slice(0, 100)}
                        </p>
                      </div>
                      <span className="text-[10px] text-zinc-400 shrink-0 mt-1">
                        {formatEmailDate(email.created_at)}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-zinc-100 divide-y divide-zinc-100">
                        <div className="px-4 py-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className={cn(
                              "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
                              email.direction === "sent" ? "bg-blue-500" : "bg-zinc-500"
                            )}>
                              {email.direction === "sent" ? "EU" : contactName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-zinc-700">
                              {email.direction === "sent" ? "Você" : senderName}
                            </span>
                            {email.direction === "received" ? (
                              <span className="flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 border border-blue-200">
                                <ArrowDownLeft className="h-3 w-3" /> Recebido
                              </span>
                            ) : opened ? (
                              <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5 border border-green-200"
                                title={`Visualizado em ${new Date(email.opened_at!).toLocaleString("pt-BR")}`}>
                                <Eye className="h-3 w-3" /> Visualizado
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-zinc-100 rounded-full px-2 py-0.5 border border-zinc-200">
                                <SendHorizonal className="h-3 w-3" /> Enviado
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-400 ml-auto">
                              {new Date(email.created_at).toLocaleString("pt-BR", {
                                day: "2-digit", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <div
                            className="text-sm text-zinc-700 leading-relaxed prose prose-sm max-w-none [&_img]:max-w-full [&_a]:text-blue-600 pl-8"
                            dangerouslySetInnerHTML={{ __html: email.body_html }}
                          />
                          <div className="pl-8 mt-2">
                            <button
                              onClick={() => openReply(email)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Reply className="h-3.5 w-3.5" /> Responder
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
