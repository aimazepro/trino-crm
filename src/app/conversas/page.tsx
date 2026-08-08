"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search, User, Users, ChevronDown, MessageCircle, Paperclip, Mic,
  Send, Trash2, ExternalLink, Check, CheckCheck, EyeOff, Pin, PinOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Sample layout data — no WhatsApp integration wired up yet.
// Swap this for real conversation data once the WhatsApp connection is built.
const MOCK_CONVERSATIONS = [
  {
    id: "1",
    contactName: "",
    dealName: "TESTE",
    phone: "5538999225622",
    ownerName: "joao paulo",
    lastMessage: "oi",
    lastMessageMine: true,
    time: "02:38",
    unread: false,
    pinned: false,
  },
];

const MOCK_TEAM = ["joao paulo"];

type Filter = "Todas" | "Não lidas" | "Fixadas";

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function ConversasPage() {
  const [scope, setScope] = useState<"Minhas" | "Time">("Minhas");
  const [vendorFilter, setVendorFilter] = useState("Todos os vendedores");
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [filter, setFilter] = useState<Filter>("Todas");
  const [query, setQuery] = useState("");
  const [allConversations, setAllConversations] = useState(MOCK_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Fake recording clock — purely visual until mic capture is wired up.
  // Seconds reset on the start/stop click handlers below, not here, so the
  // effect only ever subscribes/unsubscribes the interval (no setState in the body).
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const unreadCount = allConversations.filter(c => c.unread).length;
  const pinnedCount = allConversations.filter(c => c.pinned).length;

  const conversations = allConversations
    .filter(c => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return c.contactName.toLowerCase().includes(q) || c.dealName.toLowerCase().includes(q) || c.phone.includes(q);
    })
    .filter(c => (filter === "Não lidas" ? c.unread : filter === "Fixadas" ? c.pinned : true))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const selected = allConversations.find(c => c.id === selectedId) ?? null;

  function selectConversation(id: string) {
    setSelectedId(id);
    // Opening a conversation is how it gets marked read in this mock.
    setAllConversations(prev => prev.map(c => (c.id === id ? { ...c, unread: false } : c)));
  }

  function toggleUnread(id: string) {
    setAllConversations(prev => prev.map(c => (c.id === id ? { ...c, unread: !c.unread } : c)));
  }

  function togglePinned(id: string) {
    setAllConversations(prev => prev.map(c => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
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
                    {["Todos os vendedores", ...MOCK_TEAM].map(v => (
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

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
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
            conversations.map(c => {
              const title = c.contactName || c.phone;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "relative group border-b border-border/60 transition-colors",
                    selectedId === c.id ? "bg-muted" : "hover:bg-muted/60"
                  )}
                >
                  <button
                    onClick={() => selectConversation(c.id)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center font-semibold shrink-0">
                      {c.contactName ? c.contactName.charAt(0).toUpperCase() : <User className="h-4 w-4" aria-hidden="true" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm truncate", c.unread ? "font-semibold" : "font-medium")}>
                          {title}
                        </span>
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[11px] shrink-0 group-hover:opacity-0 transition-opacity",
                            c.unread ? "text-green-600 font-medium" : "text-muted-foreground"
                          )}
                        >
                          {c.pinned && <Pin className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
                          {c.time}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.dealName}</p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          {c.lastMessageMine && <span className="shrink-0 text-muted-foreground/70">Você:</span>}
                          <span className="truncate">{c.lastMessage}</span>
                        </span>
                        {scope === "Minhas" && c.unread && (
                          <span className="shrink-0 h-[14px] w-[14px] rounded-full bg-green-600" title="Marcada como não lida" />
                        )}
                      </div>
                      {scope === "Time" && (
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-[11px] text-muted-foreground/70 truncate">{c.ownerName}</p>
                          {c.unread && (
                            <span className="shrink-0 h-[14px] w-[14px] rounded-full bg-green-600" title="Marcada como não lida" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Row hover actions — sit outside the select <button> so clicks don't nest. */}
                  <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {!c.unread && (
                      <button
                        title="Marcar como não lida"
                        aria-label="Marcar como não lida"
                        onClick={() => toggleUnread(c.id)}
                        className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      title={c.pinned ? "Desafixar conversa" : "Fixar conversa"}
                      aria-label={c.pinned ? "Desafixar conversa" : "Fixar conversa"}
                      onClick={() => togglePinned(c.id)}
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
                  <p className="text-sm font-semibold truncate">{selected.contactName || selected.phone} · {selected.dealName}</p>
                  <p className="text-xs text-muted-foreground truncate">{selected.phone} · {selected.dealName}</p>
                </div>
              </div>
              <Link
                href={`/negocios`}
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Abrir negócio
              </Link>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-muted/20">
              <div className="flex justify-center mb-4">
                <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-3 py-1">HOJE</span>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-green-500 text-white px-3.5 py-2 text-sm">
                  {selected.lastMessage}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-green-50/80">
                    {selected.time}
                    <CheckCheck className="h-3 w-3" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border shrink-0">
              {recording ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setRecording(false); setRecordSeconds(0); }}
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
                    onClick={() => { setRecording(false); setRecordSeconds(0); }}
                    title="Enviar áudio"
                    className="h-10 w-10 rounded-lg bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors shrink-0"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Paperclip className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button className="shrink-0 hidden sm:flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Templates
                  </button>
                  <input
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 h-9 px-3 rounded-full border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  {messageInput.trim() ? (
                    <button className="shrink-0 rounded-full bg-green-600 hover:bg-green-700 text-white p-2 transition-colors">
                      <Send className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button onClick={() => { setRecordSeconds(0); setRecording(true); }} className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors">
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
