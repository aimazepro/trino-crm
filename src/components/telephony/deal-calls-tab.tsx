"use client";

// Aba "Ligações" do negócio: de onde o vendedor liga, mais o histórico do que já
// foi falado com aquele contato.
//
// Cada linha abre igual um email abre o corpo: clique e a gravação, a análise e a
// transcrição aparecem no lugar, sem tirar você da lista.

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarPlus,
  ChevronDown,
  FileText,
  Loader2,
  Phone,
  PhoneOff,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CallButton } from "./call-button";
import { ScriptModal } from "./script-picker";
import { CreateActivityDialog } from "./create-activity-dialog";
import { formatCents, formatDuration, useTelephony } from "@/hooks/use-telephony";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import type { CallAnalysis } from "@/lib/telephony/db";

interface CallRow {
  id: string;
  toNumber: string;
  status: string;
  startedAt: string;
  durationSeconds: number;
  billedCents: number;
  billingMode: string;
  hasRecording: boolean;
  disposition: string | null;
  notes: string | null;
  analysis: CallAnalysis | null;
  analyzedAt: string | null;
  hasTranscript: boolean;
  transcript: string | null;
}

const DISPOSITION_LABEL: Record<string, { label: string; tone: string }> = {
  atendeu: { label: "Atendeu", tone: "bg-green-50 text-green-700 border-green-200" },
  nao_atendeu: { label: "Não atendeu", tone: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  caixa_postal: { label: "Caixa postal", tone: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  ocupado: { label: "Ocupado", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  numero_errado: { label: "Número errado", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  reagendar: { label: "Reagendar", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  sem_interesse: { label: "Sem interesse", tone: "bg-red-50 text-red-700 border-red-200" },
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  completed: { label: "Atendida", tone: "bg-green-50 text-green-700 border-green-200" },
  no_answer: { label: "Não atendida", tone: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  busy: { label: "Ocupado", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  failed: { label: "Falhou", tone: "bg-red-50 text-red-700 border-red-200" },
  ringing: { label: "Chamando", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  answered: { label: "Em curso", tone: "bg-green-50 text-green-700 border-green-200" },
  queued: { label: "Discando", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  canceled: { label: "Cancelada", tone: "bg-zinc-50 text-zinc-600 border-zinc-200" },
};

/**
 * O rótulo da linha vem da classificação do vendedor quando ela existe. O status
 * do CDR só aparece quando ninguém classificou — antes disso a lista mostrava
 * "Atendida" para chamada que o próprio vendedor tinha marcado como não atendida.
 */
function outcomeOf(call: CallRow) {
  if (call.disposition && DISPOSITION_LABEL[call.disposition]) {
    return DISPOSITION_LABEL[call.disposition];
  }
  return STATUS_LABEL[call.status] ?? { label: call.status, tone: "bg-zinc-50 text-zinc-600 border-zinc-200" };
}

interface DealCallsTabProps {
  dealId: string;
  contactId?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
  companyName?: string | null;
  dealTitle?: string | null;
}

export function DealCallsTab({
  dealId,
  contactId,
  contactPhone,
  contactName,
  companyName,
  dealTitle,
}: DealCallsTabProps) {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<Record<string, string>>({});
  const [showScript, setShowScript] = useState(false);
  const [activityFor, setActivityFor] = useState<{ title: string } | null>(null);

  const { status } = useTelephony();
  const { selfName } = useOwnerNameMap();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/telephony/calls?dealId=${dealId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao carregar as ligações");
      setCalls(data.calls ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function analyze(callId: string) {
    setAnalyzing(callId);
    setAnalyzeError((e) => ({ ...e, [callId]: "" }));
    try {
      const res = await fetch(`/api/telephony/calls/${callId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao analisar");
      setCalls((cs) =>
        cs.map((c) =>
          c.id === callId ? { ...c, analysis: data.analysis, analyzedAt: data.analyzedAt } : c,
        ),
      );
      setExpanded(callId);
    } catch (err) {
      setAnalyzeError((e) => ({
        ...e,
        [callId]: err instanceof Error ? err.message : "Erro desconhecido",
      }));
    } finally {
      setAnalyzing(null);
    }
  }

  const scriptCtx = {
    nomeContato: contactName,
    nomeVendedor: selfName,
    empresa: companyName,
    negocio: dealTitle,
    telefone: contactPhone,
  };

  return (
    <div className="space-y-4">
      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2">
        <CallButton
          toNumber={contactPhone}
          contactName={contactName}
          companyName={companyName}
          dealTitle={dealTitle}
          sellerName={selfName}
          dealId={dealId}
          contactId={contactId}
          label={contactName ? `Ligar para ${contactName}` : "Ligar"}
          variant="ghost"
          className="border border-zinc-200"
          onFinished={(result) => {
            void load();
            // Reagendar sem compromisso marcado é promessa que se perde.
            if (result.disposition === "reagendar") {
              setActivityFor({ title: `Retornar ligação para ${contactName ?? "o contato"}` });
            }
          }}
        />

        <button
          onClick={() => setShowScript(true)}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          <FileText className="h-3.5 w-3.5 text-zinc-400" />
          Script
        </button>

        <button
          onClick={() => setActivityFor({ title: "Retornar ligação" })}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          <CalendarPlus className="h-3.5 w-3.5 text-zinc-400" />
          Nova atividade
        </button>
      </div>

      {status && status.status !== "active" && (
        <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Telefonia não ativada. Configurações → Telefone.
        </p>
      )}
      {status?.status === "active" && !status.myExtension && (
        <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Você ainda não tem ramal. Peça ao dono da conta para vincular.
        </p>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Histórico */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {loading ? (
          <div className="p-6 text-center text-xs text-zinc-400">Carregando...</div>
        ) : calls.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center px-4 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
              <PhoneOff className="h-6 w-6 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-700">Nenhuma ligação registrada</p>
            <p className="mt-1 text-xs text-zinc-500">
              Clique em &ldquo;Ligar&rdquo; acima para fazer sua primeira ligação
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {calls.map((c) => {
              const outcome = outcomeOf(c);
              const isOpen = expanded === c.id;
              const canAnalyze = c.hasTranscript || Boolean(c.notes?.trim());

              return (
                <div key={c.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="flex w-full flex-wrap items-center gap-2 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50/70"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50">
                      <Phone className="h-3.5 w-3.5 text-green-600" />
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        outcome.tone,
                      )}
                    >
                      {outcome.label}
                    </span>
                    <span className="text-sm text-zinc-700">{c.toNumber}</span>
                    {c.durationSeconds > 0 && (
                      <span className="font-mono text-xs tabular-nums text-zinc-500">
                        {formatDuration(c.durationSeconds)}
                      </span>
                    )}
                    {c.analysis && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                        <Sparkles className="h-2.5 w-2.5" /> Analisada
                      </span>
                    )}
                    <span className="ml-auto text-[11px] tabular-nums text-zinc-400">
                      {format(new Date(c.startedAt), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    {c.billingMode === "per_minute" && c.billedCents > 0 && (
                      <span className="text-[11px] font-medium tabular-nums text-zinc-500">
                        {formatCents(c.billedCents)}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-zinc-300 transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/50 px-5 py-4">
                      {c.hasRecording ? (
                        <audio
                          controls
                          preload="none"
                          src={`/api/telephony/calls/${c.id}/recording`}
                          className="h-9 w-full max-w-md"
                        />
                      ) : (
                        <p className="text-xs text-zinc-400">Sem gravação para esta ligação.</p>
                      )}

                      {c.notes && (
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                            Notas
                          </p>
                          <p className="text-sm text-zinc-700">{c.notes}</p>
                        </div>
                      )}

                      {analyzeError[c.id] && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                          {analyzeError[c.id]}
                        </p>
                      )}

                      {c.analysis ? (
                        <div className="space-y-3 rounded-xl border border-purple-100 bg-white p-4">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-700">
                              Análise da ligação
                            </span>
                            <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                              {c.analysis.sentimento} · nota {c.analysis.qualidade}/10
                            </span>
                          </div>

                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                              Resumo
                            </p>
                            <p className="text-sm leading-relaxed text-zinc-700">
                              {c.analysis.resumo}
                            </p>
                          </div>

                          {[
                            { title: "Pontos-chave", items: c.analysis.pontos_chave },
                            { title: "Objeções", items: c.analysis.objecoes },
                            { title: "Próximos passos", items: c.analysis.proximos_passos },
                          ]
                            .filter((s) => s.items?.length)
                            .map((s) => (
                              <div key={s.title}>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                                  {s.title}
                                </p>
                                <ul className="list-disc space-y-0.5 pl-4 text-sm text-zinc-700">
                                  {s.items.map((it, i) => (
                                    <li key={i}>{it}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}

                          {c.analysis.observacao_coach && (
                            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              <span className="font-semibold">Feedback: </span>
                              {c.analysis.observacao_coach}
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => void analyze(c.id)}
                          disabled={analyzing === c.id || !canAnalyze}
                          title={
                            canAnalyze
                              ? "Gerar análise da ligação"
                              : "Sem transcrição nem notas para analisar"
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {analyzing === c.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" /> Analisar
                            </>
                          )}
                        </button>
                      )}

                      {c.transcript && (
                        <details className="group">
                          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-600">
                            Transcrição
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                            {c.transcript}
                          </p>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showScript && <ScriptModal ctx={scriptCtx} onClose={() => setShowScript(false)} />}

      {activityFor && (
        <CreateActivityDialog
          dealId={dealId}
          defaultTitle={activityFor.title}
          defaultType="Ligação"
          onClose={() => setActivityFor(null)}
        />
      )}
    </div>
  );
}
