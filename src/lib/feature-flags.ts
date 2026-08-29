// src/lib/feature-flags.ts
//
// Puro de propósito: workspace-context.ts importa daqui e é compartilhado
// entre server E client (WorkspaceProvider). Qualquer import de next/server
// aqui vazaria pro bundle do client -- é a mesma armadilha que o cabeçalho
// de workspace-context.ts já documenta pra "use client". A metade que
// precisa de Supabase/Next mora em feature-flags-server.ts.

export type FeatureKey = "whatsapp" | "voip" | "automacoes" | "api_v1" | "custom_fields";

export const FEATURE_KEYS: readonly FeatureKey[] = [
  "whatsapp",
  "voip",
  "automacoes",
  "api_v1",
  "custom_fields",
];

const PLAN_DEFAULTS: Record<string, Record<FeatureKey, boolean>> = {
  trial: { whatsapp: true, voip: false, automacoes: true, api_v1: true, custom_fields: true },
  pro: { whatsapp: true, voip: true, automacoes: true, api_v1: true, custom_fields: true },
  business: { whatsapp: true, voip: true, automacoes: true, api_v1: true, custom_fields: true },
};

/**
 * Default do plano mesclado com overrides por workspace. Plano desconhecido
 * cai no default de `trial` -- o mais restritivo, nunca abre mais do que
 * deveria por um valor de plano que o registro ainda não conhece.
 */
export function effectiveFeatures(
  plan: string,
  overrides: Partial<Record<FeatureKey, boolean>> | null | undefined
): Record<FeatureKey, boolean> {
  const base = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.trial;
  return { ...base, ...(overrides ?? {}) };
}
