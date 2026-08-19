"use client";

import { useEffect, useState } from "react";

export type ConnectionState = "unknown" | "disconnected" | "connecting" | "open" | "close";

export interface WhatsAppConnectionInfo {
  status: ConnectionState;
  phoneNumber: string | null;
  profileName: string | null;
  workspaceOwnerId: string | null;
  isOwner: boolean;
}

const INITIAL: WhatsAppConnectionInfo = {
  status: "unknown",
  phoneNumber: null,
  profileName: null,
  workspaceOwnerId: null,
  isOwner: true,
};

/**
 * Live connection state for the workspace. Every screen that offers to send a
 * message asks this rather than guessing, so none of them can claim
 * "desconectado" while a session is actually open.
 */
export function useWhatsAppConnection(): WhatsAppConnectionInfo & { loading: boolean } {
  const [info, setInfo] = useState<WhatsAppConnectionInfo>(INITIAL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
        if (!res.ok) throw new Error("status unavailable");
        const data = await res.json();
        if (cancelled) return;
        setInfo({
          status: data.status ?? "disconnected",
          phoneNumber: data.phoneNumber ?? null,
          profileName: data.profileName ?? null,
          workspaceOwnerId: data.workspaceOwnerId ?? null,
          isOwner: data.isOwner !== false,
        });
      } catch {
        if (!cancelled) setInfo({ ...INITIAL, status: "disconnected" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...info, loading };
}
