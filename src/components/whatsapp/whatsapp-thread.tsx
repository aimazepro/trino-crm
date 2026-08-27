"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Send, Paperclip, Mic, Check, CheckCheck, Clock, CircleAlert,
  LoaderCircle, FileText, Download, MessageCircle, MessageSquareText, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { VoiceRecorder } from "./voice-recorder";
import { useWhatsAppThread, type ThreadTarget, type ThreadMessage } from "@/hooks/use-whatsapp-thread";

/** Fills in for the sender/recipient when a template gets inserted into the
 *  composer. Whatever isn't known just drops out rather than blocking the send. */
export interface TemplateContext {
  contactName?: string;
  companyName?: string;
  dealName?: string;
  vendorName?: string;
}

interface WhatsAppThreadProps {
  target: ThreadTarget;
  /** False renders a "conectar" prompt instead of the composer. */
  connected: boolean;
  /** Shown when the conversation has no messages yet. */
  emptyHint?: string;
  className?: string;
  /** Who this thread is with, for the "Mensagens prontas" template picker. */
  templateContext?: TemplateContext;
}

/**
 * The paper behind the messages. WhatsApp's own doodle is copyrighted art, so
 * this is a faint dot lattice at the same weight — enough to keep the bubbles
 * from floating on a flat panel, quiet enough to read over.
 */
const CHAT_BACKDROP =
  "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0) 0 0 / 22px 22px";

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

/**
 * WhatsApp's inline formatting, rendered rather than printed.
 *
 * Messages carry `*bold*`, `_italic_` and `~strike~` — the signature prefix is
 * one — and the phone shows them styled. Printing the raw text here made the
 * markers leak into the bubble and read as a bug. Deliberately not a markdown
 * parser: only the three markers WhatsApp itself uses, no nesting, and never
 * dangerouslySetInnerHTML, since this is text a stranger sent us.
 */
const FORMAT_PATTERN = /([*_~])(\S(?:[^*_~]*\S)?)\1/g;

const FORMAT_TAG: Record<string, "strong" | "em" | "s"> = {
  "*": "strong",
  _: "em",
  "~": "s",
};

function renderFormatted(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(FORMAT_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));

    const Tag = FORMAT_TAG[match[1]];
    nodes.push(<Tag key={`${start}-${match[1]}`}>{match[2]}</Tag>);
    cursor = start + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function StatusIcon({ status }: { status: ThreadMessage["status"] }) {
  if (status === "pending") return <Clock className="h-3 w-3 opacity-70" aria-label="Enviando" />;
  if (status === "failed") return <CircleAlert className="h-3 w-3 text-red-500" aria-label="Falhou" />;
  // The blue double check is the one people actually read at a glance.
  if (status === "read") return <CheckCheck className="h-3 w-3 text-sky-500" aria-label="Lida" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 opacity-70" aria-label="Entregue" />;
  return <Check className="h-3 w-3 opacity-70" aria-label="Enviada" />;
}

interface BubbleProps {
  message: ThreadMessage;
  mediaUrl?: string;
  /** True when the previous message came from the same side, within the group. */
  grouped: boolean;
  /** True when the next message comes from the other side — the tail goes here. */
  tail: boolean;
  /** id → nome, para assinar quem no time mandou a mensagem. */
  teamNames: Record<string, string>;
}

