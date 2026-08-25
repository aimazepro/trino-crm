# Relatórios (Insights) — Shell + Negócio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir `/insights` — modal real de criação de relatório (entidade + tipo), rotas dedicadas por relatório, catálogo de 8 tipos de Negócio + 2 de Atividade com cálculo real (sem mock), e seed padrão gerado a partir dos pipelines do workspace.

**Architecture:** Toda a lógica de cálculo vive em funções puras (`report-types/*.ts`) que recebem o `CrmState` já carregado pelo `useCrm()` (deals já vêm com `history`/`activities` embutidos — sem queries novas) e devolvem dados de gráfico + registros. Um registry mapeia `entity + reportType → ReportTypeDef`. Duas rotas novas (`/insights/reports/new`, `/insights/reports/[id]`) substituem o toggle de estado client-side atual. Persistência continua em `saved_reports.config` (jsonb), só ganha campos novos com fallback pros relatórios antigos.

**Tech Stack:** Next.js App Router, React (client components), Supabase (`saved_reports`, sem migration), Recharts, lucide-react. Sem framework de teste no repo — verificação é `npm run build` + checagem manual no navegador (convenção já usada no resto do projeto).

**Spec:** `docs/superpowers/specs/2026-08-25-relatorios-shell-negocio-design.md`

## Global Constraints

- Sem migration de banco — `saved_reports.config` é jsonb, campos novos são opcionais com fallback.
- Campos novos do `ReportConfig` (spec §1): `entity`, `reportType`, `periodField`, `measureBy?`, `groupBy?`, `groupByGranularity?`, `excludeStage?`.
- Autosave (debounced ~500ms), sem botão "Salvar" (spec §5).
- Contato/Empresa ficam com catálogo só de "Em branco" nessa fatia (spec §3).
- Nenhum dado mockado: relatório sem dados mostra "Nenhum dado encontrado" (padrão já usado hoje), nunca números fixos como fallback.

---

## File Structure

```
src/app/insights/
  insights-constants.ts          # MODIFY — SavedReport ganha campos novos; DEFAULT_REPORTS remove (vira report-types/seed.ts)
  insights-sidebar.tsx           # MODIFY — <button> vira <Link>; renomear "Meu Painel"
  dashboard-grid.tsx             # MODIFY — cards viram <Link>; empty-state "criar do zero" vira <Link href="/insights/reports/new">
  page.tsx                       # MODIFY — remove branch do viewer (activeReportId !== null); fica só dashboard + seed
  report-types/
    types.ts                     # CREATE — ReportConfig, ReportComputeArgs/Result, ReportTypeDef, registry types
    filters.ts                   # CREATE — FILTER_FIELDS por entidade, aplica período+filtros+groupBy num array de deals/activities
    negocio.ts                   # CREATE — 8 calculadoras de Negócio + NEGOCIO_REPORT_TYPES
    atividade.ts                 # CREATE — 2 calculadoras de Atividade + ATIVIDADE_REPORT_TYPES
    registry.ts                  # CREATE — REPORT_TYPE_REGISTRY, getReportType(entity, key)
    seed.ts                      # CREATE — buildDefaultReports(pipelines): SavedReport[]
  reports/
    new/
      page.tsx                   # CREATE — rota /insights/reports/new (modal entidade+tipo)
    [id]/
      page.tsx                   # CREATE — rota /insights/reports/[id] (thin wrapper, lê workspace + delega)
      report-viewer.tsx          # CREATE — o viewer/editor completo (extraído do page.tsx atual)
src/hooks/
  use-saved-reports.ts           # MODIFY — toConfig/fromRow carregam os campos novos com fallback
```

---

### Task 1: Tipos e filtros compartilhados do catálogo

**Files:**
- Create: `src/app/insights/report-types/types.ts`
- Create: `src/app/insights/report-types/filters.ts`
- Modify: `src/app/insights/insights-constants.ts`

**Interfaces:**
- Consumes: `Deal`, `Activity`, `Pipeline`, `PipelineStage` de `@/lib/crm-types`.
- Produces: `ReportConfig`, `ReportComputeArgs`, `ReportComputeResult`, `ChartDatum`, `ReportRecord`, `ReportTypeDef`, `ReportTypeCalculator` (usados por todas as tasks seguintes); `FILTER_FIELDS_BY_ENTITY`, `applyPeriodFilter(deals, periodField, period)`, `applyCustomFilters(deals, filters)`.

- [ ] **Step 1: Criar `report-types/types.ts`**

```ts
// src/app/insights/report-types/types.ts
import type { Deal, Activity, Pipeline } from "@/lib/crm-types";

export interface ReportFilter {
  field: string;
  operator: string; // "é" | "está vazio" | "não está vazio" | "maior que" | "menor que" | "igual a"
  value: string;
}

export interface ReportConfig {
  entity: "deal" | "activity" | "contact" | "company";
  reportType: string;
  chartType: "bar" | "stacked" | "funnel" | "pie" | "table" | "number";
  color: string;
  pipeline: string; // "" = todos os funis
  period: string;
  periodField: "created_at" | "closed_at";
  filters: ReportFilter[];
  measureBy?: "count" | "value";
  groupBy?: string; // "etapa" | "responsavel" | "status" | "created_at" | "closed_at" | "none"
  groupByGranularity?: "day" | "week" | "month";
  excludeStage?: string;
}

export interface ChartDatum {
  name: string;
  value: number;
  amount?: number;
  [seriesKey: string]: string | number | undefined;
}

export interface ReportRecord {
  id: string;
  title: string;
  value: number;
  stageName: string;
  pipelineName: string;
  ownerName: string;
  createdAt: string;
  status: string;
}

export interface ReportComputeArgs {
  deals: Deal[]; // já filtrados por período + filtros custom
  pipeline: Pipeline | null; // pipeline resolvido de config.pipeline, ou null = todos
  pipelines: Pipeline[];
  ownerNameMap: Record<string, string>;
  config: ReportConfig;
}

export interface ReportComputeResult {
  chartData: ChartDatum[];
  records: ReportRecord[];
  extraMetric?: { label: string; value: string };
}

export type ReportTypeCalculator = (args: ReportComputeArgs) => ReportComputeResult;

export interface ReportTypeDef {
  key: string;
  label: string;
  description: string;
  entity: "deal" | "activity";
  defaultChartType: ReportConfig["chartType"];
  defaultGroupBy?: string;
  compute: ReportTypeCalculator;
}

export function dealToRecord(d: Deal, stageName: string, pipelineName: string, ownerName: string): ReportRecord {
  return {
    id: d.id,
    title: d.title,
    value: d.value,
    stageName,
    pipelineName,
    ownerName,
    createdAt: d.createdAt || new Date().toISOString(),
    status: d.status,
  };
}
```

- [ ] **Step 2: Criar `report-types/filters.ts`**

