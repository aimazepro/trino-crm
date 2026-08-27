"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/use-team";
import { OwnerBadge } from "@/components/team/owner-badge";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  allowUnassigned?: boolean;
  unassignedLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Dropdown de membros ativos do workspace. */
export function OwnerSelect({
  value, onChange, allowUnassigned = false,
  unassignedLabel = "Sem dono", disabled = false, className,
}: Props) {
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

  const label = value ? (map[value] ?? "Usuário removido") : unassignedLabel;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span className="truncate">{loading ? "Carregando..." : label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {allowUnassigned && (
            <button type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-50">
              {unassignedLabel}
              {value === null && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          )}
          {members.length === 0 && !loading && (
            <p className="px-3 py-2 text-xs text-zinc-400">Nenhum membro ativo.</p>
          )}
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
