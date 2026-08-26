"use client";

// Player da gravação.
//
// O <audio controls> nativo não permite pôr a barra de progresso e o botão de
// analisar na mesma linha, e cada navegador desenha o dele de um jeito. Este é
// controlado, então a linha fica igual em todo lugar.

import { useCallback, useEffect, useRef, useState } from "react";
import { MoreVertical, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SPEEDS = [1, 1.5, 2];

export function CallAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onEnd = () => setPlaying(false);
    const onErr = () => setError(true);

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onErr);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onErr);
    };
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().then(() => setPlaying(true)).catch(() => setError(true));
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    el.currentTime = ratio * duration;
    setCurrent(el.currentTime);
  }, [duration]);

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  if (error) {
    return (
      <p className="text-xs text-zinc-400">
        Não foi possível carregar a gravação desta ligação.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-white px-3 py-2">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        onClick={toggle}
        aria-label={playing ? "Pausar" : "Tocar"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-500">
        {clock(current)} / {clock(duration)}
      </span>

      <div
        onClick={seek}
        role="slider"
        tabIndex={0}
        aria-label="Posição da gravação"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        onKeyDown={(e) => {
          const el = audioRef.current;
          if (!el) return;
          if (e.key === "ArrowRight") el.currentTime = Math.min(el.currentTime + 5, duration);
          if (e.key === "ArrowLeft") el.currentTime = Math.max(el.currentTime - 5, 0);
        }}
        className="group h-4 min-w-0 flex-1 cursor-pointer py-1.5"
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full bg-zinc-800 transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <button
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          el.muted = !el.muted;
          setMuted(el.muted);
        }}
        aria-label={muted ? "Reativar som" : "Silenciar"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <div className="relative shrink-0">
        <button
          onClick={() => setMenu((v) => !v)}
          aria-label="Mais opções"
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Velocidade
              </p>
              {SPEEDS.map((sp) => (
                <button
                  key={sp}
                  onClick={() => {
                    const el = audioRef.current;
                    if (el) el.playbackRate = sp;
                    setSpeed(sp);
                    setMenu(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-zinc-50",
                    speed === sp ? "font-semibold text-purple-700" : "text-zinc-600",
                  )}
                >
                  {sp}×{speed === sp && <span>✓</span>}
                </button>
              ))}
              <a
                href={src}
                download
                onClick={() => setMenu(false)}
                className="mt-1 block border-t border-zinc-100 px-3 py-2 text-xs text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Baixar áudio
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
