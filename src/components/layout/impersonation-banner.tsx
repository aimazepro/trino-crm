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
    // A pista visual não pode sumir antes da sessão que ela descreve. Se o
    // cookie fosse limpo primeiro e signOut() falhasse depois (um blip de
    // rede já basta), a sessão do Supabase -- httpOnly, é ela a fronteira
    // de verdade -- continuaria totalmente viva sem NENHUM aviso na tela:
    // o pior estado possível, operando como o cliente sem saber disso. Por
    // isso a ordem é sempre: encerra a sessão primeiro (com a falha contida
    // num try/catch, porque não existe "sessão meio encerrada" melhor que
    // isso), só depois apaga o marcador, e o redirect roda incondicional
    // num finally -- nenhum caminho deixa a pessoa parada na página.
    try {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        await createClient().auth.signOut();
      } catch {
        // Rede caiu ou algo assim -- segue mesmo assim pro cleanup abaixo.
      }
      document.cookie = "impersonated_by=; path=/; max-age=0";
    } finally {
      window.location.href = "/login";
    }
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
