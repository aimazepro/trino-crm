import type { Deal, LeadStatus } from "@/lib/crm-types";

/**
 * Um predicado só para responder "quais negócios esta tela está mostrando".
 *
 * Antes disso, cada lugar que conta ou soma negócios tinha o seu próprio
 * filtro: os cards do kanban, o somatório do cabeçalho e as contagens do
 * dropdown de pipeline. Eles discordavam -- os cards respeitavam o filtro por
 * vendedor, o cabeçalho e o dropdown não. Filtrando por uma pessoa, a tela
 * mostrava os cards dela e o total do time inteiro.
 *
 * Um agregado que discorda da lista que ele resume é pior que agregado nenhum,
 * porque parece certo. Por isso o predicado mora aqui, num lugar só: incluir um
 * novo filtro na tela obriga a passar por esta função, e não tem como um dos
 * lados ficar para trás.
 */
export interface DealScope {
  pipelineId?: string;
  stageId?: string;
  status?: LeadStatus;
  /** null ou undefined = todos os vendedores. */
  ownerId?: string | null;
}

export function matchesDealScope(deal: Deal, scope: DealScope): boolean {
  if (deal.deletedAt) return false;
  if (scope.pipelineId && deal.pipelineId !== scope.pipelineId) return false;
  if (scope.stageId && deal.stageId !== scope.stageId) return false;
  if (scope.status && deal.status !== scope.status) return false;
  // Comparar por id, nunca por nome -- padrão da casa.
  if (scope.ownerId && deal.ownerId !== scope.ownerId) return false;
  return true;
}

export function scopedDeals(deals: Deal[], scope: DealScope): Deal[] {
  return deals.filter((d) => matchesDealScope(d, scope));
}

export function sumDealValues(deals: Deal[]): number {
  return deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
}
