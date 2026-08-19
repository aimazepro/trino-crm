"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Send, Trash2, Square, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** How many bars the live waveform keeps on screen. */
const BAR_COUNT = 44;
/** How often a new bar is sampled. Matches WhatsApp's own scroll speed closely. */
const SAMPLE_MS = 90;

/**
 * The formats worth asking MediaRecorder for, best first. Opus is what WhatsApp
 * voice notes are made of, so a browser that can produce it saves the server a
 * conversion — Safari cannot, and falls through to its own AAC, which the send
 * route re-encodes.
 */
const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString();
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

type Phase = "recording" | "paused" | "review";

interface VoiceRecorderProps {
  onSend: (file: File) => Promise<void> | void;
  onClose: () => void;
  sending?: boolean;
}

/** A single bar of the waveform. Kept dumb so the animation stays cheap. */
function Waveform({ levels, active }: { levels: number[]; active: boolean }) {
  return (
    <div className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }).map((_, index) => {
        // Right-aligned: the newest sample is always the rightmost bar.
        const level = levels[index - (BAR_COUNT - levels.length)] ?? 0;
        return (
          <div
            key={index}
            className={cn(
              "w-[3px] shrink-0 rounded-full transition-[height] duration-75",
              active ? "bg-green-600 dark:bg-green-500" : "bg-muted-foreground/40",
            )}
            style={{ height: `${Math.max(3, level * 32)}px` }}
          />
        );
      })}
    </div>
  );
}

/**
 * Records a voice note with the feedback WhatsApp gives: a live waveform that
 * proves the microphone is actually hearing something, a running timer, and the
 * ability to pause or throw the take away before anyone receives it.
 */
export function VoiceRecorder({ onSend, onClose, sending = false }: VoiceRecorderProps) {
  const [phase, setPhase] = useState<Phase>("recording");
  const [levels, setLevels] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef(0);
  const elapsedRef = useRef(0);

  /** Everything the browser gave us, handed back. Safe to call twice. */
  const teardown = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let sampler = 0;
    let ticker = 0;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const mimeType = pickMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.start(250);
        recorderRef.current = recorder;
        startedAtRef.current = Date.now();

        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        audioCtxRef.current = context;
        analyserRef.current = analyser;

        const buffer = new Uint8Array(analyser.frequencyBinCount);
        let peak = 0;

        // Read every frame but only commit a bar every SAMPLE_MS: sampling at
        // the frame rate would scroll far too fast to read.
        const readFrame = () => {
          const node = analyserRef.current;
          if (node) {
            node.getByteTimeDomainData(buffer);
            let max = 0;
            for (const value of buffer) max = Math.max(max, Math.abs(value - 128) / 128);
            peak = Math.max(peak, max);
          }
          frame = requestAnimationFrame(readFrame);
        };
        frame = requestAnimationFrame(readFrame);

        sampler = window.setInterval(() => {
          if (recorderRef.current?.state !== "recording") return;
          setLevels((current) => [...current, peak].slice(-BAR_COUNT));
          peak = 0;
        }, SAMPLE_MS);

        ticker = window.setInterval(() => {
          if (recorderRef.current?.state !== "recording") return;
          setSeconds((elapsedRef.current + (Date.now() - startedAtRef.current)) / 1000);
        }, 200);
      } catch {
        if (!cancelled) setError("Não foi possível acessar o microfone.");
      }
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearInterval(sampler);
      clearInterval(ticker);
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
      recorderRef.current = null;
      teardown();
    };
  }, [teardown]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function togglePause() {
    const recorder = recorderRef.current;
    if (!recorder) return;

    if (recorder.state === "recording") {
      recorder.pause();
      elapsedRef.current += Date.now() - startedAtRef.current;
      setPhase("paused");
    } else if (recorder.state === "paused") {
      recorder.resume();
      startedAtRef.current = Date.now();
      setPhase("recording");
    }
  }

  /** Stops the take and moves to review, where it can still be thrown away. */
  function finish() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    if (recorder.state === "recording") {
      elapsedRef.current += Date.now() - startedAtRef.current;
    }

    recorder.onstop = () => {
      const type = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      blobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
      setPhase("review");
      teardown();
    };
    recorder.stop();
    recorderRef.current = null;
  }

  async function send() {
    const blob = blobRef.current;
    if (!blob || blob.size === 0) return;
    const type = blob.type || "audio/webm";
    await onSend(new File([blob], `audio-${Date.now()}.${extensionFor(type)}`, { type }));
    onClose();
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
        <span className="flex-1">{error}</span>
        <button onClick={onClose} className="shrink-0 underline">fechar</button>
      </div>
    );
  }

  const reviewing = phase === "review";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClose}
        title="Descartar áudio"
        aria-label="Descartar áudio"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
      >
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex h-11 flex-1 items-center gap-3 rounded-full border border-border bg-muted/40 px-4">
        {reviewing ? (
          <button
            onClick={togglePlay}
            title={playing ? "Pausar" : "Ouvir"}
            aria-label={playing ? "Pausar" : "Ouvir"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-white transition-colors hover:bg-green-700"
          >
            {playing
              ? <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              : <Play className="ml-px h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        ) : (
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full bg-red-500",
              phase === "recording" && "animate-pulse",
            )}
            aria-hidden="true"
          />
        )}

        <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {formatDuration(seconds)}
        </span>

        <Waveform levels={levels} active={phase === "recording"} />

        {phase === "paused" && (
          <span className="shrink-0 text-xs text-muted-foreground">pausado</span>
        )}
      </div>

      {!reviewing && (
        <button
          onClick={togglePause}
          title={phase === "paused" ? "Continuar" : "Pausar"}
          aria-label={phase === "paused" ? "Continuar gravação" : "Pausar gravação"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {phase === "paused"
            ? <Mic className="h-5 w-5" aria-hidden="true" />
            : <Pause className="h-5 w-5" aria-hidden="true" />}
        </button>
      )}

      <button
        onClick={reviewing ? () => void send() : finish}
        disabled={sending}
        title={reviewing ? "Enviar áudio" : "Concluir gravação"}
        aria-label={reviewing ? "Enviar áudio" : "Concluir gravação"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white transition-colors hover:bg-green-700 disabled:opacity-50"
      >
        {sending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : reviewing ? (
          <Send className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        )}
      </button>

      {previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}