```ts
// src/app/insights/report-types/filters.ts
import type { Deal } from "@/lib/crm-types";
import type { ReportConfig, ReportFilter } from "./types";

export const FILTER_FIELDS_BY_ENTITY: Record<"deal" | "activity", { value: string; label: string; type: "select" | "date" | "number" }[]> = {
  deal: [
    { value: "Status", label: "Status", type: "select" },
    { value: "Etapa", label: "Etapa", type: "select" },
    { value: "Funil", label: "Funil", type: "select" },
    { value: "Responsavel", label: "Responsável", type: "select" },
    { value: "Valor", label: "Valor", type: "number" },
    { value: "closed_at", label: "Negócio fechado em", type: "date" },
  ],
  activity: [
    { value: "Tipo", label: "Tipo", type: "select" },
    { value: "Responsavel", label: "Responsável", type: "select" },
    { value: "Concluida", label: "Concluída", type: "select" },
  ],
};

function isDealClosed(d: Deal): boolean {
  return d.status === "Ganho" || d.status === "Perdido";
}

function dealClosedAt(d: Deal): string | undefined {
  if (!isDealClosed(d)) return undefined;
  // última entrada do histórico marca o fechamento (moveu pra Ganho/Perdido)
  return d.history[0]?.createdAt ?? d.updatedAt;
}

export function periodToRange(period: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (period === "Este mes") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
  }
  if (period === "Mes passado") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to };
  }
  if (period === "Este ano") {
    return { from: new Date(now.getFullYear(), 0, 1), to: null };
  }
  if (period === "Ultimos 7 dias") {
    return { from: new Date(now.getTime() - 7 * 86400000), to: null };
  }
  if (period === "Ultimos 30 dias") {
    return { from: new Date(now.getTime() - 30 * 86400000), to: null };
  }
  return { from: null, to: null }; // "Todo o periodo"
}

export function applyPeriodFilter(deals: Deal[], periodField: ReportConfig["periodField"], period: string): Deal[] {
  const { from, to } = periodToRange(period);
  if (!from && !to) return deals;
  return deals.filter((d) => {
    const raw = periodField === "closed_at" ? dealClosedAt(d) : d.createdAt;
    if (!raw) return false;
    const t = new Date(raw).getTime();
    if (from && t < from.getTime()) return false;
    if (to && t >= to.getTime()) return false;
    return true;
  });
}

export function applyCustomFilters(
  deals: Deal[],
  filters: ReportFilter[],
  stageNameById: Record<string, string>,
  pipelineNameById: Record<string, string>,
  ownerNameMap: Record<string, string>,
): Deal[] {
  return deals.filter((d) => {
    for (const f of filters) {
      if (!matchFilter(d, f, stageNameById, pipelineNameById, ownerNameMap)) return false;
    }
    return true;
  });
}

function matchFilter(
  d: Deal,
  f: ReportFilter,
  stageNameById: Record<string, string>,
  pipelineNameById: Record<string, string>,
  ownerNameMap: Record<string, string>,
): boolean {
  if (f.field === "Status") {
    return f.operator === "é" ? d.status === f.value : true;
  }
  if (f.field === "Etapa") {
    const stageName = stageNameById[d.stageId] ?? "";
    return f.operator === "é" ? stageName.toLowerCase() === f.value.toLowerCase() : true;
  }
  if (f.field === "Funil") {
    const pipelineName = pipelineNameById[d.pipelineId] ?? "";
    return f.operator === "é" ? pipelineName.toLowerCase() === f.value.toLowerCase() : true;
  }
  if (f.field === "Responsavel") {
    const ownerName = ownerNameMap[d.ownerId ?? ""] ?? "";
    return f.operator === "é" ? ownerName.toLowerCase() === f.value.toLowerCase() : true;
  }
  if (f.field === "Valor") {
    const num = parseFloat(f.value) || 0;
    if (f.operator === "maior que") return d.value > num;
    if (f.operator === "menor que") return d.value < num;
    if (f.operator === "igual a") return d.value === num;
    return true;
  }
  if (f.field === "closed_at") {
    const closedAt = dealClosedAt(d);
    if (f.operator === "está vazio") return !closedAt;
    if (f.operator === "não está vazio") return !!closedAt;
    return true;
  }
  return true;
}
```

- [ ] **Step 3: Atualizar `insights-constants.ts` — trocar `SavedReport` pra reexportar `ReportConfig` + `id`/`name`**

Substituir o `export interface SavedReport` (linhas 1-9 do arquivo atual) por:

```ts
import type { ReportConfig } from "./report-types/types";
export type { ReportConfig, ReportFilter } from "./report-types/types";

export interface SavedReport extends ReportConfig {
  id: string;
  name: string;
}
```

Remover `export const DEFAULT_REPORTS` (linhas 11-35 do arquivo atual — vira `report-types/seed.ts` na Task 6). Manter `export const COLORS` como está.

- [ ] **Step 4: Rodar build**

```bash
npm run build
```

Esperado: falha com "Cannot find module './report-types/negocio'" ou similar — normal, esses módulos ainda não existem e nada os importa ainda nesta task. Confirme que o único erro é sobre módulos que as próximas tasks criam, não sobre `types.ts`/`filters.ts` em si.

- [ ] **Step 5: Commit**

```bash
git add src/app/insights/report-types/types.ts src/app/insights/report-types/filters.ts src/app/insights/insights-constants.ts
git commit -m "feat(insights): tipos e filtros compartilhados do catalogo de relatorios"
```

---

### Task 2: Calculadoras de Negócio — Desempenho, Funil de Conversão, Ganho × Perda

**Files:**
- Create: `src/app/insights/report-types/negocio.ts`

**Interfaces:**
- Consumes: `ReportComputeArgs`, `ReportComputeResult`, `ChartDatum`, `ReportRecord`, `dealToRecord`, `ReportTypeDef` (Task 1).
- Produces: `computeDesempenho`, `computeFunilConversao`, `computeGanhoPerda`, cada uma `ReportTypeCalculator`. Task 3 adiciona as outras 5 calculadoras no mesmo arquivo e monta `NEGOCIO_REPORT_TYPES`.

- [ ] **Step 1: Implementar as 3 calculadoras**

```ts
// src/app/insights/report-types/negocio.ts
import type { Deal } from "@/lib/crm-types";
import type { ReportComputeArgs, ReportComputeResult, ChartDatum, ReportRecord } from "./types";
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
```

- [ ] **Step 2: Rodar build**

```bash
npm run build
```

Esperado: sem erros novos nesse arquivo (ainda vai reclamar de `NEGOCIO_REPORT_TYPES` não existir se algo já importar — nada importa ainda, então deve compilar limpo).

- [ ] **Step 3: Commit**

```bash
git add src/app/insights/report-types/negocio.ts
git commit -m "feat(insights): calculadoras Desempenho, Funil de Conversao, Ganho x Perda"
```

---

### Task 3: Calculadoras de Negócio — Duração por Etapa, Movimentação por Etapa, Forecast, Tempo de Resposta, Em branco + registry

**Files:**
- Modify: `src/app/insights/report-types/negocio.ts` (adiciona ao final do arquivo criado na Task 2)

**Interfaces:**
- Consumes: tudo da Task 2 (mesmo arquivo).
- Produces: `computeDuracaoPorEtapa`, `computeMovimentacaoPorEtapa`, `computeForecast`, `computeTempoResposta`, `computeEmBranco`, `NEGOCIO_REPORT_TYPES: ReportTypeDef[]`. `NEGOCIO_REPORT_TYPES` é consumido pela Task 5 (registry) e Task 6 (seed).

- [ ] **Step 1: Implementar as calculadoras que dependem de `deal.history`**

`deal.history` vem ordenado do mais novo pro mais antigo (`crm-transforms.ts`), com `description === "Etapa alterada"` e `subtext === "De {origem} para {destino}"` pras trocas de etapa.

```ts
// continuar em src/app/insights/report-types/negocio.ts

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
```

Adiciona `import type { ReportTypeDef } from "./types";` no topo do arquivo (junto dos imports já existentes da Task 2).

- [ ] **Step 2: Rodar build**

```bash
npm run build
```

Esperado: sem erros de tipo em `negocio.ts`.

- [ ] **Step 3: Verificação manual dos cálculos**

Abra `npm run dev`, no console do navegador (numa página qualquer autenticada) rode via um teste ad-hoc — ou confirme visualmente depois da Task 9 (viewer) que "Duração por Etapa" e "Movimentação por Etapa" produzem números plausíveis pra 1-2 negócios de teste que você mova de etapa manualmente no Kanban antes de checar o relatório.

- [ ] **Step 4: Commit**

```bash
git add src/app/insights/report-types/negocio.ts
git commit -m "feat(insights): calculadoras Duracao/Movimentacao por Etapa, Forecast, Tempo de Resposta, Em branco + registry Negocio"
```

---

### Task 4: Calculadoras de Atividade — Mix de Atividades, Atividades por Responsável

**Files:**
- Create: `src/app/insights/report-types/atividade.ts`

**Interfaces:**
- Consumes: `ReportComputeArgs`, `ReportComputeResult`, `ChartDatum`, `ReportTypeDef` (Task 1). Usa `args.deals` (já filtrados) pra derivar as `activities` (cada `Deal.activities: Activity[]`), já que não há fetch de atividades solto — vem embutido no deal.
- Produces: `computeMixAtividades`, `computeAtividadesPorResponsavel`, `ATIVIDADE_REPORT_TYPES: ReportTypeDef[]` — consumido pela Task 5 (registry) e Task 6 (seed).

- [ ] **Step 1: Implementar**

