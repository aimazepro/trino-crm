"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useWorkspaceInfo, useWorkspaceLoading } from "@/lib/workspace";
import type { FeatureKey } from "@/lib/feature-flags";

/**
 * Esconde uma tela de um workspace que não tem a feature habilitada. Mirror
 * de RequireCapability (src/components/auth/require-capability.tsx), mas o
 * eixo é feature/plano, não role -- as duas coisas podem estar juntas na
 * mesma página (automacoes/page.tsx faz isso: RequireFeature por fora,
 * RequireCapability por dentro).
 *
 * Assim como RequireCapability, isto é só a metade de cliente do gate --
 * esconder a tela não é a proteção real. A proteção real é
 * assertFeatureEnabled nas rotas de API (src/lib/feature-flags-server.ts).
 */
export function RequireFeature({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: ReactNode;
}) {
  const info = useWorkspaceInfo();
  const loading = useWorkspaceLoading();

  if (loading) return null;

  if (!info?.features[feature]) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
          <Lock size={20} className="text-zinc-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">Recurso não incluído</h2>
        <p className="max-w-sm text-sm text-zinc-500">
          Este recurso não está habilitado no seu plano atual. Fale com quem
          administra sua conta para habilitá-lo.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
