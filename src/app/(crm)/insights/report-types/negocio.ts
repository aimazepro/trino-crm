import type { Deal } from "@/lib/crm-types";
import type { ReportComputeArgs, ReportComputeResult, ChartDatum, ReportRecord, ReportTypeDef } from "./types";
import { dealToRecord } from "./types";

function stageNameOf(d: Deal, pipeline: ReportComputeArgs["pipeline"]): string {
  return pipeline?.stages.find((s) => s.id === d.stageId)?.name ?? "—";
}

function toRecords(deals: Deal[], args: ReportComputeArgs): ReportRecord[] {
  const pipelineNameById: Record<string, string> = {};
  args.pipelines.forEach((p) => (pipelineNameById[p.id] = p.name));
  return deals.map((d) => {
    const pipeline = args.pipelines.find((p) => p.id === d.pipelineId) ?? null;
    return dealToRecord(
      d,
      stageNameOf(d, pipeline),
      pipelineNameById[d.pipelineId] ?? "—",
      args.ownerNameMap[d.ownerId ?? ""] ?? "Sem dono",
    );
  });
}

function monthBucket(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function computeDesempenho(args: ReportComputeArgs): ReportComputeResult {
  const buckets: Record<string, { name: string; Iniciados: number; Ganhos: number; Perdidos: number }> = {};
  const bucketOf = (iso: string) => {
    const key = monthBucket(iso);
    if (!buckets[key]) buckets[key] = { name: key, Iniciados: 0, Ganhos: 0, Perdidos: 0 };
    return buckets[key];
  };
  args.deals.forEach((d) => {
    if (d.createdAt) bucketOf(d.createdAt).Iniciados += 1;
    if (d.status === "Ganho") bucketOf(d.history[0]?.createdAt ?? d.createdAt ?? new Date().toISOString()).Ganhos += 1;
    if (d.status === "Perdido") bucketOf(d.history[0]?.createdAt ?? d.createdAt ?? new Date().toISOString()).Perdidos += 1;
  });
  return {
    chartData: Object.values(buckets) as unknown as ChartDatum[],
    records: toRecords(args.deals, args),
  };
}

export function computeFunilConversao(args: ReportComputeArgs): ReportComputeResult {
  const stages = args.pipeline?.stages ?? [];
  const excluded = args.config.excludeStage;
  const activeDeals = args.deals.filter((d) => d.status === "Ativo");
  const chartData: ChartDatum[] = stages
    .filter((s) => s.name !== excluded)
    .map((s) => ({
      name: s.name.length > 18 ? s.name.slice(0, 17) + "..." : s.name,
      fullName: s.name,
      value: activeDeals.filter((d) => d.stageId === s.id).length,
    }));
  const total = args.deals.length;
  const won = args.deals.filter((d) => d.status === "Ganho").length;
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
  return {
    chartData,
    records: toRecords(activeDeals, args),
    extraMetric: { label: "Taxa de ganho", value: `${winRate}%` },
  };
}

export function computeGanhoPerda(args: ReportComputeArgs): ReportComputeResult {
  const closed = args.deals.filter((d) => d.status === "Ganho" || d.status === "Perdido");
  if (args.config.groupBy === "loss_reason") {
    const groups: Record<string, number> = {};
    closed.filter((d) => d.status === "Perdido").forEach((d) => {
      const key = d.lossReason || "Sem motivo";
      groups[key] = (groups[key] || 0) + 1;
    });
    return { chartData: Object.entries(groups).map(([name, value]) => ({ name, value })), records: toRecords(closed, args) };
  }
  const won = closed.filter((d) => d.status === "Ganho");
  const lost = closed.filter((d) => d.status === "Perdido");
  const measureBy = args.config.measureBy ?? "count";
  const valueOf = (arr: Deal[]) => (measureBy === "value" ? arr.reduce((s, d) => s + d.value, 0) : arr.length);
  return {
    chartData: [
      { name: "Ganho", value: valueOf(won) },
      { name: "Perdido", value: valueOf(lost) },
    ],
    records: toRecords(closed, args),
  };
}

const STAGE_MOVE_RE = /^De (.+) para (.+)$/;

interface StageSegment {
  stageName: string;
  from: Date;
  to: Date;
}

function stageSegmentsOf(d: Deal, pipeline: ReportComputeArgs["pipeline"]): StageSegment[] {
  const moves = [...d.history]
    .filter((h) => h.description === "Etapa alterada" && STAGE_MOVE_RE.test(h.subtext))
    .reverse(); // cronológico: mais antigo primeiro
  const firstStageName = pipeline?.stages[0]?.name ?? "—";
  const created = d.createdAt ? new Date(d.createdAt) : new Date();
  const segments: StageSegment[] = [];
  let cursorStage = firstStageName;
  let cursorStart = created;
  for (const h of moves) {
    const match = h.subtext.match(STAGE_MOVE_RE)!;
    const eventDate = new Date(h.createdAt);
    segments.push({ stageName: cursorStage, from: cursorStart, to: eventDate });
    cursorStage = match[2];
    cursorStart = eventDate;
  }
  const end = d.status === "Ativo" ? new Date() : cursorStart;
  segments.push({ stageName: cursorStage, from: cursorStart, to: end });
  return segments;
}

export function computeDuracaoPorEtapa(args: ReportComputeArgs): ReportComputeResult {
  const totals: Record<string, { sumMs: number; count: number }> = {};
  args.deals.forEach((d) => {
    stageSegmentsOf(d, args.pipeline).forEach((seg) => {
      const key = seg.stageName;
      if (!totals[key]) totals[key] = { sumMs: 0, count: 0 };
      totals[key].sumMs += seg.to.getTime() - seg.from.getTime();
      totals[key].count += 1;
    });
  });
  const order = args.pipeline?.stages.map((s) => s.name) ?? Object.keys(totals);
  const chartData: ChartDatum[] = order
    .filter((name) => totals[name])
    .map((name) => ({ name, value: Math.round(totals[name].sumMs / totals[name].count / 86400000) }));
  return { chartData, records: toRecords(args.deals, args) };
}

export function computeMovimentacaoPorEtapa(args: ReportComputeArgs): ReportComputeResult {
  const stageOrderByName: Record<string, number> = {};
  (args.pipeline?.stages ?? []).forEach((s) => (stageOrderByName[s.name] = s.order));
  const counts: Record<string, { name: string; Entraram: number; Sairam: number; Progrediram: number; Regrediram: number }> = {};
  const bump = (name: string) => {
    if (!counts[name]) counts[name] = { name, Entraram: 0, Sairam: 0, Progrediram: 0, Regrediram: 0 };
    return counts[name];
  };
  args.deals.forEach((d) => {
    d.history
      .filter((h) => h.description === "Etapa alterada" && STAGE_MOVE_RE.test(h.subtext))
      .forEach((h) => {
        const match = h.subtext.match(STAGE_MOVE_RE)!;
        const [, from, to] = match;
        bump(from).Sairam += 1;
        bump(to).Entraram += 1;
        const fromOrder = stageOrderByName[from] ?? 0;
        const toOrder = stageOrderByName[to] ?? 0;
        if (toOrder > fromOrder) bump(to).Progrediram += 1;
        else if (toOrder < fromOrder) bump(to).Regrediram += 1;
      });
  });
  return { chartData: Object.values(counts) as unknown as ChartDatum[], records: toRecords(args.deals, args) };
}

export function computeForecast(args: ReportComputeArgs): ReportComputeResult {
  const open = args.deals.filter((d) => d.status === "Ativo");
  const buckets: Record<string, number> = {};
  open.forEach((d) => {
    const key = d.expectedCloseDate ? monthBucket(d.expectedCloseDate) : "Sem previsao";
    const weighted = d.value * ((d.probability ?? 0) / 100);
    buckets[key] = (buckets[key] || 0) + weighted;
  });
  return {
    chartData: Object.entries(buckets).map(([name, value]) => ({ name, value: Math.round(value) })),
    records: toRecords(open, args),
  };
}

export function computeTempoResposta(args: ReportComputeArgs): ReportComputeResult {
  const withActivity = args.deals.filter((d) => d.createdAt && d.activities.length > 0);
  let totalHours = 0;
  withActivity.forEach((d) => {
    const firstActivity = [...d.activities].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    const diffMs = new Date(firstActivity.createdAt).getTime() - new Date(d.createdAt!).getTime();
    totalHours += Math.max(0, diffMs) / 3600000;
  });
  const avgHours = withActivity.length > 0 ? Math.round(totalHours / withActivity.length) : 0;
  return {
    chartData: [{ name: "Tempo médio de resposta (h)", value: avgHours }],
    records: toRecords(withActivity, args),
    extraMetric: { label: "Média", value: `${avgHours}h` },
  };
}

export function computeEmBranco(args: ReportComputeArgs): ReportComputeResult {
  const groups: Record<string, { name: string; value: number; amount: number }> = {};
  const stageNameById: Record<string, string> = {};
  (args.pipeline?.stages ?? []).forEach((s) => (stageNameById[s.id] = s.name));
  args.deals.forEach((d) => {
    const key = stageNameById[d.stageId] ?? "—";
    if (!groups[key]) groups[key] = { name: key, value: 0, amount: 0 };
    groups[key].value += 1;
    groups[key].amount += d.value;
  });
  return { chartData: Object.values(groups), records: toRecords(args.deals, args) };
}

export const NEGOCIO_REPORT_TYPES: ReportTypeDef[] = [
  { key: "em_branco", label: "Em branco", description: "Comece do zero: escolha período, filtros, agrupamento e visualização", entity: "deal", defaultChartType: "bar", compute: computeEmBranco },
  { key: "desempenho", label: "Desempenho", description: "Quantos negócios você iniciou, ganhou ou perdeu no período?", entity: "deal", defaultChartType: "stacked", compute: computeDesempenho },
  { key: "funil_conversao", label: "Funil de Conversão", description: "Quantos negócios chegaram a cada etapa e qual a taxa entre elas?", entity: "deal", defaultChartType: "funnel", compute: computeFunilConversao },
  { key: "ganho_perda", label: "Ganho x Perda", description: "Taxa de conversão, valor ganho/perdido e quebra por motivo de perda", entity: "deal", defaultChartType: "pie", compute: computeGanhoPerda },
  { key: "duracao_por_etapa", label: "Duração por Etapa", description: "Quanto tempo o negócio fica em cada etapa do funil?", entity: "deal", defaultChartType: "bar", compute: computeDuracaoPorEtapa },
  { key: "movimentacao_por_etapa", label: "Movimentação por Etapa", description: "Quantos negócios entraram, saíram, progrediram e regrediram?", entity: "deal", defaultChartType: "stacked", compute: computeMovimentacaoPorEtapa },
  { key: "forecast", label: "Forecast / Pipeline ponderado", description: "Quanto você vai fechar com base em valor x probabilidade dos negócios abertos", entity: "deal", defaultChartType: "bar", compute: computeForecast },
  { key: "tempo_resposta", label: "Tempo de Resposta", description: "Quanto tempo a equipe leva pra dar a primeira resposta a um lead novo", entity: "deal", defaultChartType: "number", compute: computeTempoResposta },
];
