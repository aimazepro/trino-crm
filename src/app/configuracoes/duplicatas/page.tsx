"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DuplicatasPage() {
  const [activeTab, setActiveTab] = useState<"contatos" | "empresas">("contatos");
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Detectar Duplicatas</h1>
          <p className="text-sm font-medium text-zinc-400 mt-0.5">Encontre e mescle contatos ou empresas duplicados.</p>
        </div>
        <button
          onClick={() => setChecked(true)}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Search size={14} /> Verificar agora
        </button>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-3xl space-y-0">

          {/* Tabs */}
          <div className="flex border-b border-zinc-200 bg-white rounded-t-xl px-4 pt-1">
            {[
              { key: "contatos", label: "Contatos" },
              { key: "empresas", label: "Empresas" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as "contatos" | "empresas")}
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

          {/* Content */}
          <div className="bg-white border border-zinc-200 border-t-0 rounded-b-xl shadow-sm py-16 flex items-center justify-center">
            <p className="text-[13px] font-medium text-zinc-400">
              {checked
                ? "Nenhuma duplicata encontrada."
                : "Clique em \"Verificar agora\" para encontrar duplicatas."}
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
