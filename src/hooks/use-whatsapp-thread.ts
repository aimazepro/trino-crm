"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type WhatsAppMessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface ThreadMessage {
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

/**
 * Which conversation to show. `conversationId` is the inbox case (the row is
 * already known); `phone` is the deal case, where a conversation may not exist
 * yet and only gets created by the first outgoing message.
 */
export type ThreadTarget =
  | { conversationId: string | null }
  | { phone: string | null; dealId?: string; contactId?: string | null };

const MEDIA_BUCKET = "whatsapp-media";
const SIGNED_URL_TTL = 60 * 60;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toMessage(row: any): ThreadMessage {
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

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Finds the conversation behind a deal. Deal link first, then contact, then the
 * raw number — the number is matched on its last 8 digits, which absorbs the
 * Brazilian 9th digit the same way the server-side RPC does.
 */
async function resolveByPhone(
  supabase: SupabaseClient,
  target: Extract<ThreadTarget, { phone: string | null }>,
): Promise<string | null> {
  if (target.dealId) {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("deal_id", target.dealId)
      .limit(1)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  if (target.contactId) {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("contact_id", target.contactId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  const digits = digitsOnly(target.phone);
  if (digits.length >= 8) {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .like("phone", `%${digits.slice(-8)}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  return null;
}

export function useWhatsAppThread(target: ThreadTarget) {
  const supabase = useMemo<SupabaseClient>(() => createClient(), []);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  const mediaUrlCache = useRef(new Map<string, string>());

  // Destructured so the effects below depend on primitives rather than on a
  // target object that callers rebuild on every render.
  const explicitId = "conversationId" in target ? target.conversationId : undefined;
  const phone = "phone" in target ? target.phone : undefined;
  const dealId = "phone" in target ? target.dealId : undefined;
  const contactId = "phone" in target ? target.contactId : undefined;

  // --- which conversation ---------------------------------------------------

  useEffect(() => {
    if (explicitId !== undefined) {
      setConversationId(explicitId);
      return;
    }

    let cancelled = false;
    setConversationId(null);

    void (async () => {
      const found = await resolveByPhone(supabase, { phone: phone ?? null, dealId, contactId });
      if (!cancelled) setConversationId(found);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, explicitId, phone, dealId, contactId]);

  // --- messages -------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("timestamp", { ascending: true })
          .limit(500);

        if (cancelled) return;
        if (queryError) throw new Error(queryError.message);
        setMessages((data ?? []).map(toMessage));

        // Opening a thread is what marks it read, in either screen. The inbox
        // list picks the change up over Realtime.
        await supabase
          .from("whatsapp_conversations")
          .update({ unread_count: 0, manually_unread: false })
          .eq("id", conversationId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar mensagens");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, conversationId]);

  // --- realtime -------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`realtime:whatsapp-thread:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "DELETE") return;
          const incoming = toMessage(payload.new);
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
  }, [supabase, conversationId]);

  // --- media ----------------------------------------------------------------

  useEffect(() => {
    const paths = messages
      .map((m) => m.mediaPath)
      .filter((p): p is string => !!p && !mediaUrlCache.current.has(p));
    if (paths.length === 0) return;

    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        paths.map(async (path) => {
          const { data } = await supabase.storage
            .from(MEDIA_BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL);
          return [path, data?.signedUrl ?? null] as const;
        }),
      );
      if (cancelled) return;

      const resolved: Record<string, string> = {};
      for (const [path, url] of results) {
        if (!url) continue;
        mediaUrlCache.current.set(path, url);
        resolved[path] = url;
      }
      if (Object.keys(resolved).length > 0) {
        setMediaUrls((prev) => ({ ...prev, ...resolved }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, supabase]);

  // --- sending --------------------------------------------------------------

  const send = useCallback(
    async (payload: FormData | { text: string }) => {
      // With no conversation yet, the number is the address; the server creates
      // the conversation and tells us its id.
      const routing: Record<string, string> = conversationId
        ? { conversationId }
        : { phone: digitsOnly(phone) };

      if (!conversationId && !routing.phone) {
        setError("Contato sem telefone");
        return false;
      }

      setSending(true);
      setError(null);
      try {
        const isForm = payload instanceof FormData;
        if (isForm) for (const [k, v] of Object.entries(routing)) payload.set(k, v);

        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          ...(isForm
            ? { body: payload }
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...routing, text: payload.text }),
              }),
        });

        const data = await res.json().catch(() => null);
        if (data?.conversationId && !conversationId) setConversationId(data.conversationId);
        if (!res.ok) throw new Error(data?.error ?? "Falha ao enviar");
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao enviar");
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversationId, phone],
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

  return {
    conversationId,
    messages,
    loading,
    sending,
    error,
    mediaUrls,
    sendText,
    sendFile,
    clearError: useCallback(() => setError(null), []),
  };
}
