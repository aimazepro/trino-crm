"use client";

// Criar atividade já vinculada ao negócio, sem sair da aba de ligações.
//
// O caso que motiva isso: a ligação terminou em "reagendar" e o próximo passo
// precisa virar compromisso enquanto o contexto está fresco. Por isso o diálogo
// abre sozinho quando essa é a classificação.

import { useEffect, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface CreateActivityDialogProps {
  dealId: string;
  defaultTitle?: string;
  defaultType?: string;
  onClose: () => void;
  onCreated?: () => void;
}

/** Data/hora local no formato aceito por input[type=datetime-local]. */
function localInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateActivityDialog({
  dealId,
  defaultTitle,
  defaultType,
  onClose,
  onCreated,
}: CreateActivityDialogProps) {
  const { addActivity } = useCrm();

  // O catálogo de tipos vive em activity_types e não passa pelo estado do CRM,
  // então é buscado aqui. O fallback cobre workspace que ainda não configurou
  // nenhum tipo — sem ele o select abriria vazio.
  const [types, setTypes] = useState<string[]>([
    "Ligação",
    "Reunião",
    "E-mail",
    "WhatsApp",
    "Tarefa",
  ]);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("activity_types")
      .select("name, active")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return;
        setTypes(data.map((t: { name: string }) => t.name));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [title, setTitle] = useState(defaultTitle ?? "Retornar ligação");
  const [type, setType] = useState(defaultType ?? "Ligação");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return localInputValue(d);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!title.trim()) {
      setError("Dê um título para a atividade.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      addActivity({
        dealId,
        title: title.trim(),
        description: description.trim() || undefined,
        date: new Date(date).toISOString(),
        type,
        completed: false,
      });
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar a atividade");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-purple-600" />
          <h3 className="flex-1 text-base font-semibold text-zinc-900">Nova atividade</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Título</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">Tipo</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              >
                {types.map((t: string) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">Quando</span>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Descrição</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
          </label>

          <div className="mt-1 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className={cn(
                "flex-1 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white",
                "transition-colors hover:bg-purple-700 disabled:opacity-50",
              )}
            >
              {saving ? "Criando..." : "Criar atividade"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