function Bubble({ message, mediaUrl, grouped, tail, teamNames }: BubbleProps) {
  const mine = message.fromMe;
  const hasMedia = message.type !== "text" && message.type !== "unsupported";

  return (
    <div className={cn("flex px-1", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-2")}>
      <div
        className={cn(
          "relative max-w-[75%] rounded-xl px-2.5 py-1.5 text-[15px] leading-snug shadow-sm md:max-w-[65%]",
          mine
            ? "bg-[#d9fdd3] text-neutral-900 dark:bg-[#005c4b] dark:text-neutral-50"
            : "bg-white text-neutral-900 dark:bg-[#202c33] dark:text-neutral-50",
          // The tail is only drawn on the last bubble of a run, the way the app does it.
          tail && (mine ? "rounded-br-sm" : "rounded-bl-sm"),
          message.status === "failed" && "ring-1 ring-red-400",
        )}
      >
        {tail && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute bottom-0 h-3 w-3",
              mine
                ? "-right-1.5 [clip-path:polygon(0_0,100%_100%,0_100%)] bg-[#d9fdd3] dark:bg-[#005c4b]"
                : "-left-1.5 [clip-path:polygon(100%_0,100%_100%,0_100%)] bg-white dark:bg-[#202c33]",
            )}
          />
        )}

        {message.fromMe && (
          <span className="mb-0.5 block text-[10px] font-semibold text-green-800/70">
            {message.sentBy ? (teamNames[message.sentBy] ?? "Usuário removido") : "Automação"}
          </span>
        )}

        {message.type === "image" && mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt={message.mediaFilename ?? "Imagem"}
            className="mb-1 max-h-80 rounded-lg object-cover"
          />
        )}
        {message.type === "audio" && mediaUrl && (
          <audio controls src={mediaUrl} className="mb-1 h-10 w-64 max-w-full" />
        )}
        {message.type === "video" && mediaUrl && (
          <video controls src={mediaUrl} className="mb-1 max-h-80 rounded-lg" />
        )}
        {(message.type === "document" || message.type === "sticker") && mediaUrl && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-1 flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-2 underline-offset-2 hover:underline dark:bg-white/10"
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{message.mediaFilename ?? "Arquivo"}</span>
            <Download className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
          </a>
        )}
        {message.mediaPath && !mediaUrl && hasMedia && (
          <p className="mb-1 flex items-center gap-1.5 text-xs opacity-70">
            <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" /> Carregando anexo...
          </p>
        )}
        {message.type === "unsupported" && !message.body && (
          <p className="italic opacity-70">Mensagem não suportada</p>
        )}

        {/* The float lets the timestamp tuck into the last line, as in the app. */}
        {message.body && (
          <p className="whitespace-pre-wrap break-words">
            {renderFormatted(message.body)}
            <span className="float-right ml-2 h-0 select-none text-[11px] leading-[26px] opacity-0">
              {formatTime(message.timestamp)}
            </span>
          </p>
        )}

        <div className="-mt-0.5 flex items-center justify-end gap-1 text-[11px] opacity-70">
          <span className="tabular-nums">{formatTime(message.timestamp)}</span>
          {mine && <StatusIcon status={message.status} />}
        </div>

        {message.status === "failed" && (
          <p className="text-[11px] font-medium text-red-600 dark:text-red-400">Não enviada</p>
        )}
      </div>
    </div>
  );
}

type Template = { id: string; name: string; message: string };

/** Same four tags Configurações > Templates lets people insert (see VARS there). */
function fillTemplate(message: string, ctx?: TemplateContext): string {
  return message
    .replace(/\{\{nome_contato\}\}/g, ctx?.contactName || "")
    .replace(/\{\{nome_empresa\}\}/g, ctx?.companyName || "")
    .replace(/\{\{nome_negocio\}\}/g, ctx?.dealName || "")
    .replace(/\{\{nome_vendedor\}\}/g, ctx?.vendorName || "");
}

/**
 * "Mensagens prontas" — search and drop a saved template straight into the
 * composer, variables already filled in. Templates load lazily, once, the
 * first time the popover opens rather than on every thread mount.
 */
