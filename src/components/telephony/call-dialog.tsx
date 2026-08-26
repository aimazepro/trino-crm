"use client";

// Diálogo de ligação: disca, cronometra, mostra o script daquele workspace e
// captura o resultado ao encerrar.
//
// Uma coisa importante sobre o cronômetro: ele é INFORMATIVO. Quem determina o
// que é cobrado é o CDR que o provedor manda no webhook. No provedor simulado o
// tempo do cronômetro vira a duração do evento porque ali o navegador ESTÁ
// fazendo o papel da operadora — em produção esse número não cobra nada.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  FileText,
  Loader2,
  Mic,
  PhoneCall,
  PhoneOff,
  ShieldCheck,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/hooks/use-telephony";

type Phase = "starting" | "live" | "wrapup" | "done" | "error";

interface Script {
  id: string;
  name: string;
  content: string;
  category: string | null;
}

const DISPOSITIONS: { value: string; label: string; tone: string }[] = [
  { value: "atendeu", label: "Atendeu", tone: "border-green-200 bg-green-50 text-green-700" },
  { value: "nao_atendeu", label: "Não atendeu", tone: "border-zinc-200 bg-white text-zinc-600" },
  { value: "caixa_postal", label: "Caixa postal", tone: "border-zinc-200 bg-white text-zinc-600" },
  { value: "ocupado", label: "Ocupado", tone: "border-zinc-200 bg-white text-zinc-600" },
  { value: "numero_errado", label: "Número errado", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  { value: "reagendar", label: "Reagendar", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  { value: "sem_interesse", label: "Sem interesse", tone: "border-red-200 bg-red-50 text-red-700" },
];

export interface CallDialogProps {
  toNumber: string;
  contactName?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  onClose: () => void;
  onFinished?: () => void;
}

export function CallDialog({
  toNumber,
  contactName,
  dealId,
  contactId,
  onClose,
  onFinished,
}: CallDialogProps) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("mock");
  const [consent, setConsent] = useState<{ mode: string; text: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [disposition, setDisposition] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [scripts, setScripts] = useState<Script[]>([]);
  const [activeScript, setActiveScript] = useState<string | null>(null);

  const startedRef = useRef(false);

  // Script de cold call do workspace, ao lado da chamada.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("scripts")
      .select("id, name, content, category")
      .order("created_at")
      .then(({ data }) => {
        if (cancelled || !data) return;
        setScripts(data as Script[]);
        if (data.length > 0) setActiveScript((data[0] as Script).id);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Dispara a ligação uma única vez, mesmo com o duplo-mount do StrictMode.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/telephony/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toNumber, dealId: dealId ?? null, contactId: contactId ?? null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Falha ao ligar");

        setCallId(data.callId);
        setProvider(data.provider ?? "mock");
        setRecording(Boolean(data.recording));
        if (data.consentMode && data.consentMode !== "off") {
          setConsent({ mode: data.consentMode, text: data.consentText });
        }
        setPhase("live");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
        setPhase("error");
      }
    })();
  }, [toNumber, dealId, contactId]);

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const hangup = useCallback(async () => {
    setPhase("wrapup");
    if (!callId) return;
    try {
      // No simulado, o navegador faz o papel da operadora e emite o evento
      // final assinado. Com provedor real, o hangup chega pelo webhook dele.
      await fetch("/api/telephony/mock/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, action: "hangup", durationSeconds: seconds }),
      });
    } catch {
      // Encerramento no provedor falhou: a reconciliação diária resolve a
      // reserva presa. Não trava o vendedor na tela por causa disso.
    }
  }, [callId, seconds]);

  const finish = useCallback(async () => {
    if (!callId) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/telephony/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition: disposition ?? undefined,
          notes: notes || undefined,
        }),
      });
      setPhase("done");
      onFinished?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o resultado");
    } finally {
      setSaving(false);
    }
  }, [callId, disposition, notes, onClose, onFinished]);

  const script = scripts.find((s) => s.id === activeScript) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              phase === "live" ? "bg-green-100" : "bg-purple-100",
            )}
          >
            {phase === "starting" ? (
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
            ) : (
              <PhoneCall
                className={cn("h-5 w-5", phase === "live" ? "text-green-600" : "text-purple-600")}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {contactName || "Ligação"}
            </p>
            <p className="text-xs text-zinc-500">{toNumber}</p>
          </div>
          {phase === "live" && (
            <span className="rounded-full bg-green-50 px-3 py-1 font-mono text-sm font-semibold text-green-700">
              {formatDuration(seconds)}
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-6 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {consent && phase === "live" && (
          <div className="flex items-start gap-2 border-b border-blue-100 bg-blue-50 px-6 py-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-xs text-blue-800">
              {consent.mode === "manual" ? "Avise o cliente: " : "Aviso automático: "}
              <span className="font-medium">{consent.text}</span>
            </p>
          </div>
        )}

        <div className="grid gap-0 md:grid-cols-[1fr_320px]">
          {/* Script */}
          <div className="border-r border-zinc-100 p-6">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-zinc-900">Script da ligação</h3>
              {recording && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                  <Mic className="h-3 w-3" /> Gravando
                </span>
              )}
            </div>

            {scripts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-400">
                Nenhum script cadastrado. Crie em Configurações → Scripts de Ligação para o time ter
                um roteiro na mão durante a chamada.
              </p>
            ) : (
              <>
                {scripts.length > 1 && (
                  <select
                    value={activeScript ?? ""}
                    onChange={(e) => setActiveScript(e.target.value)}
                    className="mb-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-purple-400"
                  >
                    {scripts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.category ? ` · ${s.category}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700">
                  {script?.content ?? ""}
                </div>
              </>
            )}
          </div>

          {/* Painel lateral */}
          <div className="p-6">
            {phase === "live" && (
              <>
                <p className="mb-2 text-xs font-medium text-zinc-400 uppercase">Notas</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="O que foi dito..."
                  className="w-full resize-none rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-purple-400"
                />
                <button
                  onClick={hangup}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                >
                  <PhoneOff className="h-4 w-4" />
                  Encerrar ligação
                </button>
                {provider === "mock" && (
                  <p className="mt-2 text-center text-[10px] text-zinc-400">
                    Provedor simulado: o encerramento aqui gera o mesmo evento assinado que uma
                    operadora real geraria.
                  </p>
                )}
              </>
            )}

            {phase === "starting" && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-xs">Discando...</p>
              </div>
            )}

            {phase === "wrapup" && (
              <>
                <p className="mb-2 text-xs font-medium text-zinc-400 uppercase">Resultado</p>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {DISPOSITIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDisposition(d.value)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs font-medium transition-all",
                        disposition === d.value
                          ? `${d.tone} ring-2 ring-purple-300`
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300",
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Notas da ligação"
                  className="w-full resize-none rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-purple-400"
                />
                <button
                  onClick={finish}
                  disabled={saving}
                  className="mt-3 w-full rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar e fechar"}
                </button>
              </>
            )}

            {phase === "error" && (
              <button
                onClick={onClose}
                className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
