"use client";

// Telefonia do workspace: ativação, saldo, ramais do time e política de gravação.
//
// Só o dono vincula e desvincula ramal — é ele quem paga a conta, então é ele
// quem decide quem gasta. O modo de cada pessoa (ilimitado ocupa vaga do plano,
// por minuto desconta do saldo) também é decisão dele.

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Link2,
  Loader2,
  Mic,
  Phone,
  PhoneCall,
  ShieldCheck,
  Unlink,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MicCheck } from "@/components/telephony/mic-check";
import {
  formatCents,
  useTelephony,
  type TelephonyTeamMember,
} from "@/hooks/use-telephony";
import { RequireFeature } from "@/components/auth/require-feature";

const CREDIT_PACKS = [2500, 5000, 10000, 25000];

interface LedgerEntry {
  id: string;
  kind: string;
  amountCents: number;
  balanceAfterCents: number;
  description: string | null;
  createdAt: string;
}

export default function TelefonePage() {
  const { status, loading, error: loadError, refresh } = useTelephony();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [linking, setLinking] = useState<TelephonyTeamMember | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [providerChoice, setProviderChoice] = useState("mock");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const isOwner = status?.isOwner ?? false;
  const active = status?.status === "active";

  const loadLedger = useCallback(async () => {
    if (!isOwner) return;
    try {
      const res = await fetch("/api/telephony/credits", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setLedger(data.entries ?? []);
    } catch {
      // Extrato é secundário: falhar aqui não pode derrubar a página.
    }
  }, [isOwner]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger, status?.balanceCents]);

  async function post(url: string, body: unknown, ok: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha na operação");
      setNotice(ok);
      await refresh();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function unlink(ext: { id: string; extension: string }) {
    if (!confirm(`Desvincular o ramal ${ext.extension}? A pessoa deixa de conseguir ligar.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/telephony/extensions/${ext.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao desvincular");
      setNotice(`Ramal ${ext.extension} desvinculado.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
      </div>
    );
  }

  const rateMobile = status?.rates?.mobile ?? 0;

  return (
    <RequireFeature feature="voip">
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Phone className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Telefone</h1>
          <p className="text-sm text-zinc-500">Faça ligações direto pelo CRM com um clique</p>
        </div>
      </div>

      {(error || loadError) && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error || loadError}</p>
        </div>
      )}

      {notice && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">{notice}</p>
        </div>
      )}

      {/* Ativação */}
      {!active && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="mb-1 text-sm font-semibold text-zinc-900">Ativar telefonia</h3>
          {!isOwner ? (
            <p className="text-sm text-zinc-500">
              A telefonia ainda não foi ativada neste workspace. Peça ao dono da conta.
            </p>
          ) : (
            <>
              <p className="mb-4 text-xs text-zinc-400">
                Escolha o provedor. O simulado deixa você testar todo o fluxo — ramal, ligação,
                gravação, cobrança e timeline — sem contrato com operadora nenhuma.
              </p>
              <div className="mb-3 space-y-2">
                {[
                  {
                    id: "mock",
                    title: "Simulado (teste)",
                    desc: "Fluxo completo, sem custo e sem operadora. Ideal para validar antes de assinar.",
                  },
                  {
                    id: "api4com",
                    title: "API4COM",
                    desc: "Exige o token da sua conta na API4COM.",
                  },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProviderChoice(p.id)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      providerChoice === p.id
                        ? "border-purple-300 bg-purple-50"
                        : "border-zinc-200 bg-white hover:bg-zinc-50",
                    )}
                  >
                    <span className="text-sm font-semibold text-zinc-800">{p.title}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">{p.desc}</span>
                  </button>
                ))}
              </div>

              {providerChoice === "api4com" && (
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Token da API4COM"
                  className="mb-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                />
              )}

              <button
                disabled={busy || (providerChoice === "api4com" && !apiToken)}
                onClick={() =>
                  post(
                    "/api/telephony/account",
                    { action: "activate", provider: providerChoice, apiToken: apiToken || undefined },
                    "Telefonia ativada.",
                  )
                }
                className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40"
              >
                {busy ? "Ativando..." : "Ativar telefonia"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Saldo */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-zinc-400">Saldo de telefonia</p>
            <p className="mt-1 text-3xl font-bold text-zinc-900">
              {formatCents(status?.balanceCents ?? 0)}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {status?.reservedCents
                ? `${formatCents(status.reservedCents)} reservado em chamadas em curso · `
                : ""}
              Celular {formatCents(rateMobile)}/min
            </p>
          </div>
          <div className="text-right">
            {status?.myExtension ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <span className="text-sm font-medium text-green-600">
                    Ramal {status.myExtension.extension}
                  </span>
                  <p className="text-[10px] text-zinc-400">Seu ramal, ativo</p>
                </div>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium text-zinc-500">Sem ramal</span>
                <p className="text-[10px] text-zinc-400">Vincule abaixo, no painel do time</p>
              </>
            )}
          </div>
        </div>

        {isOwner && active && (
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <p className="mb-2 text-xs font-semibold text-zinc-500">Adicionar crédito</p>
            <div className="grid grid-cols-4 gap-2">
              {CREDIT_PACKS.map((cents) => (
                <button
                  key={cents}
                  disabled={busy}
                  onClick={() =>
                    post(
                      "/api/telephony/credits",
                      { amountCents: cents, description: "Crédito adicionado pelo dono" },
                      `${formatCents(cents)} em crédito adicionado.`,
                    )
                  }
                  className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-purple-300 hover:bg-purple-50 disabled:opacity-40"
                >
                  {formatCents(cents)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              Lançamento manual enquanto o checkout não existe. O registro fica no extrato com o
              autor. Quando o pagamento entrar, ele usa exatamente o mesmo lançamento.
            </p>
          </div>
        )}
      </div>

      {/* Ramais do time */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-semibold text-zinc-900">Ramais do time</h3>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
            <PhoneCall className="h-3 w-3" />
            Saldo por minuto · {formatCents(status?.balanceCents ?? 0)}
          </span>
        </div>
        <p className="mb-4 text-xs text-zinc-400">
          Só o dono vincula e desvincula. Ao vincular, você escolhe o modo de cada pessoa:{" "}
          <span className="font-medium text-zinc-500">Ilimitado</span> (liga à vontade, ocupa 1 vaga
          do plano) ou <span className="font-medium text-zinc-500">Por minuto</span> (desconta{" "}
          {formatCents(rateMobile)}/min do saldo).
        </p>

        <div className="divide-y divide-zinc-100">
          {(status?.team ?? []).map((m) => (
            <div key={m.userId} className="py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{m.name}</p>
                  <p className="truncate text-xs text-zinc-400">{m.role}</p>
                </div>

                {m.extension ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                      {m.extension.mode === "unlimited" ? (
                        <>
                          <Zap className="h-3 w-3" /> Ilimitado
                        </>
                      ) : (
                        <>
                          <PhoneCall className="h-3 w-3" /> Por minuto
                        </>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                      <Phone className="h-3 w-3" /> Ramal {m.extension.extension}
                    </span>
                    {isOwner && (
                      <button
                        disabled={busy}
                        onClick={() => unlink(m.extension!)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                        Desvincular
                      </button>
                    )}
                  </>
                ) : isOwner ? (
                  <button
                    disabled={busy || !active}
                    title={active ? undefined : "Ative a telefonia primeiro"}
                    onClick={() => setLinking(m)}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-40"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Vincular ramal
                  </button>
                ) : (
                  <span className="text-xs text-zinc-400">Sem ramal</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Microfone do vendedor. Antes do card de LGPD porque é o primeiro
          obstáculo real: sem permissão não há gravação, e sem gravação não há
          transcrição nem análise. */}
      {active && <MicCheck />}

      {/* Gravação e LGPD */}
      {isOwner && active && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-semibold text-zinc-900">Gravação e LGPD</h3>
          </div>

          <label className="mb-3 flex items-center gap-3">
            <input
              type="checkbox"
              checked={status?.recordingEnabled ?? false}
              disabled={busy}
              onChange={(e) =>
                post(
                  "/api/telephony/account",
                  { action: "settings", recordingEnabled: e.target.checked },
                  e.target.checked ? "Gravação ligada." : "Gravação desligada.",
                )
              }
              className="h-4 w-4 rounded border-zinc-300 text-purple-600"
            />
            <span className="flex items-center gap-1.5 text-sm text-zinc-700">
              <Mic className="h-3.5 w-3.5 text-zinc-400" />
              Gravar as ligações
            </span>
          </label>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Retenção da gravação (dias)
            </label>
            <input
              type="number"
              min={1}
              max={3650}
              defaultValue={status?.recordingRetentionDays ?? 180}
              disabled={busy}
              onBlur={(e) => {
                const days = Number(e.target.value);
                if (days !== status?.recordingRetentionDays) {
                  void post(
                    "/api/telephony/account",
                    { action: "settings", recordingRetentionDays: days },
                    `Retenção ajustada para ${days} dias.`,
                  );
                }
              }}
              className="w-32 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              Passado o prazo, o áudio é apagado automaticamente pela rotina diária. Guardar
              gravação além do necessário é exposição sem contrapartida.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Aviso de consentimento
            </label>
            <select
              value={status?.consentMode ?? "announce"}
              disabled={busy}
              onChange={(e) =>
                post(
                  "/api/telephony/account",
                  { action: "settings", consentMode: e.target.value },
                  "Consentimento atualizado.",
                )
              }
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
            >
              <option value="announce">Aviso automático no início da chamada</option>
              <option value="manual">O vendedor avisa (texto aparece na tela)</option>
              <option value="off">Sem aviso</option>
            </select>
          </div>
        </div>
      )}

      {/* Extrato */}
      {isOwner && ledger.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">Extrato</h3>
          <div className="divide-y divide-zinc-100">
            {ledger.slice(0, 15).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-700">{e.description ?? e.kind}</p>
                  <p className="text-[11px] text-zinc-400">
                    {new Date(e.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      e.amountCents >= 0 ? "text-green-600" : "text-zinc-700",
                    )}
                  >
                    {e.amountCents >= 0 ? "+" : "−"}
                    {formatCents(Math.abs(e.amountCents))}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    saldo {formatCents(e.balanceAfterCents)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de vínculo */}
      {linking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-semibold text-zinc-900">
              Vincular ramal a {linking.name}
            </h3>
            <p className="mb-4 text-sm text-zinc-500">Como essa pessoa vai ligar?</p>

            <div className="space-y-2">
              <button
                disabled={busy || !status?.paidPlan}
                onClick={async () => {
                  const done = await post(
                    "/api/telephony/extensions",
                    { userId: linking.userId, mode: "unlimited" },
                    `Ramal vinculado a ${linking.name}.`,
                  );
                  if (done) setLinking(null);
                }}
                className="w-full rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-left transition-colors hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-purple-50"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-purple-700">
                  <Zap className="h-4 w-4" /> Ilimitado — liga à vontade
                </span>
                <span className="mt-0.5 block text-xs text-purple-600/80">
                  {status?.paidPlan
                    ? "Ocupa 1 vaga do plano."
                    : "Disponível no plano pago. Assine o CRM pra liberar."}
                </span>
              </button>

              <button
                disabled={busy}
                onClick={async () => {
                  const done = await post(
                    "/api/telephony/extensions",
                    { userId: linking.userId, mode: "per_minute" },
                    `Ramal vinculado a ${linking.name}.`,
                  );
                  if (done) setLinking(null);
                }}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
                  <PhoneCall className="h-4 w-4" /> Por minuto — desconta do saldo
                </span>
                <span className="mt-0.5 block text-xs text-zinc-400">
                  {formatCents(rateMobile)}/min. Saldo atual: {formatCents(status?.balanceCents ?? 0)}.
                </span>
              </button>

              <button
                onClick={() => setLinking(null)}
                className="w-full rounded-xl px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </RequireFeature>
  );
}
