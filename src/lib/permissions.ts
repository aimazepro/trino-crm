// Sem "use client" de propósito, igual a src/lib/workspace-context.ts: este
// mapa é a mesma verdade nos dois lados. O gate de cliente esconde, o de
// servidor (RLS ou rota) recusa -- esconder botão não é permissão, é sugestão,
// e foi assim que o QR do WhatsApp vazou nesta branch.

import type { Role } from "@/lib/workspace-context";

/**
 * O que uma pessoa pode fazer, por papel. Um lugar só, para não virar um gate
 * solto por tela.
 *
 * Toda capacidade aqui tem uma recusa correspondente no banco -- conferido em
 * produção com uma varredura só em pg_policy antes de escrever qualquer coisa
 * (ver o cabeçalho de cada bloco). Nenhuma precisou de migration: a RLS destas
 * tabelas já exigia is_ws_manager() para insert/update/delete desde a
 * multitenancy. O que faltava era a tela concordar com o banco.
 *
 * A coluna `workspace_members.permissions` existe no banco e continua ignorada.
 * Quando ela for usada, é este mapa que vira o padrão por papel e ela vira a
 * exceção por pessoa -- não o contrário.
 */
export type Capability =
  | "gerenciar_automacoes"
  | "gerenciar_campos"
  | "gerenciar_produtos"
  | "gerenciar_motivos_perda"
  | "gerenciar_motivos_exclusao"
  | "gerenciar_tipos_atividade"
  | "mesclar_duplicatas"
  | "gerenciar_sequencias"
  | "gerenciar_metas";

const CAPABILITIES: Record<Capability, readonly Role[]> = {
  // A RLS de `automations`, `automation_labels` e `sequences` já exige
  // is_ws_manager() para insert/update/delete -- confirmado em produção, um
  // insert como vendedor volta 42501. Este mapa existe para a tela concordar
  // com o banco, não para substituí-lo.
  gerenciar_automacoes: ["admin", "gerente"],

  // `custom_fields` e `custom_field_groups`: insert/update/delete exigem
  // is_ws_manager(). Tela inteira fechada para vendedor.
  gerenciar_campos: ["admin", "gerente"],

  // `products`: select é do workspace inteiro, insert/update/delete exigem
  // is_ws_manager(). Por isso produtos é o único caso de "só leitura" e não de
  // "sem acesso" -- o vendedor precisa ver o catálogo para montar um negócio.
  // Aqui o <RequireCapability> não serve na tela inteira: gateia os botões.
  gerenciar_produtos: ["admin", "gerente"],

  // `loss_reasons`: insert/update/delete exigem is_ws_manager(). O vendedor
  // continua *escolhendo* um motivo ao perder um negócio (o modal lê a tabela,
  // select é liberado) -- o que ele não faz é editar a lista.
  gerenciar_motivos_perda: ["admin", "gerente"],

  // `delete_reasons`: idem loss_reasons.
  gerenciar_motivos_exclusao: ["admin", "gerente"],

  // `activity_types`: insert/update/delete exigem is_ws_manager().
  gerenciar_tipos_atividade: ["admin", "gerente"],

  // Duplicatas não tem tabela própria: a tela lê contatos/empresas e a mescla
  // termina em `deleteContact`/`deleteCompany`. O delete de `contacts` e
  // `companies` exige is_ws_manager() (o update não exige, de propósito --
  // vendedor edita contato em outras telas). Sem este gate o vendedor mescla
  // pela metade: os dados se juntam e a duplicata continua lá.
  mesclar_duplicatas: ["admin", "gerente"],

  // `sequences` e `sequence_steps`: insert/update/delete exigem
  // is_ws_manager() (em sequence_steps via EXISTS na sequência dona).
  gerenciar_sequencias: ["admin", "gerente"],

  // `goals`: select é do workspace inteiro, insert/update/delete exigem
  // is_ws_manager() -- a mesma forma de `products`, e por isso o gate também é
  // nos botões e não na tela: o vendedor precisa *ver* a meta que mede o
  // trabalho dele. Esta capacidade nasceu do P5: a varredura do P2 cobriu oito
  // tabelas e passou por Metas, então a tela oferecia o assistente inteiro para
  // o vendedor e o insert voltava 403 sem dizer nada.
  gerenciar_metas: ["admin", "gerente"],
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[capability].includes(role);
}
