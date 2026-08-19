"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, User, Users, ChevronDown, MessageCircle, Paperclip, Mic,
  Send, Trash2, ExternalLink, Check, CheckCheck, EyeOff, Pin, PinOff,
  LoaderCircle, CircleAlert, Clock, FileText, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { useWhatsAppInbox, type InboxMessage } from "@/hooks/use-whatsapp-inbox";

type Filter = "Todas" | "Não lidas" | "Fixadas";

const ALL_VENDORS = "Todos os vendedores";

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "HOJE";
  if (sameDay(date, yesterday)) return "ONTEM";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
}

/** Best available display name: contact record, then WhatsApp profile, then number. */
function formatPhoneLabel(phone: string) {
  const national = phone.startsWith("55") ? phone.slice(2) : phone;
  if (national.length < 10) return `+${phone}`;
  const ddd = national.slice(0, 2);
  const rest = national.slice(2);
  return `+55 (${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(rest.length - 4)}`;
}

function MessageStatusIcon({ status }: { status: InboxMessage["status"] }) {
  if (status === "pending") return <Clock className="h-3 w-3" aria-label="Enviando" />;
  if (status === "failed") return <CircleAlert className="h-3 w-3" aria-label="Falhou" />;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-sky-200" aria-label="Lida" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3" aria-label="Entregue" />;
  return <Check className="h-3 w-3" aria-label="Enviada" />;
}

