// Sem "use client" de propósito, igual a src/lib/workspace-context.ts: este
// mapa é a mesma verdade nos dois lados. O gate de cliente esconde, o de
// servidor (RLS ou rota) recusa -- esconder botão não é permissão, é sugestão,
// e foi assim que o QR do WhatsApp vazou nesta branch.

import type { Role } from "@/lib/workspace-context";

/**
 * O que uma pessoa pode fazer, por papel. Um lugar só, para não virar um gate
 * solto por tela: hoje é uma capacidade, a matriz completa (campos, produtos,
 * motivos, tipos de atividade, duplicatas, sequências) entra aqui do mesmo
 * jeito, sem inventar um segundo mecanismo.
 *
 * A coluna `workspace_members.permissions` existe no banco e continua ignorada.
 * Quando ela for usada, é este mapa que vira o padrão por papel e ela vira a
 * exceção por pessoa -- não o contrário.
 */
export type Capability = "gerenciar_automacoes";

const CAPABILITIES: Record<Capability, readonly Role[]> = {
  // A RLS de `automations`, `automation_labels` e `sequences` já exige
  // is_ws_manager() para insert/update/delete -- confirmado em produção, um
  // insert como vendedor volta 42501. Este mapa existe para a tela concordar
  // com o banco, não para substituí-lo.
  gerenciar_automacoes: ["admin", "gerente"],
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[capability].includes(role);
}
