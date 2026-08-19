"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, User, Users, ChevronDown, MessageCircle, ExternalLink,
  Check, EyeOff, Pin, PinOff, LoaderCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { useWhatsAppInbox } from "@/hooks/use-whatsapp-inbox";
import { WhatsAppThread } from "@/components/whatsapp/whatsapp-thread";

type Filter = "Todas" | "Não lidas" | "Fixadas";

const ALL_VENDORS = "Todos os vendedores";

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Best available display name: contact record, then WhatsApp profile, then number. */
function formatPhoneLabel(phone: string) {
  const national = phone.startsWith("55") ? phone.slice(2) : phone;
  if (national.length < 10) return `+${phone}`;
  const ddd = national.slice(0, 2);
  const rest = national.slice(2);
  return `+55 (${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(rest.length - 4)}`;
}

export default function ConversasPage() {
  const { state } = useCrm();
  const { map: ownerNames, selfId } = useOwnerNameMap();
  const {
    conversations, selectedId, connection, loading,
    selectConversation, togglePinned, toggleUnread,
  } = useWhatsAppInbox();

  const [scope, setScope] = useState<"Minhas" | "Time">("Minhas");
  const [vendorFilter, setVendorFilter] = useState(ALL_VENDORS);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [filter, setFilter] = useState<Filter>("Todas");
  const [query, setQuery] = useState("");
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

            <WhatsAppThread
              target={{ conversationId: selected.id }}
              connected={connection === "open"}
              emptyHint={`Envie a primeira mensagem para ${selected.contactName || formatPhoneLabel(selected.phone)}.`}
              className="flex-1 min-h-0"
            />
          </>
        )}
      </div>
    </div>
  );
}
