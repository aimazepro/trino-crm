"use client";

import { useState } from "react";
import { Calendar, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SyncType = "bidirecional" | "unidirecional";

export default function CalendarioPage() {
  const [connected, setConnected] = useState(false);
  const [syncType, setSyncType] = useState<SyncType>("bidirecional");

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <Calendar size={20} className="text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Calendário</h1>
            <p className="text-sm font-medium text-zinc-400 mt-0.5">Sincronize suas atividades com o Google Calendar.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-xl space-y-4">

          {connected && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle size={16} className="text-green-500 shrink-0" />
              <span className="text-[13px] font-bold text-green-700">Calendário conectado com sucesso!</span>
            </div>
          )}

          {!connected ? (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm py-16 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-5">
                <Calendar size={30} className="text-zinc-300" />
              </div>
              <p className="text-[15px] font-bold text-zinc-700 mb-1">Calendário não conectado</p>
              <p className="text-[13px] font-medium text-zinc-400 mb-6">
                Conecte o seu Google Calendar para sincronizar atividades.
              </p>
              <button
                onClick={() => setConnected(true)}
                className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
              >
                <Calendar size={15} /> Conectar Google Calendar
              </button>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <Calendar size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-zinc-900">Calendário conectado</p>
                  <p className="text-[12px] font-medium text-zinc-400 mt-0.5">joao@empresa.com</p>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* Calendar selector */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">Calendário para sincronizar</label>
                  <select className="w-full bg-white border border-zinc-200 text-[13px] font-medium rounded-lg px-4 py-2.5 outline-none focus:border-amber-500 transition-all">
                    <option>joao@empresa.com (Principal)</option>
                  </select>
                </div>

                {/* Sync type */}
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">Tipo de sincronização</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        key: "bidirecional" as SyncType,
                        label: "Bidirecional",
                        desc: "CRM ↔ Calendar. Atividades sincronizadas com seu calendário e vice-versa.",
                      },
                      {
                        key: "unidirecional" as SyncType,
                        label: "Unidirecional",
                        desc: "CRM → Calendar. Atividades do CRM sincronizadas com o seu calendário.",
                      },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setSyncType(opt.key)}
                        className={cn(
                          "text-left p-4 border rounded-xl transition-all",
                          syncType === opt.key
                            ? "border-amber-400 bg-amber-50"
                            : "border-zinc-200 hover:border-zinc-300 bg-white"
                        )}
                      >
                        <p className={cn("text-[13px] font-bold mb-1", syncType === opt.key ? "text-amber-700" : "text-zinc-800")}>
                          {opt.label}
                        </p>
                        <p className="text-[11px] font-medium text-zinc-400">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button className="w-full py-2.5 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm">
                  Iniciar sincronização
                </button>

                <button
                  onClick={() => setConnected(false)}
                  className="w-full py-2 text-[13px] font-bold text-red-500 hover:text-red-600 transition-colors"
                >
                  Desconectar
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
