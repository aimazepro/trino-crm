"use client";

import { cn } from "@/lib/utils";

export interface ScopeOption<T extends string> {
  value: T;
  label: string;
  /** Escopo que o papel do usuário não permite -- não renderiza. */
  hidden?: boolean;
  count?: number;
}

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ScopeOption<T>[];
  className?: string;
}

export function ScopeToggle<T extends string>({ value, onChange, options, className }: Props<T>) {
  const visible = options.filter((o) => !o.hidden);
  if (visible.length < 2) return null;

  return (
    <div className={cn("inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5", className)}>
      {visible.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700",
          )}>
          {o.label}
          {typeof o.count === "number" && o.count > 0 && (
            <span className="ml-1.5 text-[10px] text-zinc-400">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
