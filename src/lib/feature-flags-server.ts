// src/lib/feature-flags-server.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { apiError } from "@/lib/api-auth";
import { effectiveFeatures, type FeatureKey } from "@/lib/feature-flags";

/**
 * Gate de servidor pras rotas de API: carrega plan+feature_flags do próprio
 * workspace (a rota chamadora não tem isso pré-carregado) e devolve um 403
 * pronto pra retornar quando a feature está desligada.
 */
export async function assertFeatureEnabled(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  key: FeatureKey
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("plan, feature_flags")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) {
    return { ok: false, response: apiError("NOT_FOUND", "Workspace não encontrado", 404) };
  }

  const features = effectiveFeatures(
    workspace.plan,
    workspace.feature_flags as Partial<Record<FeatureKey, boolean>>
  );

  if (!features[key]) {
    return {
      ok: false,
      response: apiError("FEATURE_DISABLED", `Recurso '${key}' não está habilitado neste workspace`, 403),
    };
  }

  return { ok: true };
}
