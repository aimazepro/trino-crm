"use client";

// Seleção de script de ligação: lista com busca e visualização do roteiro já com
// as variáveis preenchidas. Serve os dois pontos de entrada — o botão "Script"
// da aba e o passo que antecede a discagem.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Loader2, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { fillScript, missingVars, type ScriptContext } from "@/lib/telephony/script-vars";

export interface CallScript {
  id: string;
  name: string;
  content: string;
  category: string | null;
}

export function useScripts() {
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("scripts")
      .select("id, name, content, category")
      .order("created_at")
      .then(({ data }) => {
        if (cancelled) return;
        setScripts((data ?? []) as CallScript[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { scripts, loading };
}

interface ScriptListProps {
  scripts: CallScript[];
  loading: boolean;
  ctx: ScriptContext;
  onPick: (script: CallScript) => void;
  emptyHint?: string;
}

/** Lista com busca por nome, categoria e conteúdo. */
export function ScriptList({ scripts, loading, ctx, onPick, emptyHint }: ScriptListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scripts;
    return scripts.filter((s) =>
      [s.name, s.category ?? "", s.content].some((f) => f.toLowerCase().includes(q)),
    );
  }, [scripts, query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando scripts...
      </div>
    );
  }

  if (scripts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 p-5 text-center text-sm text-zinc-400">
        {emptyHint ??
          "Nenhum script cadastrado. Crie em Configurações → Scripts de Ligação para o time ter um roteiro na mão durante a chamada."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar script por nome ou trecho do texto..."
          className="w-full rounded-xl border border-zinc-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-purple-400"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">
          Nenhum script encontrado para &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {filtered.map((s) => {
            const preview = fillScript(s.content, ctx).replace(/\s+/g, " ").slice(0, 140);
            return (
              <button
                key={s.id}
                onClick={() => onPick(s)}
                className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900">{s.name}</span>
                  {s.category && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                      {s.category}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                  {preview}
                  {s.content.length > 140 ? "..." : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ScriptModalProps {
  ctx: ScriptContext;
  onClose: () => void;
}

/** Modal autônomo: lista → roteiro, com voltar. */
export function ScriptModal({ ctx, onClose }: ScriptModalProps) {
  const { scripts, loading } = useScripts();
  const [selected, setSelected] = useState<CallScript | null>(null);

  const filled = selected ? fillScript(selected.content, ctx) : "";
  const pending = selected ? missingVars(selected.content, ctx) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <FileText className="h-4 w-4 text-purple-600" />
          <h3 className="flex-1 text-base font-semibold text-zinc-900">
            {selected ? selected.name : "Escolher script"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {selected ? (
            <>
              {pending.length > 0 && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Sem valor para: {pending.join(", ")}. O texto original continua à mostra para você
                  não ler uma frase quebrada sem perceber.
                </p>
              )}
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                {filled}
              </div>
            </>
          ) : (
            <ScriptList scripts={scripts} loading={loading} ctx={ctx} onPick={setSelected} />
          )}
        </div>

        {selected && (
          <div className="border-t border-zinc-100 px-6 py-3">
            <button
              onClick={() => setSelected(null)}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium text-amber-600",
                "transition-colors hover:text-amber-700",
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para lista
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