export default function ConversasPage() {
  const { state } = useCrm();
  const { map: ownerNames, selfId } = useOwnerNameMap();
  const {
    conversations, messages, selectedId, connection, loading, loadingThread,
    sending, error, mediaUrls, selectConversation, sendText, sendFile,
    togglePinned, toggleUnread, clearError,
  } = useWhatsAppInbox();

  const [scope, setScope] = useState<"Minhas" | "Time">("Minhas");
  const [vendorFilter, setVendorFilter] = useState(ALL_VENDORS);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [filter, setFilter] = useState<Filter>("Todas");
  const [query, setQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const contactsById = useMemo(
    () => new Map(state.contacts.map(c => [c.id, c])),
    [state.contacts],
  );
  const dealsById = useMemo(
    () => new Map(state.deals.map(d => [d.id, d])),
    [state.deals],
  );

  const enriched = useMemo(
    () => conversations.map(c => ({
      ...c,
      contactName: (c.contactId ? contactsById.get(c.contactId)?.name : null) ?? c.pushName ?? "",
      dealName: (c.dealId ? dealsById.get(c.dealId)?.title : null) ?? "",
      ownerName: c.ownerId ? ownerNames[c.ownerId] ?? "" : "",
      isUnread: c.manuallyUnread || c.unreadCount > 0,
    })),
    [conversations, contactsById, dealsById, ownerNames],
  );

  const teamNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of enriched) if (c.ownerName) names.add(c.ownerName);
    return [...names].sort();
  }, [enriched]);

  const unreadCount = enriched.filter(c => c.isUnread).length;
  const pinnedCount = enriched.filter(c => c.pinned).length;

  const visible = enriched
    // "Minhas" means conversations tied to a deal this user owns, plus the ones
    // nobody owns yet — an unassigned lead has to be visible to somebody.
    .filter(c => (scope === "Minhas" ? !c.ownerId || c.ownerId === selfId : true))
    .filter(c => (scope === "Time" && vendorFilter !== ALL_VENDORS ? c.ownerName === vendorFilter : true))
    .filter(c => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return c.contactName.toLowerCase().includes(q)
        || c.dealName.toLowerCase().includes(q)
        || c.phone.includes(q.replace(/\D/g, ""));
    })
    .filter(c => (filter === "Não lidas" ? c.isUnread : filter === "Fixadas" ? c.pinned : true));

  const selected = enriched.find(c => c.id === selectedId) ?? null;

  async function handleSendText() {
    const text = messageInput.trim();
    if (!text || sending) return;
    setMessageInput("");
    const ok = await sendText(text);
    // Nothing was sent, so put the text back rather than losing what was typed.
    if (!ok) setMessageInput(text);
  }

  async function handleFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await sendFile(file);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => stream.getTracks().forEach(t => t.stop());
      recorder.start();
      recorderRef.current = recorder;
      setRecordSeconds(0);
      setRecording(true);
    } catch {
      alert("Não foi possível acessar o microfone.");
    }
  }

  function stopRecording(send: boolean) {
    const recorder = recorderRef.current;
    if (!recorder) { setRecording(false); return; }

    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach(t => t.stop());
      if (!send || chunksRef.current.length === 0) return;
      const type = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      await sendFile(new File([blob], `audio-${Date.now()}.webm`, { type }));
    };
    recorder.stop();
    recorderRef.current = null;
    setRecording(false);
    setRecordSeconds(0);
  }

  return (
    <div className="h-full flex bg-background">
      {/* Lista de conversas */}
      <div className="w-full md:w-[360px] md:min-w-[360px] md:border-r border-border flex-col flex">
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Conversas</h1>
            <div className="flex rounded-lg border border-border p-0.5 text-xs">
              <button
                onClick={() => setScope("Minhas")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors",
                  scope === "Minhas" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <User className="h-3.5 w-3.5" aria-hidden="true" /> Minhas
              </button>
              <button
                onClick={() => setScope("Time")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors",
                  scope === "Time" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" /> Time
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar contato ou negócio..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {scope === "Time" && (
            <div className="relative">
              <button
                onClick={() => setShowVendorDropdown(v => !v)}
                className="w-full flex items-center justify-between gap-2 h-9 px-3 rounded-lg border border-border bg-background text-sm"
              >
                <span className="flex items-center gap-2 truncate">
                  <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  {vendorFilter}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              </button>
              {showVendorDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowVendorDropdown(false)} />
                  <div className="absolute left-0 top-full mt-1 w-full bg-card border border-border rounded-lg z-50 py-1 shadow-lg">
                    {[ALL_VENDORS, ...teamNames].map(v => (
                      <button
                        key={v}
                        onClick={() => { setVendorFilter(v); setShowVendorDropdown(false); }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted transition-colors",
                          v === vendorFilter && "text-green-600 font-medium"
                        )}
                      >
                        {v}
                        {v === vendorFilter && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {(["Todas", "Não lidas", "Fixadas"] as Filter[]).map(f => {
              const count = f === "Não lidas" ? unreadCount : f === "Fixadas" ? pinnedCount : 0;
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors",
                    active
                      ? "border-green-600 bg-green-50 text-green-700 font-medium dark:bg-green-950 dark:text-green-400"
                      : "border-border text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {f}
                  {count > 0 && (
                    <span
                      className={cn(
                        "min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center",
                        active ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {connection !== "open" && connection !== "unknown" && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            WhatsApp desconectado — mensagens novas não chegam.{" "}
            <Link href="/configuracoes/whatsapp" className="underline font-medium">Conectar</Link>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando conversas...
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-6 py-16">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">Nenhuma conversa ainda</p>
              <p className="text-xs text-muted-foreground mt-1">As conversas de WhatsApp dos seus negócios aparecem aqui.</p>
              <Link href="/configuracoes/whatsapp" className="mt-4 text-xs text-green-600 hover:underline">
                Verificar conexão do WhatsApp
              </Link>
            </div>
          ) : (
            visible.map(c => {
              const title = c.contactName || formatPhoneLabel(c.phone);
              return (
                <div
                  key={c.id}
                  className={cn(
                    "relative group border-b border-border/60 transition-colors",
                    selectedId === c.id ? "bg-muted" : "hover:bg-muted/60"
                  )}
                >
                  <button
                    onClick={() => void selectConversation(c.id)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center font-semibold shrink-0">
                      {c.contactName ? c.contactName.charAt(0).toUpperCase() : <User className="h-4 w-4" aria-hidden="true" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm truncate", c.isUnread ? "font-semibold" : "font-medium")}>
                          {title}
                        </span>
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[11px] shrink-0 group-hover:opacity-0 transition-opacity",
                            c.isUnread ? "text-green-600 font-medium" : "text-muted-foreground"
                          )}
                        >
                          {c.pinned && <Pin className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
                          {formatTime(c.lastMessageAt)}
                        </span>
                      </div>
                      {c.dealName && <p className="text-xs text-muted-foreground truncate mt-0.5">{c.dealName}</p>}
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          {c.lastMessageFromMe && <span className="shrink-0 text-muted-foreground/70">Você:</span>}
                          <span className="truncate">{c.lastMessagePreview ?? ""}</span>
                        </span>
                        {scope === "Minhas" && c.isUnread && (
                          <span className="shrink-0 h-[14px] w-[14px] rounded-full bg-green-600" title="Não lida" />
                        )}
                      </div>
                      {scope === "Time" && (
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-[11px] text-muted-foreground/70 truncate">{c.ownerName}</p>
                          {c.isUnread && (
                            <span className="shrink-0 h-[14px] w-[14px] rounded-full bg-green-600" title="Não lida" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Row hover actions — sit outside the select <button> so clicks don't nest. */}
                  <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {!c.isUnread && (
                      <button
                        title="Marcar como não lida"
                        aria-label="Marcar como não lida"
                        onClick={() => void toggleUnread(c.id)}
                        className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      title={c.pinned ? "Desafixar conversa" : "Fixar conversa"}
                      aria-label={c.pinned ? "Desafixar conversa" : "Fixar conversa"}
                      onClick={() => void togglePinned(c.id)}
                      className={cn(
                        "h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center transition-colors",
                        c.pinned
                          ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {c.pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Pin className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 min-w-0 flex-col hidden md:flex">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageCircle className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Selecione uma conversa</p>
            <p className="text-xs text-muted-foreground mt-1">Escolha uma conversa na lista pra ler e responder por aqui.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center font-semibold shrink-0">
                  {selected.contactName ? selected.contactName.charAt(0).toUpperCase() : <User className="h-4 w-4" aria-hidden="true" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {selected.contactName || formatPhoneLabel(selected.phone)}
                    {selected.dealName && ` · ${selected.dealName}`}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{formatPhoneLabel(selected.phone)}</p>
                </div>
              </div>
              {selected.dealId && (
                <Link
                  href={`/negocios/${selected.dealId}`}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Abrir negócio
                </Link>
              )}
            </div>

            {error && (
              <div className="mx-6 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                <CircleAlert className="h-4 w-4 shrink-0 mt-px" aria-hidden="true" />
                <span className="flex-1 break-words">{error}</span>
                <button onClick={clearError} className="shrink-0 underline">fechar</button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-muted/20">
              {loadingThread ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-10">
                  Nenhuma mensagem nessa conversa ainda.
                </p>
              ) : (
                messages.map((m, index) => {
                  const previous = messages[index - 1];
                  const showDay =
                    !previous ||
                    new Date(previous.timestamp).toDateString() !== new Date(m.timestamp).toDateString();
                  const mediaUrl = m.mediaPath ? mediaUrls[m.mediaPath] : undefined;

                  return (
                    <div key={m.id}>
                      {showDay && (
                        <div className="flex justify-center my-4">
                          <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-3 py-1">
                            {formatDayLabel(m.timestamp)}
                          </span>
                        </div>
                      )}
                      <div className={cn("flex mb-1.5", m.fromMe ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-3.5 py-2 text-sm",
                            m.fromMe
                              ? "rounded-br-sm bg-green-500 text-white"
                              : "rounded-bl-sm bg-card border border-border",
                            m.status === "failed" && "ring-1 ring-red-400",
                          )}
                        >
                          {m.type === "image" && mediaUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrl} alt={m.mediaFilename ?? "Imagem"} className="rounded-lg max-h-72 mb-1" />
                          )}
                          {m.type === "audio" && mediaUrl && (
                            <audio controls src={mediaUrl} className="max-w-full mb-1" />
                          )}
                          {m.type === "video" && mediaUrl && (
                            <video controls src={mediaUrl} className="rounded-lg max-h-72 mb-1" />
                          )}
                          {(m.type === "document" || m.type === "sticker") && mediaUrl && (
                            <a
                              href={mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "flex items-center gap-2 underline mb-1",
                                m.fromMe ? "text-green-50" : "text-foreground",
                              )}
                            >
                              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span className="truncate">{m.mediaFilename ?? "Arquivo"}</span>
                              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            </a>
                          )}
                          {m.mediaPath && !mediaUrl && (
                            <p className={cn("text-xs mb-1", m.fromMe ? "text-green-50/80" : "text-muted-foreground")}>
                              Carregando anexo...
                            </p>
                          )}
                          {m.type === "unsupported" && !m.body && (
                            <p className="italic opacity-80">Mensagem não suportada</p>
                          )}
                          {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}

                          <div
                            className={cn(
                              "flex items-center justify-end gap-1 mt-1 text-[10px]",
                              m.fromMe ? "text-green-50/80" : "text-muted-foreground",
                            )}
                          >
                            {formatTime(m.timestamp)}
                            {m.fromMe && <MessageStatusIcon status={m.status} />}
                          </div>
                          {m.status === "failed" && (
                            <p className="text-[10px] mt-0.5 text-red-100">Não enviada</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={threadEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border shrink-0">
              {connection !== "open" ? (
                <p className="text-center text-xs text-muted-foreground py-2">
                  WhatsApp desconectado.{" "}
                  <Link href="/configuracoes/whatsapp" className="text-green-600 underline">Conectar para responder</Link>
                </p>
              ) : recording ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => stopRecording(false)}
                    title="Cancelar"
                    className="h-10 w-10 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <div className="flex-1 flex items-center gap-3 h-10 rounded-lg bg-background border border-red-200 dark:border-red-900 px-4">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
                    <span className="text-sm font-mono text-red-600 dark:text-red-400 shrink-0">{formatDuration(recordSeconds)}</span>
                    <span className="text-xs text-muted-foreground">Gravando áudio...</span>
                  </div>
                  <button
                    onClick={() => stopRecording(true)}
                    title="Enviar áudio"
                    className="h-10 w-10 rounded-lg bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors shrink-0"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFilePicked}
                    accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    title="Anexar arquivo"
                    className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <Paperclip className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <input
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSendText(); } }}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 h-9 px-3 rounded-full border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  {messageInput.trim() ? (
                    <button
                      onClick={() => void handleSendText()}
                      disabled={sending}
                      className="shrink-0 rounded-full bg-green-600 hover:bg-green-700 text-white p-2 transition-colors disabled:opacity-50"
                    >
                      {sending
                        ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                        : <Send className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  ) : (
                    <button
                      onClick={() => void startRecording()}
                      disabled={sending}
                      title="Gravar áudio"
                      className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <Mic className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
