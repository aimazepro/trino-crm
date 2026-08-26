"use client";

// Teste de microfone.
//
// Existe para responder, sem abrir log e sem depender de mim, a pergunta que
// aparece toda vez que uma gravação sai ruim: é a gravação ou é o computador?
// O teste grava com exatamente os mesmos parâmetros da ligação (mesmo contêiner,
// mesmo bitrate, mesmas restrições) e mostra o que mediu -- pico de sinal,
// bitrate real, codec escolhido pelo navegador. Se o teste sai limpo e a
// ligação sai chiada, o problema não é o microfone.

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mic, MicOff, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { permanentPermissionHint, useMicPermission } from "@/hooks/use-mic-permission";
import {
  createRecordingGraph,
  NARROWBAND_SAMPLE_RATE,
  RECORDING_BITS_PER_SECOND,
  RECORDING_CONSTRAINTS,
  recorderOptions,
} from "@/lib/telephony/recording";

const TEST_SECONDS = 6;

interface Result {
  url: string;
  mimeType: string;
  bytes: number;
  seconds: number;
  peak: number;
  /** Taxa do microfone. 16 kHz = fone Bluetooth em modo chamada. */
  inputSampleRate: number | null;
}

/** Bitrate abaixo disso é onde o AAC começa a inventar ruído no lugar de agudos. */
const POOR_BITRATE_KBPS = 48;
/** Pico abaixo disso é microfone mudo, longe demais ou entrada errada. */
const WEAK_PEAK = 0.02;

