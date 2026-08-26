"use client";

// Diálogo de ligação.
//
// Três passos: escolher o script, falar, classificar o resultado.
//
// Sobre o cronômetro: ele é informativo. Quem determina o que é cobrado é o CDR
// que a operadora manda no webhook. No provedor simulado o navegador faz o papel
// da operadora, então ali o tempo do cronômetro vira a duração do evento — e o
// status vem do que o vendedor classificou, não do relógio. Sem isso toda
// chamada virava "Atendida", inclusive as que ninguém atendeu.
//
// Microfone: o mudo desliga a trilha de áudio de verdade (`track.enabled`), a
// mesma que o MediaRecorder está gravando. Não é um ícone que muda de cor.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Delete,
  FileText,
  Grid3x3,
  Loader2,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/hooks/use-telephony";
import { fillScript, type ScriptContext } from "@/lib/telephony/script-vars";
import { ScriptList, useScripts, type CallScript } from "./script-picker";

type Phase = "script" | "starting" | "live" | "wrapup" | "error";

const DISPOSITIONS: { value: string; label: string; connected: boolean; tone: string }[] = [
  { value: "atendeu", label: "Atendeu", connected: true, tone: "border-green-300 bg-green-50 text-green-700" },
  { value: "nao_atendeu", label: "Não atendeu", connected: false, tone: "border-zinc-300 bg-zinc-50 text-zinc-700" },
  { value: "caixa_postal", label: "Caixa postal", connected: true, tone: "border-zinc-300 bg-zinc-50 text-zinc-700" },
  { value: "ocupado", label: "Ocupado", connected: false, tone: "border-amber-300 bg-amber-50 text-amber-700" },
  { value: "numero_errado", label: "Número errado", connected: true, tone: "border-amber-300 bg-amber-50 text-amber-700" },
  { value: "reagendar", label: "Reagendar", connected: true, tone: "border-blue-300 bg-blue-50 text-blue-700" },
  { value: "sem_interesse", label: "Sem interesse", connected: true, tone: "border-red-300 bg-red-50 text-red-700" },
];

const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

// Pares de frequência DTMF reais — o mesmo tom que um telefone gera.
const DTMF: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
  "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
  "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
};

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export interface CallDialogProps {
  toNumber: string;
  contactName?: string | null;
  companyName?: string | null;
  dealTitle?: string | null;
  sellerName?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  onClose: () => void;
  onFinished?: (result: { callId: string | null; disposition: string | null }) => void;
}

