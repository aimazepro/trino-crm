"use client";

import { useEffect, useState } from "react";

/**
 * Única pista visual de que os dados na tela não são seus. Renderizada pelo
 * AppShell (layout), nunca por uma página específica: se ela sumisse numa
 * rota, alguém agiria achando que está na própria conta.
 */
export function ImpersonationBanner() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)impersonated_by=([^;]*)/);
    setEmail(match ? decodeURIComponent(match[1]) : null);
  }, []);

  if (!email) return null;

  async function sair() {
    document.cookie = "impersonated_by=; path=/; max-age=0";
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="bg-amber-500 text-white text-xs font-bold px-4 py-2 flex items-center justify-between">
      <span>SESSÃO DE SUPORTE — você está como {email}</span>
      <button onClick={sair} className="underline underline-offset-2">
        sair
      </button>
    </div>
  );
}