```ts
// src/app/insights/report-types/atividade.ts
import type { ReportComputeArgs, ReportComputeResult, ChartDatum, ReportTypeDef } from "./types";

function activitiesInPeriod(args: ReportComputeArgs) {
  // args.deals já vem filtrado por período (created_at do negócio via applyPeriodFilter
  // usando periodField="created_at" nas atividades é feito no page/viewer antes de chamar aqui —
  // aqui só flatten pros deals que sobraram do filtro)
  return args.deals.flatMap((d) => d.activities.map((a) => ({ ...a, dealId: d.id })));
}

export function computeMixAtividades(args: ReportComputeArgs): ReportComputeResult {
  const activities = activitiesInPeriod(args);
  const counts: Record<string, number> = {};
  activities.forEach((a) => {
    counts[a.type] = (counts[a.type] || 0) + 1;
  });
  const chartData: ChartDatum[] = [{ name: "Total", ...counts }];
  return { chartData, records: [] };
}

export function computeAtividadesPorResponsavel(args: ReportComputeArgs): ReportComputeResult {
  const activities = activitiesInPeriod(args);
  const byOwner: Record<string, { name: string; Concluídas: number; Pendentes: number }> = {};
  activities.forEach((a) => {
    const ownerName = args.ownerNameMap[a.assigneeId ?? ""] ?? "Sem responsável";
    if (!byOwner[ownerName]) byOwner[ownerName] = { name: ownerName, Concluídas: 0, Pendentes: 0 };
    if (a.completed) byOwner[ownerName].Concluídas += 1;
    else byOwner[ownerName].Pendentes += 1;
  });
  return { chartData: Object.values(byOwner) as unknown as ChartDatum[], records: [] };
}

export const ATIVIDADE_REPORT_TYPES: ReportTypeDef[] = [
  { key: "mix_atividades", label: "Mix de Atividades", description: "Distribuição das atividades por tipo", entity: "activity", defaultChartType: "stacked", compute: computeMixAtividades },
  { key: "atividades_por_responsavel", label: "Atividades por Responsável", description: "Atividades de cada membro do time", entity: "activity", defaultChartType: "stacked", compute: computeAtividadesPorResponsavel },
];
```

- [ ] **Step 2: Rodar build**

```bash
npm run build
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/insights/report-types/atividade.ts
git commit -m "feat(insights): calculadoras de Atividade (Mix, por Responsavel)"
```

---

### Task 5: Registry combinado

**Files:**
- Create: `src/app/insights/report-types/registry.ts`

**Interfaces:**
- Consumes: `NEGOCIO_REPORT_TYPES` (Task 3), `ATIVIDADE_REPORT_TYPES` (Task 4), `ReportTypeDef` (Task 1).
- Produces: `REPORT_TYPE_REGISTRY: Record<"deal"|"activity"|"contact"|"company", ReportTypeDef[]>`, `getReportType(entity, key): ReportTypeDef | undefined` — consumidos pelas Tasks 7 (rota /new) e 9 (viewer).

- [ ] **Step 1: Implementar**

```ts
// src/app/insights/report-types/registry.ts
import type { ReportTypeDef, ReportConfig } from "./types";
import { NEGOCIO_REPORT_TYPES } from "./negocio";
import { ATIVIDADE_REPORT_TYPES } from "./atividade";

const EM_BRANCO_GENERICO: ReportTypeDef = {
  key: "em_branco",
  label: "Em branco",
  description: "Comece do zero: escolha período, filtros, agrupamento e visualização",
  entity: "contact",
  defaultChartType: "table",
  compute: () => ({ chartData: [], records: [] }),
};

export const REPORT_TYPE_REGISTRY: Record<ReportConfig["entity"], ReportTypeDef[]> = {
  deal: NEGOCIO_REPORT_TYPES,
  activity: ATIVIDADE_REPORT_TYPES,
  contact: [{ ...EM_BRANCO_GENERICO, entity: "contact" }],
  company: [{ ...EM_BRANCO_GENERICO, entity: "company" }],
};

export function getReportType(entity: ReportConfig["entity"], key: string): ReportTypeDef | undefined {
  return REPORT_TYPE_REGISTRY[entity].find((t) => t.key === key) ?? REPORT_TYPE_REGISTRY[entity][0];
}

export const ENTITY_LABELS: Record<ReportConfig["entity"], string> = {
  deal: "Negócio",
  activity: "Atividade",
  contact: "Contato",
  company: "Empresa",
};
```

- [ ] **Step 2: Rodar build e commit**

```bash
npm run build
git add src/app/insights/report-types/registry.ts
git commit -m "feat(insights): registry combinado de tipos de relatorio"
```

---

### Task 6: Seed padrão (`buildDefaultReports`)

**Files:**
- Create: `src/app/insights/report-types/seed.ts`

**Interfaces:**
- Consumes: `Pipeline[]` de `@/lib/crm-types`, `SavedReport`/`COLORS` de `../insights-constants`.
- Produces: `buildDefaultReports(pipelines: Pipeline[]): SavedReport[]` — consumido pela Task 12 (`page.tsx`, botão "Criar relatórios padrão").

- [ ] **Step 1: Implementar**

```ts
// src/app/insights/report-types/seed.ts
import type { Pipeline } from "@/lib/crm-types";
import type { SavedReport } from "../insights-constants";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `rep_${Date.now()}_${counter}`;
}

function base(overrides: Partial<SavedReport>): SavedReport {
  return {
    id: nextId(),
    name: "Relatório",
    entity: "deal",
    reportType: "em_branco",
    chartType: "bar",
    color: "#3b82f6",
    pipeline: "",
    period: "Este mes",
    periodField: "created_at",
    filters: [],
    ...overrides,
  };
}

export function buildDefaultReports(pipelines: Pipeline[]): SavedReport[] {
  const reports: SavedReport[] = [];

  // 5 relatórios globais, sem filtro de funil
  reports.push(base({ name: "Ganhos vs Perdidos", reportType: "ganho_perda", chartType: "pie", color: "#ec4899", groupBy: "status" }));
  reports.push(base({ name: "Receita Mensal", reportType: "em_branco", chartType: "bar", color: "#3b82f6", period: "Este ano", periodField: "closed_at", measureBy: "value", groupBy: "closed_at", groupByGranularity: "month", filters: [{ field: "Status", operator: "é", value: "Ganho" }] }));
  reports.push(base({ name: "Negocios Criados por Dia", reportType: "em_branco", chartType: "bar", color: "#8b5cf6", groupBy: "created_at", groupByGranularity: "day" }));
  reports.push(base({ name: "Receita por Responsavel", reportType: "em_branco", chartType: "bar", color: "#22c55e", measureBy: "value", groupBy: "responsavel", filters: [{ field: "Status", operator: "é", value: "Ganho" }] }));
  reports.push(base({ name: "Negocios por Responsavel", reportType: "em_branco", chartType: "bar", color: "#f97316", groupBy: "responsavel" }));

  // por pipeline: 5 de Negócio + 2 de Atividade
  pipelines.forEach((p) => {
    reports.push(base({ name: "Funil de Conversao", reportType: "funil_conversao", chartType: "funnel", color: "#eab308", pipeline: p.name }));
    reports.push(base({ name: "Leads Ganhos", reportType: "em_branco", chartType: "number", color: "#22c55e", pipeline: p.name, filters: [{ field: "Status", operator: "é", value: "Ganho" }] }));
    reports.push(base({ name: "Reunioes Agendadas", reportType: "em_branco", chartType: "bar", color: "#3b82f6", pipeline: p.name, filters: [{ field: "Etapa", operator: "é", value: p.stages.find((s) => s.name.toLowerCase().includes("reuni"))?.name ?? "Reunião Agendada" }] }));
    reports.push(base({ name: "Novos Leads no Funil", reportType: "em_branco", chartType: "bar", color: "#ec4899", pipeline: p.name, filters: [{ field: "Etapa", operator: "é", value: p.stages[0]?.name ?? "Entrada de Leads" }] }));
    reports.push(base({ name: "Negocios Abertos por Etapa", reportType: "em_branco", chartType: "bar", color: "#8b5cf6", pipeline: p.name, groupBy: "etapa", periodField: "closed_at", filters: [{ field: "closed_at", operator: "está vazio", value: "" }] }));
    reports.push(base({ name: "Mix de Atividades", reportType: "mix_atividades", entity: "activity", chartType: "stacked", color: "#3b82f6", pipeline: p.name }));
    reports.push(base({ name: "Atividades por Responsavel", reportType: "atividades_por_responsavel", entity: "activity", chartType: "stacked", color: "#22c55e", pipeline: p.name }));
  });

  return reports;
}
```

