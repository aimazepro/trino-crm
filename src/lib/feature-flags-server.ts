// src/lib/feature-flags-server.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { apiError } from "@/lib/api-auth";
import { effectiveFeatures, type FeatureKey } from "@/lib/feature-flags";

/**
 * A checagem só toca `workspaces.plan`/`workspaces.feature_flags` -- pedir o
 * `Database` inteiro (gerado, ~60 tabelas) como tipo do parâmetro forçaria
 * todo client admin especializado (ex.: `TelephonyClient`, tipado contra a
 * fatia própria de `src/lib/telephony/db.ts`) a ser widened pro schema
 * completo só pra passar por aqui. Esta forma estrutural mínima aceita
 * qualquer client cuja tabela `workspaces` tenha essas duas colunas.
 */
type WorkspaceFeatureRow = { id: string; plan: string; feature_flags: unknown };
type FeatureFlagsDatabase = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      workspaces: {
        Row: WorkspaceFeatureRow;
        Insert: Partial<WorkspaceFeatureRow>;
        Update: Partial<WorkspaceFeatureRow>;
        Relationships: unknown[];
      };
    };
    // Formato mínimo exigido pelo `GenericSchema` do postgrest-js (Views e
    // Functions casam por essa forma, não por `unknown`) -- qualquer client
    // concreto (o `Database` gerado inteiro, ou a fatia própria de
    // `TelephonyClient`) declara Views/Functions reais que se encaixam aqui.
    Views: Record<string, { Row: Record<string, unknown>; Relationships: unknown[] }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, unknown>;
    CompositeTypes: Record<string, unknown>;
  };
};

/**
 * Gate de servidor pras rotas de API: carrega plan+feature_flags do próprio
 * workspace (a rota chamadora não tem isso pré-carregado) e devolve um 403
 * pronto pra retornar quando a feature está desligada.
 */
export async function assertFeatureEnabled(
  supabase: SupabaseClient<FeatureFlagsDatabase>,
  workspaceId: string,
  key: FeatureKey
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  // O parser de select-string do postgrest-js não resolve "plan, feature_flags"
  // contra este Database mínimo (só a fatia de `workspaces`, sem o schema
  // completo) -- overrideTypes é a forma pública e não-deprecated de fixar o
  // shape do resultado nesse caso, em vez de um `as` cego no client ou no dado.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("plan, feature_flags")
    .eq("id", workspaceId)
    .maybeSingle()
    .overrideTypes<Pick<WorkspaceFeatureRow, "plan" | "feature_flags"> | null, { merge: false }>();

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
