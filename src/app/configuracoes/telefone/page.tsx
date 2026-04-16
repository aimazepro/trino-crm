"use client";

import { useState } from "react";
import { Phone, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const CREDIT_PACKS = [
  { min: 50, price: 19 },
  { min: 100, price: 38 },
  { min: 250, price: 95 },
  { min: 500, price: 190 },
  { min: 1000, price: 380 },
];

type State = "disconnected" | "activating" | "active";

export default function TelefonePage() {
  const [state, setState] = useState<State>("disconnected");
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [balance] = useState(0);

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <Phone size={20} className="text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Telefone</h1>
            <p className="text-sm font-medium text-zinc-400 mt-0.5">Ligações diretas pelo CRM com um clique.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-xl space-y-4">

          {/* Status badge */}
          {state === "active" && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle size={16} className="text-green-500 shrink-0" />
              <span className="text-[13px] font-bold text-green-700">Telefone ativado</span>
            </div>
          )}

          {/* How it works */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Info size={15} className="text-blue-600 shrink-0" />
              <p className="text-[13px] font-bold text-blue-800">Como funciona:</p>
            </div>
            <ol className="space-y-1.5 pl-1">
              {[
                "Compre créditos de telefone abaixo",
                "Ative o telefone (isso leva uma vez)",
                "Abra qualquer negócio e clique em \"Ligar\"",
                "Custo: Descontado do saldo por minuto de ligação",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] font-medium text-blue-700">
                  <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Balance card */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-100">
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">SALDO DE TELEFONE</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-zinc-900">R$ {balance.toFixed(2).replace(".", ",")}</p>
                {state === "active" && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Telefone ativo</span>
                    <span className="text-[11px] font-medium text-zinc-400">Ramal 1070</span>
                  </div>
                )}
              </div>
            </div>

            {/* Credits grid */}
            <div className="px-6 py-4">
              <p className="text-[12px] font-bold text-zinc-500 mb-3">Comprar créditos</p>
              <div className="grid grid-cols-2 gap-2">
                {CREDIT_PACKS.map(pack => (
                  <button
                    key={pack.min}
                    onClick={() => setSelectedPack(pack.min)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 border rounded-xl text-left transition-all",
                      selectedPack === pack.min
                        ? "border-amber-400 bg-amber-50"
                        : "border-zinc-200 hover:border-zinc-300 bg-white"
                    )}
                  >
                    <span className="text-[13px] font-semibold text-zinc-700">{pack.min} min</span>
                    <span className="text-[14px] font-bold text-amber-600">R$ {pack.price}</span>
                  </button>
                ))}
              </div>

              <p className="text-[11px] font-medium text-zinc-400 mt-3 text-center">
                Cobrado na fatura mensal. Créditos descontados automaticamente por minuto de ligação.
              </p>
            </div>

            {/* Action button */}
            <div className="px-6 pb-5">
              {state === "disconnected" && (
                <p className="text-[12px] font-medium text-zinc-400 text-center mb-3">
                  Ative o telefone para continuar a ligar
                </p>
              )}
              {state !== "active" ? (
                <button
                  onClick={() => setState(state === "disconnected" ? "activating" : "active")}
                  className="w-full py-2.5 bg-violet-500 text-white text-[13px] font-bold rounded-lg hover:bg-violet-600 transition-colors shadow-sm"
                >
                  {state === "disconnected" ? "Ativar telefone" : "Confirmar ativação"}
                </button>
              ) : (
                <div className="flex items-center justify-between border border-zinc-200 rounded-xl px-4 py-3 bg-zinc-50">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-bold text-green-600">Telefone ativo</span>
                    <span className="text-zinc-300">·</span>
                    <span className="text-[12px] font-medium text-zinc-500">Ramal 1070</span>
                  </div>
                  <button
                    onClick={() => setState("disconnected")}
                    className="text-[12px] font-bold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Desativar
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
