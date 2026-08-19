"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  TriangleAlert,
  WifiOff,
  QrCode,
  LoaderCircle,
  RefreshCw,
  CircleAlert,
} from "lucide-react";

type Status = "disconnected" | "connecting" | "open" | "close";

type StatusResponse = {
  status: Status;
  qr: string | null;
  qrExpired?: boolean;
  phoneNumber: string | null;
  profileName: string | null;
  lastError?: string | null;
  isOwner: boolean;
};

/** While a QR is on screen we poll for the scan; Evolution rotates it ~every 30s. */
const POLL_MS = 3000;

function formatPhone(raw: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length < 10) return `+${digits}`;
  const ddd = national.slice(0, 2);
  const rest = national.slice(2);
  const head = rest.length === 9 ? `${rest[0]} ${rest.slice(1, 5)}` : rest.slice(0, 4);
  const tail = rest.slice(rest.length - 4);
  return `+55 (${ddd}) ${head}-${tail}`;
}

export default function WhatsAppConfigPage() {
  const [info, setInfo] = useState<StatusResponse | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kept in a ref so the polling effect doesn't restart on every tick.
  const qrRef = useRef<string | null>(null);
  qrRef.current = qr;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao consultar o status");
      const data = (await res.json()) as StatusResponse;
      setInfo(data);
      if (data.status === "open") setQr(null);
      else if (data.qr) setQr(data.qr);
      else if (data.qrExpired) setQr(null);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao consultar o status");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll only while a scan could land — an idle disconnected screen costs nothing.
  useEffect(() => {
    if (info?.status !== "connecting" && !qrRef.current) return;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [info?.status, refresh]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao conectar");
      setQr(data.qr ?? null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao conectar");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Desconectar o WhatsApp? As conversas ficam salvas, mas você para de enviar e receber.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao desconectar");
      setQr(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desconectar");
    } finally {
      setBusy(false);
    }
  }

  const status = info?.status ?? "disconnected";
  const showQr = status !== "open" && qr != null;
  const canManage = info?.isOwner !== false;

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="max-w-2xl mx-auto py-10 px-6">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">WhatsApp</h1>
            <p className="text-sm text-zinc-500">
              Conecte seu WhatsApp para conversar com leads diretamente pelo CRM
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
          <div className="flex gap-3">
            <TriangleAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-bold mb-2">Antes de conectar, leia com atenção</p>
              <ul className="space-y-1.5">
                <li>
                  <strong>Use um número comercial.</strong> NÃO conecte seu WhatsApp pessoal. Use
                  um chip dedicado para o CRM.
                </li>
                <li>
                  <strong>Não envie mensagens em massa.</strong> Use para conversas individuais com
                  leads. Disparos em massa podem resultar em restrição da conta.
                </li>
                <li>
                  <strong>Restrições no número</strong> estão relacionadas à qualidade do chip e
                  fazem parte do uso.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6 flex gap-3">
            <CircleAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 min-w-0">
              <p className="font-semibold">Não deu certo</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          </div>
        )}

        {/* Main Connection Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Verificando conexão...
            </div>
          )}

          {!loading && status === "open" && (
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-900">WhatsApp conectado</p>
                <p className="text-sm text-zinc-500 mt-0.5 truncate">
                  {info?.profileName ? `${info.profileName} · ` : ""}
                  {formatPhone(info?.phoneNumber ?? null) || "número não identificado"}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={disconnect}
                  disabled={busy}
                  className="px-4 py-2 border border-red-200 text-red-500 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Desconectar
                </button>
              )}
            </div>
          )}

          {!loading && status !== "open" && showQr && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-900">Escaneie o QR Code</p>
                  <p className="text-sm text-zinc-500">
                    Abra o WhatsApp no celular {">"} Aparelhos conectados {">"} Conectar
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-xl border-2 border-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="QR Code WhatsApp" className="w-64 h-64" src={qr!} />
                </div>

                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Aguardando leitura do QR Code...
                </div>

                <button
                  onClick={connect}
                  disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
                  Gerar novo QR Code
                </button>
              </div>
            </div>
          )}

          {!loading && status !== "open" && !showQr && (
            <div className="text-center py-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto">
                <WifiOff className="h-8 w-8 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-900">WhatsApp não conectado</p>
                <p className="text-sm text-zinc-500 mt-1">
                  {canManage
                    ? "Conecte um número comercial para enviar e receber mensagens pelo CRM"
                    : "O dono da conta ainda não conectou o WhatsApp deste workspace"}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={connect}
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {busy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="h-4 w-4" />
                  )}
                  {busy ? "Gerando QR Code..." : "Conectar WhatsApp"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* WhatsApp API Oficial card */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <MessageCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-zinc-900">
                  WhatsApp API Oficial (Meta)
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  Em breve
                </span>
              </div>
              <p className="text-sm text-zinc-600 mt-2">
                Conexão oficial com a Meta, sem risco de banimento. Ideal para empresas que querem
                estabilidade e escala. Cobrado por uso (pré-pago em créditos).
              </p>
              <p className="text-xs text-zinc-500 mt-3">
                Estamos desenvolvendo essa integração. Em breve você poderá ativar no seu workspace.
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
