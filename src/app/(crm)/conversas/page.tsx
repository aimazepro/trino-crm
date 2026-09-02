"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, User, UsersRound, MessageCircle, ExternalLink,
  EyeOff, Pin, PinOff, LoaderCircle, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useCrm } from "@/contexts/crm-context";
import { useTeam } from "@/hooks/use-team";
import { ScopeToggle } from "@/components/team/scope-toggle";
import { OwnerSelect } from "@/components/team/owner-select";
import { OwnerBadge } from "@/components/team/owner-badge";
import { useWhatsAppInbox } from "@/hooks/use-whatsapp-inbox";
import { WhatsAppThread } from "@/components/whatsapp/whatsapp-thread";
import { NewDealModal } from "@/components/pipeline/new-deal-modal";
import { RequireFeature } from "@/components/auth/require-feature";

type Filter = "Todas" | "Não lidas" | "Fixadas";
type Scope = "minhas" | "fila" | "time";

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
  const { state, addContact } = useCrm();
  // `loading` (time) é combinado com o `loading` do inbox mais abaixo: self.id
  // só existe depois que useTeam() resolve, e o escopo padrão é "minhas" --
  // sem essa espera a lista pisca vazia em toda carga da página, porque
  // c.ownerId === "" nunca bate com nada.
  const { map: ownerNames, self, isManager, loading: teamLoading } = useTeam();
  const selfId = self?.id ?? "";
  const selfName = self?.name ?? "";
  const {
    conversations, selectedId, connection, loading,
    selectConversation, togglePinned, toggleUnread, applyOwner,
  } = useWhatsAppInbox();

  const [scope, setScope] = useState<Scope>("minhas");
  const [vendorFilter, setVendorFilter] = useState<string | null>(null); // id, não nome
  const [filter, setFilter] = useState<Filter>("Todas");
  const [query, setQuery] = useState("");
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [pendingDealContactId, setPendingDealContactId] = useState<string | undefined>(undefined);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const contactsById = useMemo(
    () => new Map(state.contacts.map(c => [c.id, c])),
    [state.contacts],
  );
  const dealsById = useMemo(
    () => new Map(state.deals.map(d => [d.id, d])),
    [state.deals],
  );
  const companiesById = useMemo(
    () => new Map(state.companies.map(c => [c.id, c])),
    [state.companies],
  );

  const enriched = useMemo(
    () => conversations.map(c => {
      const deal = c.dealId ? dealsById.get(c.dealId) : null;
      const company = deal?.companyId ? companiesById.get(deal.companyId) : null;
      return {
        ...c,
        contactName: (c.contactId ? contactsById.get(c.contactId)?.name : null) ?? c.pushName ?? "",
        dealName: deal?.title ?? "",
        companyName: company?.name ?? "",
        ownerName: c.ownerId ? ownerNames[c.ownerId] ?? "" : "",
        isUnread: c.manuallyUnread || c.unreadCount > 0,
      };
    }),
    [conversations, contactsById, dealsById, companiesById, ownerNames],
  );

  // Restores the pipeline the user was last working in Negócios, same key
  // negocios/page.tsx writes — a deal created from a WhatsApp chat should land
  // wherever they've actually been working, not always the first pipeline.
  const activePipelineId = useMemo(() => {
    if (state.pipelines.length === 0) return "";
    const saved = typeof window !== "undefined" ? localStorage.getItem("trino_crm_active_pipeline_id") : null;
    return saved && state.pipelines.some(p => p.id === saved) ? saved : state.pipelines[0].id;
  }, [state.pipelines]);

  async function handleCreateDeal(conversationId: string, contactName: string, phone: string, existingContactId: string | null) {
    if (creatingDeal) return;
    setCreatingDeal(true);
    try {
      let contactId = existingContactId;
      if (!contactId) {
        contactId = await addContact({
          id: "",
          name: contactName,
          role: "",
          emails: [],
          phones: [{ value: phone, type: "WhatsApp" }],
        });
        if (!contactId) return;
      }

      // Client-side on purpose, unlike the rest of this table's writes: the
      // person clicking this owns the conversation row already (RLS-scoped),
      // and linking contact_id now is what lets the deal-sync trigger
      // (migration 20260825180000) fill in deal_id/owner_id the instant the
      // deal below gets inserted.
      const supabase = createClient();
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ contact_id: contactId })
        .eq("id", conversationId);
      if (error) console.error("[Conversas] link contact to conversation failed:", error);

      setPendingDealContactId(contactId);
      setShowNewDealModal(true);
    } finally {
      setCreatingDeal(false);
    }
  }

  /**
   * Reatribuição explícita. A política de UPDATE de whatsapp_conversations já
   * aceita dono atual, gerente/admin, ou conversa sem dono -- então o vendedor
   * consegue assumir da fila e o gerente consegue passar para outro, sem regra
   * extra aqui.
   */
  async function handleAssign(conversationId: string, ownerId: string | null) {
    if (assigning) return;
    setAssigning(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .update({ owner_id: ownerId })
        .eq("id", conversationId)
        .select("id");
      if (error) {
        console.error("[Conversas] atribuir conversa falhou:", error);
        alert("Não foi possível atribuir a conversa.");
      } else if (!data || data.length === 0) {
        // RLS bateu 0 linhas sem devolver error: a conversa não está mais no
        // estado que este UPDATE esperava (ex.: outro vendedor assumiu da
        // fila um instante antes). Sem o .select(), isso passava batido.
        alert("Essa conversa já foi assumida por outra pessoa.");
      } else {
        // Só depois de o banco confirmar. A lista sai do estado do inbox, então
        // sem esta linha a conversa continuava na Fila até um reload.
        applyOwner(conversationId, ownerId);
      }
    } finally {
      setAssigning(false);
    }
  }

  // Contadores dos escopos, calculados antes do filtro de escopo para que a
  // aba mostre quantas conversas ela tem mesmo sem estar selecionada.
  const scopeCounts = useMemo(() => ({
    minhas: enriched.filter(c => c.ownerId === selfId).length,
    fila: enriched.filter(c => !c.ownerId).length,
    time: enriched.length,
  }), [enriched, selfId]);

  const unreadCount = enriched.filter(c => c.isUnread).length;
  const pinnedCount = enriched.filter(c => c.pinned).length;

  const visible = enriched
    // "Minhas" é só o que é meu. A fila tem aba própria agora -- misturar
    // conversa sem dono em "Minhas" fazia o vendedor achar que já era dele.
    .filter(c => {
      if (scope === "minhas") return c.ownerId === selfId;
      if (scope === "fila") return !c.ownerId;
      return true; // time
    })
    .filter(c => (scope === "time" && vendorFilter ? c.ownerId === vendorFilter : true))
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
    <RequireFeature feature="whatsapp">
    <div className="h-full flex bg-background">
      {/* Lista de conversas */}
      <div className="w-full md:w-[360px] md:min-w-[360px] md:border-r border-border flex-col flex">
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Conversas</h1>
            <ScopeToggle<Scope>
              value={scope}
              onChange={(v) => { setScope(v); setVendorFilter(null); }}
              options={[
                { value: "minhas", label: "Minhas", count: scopeCounts.minhas },
                { value: "fila", label: "Fila", count: scopeCounts.fila },
                { value: "time", label: "Time", count: scopeCounts.time, hidden: !isManager },
              ]}
            />
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

          {scope === "time" && (
            <OwnerSelect
              value={vendorFilter}
              onChange={setVendorFilter}
              allowUnassigned
              unassignedLabel="Todos os vendedores"
              className="w-full"
            />
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
          {loading || teamLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando conversas...
            </div>
          ) : conversations.length === 0 ? (
            // Truly nothing in the inbox yet — worth checking the connection for.
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
          ) : visible.length === 0 ? (
            // There ARE conversations — this filter/search just matched none of
            // them. Nothing wrong with the connection, so no reason to say so.
            <div className="flex flex-col items-center justify-center text-center px-6 py-16">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Search className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">
                {query.trim()
                  ? "Nenhum resultado para a busca"
                  : filter === "Não lidas"
                  ? "Nenhuma conversa não lida"
                  : filter === "Fixadas"
                  ? "Nenhuma conversa fixada"
                  : "Nenhuma conversa aqui"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {scope === "fila"
                  ? "Nenhuma conversa esperando atendimento."
                  : scope === "time" && vendorFilter
                    ? `Sem conversas de ${ownerNames[vendorFilter] ?? "esse vendedor"} com esse filtro.`
                    : "Troque o filtro ou a busca pra ver as outras conversas."}
              </p>
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
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={cn("text-sm truncate", c.isUnread ? "font-semibold" : "font-medium")}>
                            {title}
                          </span>
                          {c.isGroup && (
                            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                              Grupo
                            </span>
                          )}
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
                        {scope === "minhas" && c.isUnread && (
                          <span className="shrink-0 h-[14px] w-[14px] rounded-full bg-green-600" title="Não lida" />
                        )}
                      </div>
                      {scope === "time" && (
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
                  <p className="flex items-center gap-1.5 text-sm font-semibold truncate">
                    <span className="truncate">
                      {selected.contactName || (selected.isGroup ? "Grupo" : formatPhoneLabel(selected.phone))}
                      {selected.dealName && ` · ${selected.dealName}`}
                    </span>
                    {selected.isGroup && (
                      <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        <UsersRound className="h-2.5 w-2.5" aria-hidden="true" /> Grupo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selected.isGroup ? "Grupo do WhatsApp" : formatPhoneLabel(selected.phone)}
                  </p>
                </div>
              </div>
              {!selected.ownerId ? (
                <button
                  onClick={() => void handleAssign(selected.id, selfId)}
                  disabled={assigning}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-amber-500 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  <User className="h-3.5 w-3.5" aria-hidden="true" /> Assumir conversa
                </button>
              ) : isManager ? (
                <OwnerSelect
                  value={selected.ownerId}
                  onChange={(id) => void handleAssign(selected.id, id)}
                  allowUnassigned
                  unassignedLabel="Devolver para a fila"
                  disabled={assigning}
                  className="w-44 shrink-0"
                />
              ) : (
                <OwnerBadge ownerId={selected.ownerId} className="shrink-0" />
              )}
              {selected.dealId ? (
                <Link
                  href={`/negocios/${selected.dealId}`}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Abrir negócio
                </Link>
              ) : !selected.isGroup ? (
                <button
                  onClick={() => void handleCreateDeal(
                    selected.id,
                    selected.contactName || formatPhoneLabel(selected.phone),
                    selected.phone,
                    selected.contactId,
                  )}
                  disabled={creatingDeal}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-green-600 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900"
                >
                  {creatingDeal
                    ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  Criar negócio
                </button>
              ) : null}
            </div>

            <WhatsAppThread
              target={{ conversationId: selected.id }}
              connected={connection === "open"}
              emptyHint={`Envie a primeira mensagem para ${selected.contactName || formatPhoneLabel(selected.phone)}.`}
              className="flex-1 min-h-0"
              templateContext={{
                contactName: selected.contactName || undefined,
                companyName: selected.companyName || undefined,
                dealName: selected.dealName || undefined,
                vendorName: selfName || undefined,
              }}
            />

            {showNewDealModal && (
              <NewDealModal
                activePipelineId={activePipelineId}
                initialContactId={pendingDealContactId}
                initialTitle={selected.contactName || formatPhoneLabel(selected.phone)}
                onClose={() => { setShowNewDealModal(false); setPendingDealContactId(undefined); }}
              />
            )}
          </>
        )}
      </div>
    </div>
    </RequireFeature>
  );
}
