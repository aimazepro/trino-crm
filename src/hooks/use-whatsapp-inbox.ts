"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useWhatsAppConnection } from "./use-whatsapp-connection";

export interface InboxConversation {
  id: string;
  remoteJid: string;
  phone: string;
  contactId: string | null;
  dealId: string | null;
  ownerId: string | null;
  pushName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean;
  unreadCount: number;
  manuallyUnread: boolean;
  pinned: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toConversation(row: any): InboxConversation {
  return {
    id: row.id,
    remoteJid: row.remote_jid,
    phone: row.phone,
    contactId: row.contact_id,
    dealId: row.deal_id,
    ownerId: row.owner_id,
    pushName: row.push_name,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    lastMessageFromMe: row.last_message_from_me,
    unreadCount: row.unread_count ?? 0,
    manuallyUnread: row.manually_unread ?? false,
    pinned: row.pinned ?? false,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function sortConversations(list: InboxConversation[]): InboxConversation[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
    const at = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bt = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return bt - at;
  });
}

/**
 * The conversation list. Reading and sending inside one conversation lives in
 * useWhatsAppThread, which the deal screen uses on its own.
 */
export function useWhatsAppInbox() {
  const supabase = useMemo<SupabaseClient>(() => createClient(), []);
  const { status: connection, workspaceOwnerId } = useWhatsAppConnection();

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("whatsapp_conversations")
          .select("*")
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(300);

        if (cancelled) return;
        if (queryError) throw new Error(queryError.message);
        setConversations(sortConversations((data ?? []).map(toConversation)));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar conversas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!workspaceOwnerId) return;

    const channel = supabase
      .channel(`realtime:whatsapp-inbox:${workspaceOwnerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversations",
          filter: `user_id=eq.${workspaceOwnerId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") return;
          const incoming = toConversation(payload.new);
          setConversations((prev) =>
            sortConversations([...prev.filter((c) => c.id !== incoming.id), incoming]),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, workspaceOwnerId]);

  // The thread hook clears the badge in the database when it opens; this is the
  // optimistic half, so the list reacts on click instead of on the round trip.
  const selectConversation = useCallback((conversationId: string) => {
    setSelectedId(conversationId);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0, manuallyUnread: false } : c,
      ),
    );
  }, []);

  const togglePinned = useCallback(
    async (conversationId: string) => {
      const current = conversations.find((c) => c.id === conversationId);
      if (!current) return;
      const pinned = !current.pinned;

      setConversations((prev) =>
        sortConversations(prev.map((c) => (c.id === conversationId ? { ...c, pinned } : c))),
      );
      await supabase.from("whatsapp_conversations").update({ pinned }).eq("id", conversationId);
    },
    [conversations, supabase],
  );

  const toggleUnread = useCallback(
    async (conversationId: string) => {
      const current = conversations.find((c) => c.id === conversationId);
      if (!current) return;
      const manuallyUnread = !(current.manuallyUnread || current.unreadCount > 0);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, manuallyUnread, unreadCount: manuallyUnread ? c.unreadCount : 0 }
            : c,
        ),
      );
      await supabase
        .from("whatsapp_conversations")
        .update({ manually_unread: manuallyUnread, ...(manuallyUnread ? {} : { unread_count: 0 }) })
        .eq("id", conversationId);
    },
    [conversations, supabase],
  );

  return {
    conversations,
    selectedId,
    connection,
    loading,
    error,
    selectConversation,
    togglePinned,
    toggleUnread,
    clearError: useCallback(() => setError(null), []),
  };
}
