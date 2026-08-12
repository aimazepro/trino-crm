"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeOption {
  value: string;
  label: string;
}

/** Duration-from-start offsets (minutes), fine-grained early then coarser — mirrors typical calendar-app end-time pickers. */
const DURATION_OFFSETS = [0, 5, 10, 15, 20, 25, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseHHmm(v: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

function formatDuration(min: number) {
  if (min === 0) return "0min";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h${rem}min`;
}

function buildOptions(relativeTo?: string): TimeOption[] {
  if (relativeTo) {
    const base = parseHHmm(relativeTo);
    if (base) {
      const baseMinutes = base.h * 60 + base.m;
      return DURATION_OFFSETS.map((offset) => {
        const total = (baseMinutes + offset) % (24 * 60);
        const value = `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
        return { value, label: `${value} (${formatDuration(offset)})` };
      });
    }
  }
  const options: TimeOption[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${pad(h)}:${pad(m)}`;
      options.push({ value, label: value });
    }
  }
  return options;
}

/**
 * Masks free typing into HH:mm, auto-inserting the colon and softly clamping
 * out-of-range hours/minutes. Re-derives the full split from scratch on every
 * keystroke (never trusts the previous render's split) so it can't deadlock:
 * a first digit of 3-9 is always a one-digit hour, and a two-digit prefix over
 * 23 falls back to a one-digit hour with the second digit starting the minutes
 * — e.g. typing "950" reaches 9:50 instead of getting stuck at "9:".
 */
function maskTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 0) return "";

  let hourDigits: string;
  let rest: string;
  if (digits[0] > "2") {
    hourDigits = digits[0];
    rest = digits.slice(1);
  } else if (digits.length === 1) {
    hourDigits = digits[0];
    rest = "";
  } else {
    const twoDigitHour = digits.slice(0, 2);
    if (Number(twoDigitHour) > 23) {
      hourDigits = digits[0];
      rest = digits.slice(1);
    } else {
      hourDigits = twoDigitHour;
      rest = digits.slice(2);
    }
  }

  if (rest.length === 0) return hourDigits;
  let minuteDigits = rest.slice(0, 2);
  if (minuteDigits.length === 2 && Number(minuteDigits) > 59) minuteDigits = "59";
  return `${hourDigits}:${minuteDigits}`;
}

interface TimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** When set, the suggestion dropdown shows durations from this HH:mm instead of absolute times. */
  relativeTo?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}

export function TimeField({ value, onChange, relativeTo, ariaLabel, placeholder = "HH:mm", className }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const options = buildOptions(relativeTo);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => onChange(maskTimeInput(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") { e.currentTarget.blur(); setOpen(false); }
          }}
          className={cn(
            "w-full border border-gray-200 rounded-xl pl-3 pr-8 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors text-gray-800",
            className
          )}
        />
        <Clock size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-max min-w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-y-auto max-h-52">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                ref={active ? activeRef : undefined}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(opt.value); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between gap-3 text-left px-3 py-1.5 text-sm transition-colors whitespace-nowrap",
                  active ? "bg-amber-50 text-amber-700 font-medium" : "text-gray-700 hover:bg-gray-50"
                )}
              >
                {opt.label}
                {active && <Check size={13} className="text-amber-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
