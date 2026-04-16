"use client";

import { useState } from "react";
import { Mail, Info, Copy, CheckCircle } from "lucide-react";

export default function GmailPage() {
  const [connected, setConnected] = useState(false);

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <Mail size={20} className="text-red-500" />
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Gmail</h1>
            <p className="text-sm font-medium text-zinc-400 mt-0.5">Sincronize emails com o CRM automaticamente.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-xl space-y-4">

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Info size={15} className="text-blue-600 shrink-0" />
              <p className="text-[13px] font-bold text-blue-800">Como funciona:</p>
            </div>
            <ul className="space-y-2 pl-1">
              {[
                "Conectar endereço do email",
                "Emails enviados e recebidos serão sincronizados automaticamente com os negócios",
                "Todos as alterações no pipeline poderão enviar emails automaticamente",
                "Qualquer email recebido pode criar um novo contato no CRM",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] font-medium text-blue-700">
                  <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>

          {/* Connection card */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            {!connected ? (
              <div className="px-6 py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <Mail size={18} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-zinc-700">Email não conectado</p>
                  <p className="text-[12px] font-medium text-zinc-400 mt-0.5">Conecte sua conta Google para sincronizar emails.</p>
                </div>
                <button
                  onClick={() => setConnected(true)}
                  className="px-4 py-2 bg-amber-500 text-white text-[13px] font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
                >
                  Conectar Gmail
                </button>
              </div>
            ) : (
              <div className="px-6 py-5">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle size={18} className="text-green-500 shrink-0" />
                  <p className="text-[14px] font-bold text-green-700">Gmail conectado com sucesso!</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">CONTA</p>
                    <p className="text-[13px] font-semibold text-zinc-800">joao@empresa.com</p>
                  </div>
                  <button
                    onClick={() => setConnected(false)}
                    className="text-[13px] font-bold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Desconectar
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
