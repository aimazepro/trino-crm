"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Arquivo", "Mapeamento", "Preview", "Resultado"];

export default function ImportacaoPage() {
  const [activeTab, setActiveTab] = useState<"nova" | "historico">("nova");
  const [currentStep] = useState(1);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Importar dados</h1>
          <p className="text-sm font-medium text-zinc-400 mt-0.5">Importe empresas, contatos e negócios a partir de arquivos CSV.</p>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-3xl space-y-6">

          {/* Tabs */}
          <div className="flex border-b border-zinc-200 bg-white rounded-t-xl px-4 pt-1">
            {[
              { key: "nova", label: "Nova importacao" },
              { key: "historico", label: "Historico de importacao" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as "nova" | "historico")}
                className={cn(
                  "px-4 py-3 text-[13px] font-bold border-b-2 transition-colors",
                  activeTab === tab.key
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-zinc-400 hover:text-zinc-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "nova" && (
            <div className="space-y-5 -mt-4">
              {/* Step progress */}
              <div className="bg-white border border-zinc-200 rounded-b-xl rounded-tr-xl px-6 py-5 shadow-sm">
                <div className="flex items-center gap-0">
                  {STEPS.map((step, i) => (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold",
                          i + 1 === currentStep
                            ? "bg-amber-500 text-white"
                            : i + 1 < currentStep
                              ? "bg-green-500 text-white"
                              : "bg-zinc-100 text-zinc-400"
                        )}>
                          {i + 1}
                        </div>
                        <span className={cn(
                          "text-[12px] font-semibold",
                          i + 1 === currentStep ? "text-amber-600" : "text-zinc-400"
                        )}>
                          {step}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className="flex-1 h-px bg-zinc-200 mx-3" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tutorial accordion */}
              <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setTutorialOpen(!tutorialOpen)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 transition-colors"
                >
                  {tutorialOpen ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
                  <span className="text-[13px] font-semibold text-zinc-700">Como importar dados no DMhub (vídeo tutorial)</span>
                </button>
                {tutorialOpen && (
                  <div className="px-5 pb-4 text-[13px] font-medium text-zinc-500 border-t border-zinc-100 pt-3">
                    Assista ao tutorial em vídeo para entender como preparar seu arquivo CSV e realizar a importação corretamente.
                  </div>
                )}
              </div>

              {/* Two columns */}
              <div className="grid grid-cols-2 gap-4">

                {/* Left - modelo pronto */}
                <div className="bg-white border-2 border-amber-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
                  <span className="absolute top-3 right-3 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    RECOMENDADO
                  </span>
                  <div className="flex items-start gap-3 mb-3">
                    <Download size={20} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[14px] font-bold text-zinc-900">Use nosso modelo pronto</p>
                      <p className="text-[12px] font-medium text-zinc-500 mt-1">
                        Planilha com todas as colunas certas: nome do negócio, etapa, valor, data de fechamento...
                      </p>
                    </div>
                  </div>
                  <p className="text-[12px] font-medium text-zinc-400 mb-4">
                    Baixe, preencha e envie de volta. Suas colunas serão reconhecidas automaticamente e os negócios aparecem direto no seu pipeline.
                  </p>
                  <button className="w-full flex items-center justify-center gap-2 border-2 border-amber-400 text-amber-600 text-[13px] font-bold py-2.5 rounded-lg hover:bg-amber-50 transition-colors">
                    <Download size={14} /> Baixar modelo CSV
                  </button>
                </div>

                {/* Right - upload */}
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <Upload size={20} className="text-zinc-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[14px] font-bold text-zinc-900">Envie seu CSV aqui</p>
                      <p className="text-[12px] font-medium text-zinc-500 mt-1">
                        Pode ser o modelo preenchido ou o seu próprio arquivo.
                      </p>
                    </div>
                  </div>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); }}
                    className={cn(
                      "border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-8 px-4 transition-colors cursor-pointer",
                      dragOver ? "border-amber-400 bg-amber-50" : "border-zinc-200 hover:border-zinc-300"
                    )}
                  >
                    <Upload size={24} className="text-zinc-300 mb-2" />
                    <p className="text-[13px] font-semibold text-zinc-500">Arraste um arquivo CSV ou clique para selecionar</p>
                    <p className="text-[11px] font-medium text-zinc-400 mt-1">Somente arquivos .csv</p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === "historico" && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-8 text-center -mt-4">
              <p className="text-[13px] font-medium text-zinc-400">Nenhuma importação realizada ainda.</p>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
