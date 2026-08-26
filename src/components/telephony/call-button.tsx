"use client";

// Botão "Ligar" reutilizável. Mesmo componente no card de ligação do negócio e
// no detalhe do contato — um caminho só para manter o comportamento igual nos
// dois lugares.

import { useState } from "react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { CallDialog } from "./call-dialog";
import { useTelephony } from "@/hooks/use-telephony";

interface CallButtonProps {
  toNumber: string | null | undefined;
  contactName?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  onFinished?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
  label?: string;
}

export function CallButton({
  toNumber,
  contactName,
  dealId,
  contactId,
  onFinished,
  variant = "primary",
  className,
  label = "Ligar",
}: CallButtonProps) {
  const [open, setOpen] = useState(false);
  const { status } = useTelephony();

  if (!toNumber) return null;

  const active = status?.status === "active";
  const hasExtension = Boolean(status?.myExtension);
  const ready = active && hasExtension;

  const title = !active
    ? "Telefonia não está ativa. Configure em Configurações → Telefone."
    : !hasExtension
      ? "Você não tem ramal vinculado. Peça ao dono da conta."
      : `Ligar para ${toNumber}`;

  return (
    <>
      <button
        onClick={() => ready && setOpen(true)}
        disabled={!ready}
        title={title}
        className={cn(
          "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          variant === "primary"
            ? "bg-purple-600 text-white hover:bg-purple-700"
            : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100",
          className,
        )}
      >
        <Phone className={cn("h-3.5 w-3.5", variant === "ghost" && "text-zinc-400")} />
        {label}
      </button>

      {open && (
        <CallDialog
          toNumber={toNumber}
          contactName={contactName}
          dealId={dealId}
          contactId={contactId}
          onClose={() => setOpen(false)}
          onFinished={onFinished}
        />
      )}
    </>
  );
}
