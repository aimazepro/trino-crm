import type { ReportComputeArgs, ReportComputeResult, ChartDatum, ReportTypeDef } from "./types";

function activitiesInPeriod(args: ReportComputeArgs) {
  // args.deals já vem filtrado por período (created_at do negócio via applyPeriodFilter);
  // aqui só flatten pros deals que sobraram do filtro.
  return args.deals.flatMap((d) => d.activities.map((a) => ({ ...a, dealId: d.id })));
}

export function computeMixAtividades(args: ReportComputeArgs): ReportComputeResult {
  const activities = activitiesInPeriod(args);
  const counts: Record<string, number> = {};
  activities.forEach((a) => {
    counts[a.type] = (counts[a.type] || 0) + 1;
  });
  const chartData: ChartDatum[] = [{ name: "Total", value: activities.length, ...counts }];
  return { chartData, records: [] };
}

export function computeAtividadesPorResponsavel(args: ReportComputeArgs): ReportComputeResult {
  const activities = activitiesInPeriod(args);
  const byOwner: Record<string, { name: string; value: number; Concluídas: number; Pendentes: number }> = {};
  activities.forEach((a) => {
    const ownerName = args.ownerNameMap[a.assigneeId ?? ""] ?? "Sem responsável";
    if (!byOwner[ownerName]) byOwner[ownerName] = { name: ownerName, value: 0, Concluídas: 0, Pendentes: 0 };
    byOwner[ownerName].value += 1;
    if (a.completed) byOwner[ownerName].Concluídas += 1;
    else byOwner[ownerName].Pendentes += 1;
  });
  return { chartData: Object.values(byOwner) as unknown as ChartDatum[], records: [] };
}

export const ATIVIDADE_REPORT_TYPES: ReportTypeDef[] = [
  { key: "mix_atividades", label: "Mix de Atividades", description: "Distribuição das atividades por tipo", entity: "activity", defaultChartType: "stacked", compute: computeMixAtividades },
  { key: "atividades_por_responsavel", label: "Atividades por Responsável", description: "Atividades de cada membro do time", entity: "activity", defaultChartType: "stacked", compute: computeAtividadesPorResponsavel },
];
