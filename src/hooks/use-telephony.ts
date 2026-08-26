"use client";

import { useCallback, useEffect, useState } from "react";

export interface TelephonyExtensionInfo {
  id: string;
  userId: string;
  extension: string;
  mode: "unlimited" | "per_minute";
  dialMode: "webphone" | "callback";
  status: "active" | "disabled";
  linkedAt: string;
  callbackNumber: string | null;
}

export interface TelephonyTeamMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  isOwner: boolean;
  extension: TelephonyExtensionInfo | null;
}

export interface TelephonyStatus {
  provider: string;
  status: "inactive" | "provisioning" | "active" | "suspended";
  callerId: string | null;
  recordingEnabled: boolean;
  recordingRetentionDays: number;
  consentMode: "announce" | "manual" | "off";
  consentText: string;
  isOwner: boolean;
  plan: string | null;
  paidPlan: boolean;
  balanceCents: number;
  reservedCents: number;
  rates: Record<string, number>;
  myExtension: TelephonyExtensionInfo | null;
  team: TelephonyTeamMember[];
}

export function useTelephony() {
  const [status, setStatus] = useState<TelephonyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/telephony/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao consultar a telefonia");
      setStatus(data as TelephonyStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}

export function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
