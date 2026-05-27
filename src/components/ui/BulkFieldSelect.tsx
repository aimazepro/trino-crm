"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function BulkFieldSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors min-w-0 w-full"
      >
        <span className="min-w-0 truncate flex-1 text-left text-zinc-800 font-medium">
          {value}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden w-full">
          {options.map(o => (
            <button
              key={o}
              type="button"
              onMouseDown={() => { onChange(o); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2.5 text-sm hover:bg-amber-50 transition-colors flex items-center justify-between",
                o === value && "bg-blue-600 text-white font-semibold hover:bg-blue-600"
              )}
            >
              <span>{o}</span>
              {o === value && (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check h-3.5 w-3.5 text-white" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
