"use client";

import { useState } from "react";
import { QrCode, Smartphone, AlertTriangle, MessageSquare } from "lucide-react";

export default function WhatsAppConfigPage() {
  const [state, setState] = useState<"disconnected" | "qrcode" | "connected">("disconnected");

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">WhatsApp</h1>
          <p className="text-sm font-medium text-zinc-400 mt-0.5">Ligue ao WhatsApp diretamente, sem limites, pelo número DM.</p>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-xl space-y-4">

          {/* Alert box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <p className="text-[13px] font-bold text-amber-800">Antes de conectar, leia com atenção</p>
            </div>
            <p className="text-[13px] font-medium text-amber-700">
              <span className="font-bold">Não conecte o WhatsApp pessoal.</span> Isso vai fazer você perder as mensagens e conversas existentes.
            </p>
            <p className="text-[13px] font-medium text-amber-700">
              <span className="font-bold">Não use mensagens em massa:</span> isso vai te desconectar, causará problemas e você terá que reconectar.
            </p>
            <p className="text-[13px] font-medium text-amber-700">
              <span className="font-bold">Não use com um bot ou qualquer terceiro</span> sem autorização da nossa plataforma.
            </p>
          </div>

          {/* Main card */}
          {state === "disconnected" && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                  <Smartphone size={18} className="text-zinc-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-zinc-700">WhatsApp não conectado</p>
                  <p className="text-[12px] font-medium text-zinc-400 mt-0.5">Conecte seu WhatsApp ou inicie uma conversa pelo CRM.</p>
                </div>
                <button
                  onClick={() => setState("qrcode")}
                  className="px-4 py-2 bg-green-500 text-white text-[13px] font-bold rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                >
                  Conectar WhatsApp
                </button>
              </div>
            </div>
          )}

          {state === "qrcode" && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <QrCode size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-zinc-900">Escaneie o QR Code</p>
                  <p className="text-[12px] font-medium text-zinc-400">Abra o WhatsApp e escaneie para conectar</p>
                </div>
              </div>
              <div className="p-8 flex flex-col items-center">
                <div className="p-4 bg-white border-2 border-dashed border-zinc-200 rounded-2xl mb-4">
                  <QrCode className="w-44 h-44 text-zinc-300" strokeWidth={1} />
                </div>
                <p className="text-[12px] font-medium text-zinc-400">QR Code válido por 60 segundos</p>
                <ul className="text-[13px] text-zinc-500 font-medium space-y-2 mt-5 w-full max-w-xs">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 text-xs font-bold">1</span>
                    Abra o WhatsApp no seu smartphone
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 text-xs font-bold">2</span>
                    Toque em Mais opções ou Configurações
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 text-xs font-bold">3</span>
                    Selecione Aparelhos Conectados e aponte a câmera
                  </li>
                </ul>
                <button onClick={() => setState("disconnected")} className="mt-6 text-[13px] font-bold text-zinc-400 hover:text-zinc-600">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {state === "connected" && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <Smartphone size={18} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-zinc-900">WhatsApp conectado</p>
                  <p className="text-[12px] font-medium text-zinc-400 mt-0.5">+55 (11) 9 9999-9999</p>
                </div>
                <button
                  onClick={() => setState("disconnected")}
                  className="px-4 py-2 border border-red-200 text-red-500 text-[13px] font-bold rounded-lg hover:bg-red-50 transition-colors"
                >
                  Desconectar
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp API Oficial card */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm px-5 py-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare size={16} className="text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold text-zinc-900">WhatsApp API Oficial (Meta)</p>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">Em breve</span>
              </div>
              <p className="text-[12px] font-medium text-zinc-400 mt-0.5">
                Integre via API oficial para envios em escala com maior estabilidade. Disponível para planos avançados.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
