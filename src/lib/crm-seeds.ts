import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pipeline, PipelineStage } from "@/lib/crm-types";

const DEFAULT_PIPELINES = [
  { name: "Prospecção", stages: ["Entrada de Leads", "Tentando contato", "Contato realizado com a empresa", "Contato realizado com o decisor", "Reunião Agendada"] },
  { name: "Inbound", stages: ["Formulário Preenchido", "Qualificado pelo formulário", "Tentando contato", "Contato realizado", "Reunião Agendada"] },
  { name: "Social Selling", stages: ["MQL Cadastrado", "Tentando contato", "Contato realizado", "Conversa Significativa", "Reunião Agendada"] },
  { name: "Negociação", stages: ["Reunião Realizada", "Proposta Agendada", "Proposta Apresentada", "Negociação", "Contrato"] },
];

export async function seedDefaultPipelines(
  supabase: SupabaseClient,
  userId: string,
  pipelines: Pipeline[],
): Promise<Pipeline[]> {
  if (pipelines.length > 0) return pipelines;

  const result: Pipeline[] = [];
  for (const def of DEFAULT_PIPELINES) {
    const { data: pData } = await supabase.from("pipelines").insert({ user_id: userId, name: def.name }).select().single();
    if (pData) {
      const stageRows = def.stages.map((s, i) => ({ pipeline_id: pData.id, name: s, max_days: 7, order: i }));
      const { data: sData } = await supabase.from("pipeline_stages").insert(stageRows).select();
      result.push({
        id: pData.id,
        name: pData.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stages: (sData ?? []).sort((a: any, b: any) => a.order - b.order)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((s: any): PipelineStage => ({ id: s.id, name: s.name, maxDays: s.max_days, order: s.order })),
      });
    }
  }
  return result;
}
