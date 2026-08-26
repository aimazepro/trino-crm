"use client";

// Aba "Ligações" do negócio: o card de onde o vendedor liga e o histórico do
// que já foi falado com aquele contato.

import { useCallback, useEffect, useState } from "react";
import { Phone, PhoneOff, PlayCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CallButton } from "./call-button";
import { formatCents, formatDuration, useTelephony } from "@/hooks/use-telephony";

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
}

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

const DISPOSITION_LABEL: Record<string, string> = {
  atendeu: "Atendeu",
  nao_atendeu: "Não atendeu",
  caixa_postal: "Caixa postal",
  numero_errado: "Número errado",
  reagendar: "Reagendar",
  sem_interesse: "Sem interesse",
  ocupado: "Ocupado",
};

interface DealCallsTabProps {
  dealId: string;
  contactId?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
}

export function DealCallsTab({ dealId, contactId, contactPhone, contactName }: DealCallsTabProps) {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { status } = useTelephony();

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

  return (
    <div className="space-y-4">
      {/* Card de ligação */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
            <Phone className="h-5 w-5 text-purple-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900">
              {contactPhone ? `Ligar para ${contactName ?? "o contato"}` : "Sem telefone no contato"}
            </p>
            <p className="truncate text-xs text-zinc-500">
              {contactPhone
                ? `${contactPhone}${
                    status?.myExtension ? ` · seu ramal ${status.myExtension.extension}` : ""
                  }`
                : "Cadastre um telefone no contato para ligar daqui"}
            </p>
          </div>
          <CallButton
            toNumber={contactPhone}
            contactName={contactName}
            dealId={dealId}
            contactId={contactId}
            onFinished={load}
          />
        </div>

        {status && status.status !== "active" && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Telefonia não ativada. Configurações → Telefone.
          </p>
        )}
        {status?.status === "active" && !status.myExtension && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Você ainda não tem ramal. Peça ao dono da conta para vincular.
          </p>
        )}
      </div>

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
            <p className="mt-1 text-xs text-zinc-500">As ligações feitas daqui aparecem nesta lista</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {calls.map((c) => {
              const s = STATUS_LABEL[c.status] ?? {
                label: c.status,
                tone: "bg-zinc-50 text-zinc-600 border-zinc-200",
              };
              return (
                <div key={c.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        s.tone,
                      )}
                    >
                      {s.label}
                    </span>
                    <span className="text-sm text-zinc-700">{c.toNumber}</span>
                    {c.durationSeconds > 0 && (
                      <span className="font-mono text-xs text-zinc-500">
                        {formatDuration(c.durationSeconds)}
                      </span>
                    )}
                    {c.disposition && (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                        {DISPOSITION_LABEL[c.disposition] ?? c.disposition}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-zinc-400">
                      {format(new Date(c.startedAt), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    {c.billingMode === "per_minute" && c.billedCents > 0 && (
                      <span className="text-[11px] font-medium text-zinc-500">
                        {formatCents(c.billedCents)}
                      </span>
                    )}
                  </div>

                  {c.notes && <p className="mt-1.5 text-xs text-zinc-600">{c.notes}</p>}

                  {c.hasRecording && (
                    <div className="mt-2 flex items-center gap-2">
                      <PlayCircle className="h-3.5 w-3.5 text-zinc-400" />
                      <audio
                        controls
                        preload="none"
                        src={`/api/telephony/calls/${c.id}/recording`}
                        className="h-8 max-w-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