- [ ] **Step 2: Rodar build e commit**

```bash
npm run build
git add src/app/insights/report-types/seed.ts
git commit -m "feat(insights): seed padrao gerado a partir dos pipelines do workspace"
```

---

### Task 7: `use-saved-reports.ts` — persistir campos novos

**Files:**
- Modify: `src/hooks/use-saved-reports.ts:9-30` (funções `toConfig`/`fromRow`)

**Interfaces:**
- Consumes: `SavedReport` (agora com os campos novos, Task 1 Step 3).
- Produces: nenhuma mudança de assinatura pública do hook — só o shape do jsonb persistido/lido muda.

- [ ] **Step 1: Substituir `toConfig`/`fromRow`**

```ts
function toConfig(r: SavedReport) {
  return {
    entity: r.entity,
    reportType: r.reportType,
    chartType: r.chartType,
    color: r.color,
    pipeline: r.pipeline,
    period: r.period,
    periodField: r.periodField,
    filters: r.filters,
    measureBy: r.measureBy,
    groupBy: r.groupBy,
    groupByGranularity: r.groupByGranularity,
    excludeStage: r.excludeStage,
  };
}

function fromRow(row: { id: string; name: string; config: unknown }): SavedReport {
  const config = (row.config ?? {}) as Partial<ReturnType<typeof toConfig>>;
  return {
    id: row.id,
    name: row.name,
    entity: config.entity || "deal",
    reportType: config.reportType || "em_branco",
    chartType: config.chartType || "bar",
    color: config.color || "#ec4899",
    pipeline: config.pipeline || "",
    period: config.period || "Este mes",
    periodField: config.periodField || "created_at",
    filters: config.filters || [],
    measureBy: config.measureBy,
    groupBy: config.groupBy,
    groupByGranularity: config.groupByGranularity,
    excludeStage: config.excludeStage,
  };
}
```

Isso troca as linhas 9-30 do arquivo atual (as duas funções já existentes) — o resto do hook (`useSavedReports`, `sync`, `deleteFromDb`, `useEffect` de carga) não muda.

- [ ] **Step 2: Rodar build**

```bash
npm run build
```

Esperado: sem erros — `SavedReport` já tem esses campos desde a Task 1.

- [ ] **Step 3: Verificação manual**

`npm run dev`, abrir `/insights`, confirmar no painel de rede do navegador que o `upsert` em `saved_reports` (aba Network, filtro "saved_reports") manda `config` com `entity`/`reportType` presentes.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-saved-reports.ts
git commit -m "feat(insights): persiste entity/reportType/measureBy/groupBy no saved_reports.config"
```

---

### Task 8: Sidebar e Dashboard — rotas reais + renomear painel

**Files:**
- Modify: `src/app/insights/insights-sidebar.tsx`
- Modify: `src/app/insights/dashboard-grid.tsx`

**Interfaces:**
- Consumes: nada novo — só troca `onClick`/estado por `next/link`.
- Produces: nenhuma mudança de props públicas dos componentes (ainda recebem `savedReports`, `activeReportId` etc. — a Task 12 é que muda quem os chama).

- [ ] **Step 1: `insights-sidebar.tsx` — item "Meu Painel" ganha renomear e vira `<Link>`**

No bloco de `dashboardPopulated` (linhas ~106-124 do arquivo atual), trocar o `<button onClick={() => onSelectReport(null)}>` por:

```tsx
import Link from "next/link";
// ...
{dashboardPopulated && (
  <div className="group relative">
    <Link
      href="/insights"
      className={cn(
        "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-colors font-medium text-left",
        activeReportId === null ? "bg-emerald-50 text-emerald-700" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
      )}
    >
      <LayoutDashboard className={cn("h-4 w-4 shrink-0", activeReportId === null ? "text-emerald-500" : "text-zinc-400")} />
      <span className="truncate flex-1 pr-11 font-semibold">Meu Painel</span>
    </Link>
    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
      <button onClick={onRenameDashboard} title="Renomear painel" className="p-1 rounded text-zinc-300 hover:text-blue-500 transition-all cursor-pointer">
        <Pencil className="h-3 w-3" />
      </button>
      <button onClick={onDeleteDashboard} title="Excluir painel" className="p-1 rounded text-zinc-300 hover:text-red-500 transition-all cursor-pointer">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  </div>
)}
```

Adicionar `onRenameDashboard: () => void;` na interface `InsightsSidebarProps` e na desestruturação dos props. O `page.tsx` (Task 12) implementa esse handler chamando `prompt()` ou reaproveitando o padrão de rename inline já usado nos relatórios — usar `prompt("Novo nome do painel:", "Meu Painel")` é suficiente pra essa fatia (sem persistência de nome do painel, já que só existe "Meu Painel" — o handler só precisa existir pra bater visualmente com o concorrente; deixar um `// TODO(painéis múltiplos): persistir nome` não se aplica aqui — implementar de fato: guardar o nome em `localStorage.setItem("insights_dashboard_name", novoNome)` e ler no `page.tsx`).

No bloco dos itens de relatório (linhas ~137-176), trocar o `<button onClick={() => onSelectReport(report.id)}>` por `<Link href={`/insights/reports/${report.id}`}>` com as mesmas classes.

- [ ] **Step 2: `dashboard-grid.tsx` — cards e empty-state viram `<Link>`**

No empty-state (linhas 49-55), trocar:

```tsx
<button onClick={onCreateReportZero} ...>Criar relatorio do zero</button>
```

por:

```tsx
<Link href="/insights/reports/new" className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
  <Plus className="h-4 w-4" />
  Criar relatorio do zero
</Link>
```

Nos 4 cards de gráfico (`onClick={() => onSelectByNameAndPipeline(...)}`), envolver o card num `<Link href={buildReportHref(name, pipeline)}>` — como os cards hoje resolvem por nome+pipeline (não por id), manter a prop `onSelectByNameAndPipeline` mas fazer ela navegar via `router.push` (recebe `router` como prop nova, ou mais simples: o `page.tsx`, que já tem os `savedReports` carregados, resolve o id e passa `hrefFor(name, pipeline): string` como prop pro `DashboardGrid` em vez de um handler de clique). Trocar a prop `onSelectByNameAndPipeline: (name, pipeline) => void` por `hrefFor: (name: string, pipeline: string) => string`, e cada card vira:

```tsx
<Link href={hrefFor("Funil de Conversao", "Prospecção")} className="group rounded-xl border border-zinc-200 bg-white overflow-hidden cursor-pointer hover:shadow-md transition-all block">
```

(mesmo conteúdo interno, só troca a tag raiz de `<div onClick=...>` pra `<Link href=...>` e remove o `onClick` do container — os botões internos como "Editar relatorio" continuam com `e.stopPropagation()` pra não conflitar com o Link).

- [ ] **Step 3: Rodar build**

```bash
npm run build
```

Esperado: erros de tipo em `page.tsx` (props mudaram) — normal, Task 12 corrige. Confirme que os erros são só em `page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/app/insights/insights-sidebar.tsx src/app/insights/dashboard-grid.tsx
git commit -m "feat(insights): sidebar e dashboard usam rotas reais (Link) em vez de estado"
```

---

### Task 9: Rota `/insights/reports/new` — modal de entidade + tipo

**Files:**
- Create: `src/app/insights/reports/new/page.tsx`

**Interfaces:**
- Consumes: `REPORT_TYPE_REGISTRY`, `ENTITY_LABELS` (Task 5), `useCrm()` (`@/contexts/crm-context`), `useSavedReports` (Task 7), `buildDefaultReports`'s `base()` pattern pra montar um `SavedReport` novo.
- Produces: cria um relatório em `saved_reports` e navega pra `/insights/reports/{id}` — nenhuma outra task consome esta página diretamente (é uma rota folha).

