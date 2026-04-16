"use client";

import { QrCode, Smartphone, LogOut } from "lucide-react";

export default function WhatsAppConfigPage() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">WhatsApp Externo</h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">Conecte seu aparelho para sincronizar mensagens</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-xl mx-auto mt-10">
          
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Aparelho Desconectado</h2>
                  <p className="text-sm font-medium text-zinc-400 mt-1">Escaneie o QR Code para conectar</p>
                </div>
              </div>
            </div>

            <div className="p-8 flex flex-col items-center justify-center">
              <div className="p-4 bg-white border-2 border-dashed border-zinc-200 rounded-2xl mb-6">
                <QrCode className="w-48 h-48 text-zinc-300" strokeWidth={1} />
              </div>
              
              <ul className="text-sm text-zinc-500 font-medium space-y-3 mb-8 w-full max-w-sm px-4">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0 text-xs font-bold font-mono">1</span>
                  Abra o WhatsApp no seu smartphone
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0 text-xs font-bold font-mono">2</span>
                  Toque em Mais opções ou Configurações
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0 text-xs font-bold font-mono">3</span>
                  Selecione Aparelhos Conectados e aponte a câmera
                </li>
              </ul>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