function TemplatePicker({ onPick }: { onPick: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || templates !== null) return;
    let cancelled = false;
    const supabase = createClient();
    void supabase
      .from("whatsapp_templates")
      .select("id, name, message")
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled) setTemplates(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [open, templates]);

  const q = query.trim().toLowerCase();
  const filtered = (templates ?? []).filter(
    (t) => !q || t.name.toLowerCase().includes(q) || t.message.toLowerCase().includes(q),
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Mensagens prontas"
        aria-label="Mensagens prontas"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted hover:text-foreground",
          open ? "bg-muted text-foreground" : "text-muted-foreground",
        )}
      >
        <MessageSquareText className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <div className="border-b border-border p-2">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar template..."
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {templates === null ? (
                <div className="flex items-center justify-center gap-1.5 py-6 text-xs text-muted-foreground">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Carregando...
                </div>
              ) : filtered.length === 0 && templates.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Nenhum template ainda.{" "}
                  <Link href="/configuracoes/whatsapp-templates" className="text-green-600 underline">
                    Criar um
                  </Link>
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum resultado</div>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { onPick(t.message); setOpen(false); setQuery(""); }}
                    className="w-full border-b border-border/60 px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted"
                  >
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.message}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The message list and composer, shared by /conversas and the deal WhatsApp
 * tab. Each screen supplies its own header, since one shows a conversation
 * picked from a list and the other a contact picked from a deal.
 */
export function WhatsAppThread({
  target, connected, emptyHint, className, templateContext,
}: WhatsAppThreadProps) {
  const { messages, loading, sending, error, mediaUrls, sendText, sendFile, clearError } =
    useWhatsAppThread(target);
  const { map: teamNames } = useTeam();

  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <CircleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 break-words">{error}</span>
          <button onClick={clearError} className="shrink-0 underline">fechar</button>
        </div>
      )}

      <div
        className="min-h-0 flex-1 overflow-y-auto bg-[#efeae2] px-4 py-4 text-neutral-400/25 dark:bg-[#0b141a] dark:text-neutral-500/20 md:px-8"
        style={{ backgroundImage: CHAT_BACKDROP }}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando mensagens...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/5 dark:bg-white/10">
              <MessageCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Nenhuma mensagem ainda
            </p>
            {emptyHint && <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>}
          </div>
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const showDay =
              !previous ||
              new Date(previous.timestamp).toDateString() !==
                new Date(message.timestamp).toDateString();

            return (
              <div key={message.id}>
                {showDay && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-600 shadow-sm dark:bg-[#182229] dark:text-neutral-300">
                      {formatDayLabel(message.timestamp)}
                    </span>
                  </div>
                )}
                <Bubble
                  message={message}
                  mediaUrl={message.mediaPath ? mediaUrls[message.mediaPath] : undefined}
                  grouped={!showDay && previous?.fromMe === message.fromMe}
                  tail={!next || next.fromMe !== message.fromMe}
                  teamNames={teamNames}
                />
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-border bg-background px-4 py-2.5">
        {!connected ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            WhatsApp desconectado.{" "}
            <Link href="/configuracoes/whatsapp" className="text-green-600 underline">
              Conectar para responder
            </Link>
          </p>
        ) : recording ? (
          <VoiceRecorder
            sending={sending}
            onSend={async (file) => { await sendFile(file); }}
            onClose={() => setRecording(false)}
          />
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
              aria-label="Anexar arquivo"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Paperclip className="h-5 w-5" aria-hidden="true" />
            </button>
            <TemplatePicker onPick={(message) => setInput(fillTemplate(message, templateContext))} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSendText(); }
              }}
              placeholder="Digite uma mensagem"
              className="h-11 flex-1 rounded-full border border-border bg-muted/40 px-4 text-[15px] outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-green-600/40"
            />
            {input.trim() ? (
              <button
                onClick={() => void handleSendText()}
                disabled={sending}
                title="Enviar"
                aria-label="Enviar mensagem"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {sending
                  ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : <Send className="h-4 w-4" aria-hidden="true" />}
              </button>
            ) : (
              <button
                onClick={() => setRecording(true)}
                disabled={sending}
                title="Gravar áudio"
                aria-label="Gravar áudio"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                <Mic className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
