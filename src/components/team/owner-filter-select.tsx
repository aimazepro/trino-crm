"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/use-team";
import { OwnerBadge } from "@/components/team/owner-badge";

/**
 * Sentinel para "sem dono" -- distinto de `null`, que aqui significa "sem
 * filtro ativo" (mostra todo mundo). Não é um id real, então nunca colide
 * com um member_user_id de verdade.
 */
export const UNASSIGNED_OWNER_FILTER = "__unassigned__";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}

/**
 * Filtro por dono para listagens compartilhadas (Contatos, Empresas), onde
 * -- ao contrário de Negócios -- todo papel vê a base inteira e o filtro é
 * conveniência, não controle de acesso. Três estados, todos comparados por
 * id: null = "Todos os donos", UNASSIGNED_OWNER_FILTER = "Sem dono", ou o id
 * de um membro do time.
 */
export function OwnerFilterSelect({ value, onChange, className }: Props) {
  const { members, map, loading } = useTeam();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const label =
    value === null ? "Todos os donos"
    : value === UNASSIGNED_OWNER_FILTER ? "Sem dono"
    : (map[value] ?? "Usuário removido");

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span className="truncate">{loading ? "Carregando..." : label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-52 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          <button type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-50">
            Todos os donos
            {value === null && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          <button type="button"
            onClick={() => { onChange(UNASSIGNED_OWNER_FILTER); setOpen(false); }}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-50">
            Sem dono
            {value === UNASSIGNED_OWNER_FILTER && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          {members.length > 0 && <div className="my-1 h-px bg-zinc-100" />}
          {members.map((m) => (
            <button key={m.id} type="button"
              onClick={() => { onChange(m.id); setOpen(false); }}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-zinc-50",
                value === m.id && "bg-zinc-50 font-semibold",
              )}>
              <OwnerBadge ownerId={m.id} />
              {value === m.id && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