export function MicCheck() {
  const mic = useMicPermission();
  const [recording, setRecording] = useState(false);
  const [left, setLeft] = useState(TEST_SECONDS);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const run = useCallback(async () => {
    setError(null);
    setResult(null);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: RECORDING_CONSTRAINTS });
    } catch {
      setError(`Não consegui abrir o microfone. ${permanentPermissionHint()}`);
      return;
    }

    // Medidor de pico em paralelo à gravação: é ele que separa "gravou baixo"
    // de "não gravou nada", que na hora de ouvir soam parecidos.
    let peak = 0;
    let raf = 0;
    let ctx: AudioContext | null = null;
    try {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioCtor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let localPeak = 0;
        for (let i = 0; i < buf.length; i += 1) {
          const v = Math.abs(buf[i]);
          if (v > localPeak) localPeak = v;
        }
        if (localPeak > peak) peak = localPeak;
        setLevel(localPeak);
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Sem medidor o teste ainda vale: a gravação é o que importa.
    }

    // Mesmo caminho da ligação, incluindo a reamostragem que contorna o bug do
    // Safari: um teste que grava melhor que a chamada real não testa nada.
    const graph = await createRecordingGraph(stream);

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(graph.stream, recorderOptions());
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const startedAt = Date.now();
    setRecording(true);
    setLeft(TEST_SECONDS);

    const countdown = setInterval(() => {
      setLeft((v) => Math.max(0, v - 1));
    }, 1000);

    const finish = () => {
      const seconds = (Date.now() - startedAt) / 1000;
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setResult({
        url,
        mimeType: recorder.mimeType || blob.type || "desconhecido",
        bytes: blob.size,
        seconds,
        peak,
        inputSampleRate: graph.inputSampleRate,
      });
      setRecording(false);
      setLevel(0);
    };

    const stopAll = () => {
      clearInterval(countdown);
      if (raf) cancelAnimationFrame(raf);
      void graph.close();
      void ctx?.close().catch(() => {});
      stream.getTracks().forEach((t) => t.stop());
      cleanupRef.current = null;
    };

    recorder.onstop = () => {
      stopAll();
      finish();
    };

    recorder.start(500);
    const timer = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, TEST_SECONDS * 1000);

    cleanupRef.current = () => {
      clearTimeout(timer);
      if (recorder.state !== "inactive") recorder.stop();
      else stopAll();
    };
  }, []);

  const stop = useCallback(() => {
    cleanupRef.current?.();
  }, []);

  const kbps = result && result.seconds > 0 ? (result.bytes * 8) / result.seconds / 1000 : 0;
  const weakSignal = result ? result.peak < WEAK_PEAK : false;
  const poorBitrate = result ? kbps < POOR_BITRATE_KBPS : false;
  const narrowband = result
    ? (result.inputSampleRate ?? Infinity) < NARROWBAND_SAMPLE_RATE
    : false;
  const healthy = result ? !weakSignal && !poorBitrate && !narrowband : false;

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-1 flex items-center gap-2">
        <Mic className="h-4 w-4 text-purple-600" />
        <h3 className="text-sm font-semibold text-zinc-900">Microfone</h3>
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        Grava {TEST_SECONDS} segundos com os mesmos parâmetros de uma ligação de verdade. Se o teste
        sai limpo e a gravação da ligação não, o problema não está no seu computador.
      </p>

      {/* Permissão */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5">
        {mic.state === "granted" ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Permissão concedida{mic.temporary ? " só para esta visita" : ""}
          </span>
        ) : mic.state === "denied" ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-700">
            <MicOff className="h-3.5 w-3.5" /> Microfone bloqueado para este site
          </span>
        ) : mic.state === "unsupported" ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <AlertCircle className="h-3.5 w-3.5" /> Este navegador não grava áudio
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
            <Mic className="h-3.5 w-3.5 text-zinc-400" /> Permissão ainda não concedida
          </span>
        )}

        {mic.state !== "granted" && mic.state !== "unsupported" && (
          <button
            onClick={() => void mic.request()}
            disabled={mic.requesting}
            className="ml-auto rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-purple-700 ring-1 ring-zinc-200 transition-colors hover:bg-purple-50 disabled:opacity-50"
          >
            {mic.requesting ? "Pedindo..." : "Permitir microfone"}
          </button>
        )}
      </div>

      {/* Como deixar permanente. O navegador é quem decide isso, não o site --
          o máximo que dá para fazer é dizer onde fica a opção. */}
      {(mic.temporary || mic.state === "denied" || mic.state === "prompt") && (
        <p className="mb-4 rounded-xl bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-800">
          <span className="font-semibold">Para não ter que permitir toda vez:</span>{" "}
          {permanentPermissionHint()}
        </p>
      )}

      {/* Teste */}
      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <button
            onClick={stop}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            <Square className="h-3.5 w-3.5" /> Parar ({left}s)
          </button>
        ) : (
          <button
            onClick={() => void run()}
            disabled={mic.state === "unsupported"}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            <Mic className="h-3.5 w-3.5" /> Testar microfone
          </button>
        )}

        {recording && (
          <div className="flex min-w-[140px] flex-1 items-center gap-2">
            <span className="text-[11px] text-zinc-500">Sinal</span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-75",
                  level > 0.6 ? "bg-amber-500" : "bg-green-500",
                )}
                style={{ width: `${Math.min(100, level * 140)}%` }}
              />
            </div>
          </div>
        )}

        {recording && <Loader2 className="h-4 w-4 animate-spin text-zinc-300" />}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      {result && (
        <div className="mt-4 space-y-3 rounded-xl border border-zinc-200 p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => void audioRef.current?.play()}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              <Play className="h-3 w-3" /> Ouvir
            </button>
            <audio ref={audioRef} src={result.url} className="hidden" />
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold",
                healthy ? "text-green-700" : "text-amber-700",
              )}
            >
              {healthy ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Gravação saudável
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5" />
                  {weakSignal
                    ? "Sinal fraco demais"
                    : narrowband
                      ? "Microfone em banda estreita"
                      : "Bitrate baixo demais"}
                </>
              )}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4">
            {[
              ["Codec", result.mimeType.split(";")[0]],
              ["Bitrate", `${kbps.toFixed(0)} kb/s`],
              [
                "Microfone",
                result.inputSampleRate
                  ? `${(result.inputSampleRate / 1000).toFixed(1)} kHz`
                  : "—",
              ],
              ["Pico", `${(result.peak * 100).toFixed(0)}%`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-zinc-400">{k}</dt>
                <dd className="font-mono font-medium text-zinc-700">{v}</dd>
              </div>
            ))}
          </dl>

          {weakSignal && (
            <p className="text-[11px] leading-relaxed text-amber-800">
              O microfone quase não captou som. Verifique se a entrada certa está selecionada nas
              configurações de som do sistema e se não há mudo de hardware ligado.
            </p>
          )}
          {narrowband && (
            <p className="text-[11px] leading-relaxed text-amber-800">
              Seu microfone está entregando{" "}
              {((result.inputSampleRate ?? 0) / 1000).toFixed(1)} kHz — banda estreita. É o que o
              sistema faz quando o microfone é de um fone Bluetooth: ele entra em modo telefone e
              corta a qualidade na origem, antes de qualquer gravação. Trocar para o microfone
              interno do computador resolve.
            </p>
          )}
          {poorBitrate && !weakSignal && !narrowband && (
            <p className="text-[11px] leading-relaxed text-amber-800">
              O navegador gravou abaixo de {POOR_BITRATE_KBPS} kb/s mesmo com{" "}
              {(RECORDING_BITS_PER_SECOND / 1000).toFixed(0)} kb/s pedidos. Nesse bitrate o codec
              troca voz por ruído metálico. Se estiver no Safari, teste a mesma ligação no Chrome
              para comparar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
