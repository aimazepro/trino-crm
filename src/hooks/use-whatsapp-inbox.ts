"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type WhatsAppMessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface InboxMessage {
  id: string;
  conversationId: string;
  waMessageId: string | null;
  fromMe: boolean;
  type: string;
  body: string | null;
  mediaPath: string | null;
  mediaMime: string | null;
  mediaFilename: string | null;
  status: WhatsAppMessageStatus;
  error: string | null;
  timestamp: string;
}

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

export type ConnectionState = "unknown" | "disconnected" | "connecting" | "open" | "close";

const MEDIA_BUCKET = "whatsapp-media";
const SIGNED_URL_TTL = 60 * 60;

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

function toMessage(row: any): InboxMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    waMessageId: row.wa_message_id,
    fromMe: row.from_me,
    type: row.type,
    body: row.body,
    mediaPath: row.media_path,
    mediaMime: row.media_mime,
    mediaFilename: row.media_filename,
    status: row.status,
    error: row.error,
    timestamp: row.timestamp,
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

export function useWhatsAppInbox() {
  const supabase = useMemo<SupabaseClient>(() => createClient(), []);

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("unknown");
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed URLs expire, but a session rarely outlives one hour of viewing; the
  // cache keeps a scrolling thread from re-signing the same object repeatedly.
  const mediaUrlCache = useRef(new Map<string, string>());
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  // --- initial load -------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
        const status = res.ok ? await res.json() : null;
        if (cancelled) return;

        setConnection(status?.status ?? "disconnected");
        setWorkspaceOwnerId(status?.workspaceOwnerId ?? null);

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
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // --- realtime -----------------------------------------------------------

  useEffect(() => {
    if (!workspaceOwnerId) return;

    const filter = `user_id=eq.${workspaceOwnerId}`;

    const channel = supabase
      .channel(`realtime:whatsapp:${workspaceOwnerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations", filter },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") return;
          const incoming = toConversation(payload.new);
          setConversations((prev) => {
            const without = prev.filter((c) => c.id !== incoming.id);
            return sortConversations([...without, incoming]);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages", filter },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") return;
          const incoming = toMessage(payload.new);
          // Only the open thread is held in memory; the rest is reflected by the
          // conversation row's preview and unread badge.
          if (incoming.conversationId !== selectedIdRef.current) return;
          setMessages((prev) => {
            const without = prev.filter((m) => m.id !== incoming.id);
            return [...without, incoming].sort(
              (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
            );
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, workspaceOwnerId]);

  // --- media --------------------------------------------------------------

  const resolveMediaUrls = useCallback(
    async (paths: string[]) => {
      const missing = paths.filter((p) => p && !mediaUrlCache.current.has(p));
      if (missing.length === 0) return;

      const results = await Promise.all(
        missing.map(async (path) => {
          const { data } = await supabase.storage
            .from(MEDIA_BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL);
          return [path, data?.signedUrl ?? null] as const;
        }),
      );

      const resolved: Record<string, string> = {};
      for (const [path, url] of results) {
        if (!url) continue;
        mediaUrlCache.current.set(path, url);
        resolved[path] = url;
      }
      if (Object.keys(resolved).length > 0) {
        setMediaUrls((prev) => ({ ...prev, ...resolved }));
      }
    },
    [supabase],
  );

  useEffect(() => {
    const paths = messages.map((m) => m.mediaPath).filter((p): p is string => !!p);
    if (paths.length > 0) void resolveMediaUrls(paths);
  }, [messages, resolveMediaUrls]);

  // --- thread -------------------------------------------------------------

  const selectConversation = useCallback(
    async (conversationId: string) => {
      setSelectedId(conversationId);
      setMessages([]);
      setLoadingThread(true);

      try {
        const { data, error: queryError } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("timestamp", { ascending: true })
          .limit(500);

        if (queryError) throw new Error(queryError.message);
        setMessages((data ?? []).map(toMessage));

        // Opening a thread is what marks it read, same as WhatsApp.
        await supabase
          .from("whatsapp_conversations")
          .update({ unread_count: 0, manually_unread: false })
          .eq("id", conversationId);

        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0, manuallyUnread: false } : c,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao abrir a conversa");
      } finally {
        setLoadingThread(false);
      }
    },
    [supabase],
  );

  // --- mutations ----------------------------------------------------------

  const send = useCallback(
    async (body: FormData | { text: string }) => {
      const conversationId = selectedIdRef.current;
      if (!conversationId) return false;

      setSending(true);
      setError(null);
      try {
        const isForm = body instanceof FormData;
        if (isForm) body.set("conversationId", conversationId);

        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          ...(isForm
            ? { body }
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversationId, text: body.text }),
              }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Falha ao enviar");
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao enviar");
        return false;
      } finally {
        setSending(false);
      }
    },
    [],
  );

  const sendText = useCallback((text: string) => send({ text }), [send]);

  const sendFile = useCallback(
    (file: File, caption?: string) => {
      const form = new FormData();
      form.set("file", file);
      if (caption) form.set("caption", caption);
      return send(form);
    },
    [send],
  );

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
    messages,
    selectedId,
    connection,
    loading,
    loadingThread,
    sending,
    error,
    mediaUrls,
    selectConversation,
    sendText,
    sendFile,
    togglePinned,
    toggleUnread,
    clearError: () => setError(null),
  };
}