export function CallDialog({
  toNumber,
  contactName,
  companyName,
  dealTitle,
  sellerName,
  dealId,
  contactId,
  onClose,
  onFinished,
}: CallDialogProps) {
  const [phase, setPhase] = useState<Phase>("script");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [provider, setProvider] = useState("mock");
  const [consent, setConsent] = useState<{ mode: string; text: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [disposition, setDisposition] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [dialed, setDialed] = useState("");
  const [script, setScript] = useState<CallScript | null>(null);

  const { scripts, loading: loadingScripts } = useScripts();

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const audioCtxRef = useRef<AudioContext | null>(null);

  const ctx: ScriptContext = {
    nomeContato: contactName,
    nomeVendedor: sellerName,
    empresa: companyName,
    negocio: dealTitle,
    telefone: toNumber,
  };

  // ---- captura de áudio e transcrição --------------------------------------

  const startCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setWarning(
        "Sem acesso ao microfone: a ligação continua, mas sem gravação nem transcrição.",
      );
      return;
    }

    // Web Speech API: só o Chrome implementa. Sem ela a ligação funciona
    // igual, só não gera transcrição para a análise.
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    try {
      const rec = new Ctor();
      rec.lang = "pt-BR";
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const r = e.results[i];
          if (r.isFinal) transcriptRef.current += `${r[0].transcript.trim()} `;
        }
      };
      rec.onerror = () => {};
      rec.start();
      recognitionRef.current = rec;
    } catch {
      // Transcrição é opcional: falhar aqui não pode atrapalhar a ligação.
    }
  }, []);

  const stopCapture = useCallback(async (): Promise<Blob | null> => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    const recorder = recorderRef.current;
    let blob: Blob | null = null;

    if (recorder && recorder.state !== "inactive") {
      blob = await new Promise<Blob | null>((resolve) => {
        recorder.onstop = () => {
          resolve(chunksRef.current.length ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }) : null);
        };
        recorder.stop();
      });
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    return blob;
  }, []);

  const toggleMute = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) {
      setWarning("Microfone indisponível: não há o que silenciar.");
      return;
    }
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const playTone = useCallback((key: string) => {
    const pair = DTMF[key];
    if (!pair) return;
    try {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audio = audioCtxRef.current ?? new AudioCtor();
      audioCtxRef.current = audio;

      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.08, audio.currentTime);
      gain.connect(audio.destination);

      for (const freq of pair) {
        const osc = audio.createOscillator();
        osc.frequency.setValueAtTime(freq, audio.currentTime);
        osc.connect(gain);
        osc.start();
        osc.stop(audio.currentTime + 0.14);
      }
    } catch {
      // Sem áudio disponível: o dígito ainda entra no visor.
    }
  }, []);

  // ---- ciclo da chamada ----------------------------------------------------

  const placeCall = useCallback(async () => {
    setPhase("starting");
    setError(null);
    try {
      const res = await fetch("/api/telephony/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber,
          dealId: dealId ?? null,
          contactId: contactId ?? null,
          scriptId: script?.id ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao ligar");

      setCallId(data.callId);
      setProvider(data.provider ?? "mock");
      if (data.consentMode && data.consentMode !== "off") {
        setConsent({ mode: data.consentMode, text: data.consentText });
      }
      setPhase("live");
      if (data.recording) void startCapture();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setPhase("error");
    }
  }, [toNumber, dealId, contactId, script, startCapture]);

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Encerrar não finaliza ainda: a classificação do vendedor é que decide se a
  // chamada conectou, e portanto se ela é cobrada.
  const hangup = useCallback(() => {
    setPhase("wrapup");
  }, []);

  const finish = useCallback(async () => {
    if (!callId) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const blob = await stopCapture();
      const chosen = DISPOSITIONS.find((d) => d.value === disposition);

      if (provider === "mock") {
        await fetch("/api/telephony/mock/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callId,
            action: "hangup",
            durationSeconds: seconds,
            status: chosen ? (chosen.connected ? "completed" : "no_answer") : undefined,
          }),
        });
      }

      await fetch(`/api/telephony/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition: disposition ?? undefined,
          notes: notes || undefined,
          transcript: transcriptRef.current.trim() || undefined,
        }),
      });

      if (blob && blob.size > 0) {
        await fetch(`/api/telephony/calls/${callId}/recording`, {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        });
      }

      onFinished?.({ callId, disposition });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o resultado");
      setSaving(false);
    }
  }, [callId, disposition, notes, seconds, provider, stopCapture, onFinished, onClose]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const filledScript = script ? fillScript(script.content, ctx) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
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
            <span className="rounded-full bg-green-50 px-3 py-1 font-mono text-sm font-semibold tabular-nums text-green-700">
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
        {warning && phase === "live" && (
          <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-6 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-800">{warning}</p>
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

        {/* Passo 1: escolher script */}
        {phase === "script" && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-zinc-900">
                Escolha o script antes de discar
              </h3>
            </div>
            <ScriptList
              scripts={scripts}
              loading={loadingScripts}
              ctx={ctx}
              onPick={(s) => {
                setScript(s);
                void placeCall();
              }}
              emptyHint="Nenhum script cadastrado ainda. Você pode ligar sem roteiro e criar um depois em Configurações → Scripts de Ligação."
            />
            <button
              onClick={() => void placeCall()}
              className="mt-auto w-full rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Ligar sem script
            </button>
          </div>
        )}

        {phase === "starting" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Discando para {toNumber}...</p>
          </div>
        )}

        {/* Passo 2: em chamada */}
        {phase === "live" && (
          <div className="grid flex-1 overflow-hidden md:grid-cols-[1fr_320px]">
            <div className="flex flex-col overflow-y-auto border-r border-zinc-100 p-6">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-semibold text-zinc-900">Script da ligação</h3>
                {recording && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                    <Mic className="h-3 w-3" /> Gravando
                  </span>
                )}
              </div>

              {script ? (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-800">{script.name}</span>
                    <button
                      onClick={() => setScript(null)}
                      className="ml-auto flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
                    >
                      <ArrowLeft className="h-3 w-3" /> Trocar script
                    </button>
                  </div>
                  <div className="flex-1 whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700">
                    {filledScript}
                  </div>
                </>
              ) : (
                <ScriptList
                  scripts={scripts}
                  loading={loadingScripts}
                  ctx={ctx}
                  onPick={setScript}
                  emptyHint="Sem script cadastrado. A ligação segue normalmente."
                />
              )}
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto p-6">
              <p className="text-xs font-medium uppercase text-zinc-400">Notas</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="O que foi dito..."
                className="w-full resize-none rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-purple-400"
              />

              {showKeypad && (
                <div className="rounded-xl border border-zinc-200 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex-1 font-mono text-sm tabular-nums text-zinc-700">
                      {dialed || "—"}
                    </span>
                    <button
                      onClick={() => setDialed((d) => d.slice(0, -1))}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-100"
                      aria-label="Apagar dígito"
                    >
                      <Delete className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {KEYPAD.map((k) => (
                      <button
                        key={k}
                        onClick={() => {
                          playTone(k);
                          setDialed((d) => (d + k).slice(0, 24));
                        }}
                        className="rounded-lg border border-zinc-200 py-2 font-mono text-sm text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-auto flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  title={muted ? "Reativar microfone" : "Silenciar microfone"}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border transition-colors",
                    muted
                      ? "border-red-200 bg-red-50 text-red-600"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                  )}
                >
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setShowKeypad((v) => !v)}
                  title="Teclado"
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border transition-colors",
                    showKeypad
                      ? "border-purple-200 bg-purple-50 text-purple-600"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                  )}
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button
                  onClick={hangup}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-red-500 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                >
                  <PhoneOff className="h-4 w-4" />
                  Encerrar
                </button>
              </div>
              {muted && (
                <p className="text-center text-[10px] text-zinc-400">
                  Microfone desligado — a gravação segue, em silêncio.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Passo 3: resultado */}
        {phase === "wrapup" && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            <div>
              <p className="mb-1 text-sm font-semibold text-zinc-900">Como terminou?</p>
              <p className="text-xs text-zinc-400">
                É isso que define se a chamada conta como atendida — e, no modo por minuto, se ela é
                cobrada.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DISPOSITIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDisposition(d.value)}
                  className={cn(
                    "rounded-lg border px-2 py-2.5 text-xs font-medium transition-all",
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

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">
                Duração {formatDuration(seconds)}
                {transcriptRef.current.trim() ? " · transcrição capturada" : ""}
              </span>
              <button
                onClick={() => void finish()}
                disabled={saving}
                className="ml-auto rounded-xl bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar e fechar"}
              </button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="p-6">
            <button
              onClick={onClose}
              className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