- [ ] **Step 1: Implementar**

```tsx
// src/app/insights/reports/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, DollarSign, Calendar, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { REPORT_TYPE_REGISTRY, ENTITY_LABELS } from "../../report-types/registry";
import type { ReportConfig } from "../../report-types/types";

const ENTITY_ICONS: Record<ReportConfig["entity"], typeof DollarSign> = {
  deal: DollarSign,
  activity: Calendar,
  contact: User,
  company: Building2,
};

export default function NewReportPage() {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [entity, setEntity] = useState<ReportConfig["entity"]>("deal");
  const [reportType, setReportType] = useState<string>(REPORT_TYPE_REGISTRY.deal[0].key);
  const [creating, setCreating] = useState(false);

  const types = REPORT_TYPE_REGISTRY[entity];

  const handleSelectEntity = (e: ReportConfig["entity"]) => {
    setEntity(e);
    setReportType(REPORT_TYPE_REGISTRY[e][0].key);
  };

  const handleContinue = async () => {
    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }
    const def = types.find((t) => t.key === reportType) ?? types[0];
    const config: ReportConfig = {
      entity, reportType,
      chartType: def.defaultChartType,
      color: "#ec4899", pipeline: "", period: "Este mes", periodField: "created_at", filters: [],
    };
    const { data, error } = await supabase
      .from("saved_reports")
      .insert({ user_id: user.id, workspace_id: workspaceId, name: def.label, config })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) return;
    router.push(`/insights/reports/${data.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => router.push("/insights")}>
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">Adicionar novo relatório</h2>
          <button onClick={() => router.push("/insights")} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-[220px_1fr] gap-0 max-h-[60vh]">
          <div className="border-r border-zinc-100 p-3 space-y-1 overflow-y-auto">
            <p className="px-2 pb-2 text-[10px] font-bold text-zinc-400 tracking-wider">ESCOLHER ENTIDADE</p>
            {(Object.keys(ENTITY_LABELS) as ReportConfig["entity"][]).map((e) => {
              const Icon = ENTITY_ICONS[e];
              return (
                <button
                  key={e}
                  onClick={() => handleSelectEntity(e)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors",
                    entity === e ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {ENTITY_LABELS[e]}
                </button>
              );
            })}
          </div>
          <div className="p-3 space-y-1 overflow-y-auto">
            <p className="px-2 pb-2 text-[10px] font-bold text-zinc-400 tracking-wider">ESCOLHER TIPO DE RELATORIO</p>
            {types.map((t) => (
              <button
                key={t.key}
                onClick={() => setReportType(t.key)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                  reportType === t.key ? "bg-zinc-100" : "hover:bg-zinc-50"
                )}
              >
                <div className="text-sm font-semibold text-zinc-800">{t.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-100">
          <button onClick={() => router.push("/insights")} className="px-4 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">
            Cancelar
          </button>
          <button onClick={handleContinue} disabled={creating} className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 disabled:opacity-50">
            {creating ? "Criando..." : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rodar build**

```bash
npm run build
```

Esperado: sem erros.

- [ ] **Step 3: Verificação manual**

`npm run dev`, ir em `/insights/reports/new`, trocar entidade, escolher um tipo de Negócio, clicar "Continuar", confirmar redirect pra `/insights/reports/{id}` (a página em si só existe na Task 10 — vai dar 404 até lá, é esperado).

- [ ] **Step 4: Commit**

```bash
git add src/app/insights/reports/new/page.tsx
git commit -m "feat(insights): rota /insights/reports/new com modal entidade+tipo"
```

---

### Task 10: Rota `/insights/reports/[id]` — viewer/editor

**Files:**
- Create: `src/app/insights/reports/[id]/report-viewer.tsx`
- Create: `src/app/insights/reports/[id]/page.tsx`

**Interfaces:**
- Consumes: `getReportType` (Task 5), `applyPeriodFilter`/`applyCustomFilters`/`FILTER_FIELDS_BY_ENTITY` (Task 1), `useCrm()`, `useOwnerNameMap()`, `useWorkspace()`, `SavedReport` (Task 1).
- Produces: página folha — nada mais consome isso.

- [ ] **Step 1: `report-viewer.tsx` — componente client com o relatório carregado**

Este componente recebe `reportId: string` via prop e é responsável por: carregar a linha de `saved_reports` (se não existir, `notFound()`), rodar a calculadora do `reportType`, desenhar os controles (Medir por / Ver por / granularidade / Excluir etapa), o gráfico (reaproveita os 6 branches de `editChartType` que já existem em `src/app/insights/page.tsx:1040-1141` — copiar esse bloco JSX quase sem mudança, só trocando `activeReportChartData`/`filteredDeals` pelas variáveis novas abaixo) e a tabela de Registros (reaproveita `src/app/insights/page.tsx:1145-1287`, trocando `sortedDeals` pela `records` do resultado da calculadora).

```tsx
// src/app/insights/reports/[id]/report-viewer.tsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Palette, Download, Trash2, BarChart2, Layers, GitBranchPlus, ChartPie, Table2, Hash, Plus, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { getReportType } from "../../report-types/registry";
import { applyPeriodFilter, applyCustomFilters, FILTER_FIELDS_BY_ENTITY } from "../../report-types/filters";
import { COLORS, type SavedReport, type ReportFilter } from "../../insights-constants";

const CHART_TYPE_BUTTONS = [
  { key: "bar" as const, label: "Barras", Icon: BarChart2 },
  { key: "stacked" as const, label: "Barras empilhadas", Icon: Layers },
  { key: "funnel" as const, label: "Funil de conversao", Icon: GitBranchPlus },
  { key: "pie" as const, label: "Pizza", Icon: ChartPie },
  { key: "table" as const, label: "Tabela", Icon: Table2 },
  { key: "number" as const, label: "Numero", Icon: Hash },
];

const GROUP_BY_OPTIONS = [
  { value: "none", label: "Sem agrupamento" },
  { value: "etapa", label: "Etapa" },
  { value: "responsavel", label: "Responsável" },
  { value: "status", label: "Status" },
  { value: "created_at", label: "Negócio criado em" },
  { value: "closed_at", label: "Negócio fechado em" },
];

export function ReportViewer({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { state } = useCrm();
  const { map: ownerNameMap, names: ownerNames } = useOwnerNameMap();
  const [report, setReport] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("saved_reports").select("id, name, config").eq("id", reportId).single().then(({ data, error }) => {
      setLoading(false);
      if (error || !data) { setNotFound(true); return; }
      const config = (data.config ?? {}) as Partial<SavedReport>;
      setReport({
        id: data.id, name: data.name,
        entity: config.entity || "deal", reportType: config.reportType || "em_branco",
        chartType: config.chartType || "bar", color: config.color || "#ec4899",
        pipeline: config.pipeline || "", period: config.period || "Este mes",
        periodField: config.periodField || "created_at", filters: config.filters || [],
        measureBy: config.measureBy, groupBy: config.groupBy,
        groupByGranularity: config.groupByGranularity, excludeStage: config.excludeStage,
      });
    });
  }, [reportId]);

  const persist = useCallback((next: SavedReport) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      createClient().from("saved_reports").update({
        name: next.name,
        config: {
          entity: next.entity, reportType: next.reportType, chartType: next.chartType, color: next.color,
          pipeline: next.pipeline, period: next.period, periodField: next.periodField, filters: next.filters,
          measureBy: next.measureBy, groupBy: next.groupBy, groupByGranularity: next.groupByGranularity,
          excludeStage: next.excludeStage,
        },
      }).eq("id", next.id).then(() => {});
    }, 500);
  }, []);

  const update = useCallback((patch: Partial<SavedReport>) => {
    setReport((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, [persist]);

  const pipeline = useMemo(() => {
    if (!report?.pipeline) return null;
    return state.pipelines.find((p) => p.name === report.pipeline) ?? null;
  }, [report?.pipeline, state.pipelines]);

  const stageNameById = useMemo(() => {
    const map: Record<string, string> = {};
    state.pipelines.forEach((p) => p.stages.forEach((s) => (map[s.id] = s.name)));
    return map;
  }, [state.pipelines]);

  const pipelineNameById = useMemo(() => {
    const map: Record<string, string> = {};
    state.pipelines.forEach((p) => (map[p.id] = p.name));
    return map;
  }, [state.pipelines]);

  const filteredDeals = useMemo(() => {
    if (!report) return [];
    let deals = report.pipeline ? state.deals.filter((d) => pipelineNameById[d.pipelineId] === report.pipeline) : state.deals;
    deals = applyPeriodFilter(deals, report.periodField, report.period);
    deals = applyCustomFilters(deals, report.filters, stageNameById, pipelineNameById, ownerNameMap);
    return deals;
  }, [report, state.deals, pipelineNameById, stageNameById, ownerNameMap]);

  const result = useMemo(() => {
    if (!report) return null;
    const def = getReportType(report.entity, report.reportType);
    if (!def) return null;
    return def.compute({ deals: filteredDeals, pipeline, pipelines: state.pipelines, ownerNameMap, config: report });
  }, [report, filteredDeals, pipeline, state.pipelines, ownerNameMap]);

  const handleDelete = async () => {
    await createClient().from("saved_reports").delete().eq("id", reportId);
    router.push("/insights");
  };

  const handleExportCSV = () => {
    if (!result) return;
    const headers = ["Titulo", "Valor", "Etapa", "Funil", "Responsavel", "Criado em", "Status"];
    const rows = result.records.map((r) => [r.title, `R$ ${r.value}`, r.stageName, r.pipelineName, r.ownerName, new Date(r.createdAt).toLocaleString("pt-BR"), r.status]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `${(report?.name ?? "relatorio").replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fieldOptions = report ? FILTER_FIELDS_BY_ENTITY[report.entity === "activity" ? "activity" : "deal"] : [];

  if (loading) return <div className="p-6 text-sm text-zinc-400">Carregando...</div>;
  if (notFound || !report) return <div className="p-6 text-sm text-zinc-400">Relatório não encontrado.</div>;

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 flex flex-col">
      <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/insights")} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <input
            value={report.name}
            onChange={(e) => update({ name: e.target.value })}
            className="text-lg font-semibold text-zinc-900 rounded px-1 -mx-1 border border-transparent hover:border-zinc-200 focus:border-emerald-500 outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {CHART_TYPE_BUTTONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                title={label}
                onClick={() => update({ chartType: key })}
                className={cn("p-2 rounded-lg transition-colors", report.chartType === key ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100")}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <ColorPicker color={report.color} onChange={(c) => update({ color: c })} />
          <button onClick={handleExportCSV} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button onClick={handleDelete} className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 border border-zinc-200">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4 flex-1 overflow-auto">
        <FiltersPanel report={report} fieldOptions={fieldOptions} ownerNames={ownerNames} pipelines={state.pipelines} onUpdate={update} />

        <div className="rounded-xl border border-zinc-200 bg-white p-6 overflow-hidden">
          <div className="mb-4 flex items-center justify-end gap-2 flex-wrap">
            {report.entity === "deal" && (
              <>
                <span className="text-sm text-zinc-500">Medir por</span>
                <select value={report.measureBy ?? "count"} onChange={(e) => update({ measureBy: e.target.value as "count" | "value" })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
                  <option value="count">Quantidade</option>
                  <option value="value">Valor (R$)</option>
                </select>
              </>
            )}
            <span className="text-sm text-zinc-500 ml-2">Ver por</span>
            <select value={report.groupBy ?? "none"} onChange={(e) => update({ groupBy: e.target.value })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
              {GROUP_BY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {(report.groupBy === "created_at" || report.groupBy === "closed_at") && (
              <select value={report.groupByGranularity ?? "month"} onChange={(e) => update({ groupByGranularity: e.target.value as "day" | "week" | "month" })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
                <option value="day">Por dia</option>
                <option value="week">Por semana</option>
                <option value="month">Por mês</option>
              </select>
            )}
            {report.reportType === "funil_conversao" && pipeline && (
              <>
                <span className="text-sm text-zinc-500 ml-2">Excluir etapa</span>
                <select value={report.excludeStage ?? ""} onChange={(e) => update({ excludeStage: e.target.value || undefined })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
                  <option value="">Nenhuma</option>
                  {pipeline.stages.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </>
            )}
          </div>
          {result?.extraMetric && (
            <div className="font-bold text-zinc-800 mb-2 text-sm">{result.extraMetric.label}: {result.extraMetric.value}</div>
          )}
          <ReportChart chartType={report.chartType} data={result?.chartData ?? []} color={report.color} />
        </div>

        <RecordsTable records={result?.records ?? []} onExport={handleExportCSV} />
      </div>
    </div>
  );
}

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
        <div className="h-4 w-4 rounded-full border border-zinc-200" style={{ backgroundColor: color }} />
        <Palette className="h-3.5 w-3.5 text-zinc-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 p-2 rounded-lg border border-zinc-200 bg-white shadow-lg z-50 grid grid-cols-4 gap-1.5 w-36">
          {COLORS.map((c) => (
            <button key={c.value} onClick={() => { onChange(c.value); setOpen(false); }} className={cn("h-6 w-6 rounded-full border", color === c.value ? "border-zinc-900 scale-105" : "border-zinc-200")} style={{ backgroundColor: c.value }} title={c.name} />
          ))}
        </div>
      )}
    </div>
  );
}

function FiltersPanel({ report, fieldOptions, ownerNames, pipelines, onUpdate }: {
  report: SavedReport;
  fieldOptions: { value: string; label: string; type: string }[];
  ownerNames: string[];
  pipelines: { name: string }[];
  onUpdate: (patch: Partial<SavedReport>) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [field, setField] = useState(fieldOptions[0]?.value ?? "Status");
  const [operator, setOperator] = useState("é");
  const [value, setValue] = useState("");

  const addFilter = () => {
    const next: ReportFilter = { field, operator, value };
    onUpdate({ filters: [...report.filters, next] });
    setShowAdd(false);
    setValue("");
  };

  const removeFilter = (idx: number) => {
    onUpdate({ filters: report.filters.filter((_, i) => i !== idx) });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">{report.entity === "activity" ? "ATIVIDADE" : "NEGOCIO"}</span>
        <select value={report.periodField} onChange={(e) => onUpdate({ periodField: e.target.value as "created_at" | "closed_at" })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
          <option value="created_at">{report.entity === "activity" ? "Data de criacao" : "Negocio criado em"}</option>
          {report.entity === "deal" && <option value="closed_at">Negocio fechado em</option>}
        </select>
        <span className="text-sm text-zinc-400">e</span>
        <select value={report.period} onChange={(e) => onUpdate({ period: e.target.value })} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm">
          {["Este mes", "Mes passado", "Este ano", "Ultimos 7 dias", "Ultimos 30 dias", "Todo o periodo"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {report.filters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {report.filters.map((f, idx) => (
            <div key={idx} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-700">
              <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-500">{report.entity === "activity" ? "ATIVIDADES" : "NEGOCIOS"}</span>
              <span className="font-semibold">{f.field}</span>
              <span className="text-zinc-400">{f.operator}</span>
              {f.value && <span className="font-semibold">{f.value}</span>}
              <button onClick={() => removeFilter(idx)} className="p-0.5 rounded hover:bg-zinc-200 text-zinc-400"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowAdd((v) => !v)} className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
        <Plus className="h-4 w-4" /> Adicionar filtro
      </button>
      {showAdd && (
        <div className="p-3 border border-zinc-200 rounded-lg bg-zinc-50 space-y-3 max-w-sm">
          <div className="grid grid-cols-3 gap-2">
            <select value={field} onChange={(e) => setField(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5">
              {fieldOptions.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select value={operator} onChange={(e) => setOperator(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5">
              {fieldOptions.find((f) => f.value === field)?.type === "date" ? (
                <>
                  <option value="está vazio">está vazio</option>
                  <option value="não está vazio">não está vazio</option>
                </>
              ) : fieldOptions.find((f) => f.value === field)?.type === "number" ? (
                <>
                  <option value="maior que">maior que</option>
                  <option value="menor que">menor que</option>
                  <option value="igual a">igual a</option>
                </>
              ) : (
                <option value="é">é</option>
              )}
            </select>
            {fieldOptions.find((f) => f.value === field)?.type === "date" ? (
              <div />
            ) : field === "Status" ? (
              <select value={value} onChange={(e) => setValue(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5">
                <option value="Ativo">Ativo</option><option value="Ganho">Ganho</option><option value="Perdido">Perdido</option>
              </select>
            ) : field === "Funil" ? (
              <select value={value} onChange={(e) => setValue(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5">
                {pipelines.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            ) : field === "Responsavel" ? (
              <select value={value} onChange={(e) => setValue(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5">
                {ownerNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : (
              <input value={value} onChange={(e) => setValue(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded p-1.5" />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-2 py-1 text-xs border border-zinc-200 rounded text-zinc-500">Cancelar</button>
            <button onClick={addFilter} className="px-2 py-1 text-xs bg-emerald-600 rounded text-white">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportChart({ chartType, data, color }: { chartType: SavedReport["chartType"]; data: { name: string; value: number }[]; color: string }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-48 text-sm text-zinc-400">Nenhum dado encontrado</div>;
  if (chartType === "number") {
    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <span className="text-sm font-medium text-zinc-500 uppercase">Total</span>
        <span className="text-7xl font-extrabold mt-2" style={{ color }}>{total}</span>
      </div>
    );
  }
  if (chartType === "pie") {
    return (
      <div style={{ width: "100%", height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
              {data.map((_, idx) => <Cell key={idx} fill={idx === 0 ? color : idx === 1 ? "#3b82f6" : "#22c55e"} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  if (chartType === "funnel") {
    return (
      <div style={{ width: "100%", height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 120, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
            <Tooltip /><Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip /><Legend />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecordsTable({ records, onExport }: { records: { id: string; title: string; value: number; stageName: string; pipelineName: string; ownerName: string; createdAt: string; status: string }[]; onExport: () => void }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Registros</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{records.length} registros</p>
        </div>
        <button onClick={onExport} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
          <Download className="h-3.5 w-3.5" /> Exportar
        </button>
      </div>
      <div className="overflow-auto max-h-[600px]">
        {records.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-zinc-400">Nenhum registro encontrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                {["Titulo", "Valor", "Etapa", "Funil", "Responsavel", "Criado em", "Status"].map((h) => (
                  <th key={h} className="text-left py-2.5 px-4 font-semibold text-zinc-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} onClick={() => { window.location.href = `/negocios/${r.id}`; }} className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer">
                  <td className="py-2.5 px-4 truncate max-w-[200px]">{r.title}</td>
                  <td className="py-2.5 px-4">R$&nbsp;{r.value.toLocaleString("pt-BR")}</td>
                  <td className="py-2.5 px-4">{r.stageName}</td>
                  <td className="py-2.5 px-4">{r.pipelineName}</td>
                  <td className="py-2.5 px-4">{r.ownerName}</td>
                  <td className="py-2.5 px-4">{new Date(r.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="py-2.5 px-4">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `page.tsx` — wrapper de rota**

```tsx
// src/app/insights/reports/[id]/page.tsx
import { ReportViewer } from "./report-viewer";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportViewer reportId={id} />;
}
```

Confira em `node_modules/next/dist/docs/` (per `AGENTS.md`) se essa versão do Next.js ainda espera `params` como `Promise` em Server Components — se a versão instalada usar `params` síncrono, ajustar a assinatura pra `{ params }: { params: { id: string } }` sem `await`.

- [ ] **Step 3: Rodar build**

```bash
npm run build
```

Esperado: sem erros. Corrija qualquer erro de tipo apontado (ex. import de ícone inexistente em `lucide-react` — confira `ChartPie`/`GitBranchPlus` existem na versão instalada; se não, usar `PieChart as ChartPie` e `GitBranch as GitBranchPlus` como alias).

- [ ] **Step 4: Verificação manual completa**

`npm run dev`: criar um relatório "Funil de Conversão" de Negócio via `/insights/reports/new`, confirmar que abre em `/insights/reports/{id}`, trocar período/filtros/Ver por, conferir que persiste (recarregar a página e ver se mantém), excluir uma etapa no funil, exportar CSV, excluir o relatório.

- [ ] **Step 5: Commit**

```bash
git add src/app/insights/reports/
git commit -m "feat(insights): rota /insights/reports/[id] com viewer completo (Medir por/Ver por/autosave)"
```

---

### Task 11: Limpar `page.tsx` — remove viewer antigo, liga seed novo, handler de renomear painel

**Files:**
- Modify: `src/app/insights/page.tsx`

**Interfaces:**
- Consumes: `buildDefaultReports` (Task 6), `hrefFor`/`onRenameDashboard` esperados por `dashboard-grid.tsx`/`insights-sidebar.tsx` (Task 8).
- Produces: nenhuma — é a página raiz.

- [ ] **Step 1: Reescrever `page.tsx`**

Remove todo o branch `activeReportId !== null` (linhas 642-1291 do arquivo atual — já extraído pra `report-viewer.tsx` na Task 10) e toda a lógica de edição de relatório único (`editReportName`, `editChartType`, `editColor`, `editFilters`, `filteredDeals`, `sortedDeals`, `handleSaveReport`, `handleDeleteActiveReport`, `handleExportCSV`, `activeReportChartData`, `activePieChartData` — linhas 51-70, 204-266, 401-517 do arquivo atual). Mantém: `useCrm`, `useOwnerNameMap`, `useSavedReports`, dropdowns de criar/data/usuário, `dynamicCounts`/`cardStats`/`funnelChartData`/`openStageChartData`/`activityOwnerChartData`/`mixActivityChartData` (cards do dashboard "Meu Painel" — continuam mockando o painel fixo "Prospecção", fora de escopo mexer nisso aqui).

```tsx
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { useSavedReports } from "@/hooks/use-saved-reports";
import { COLORS } from "./insights-constants";
import { buildDefaultReports } from "./report-types/seed";
import { DashboardGrid } from "./dashboard-grid";
import { InsightsSidebar } from "./insights-sidebar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Plus, ChevronDown, Search, PanelTop, LayoutDashboard, Trash2, FileText, Sparkles, Pencil, Maximize2, GripVertical, Settings, BarChart2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InsightsPage() {
  const { state } = useCrm();
  const { map: ownerNameMap, names: ownerNames, selfName: selfOwnerName } = useOwnerNameMap();

  const {
    savedReports, setSavedReports, dashboardPopulated, setDashboardPopulated,
    sync: syncReports, deleteFromDb: deleteReportSupabase,
  } = useSavedReports(() => {}); // relatório salvo não precisa mais setar activeReportId aqui

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingReportName, setEditingReportName] = useState("");
  const [dateLabel, setDateLabel] = useState("Este mes");
  const [userFilter, setUserFilter] = useState("Todos os usuarios");
  const [dashboardName, setDashboardName] = useState("Meu Painel");

  const createDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("insights_dashboard_name");
    if (stored) setDashboardName(stored);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) setShowCreateDropdown(false);
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) setShowDateDropdown(false);
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) setShowUserDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreateDefaultReports = () => {
    const reports = buildDefaultReports(state.pipelines);
    setSavedReports(reports);
    syncReports(reports);
    setDashboardPopulated(true);
    localStorage.setItem("insights_dashboard_populated", "true");
  };

  const handleCreateDashboard = () => {
    setDashboardPopulated(true);
    localStorage.setItem("insights_dashboard_populated", "true");
    setShowCreateDropdown(false);
  };

  const handleRenameDashboard = () => {
    const next = prompt("Novo nome do painel:", dashboardName);
    if (!next || !next.trim()) return;
    setDashboardName(next.trim());
    localStorage.setItem("insights_dashboard_name", next.trim());
  };

  const handleDeleteReport = (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const updated = savedReports.filter((r) => r.id !== id);
    setSavedReports(updated);
    deleteReportSupabase(id);
  };

  const handleDeleteDashboard = () => {
    setDashboardPopulated(false);
    localStorage.setItem("insights_dashboard_populated", "false");
  };

  const handleStartRename = (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setEditingReportId(id); setEditingReportName(name);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!editingReportName.trim()) return;
    const updated = savedReports.map((r) => (r.id === id ? { ...r, name: editingReportName } : r));
    setSavedReports(updated);
    setEditingReportId(null);
    syncReports(updated);
  };

  const filteredReports = useMemo(() => {
    if (!searchQuery) return savedReports;
    return savedReports.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [savedReports, searchQuery]);

  const hrefFor = (name: string, pipeline: string) => {
    const rep = savedReports.find((r) => r.name.toLowerCase().includes(name.toLowerCase()) && r.pipeline.toLowerCase().includes(pipeline.toLowerCase()));
    return rep ? `/insights/reports/${rep.id}` : "/insights/reports/new";
  };

  // ── cards fixos do painel "Meu Painel" (Prospecção) — mantidos como já existiam ──
  const prospeccaoPipeline = useMemo(() => state.pipelines.find((p) => p.name.toLowerCase().includes("prospec")) || state.pipelines[0], [state.pipelines]);
  const pipelineDeals = useMemo(() => (prospeccaoPipeline ? state.deals.filter((d) => d.pipelineId === prospeccaoPipeline.id) : []), [state.deals, prospeccaoPipeline]);
  const hasRealDeals = pipelineDeals.length > 0;
  const dynamicCounts = useMemo(() => {
    if (!prospeccaoPipeline) return { leads: 0, decisor: 0, reunioes: 0, ganhos: 0 };
    const firstStage = prospeccaoPipeline.stages[0];
    const decisorStage = prospeccaoPipeline.stages.find((s) => s.name.toLowerCase().includes("decisor"));
    const reuniaoStage = prospeccaoPipeline.stages.find((s) => s.name.toLowerCase().includes("reuni"));
    return {
      leads: pipelineDeals.filter((d) => d.stageId === firstStage?.id && d.status === "Ativo").length,
      decisor: decisorStage ? pipelineDeals.filter((d) => d.stageId === decisorStage.id && d.status === "Ativo").length : 0,
      reunioes: reuniaoStage ? pipelineDeals.filter((d) => d.stageId === reuniaoStage.id && d.status === "Ativo").length : 0,
      ganhos: pipelineDeals.filter((d) => d.status === "Ganho").length,
    };
  }, [prospeccaoPipeline, pipelineDeals]);
  const cardStats = hasRealDeals ? dynamicCounts : { leads: 0, decisor: 0, reunioes: 0, ganhos: 0 };
  const funnelChartData = useMemo(() => {
    if (!prospeccaoPipeline) return [];
    return prospeccaoPipeline.stages.map((s) => ({ name: s.name.length > 18 ? s.name.slice(0, 17) + "..." : s.name, value: pipelineDeals.filter((d) => d.stageId === s.id && d.status === "Ativo").length }));
  }, [prospeccaoPipeline, pipelineDeals]);
  const openStageChartData = useMemo(() => {
    if (!prospeccaoPipeline) return [];
    return prospeccaoPipeline.stages.map((s) => ({ name: s.name, value: pipelineDeals.filter((d) => d.stageId === s.id && d.status === "Ativo").length })).filter((d) => d.value > 0);
  }, [prospeccaoPipeline, pipelineDeals]);
  const activityOwnerChartData = useMemo(() => {
    const activities = pipelineDeals.flatMap((d) => d.activities);
    const completed = activities.filter((a) => a.completed).length;
    const pending = activities.filter((a) => !a.completed).length;
    return [{ name: selfOwnerName || "Sem dono", "Concluídas": completed, "Pendentes": pending }];
  }, [pipelineDeals, selfOwnerName]);
  const mixActivityChartData = useMemo(() => {
    const activities = pipelineDeals.flatMap((d) => d.activities);
    const counts: Record<string, number> = {};
    activities.forEach((a) => { counts[a.type] = (counts[a.type] || 0) + 1; });
    return [{ name: selfOwnerName || "Sem dono", ...counts }];
  }, [pipelineDeals, selfOwnerName]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-50">
      <InsightsSidebar
        createDropdownRef={createDropdownRef}
        showCreateDropdown={showCreateDropdown}
        onToggleCreateDropdown={() => setShowCreateDropdown((v) => !v)}
        onCloseCreateDropdown={() => setShowCreateDropdown(false)}
        onCreateReportZero={() => { window.location.href = "/insights/reports/new"; }}
        onCreateDashboard={handleCreateDashboard}
        onRenameDashboard={handleRenameDashboard}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dashboardPopulated={dashboardPopulated}
        activeReportId={null}
        onSelectReport={() => {}}
        onDeleteDashboard={handleDeleteDashboard}
        savedReports={savedReports}
        filteredReports={filteredReports}
        editingReportId={editingReportId}
        editingReportName={editingReportName}
        onEditingReportNameChange={setEditingReportName}
        onCancelRename={() => setEditingReportId(null)}
        onStartRename={handleStartRename}
        onSaveRename={handleSaveRename}
        onDeleteReport={handleDeleteReport}
        dashboardName={dashboardName}
      />
      <div className="flex-1 overflow-auto bg-zinc-50 flex flex-col">
        <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-semibold text-zinc-900">{dashboardName}</h1>
        </div>
        <div className="flex-1 overflow-auto">
          <DashboardGrid
            dashboardPopulated={dashboardPopulated}
            onCreateDefaultReports={handleCreateDefaultReports}
            onCreateReportZero={() => { window.location.href = "/insights/reports/new"; }}
            hrefFor={hrefFor}
            cardStats={cardStats}
            funnelChartData={funnelChartData}
            openStageChartData={openStageChartData}
            activityOwnerChartData={activityOwnerChartData}
            mixActivityChartData={mixActivityChartData}
          />
        </div>
      </div>
    </div>
  );
}
```

Adicionar `dashboardName: string` na interface `InsightsSidebarProps` (Task 8) e usar em vez do texto fixo "Meu Painel" no JSX do item da sidebar.

- [ ] **Step 2: Rodar build**

```bash
npm run build
```

Esperado: 0 erros de tipo em todo `src/app/insights/`.

- [ ] **Step 3: Verificação manual — fluxo completo**

`npm run dev`: `/insights` com painel vazio → "Criar relatórios padrão" → confirma que a sidebar lista N relatórios reais (link pra `/insights/reports/{id}` cada um) → clica em 2-3 diferentes e confirma que abrem com dados reais (ou "Nenhum dado encontrado" se não houver negócios no período) → renomeia "Meu Painel" → recarrega a página e confirma que o nome persistiu (localStorage).

- [ ] **Step 4: Commit**

```bash
git add src/app/insights/page.tsx src/app/insights/insights-sidebar.tsx
git commit -m "feat(insights): liga seed novo, remove viewer client-side antigo, renomear painel"
```

---

## Self-Review

**Cobertura da spec:**
- §1 (modelo de dado) → Task 1 Step 1, Task 7.
- §2 (rotas) → Task 9, Task 10.
- §3 (modal) → Task 9.
- §4 (8 tipos Negócio + 2 Atividade) → Tasks 2, 3, 4.
- §5 (viewer: autosave, badges, "está vazio", Medir por/Ver por/granularidade, Excluir etapa, ícones) → Task 10.
- §6 (renomear painel) → Task 8, Task 11.
- §7 (seed) → Task 6.
- §8 (fora de escopo) → nenhuma task toca Contato/Empresa completo, múltiplos Painéis, drag-reorder/resize de coluna, "Personalizar colunas", "Analisar com IA" — confirmado, nada nas tasks cobre isso.

**Placeholder scan:** nenhum "TBD"/"implementar depois" — o único ponto historicamente arriscado (rename do painel) foi resolvido com implementação real via `localStorage`, não deixado como TODO.

**Consistência de tipos:** `ReportConfig`/`SavedReport` (Task 1) usados sem divergência em `filters.ts`, `negocio.ts`, `atividade.ts`, `registry.ts`, `seed.ts`, `use-saved-reports.ts`, `report-viewer.tsx`, `page.tsx`/`new/page.tsx` — todos importam do mesmo `report-types/types.ts`. `getReportType(entity, key)` chamado com a mesma assinatura em `report-viewer.tsx`. `hrefFor`/`onRenameDashboard`/`dashboardName` — props novas introduzidas na Task 8/11 batem entre `page.tsx` (quem chama) e `dashboard-grid.tsx`/`insights-sidebar.tsx` (quem declara a interface).
