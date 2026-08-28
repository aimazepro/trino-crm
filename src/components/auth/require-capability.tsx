"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useWorkspaceInfo, useWorkspaceLoading } from "@/lib/workspace";
import { can, type Capability } from "@/lib/permissions";

/**
 * Esconde uma tela de quem não tem a capacidade. É a metade de cliente do
 * gate -- a metade que vale é a RLS. Usa useWorkspaceInfo (não useWorkspace),
 * que não estoura enquanto o workspace ainda está carregando.
 */
export function RequireCapability({
  capability,
  children,
}: {
  capability: Capability;
  children: ReactNode;
}) {
  const info = useWorkspaceInfo();
  const loading = useWorkspaceLoading();

  // Enquanto carrega não mostra nem o conteúdo nem o aviso: piscar "sem acesso"
  // para quem tem acesso é pior que esperar.
  if (loading) return null;

  if (!can(info?.role, capability)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
          <Lock size={20} className="text-zinc-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">Sem acesso</h2>
        <p className="max-w-sm text-sm text-zinc-500">
          Esta área é restrita a administradores e gerentes. Fale com quem
          administra o workspace se você precisa acessá-la.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
