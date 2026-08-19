"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Send, Paperclip, Mic, Trash2, Check, CheckCheck, Clock, CircleAlert,
  LoaderCircle, FileText, Download, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppThread, type ThreadTarget, type ThreadMessage } from "@/hooks/use-whatsapp-thread";

interface WhatsAppThreadProps {
  target: ThreadTarget;
  /** False renders a "conectar" prompt instead of the composer. */
  connected: boolean;
  /** Shown when the conversation has no messages yet. */
  emptyHint?: string;
  className?: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "HOJE";
  if (sameDay(date, yesterday)) return "ONTEM";
  return date
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    .toUpperCase();
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function StatusIcon({ status }: { status: ThreadMessage["status"] }) {
  if (status === "pending") return <Clock className="h-3 w-3" aria-label="Enviando" />;
  if (status === "failed") return <CircleAlert className="h-3 w-3" aria-label="Falhou" />;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-sky-200" aria-label="Lida" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3" aria-label="Entregue" />;
  return <Check className="h-3 w-3" aria-label="Enviada" />;
}

function Bubble({ message, mediaUrl }: { message: ThreadMessage; mediaUrl?: string }) {
  const mine = message.fromMe;
  return (
    <div className={cn("flex mb-1.5", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-3.5 py-2 text-sm",
          mine ? "rounded-br-sm bg-green-500 text-white" : "rounded-bl-sm bg-card border border-border",
          message.status === "failed" && "ring-1 ring-red-400",
        )}
      >
        {message.type === "image" && mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl} alt={message.mediaFilename ?? "Imagem"} className="rounded-lg max-h-72 mb-1" />
        )}
        {message.type === "audio" && mediaUrl && (
          <audio controls src={mediaUrl} className="max-w-full mb-1" />
        )}
        {message.type === "video" && mediaUrl && (
          <video controls src={mediaUrl} className="rounded-lg max-h-72 mb-1" />
        )}
        {(message.type === "document" || message.type === "sticker") && mediaUrl && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className={cn("flex items-center gap-2 underline mb-1", mine ? "text-green-50" : "text-foreground")}
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{message.mediaFilename ?? "Arquivo"}</span>
            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </a>
        )}
        {message.mediaPath && !mediaUrl && (
          <p className={cn("text-xs mb-1", mine ? "text-green-50/80" : "text-muted-foreground")}>
            Carregando anexo...
          </p>
        )}
        {message.type === "unsupported" && !message.body && (
          <p className="italic opacity-80">Mensagem não suportada</p>
        )}
        {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}

        <div
          className={cn(
            "flex items-center justify-end gap-1 mt-1 text-[10px]",
            mine ? "text-green-50/80" : "text-muted-foreground",
          )}
        >
          {formatTime(message.timestamp)}
          {mine && <StatusIcon status={message.status} />}
        </div>
        {message.status === "failed" && <p className="text-[10px] mt-0.5 text-red-100">Não enviada</p>}
      </div>
    </div>
  );
}

/**
 * The message list and composer, shared by /conversas and the deal WhatsApp
 * tab. Each screen supplies its own header, since one shows a conversation
 * picked from a list and the other a contact picked from a deal.
 */
export function WhatsAppThread({ target, connected, emptyHint, className }: WhatsAppThreadProps) {
  const { messages, loading, sending, error, mediaUrls, sendText, sendFile, clearError } =
    useWhatsAppThread(target);

  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendText() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const ok = await sendText(text);
    // Nothing left, so give the text back rather than losing what was typed.
    if (!ok) setInput(text);
  }

  async function handleFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await sendFile(file);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => stream.getTracks().forEach((t) => t.stop());
      recorder.start();
      recorderRef.current = recorder;
      setRecordSeconds(0);
      setRecording(true);
    } catch {
      alert("Não foi possível acessar o microfone.");
    }
  }

  function stopRecording(shouldSend: boolean) {
    const recorder = recorderRef.current;
    if (!recorder) { setRecording(false); return; }

    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      if (!shouldSend || chunksRef.current.length === 0) return;
      const type = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      await sendFile(new File([blob], `audio-${Date.now()}.webm`, { type }));
    };
    recorder.stop();
    recorderRef.current = null;
    setRecording(false);
    setRecordSeconds(0);
  }

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <CircleAlert className="h-4 w-4 shrink-0 mt-px" aria-hidden="true" />
          <span className="flex-1 break-words">{error}</span>
          <button onClick={clearError} className="shrink-0 underline">fechar</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 bg-muted/20 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando mensagens...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
            {emptyHint && <p className="text-xs text-muted-foreground mt-1">{emptyHint}</p>}
          </div>
        ) : (
          messages.map((m, index) => {
            const previous = messages[index - 1];
            const showDay =
              !previous ||
              new Date(previous.timestamp).toDateString() !== new Date(m.timestamp).toDateString();

            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex justify-center my-4">
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-3 py-1">
                      {formatDayLabel(m.timestamp)}
                    </span>
                  </div>
                )}
                <Bubble message={m} mediaUrl={m.mediaPath ? mediaUrls[m.mediaPath] : undefined} />
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0 bg-background">
        {!connected ? (
          <p className="text-center text-xs text-muted-foreground py-2">
            WhatsApp desconectado.{" "}
            <Link href="/configuracoes/whatsapp" className="text-green-600 underline">
              Conectar para responder
            </Link>
          </p>
        ) : recording ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => stopRecording(false)}
              title="Cancelar"
              className="h-10 w-10 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center transition-colors shrink-0"
            >
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex-1 flex items-center gap-3 h-10 rounded-lg bg-background border border-red-200 dark:border-red-900 px-4">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
              <span className="text-sm font-mono text-red-600 dark:text-red-400 shrink-0">
                {formatDuration(recordSeconds)}
              </span>
              <span className="text-xs text-muted-foreground">Gravando áudio...</span>
            </div>
            <button
              onClick={() => stopRecording(true)}
              title="Enviar áudio"
              className="h-10 w-10 rounded-lg bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors shrink-0"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFilePicked}
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title="Anexar arquivo"
              className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSendText(); }
              }}
              placeholder="Digite uma mensagem..."
              className="flex-1 h-9 px-3 rounded-full border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {input.trim() ? (
              <button
                onClick={() => void handleSendText()}
                disabled={sending}
                className="shrink-0 rounded-full bg-green-600 hover:bg-green-700 text-white p-2 transition-colors disabled:opacity-50"
              >
                {sending
                  ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : <Send className="h-4 w-4" aria-hidden="true" />}
              </button>
            ) : (
              <button
                onClick={() => void startRecording()}
                disabled={sending}
                title="Gravar áudio"
                className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
