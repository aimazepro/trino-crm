//
// Lógica pura de "isso é um admin da plataforma" — sem tocar em cookie,
// banco ou Next. Fica separado de platform-admin-server.ts de propósito:
// esse outro arquivo importa next/headers, e qualquer coisa que o importe
// vira server-only. Aqui não, então dá pra testar com `node --test` puro e
// reusar (se um dia precisar) em contexto nenhum específico do Next.

import { timingSafeEqual } from "crypto";

/**
 * True se `email` está na allowlist separada por vírgula, sem diferenciar
 * maiúscula/minúscula nem espaço em volta.
 */
export function matchesAdminAllowlist(
  email: string | null | undefined,
  allowlistCsv: string | undefined
): boolean {
  if (!email || !allowlistCsv) return false;
  const normalized = email.trim().toLowerCase();
  return allowlistCsv
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

/** Comparação em tempo constante -- um Bearer errado não deve vazar quanto do
 * token acertou por diferença de tempo de resposta. */
export function tokenMatches(
  provided: string | null | undefined,
  expected: string | undefined
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Papel do operador da plataforma. Espelha o check da coluna
 * platform_admins.role -- mudou aqui, muda a migração junto. */
export type PlatformRole = "owner" | "support" | "billing";

export const PLATFORM_ROLES: readonly PlatformRole[] = ["owner", "support", "billing"];

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === "string" && (PLATFORM_ROLES as readonly string[]).includes(value);
}

/**
 * O que cada papel pode fazer. Habilidade, não rota: a mesma habilidade é
 * checada no servidor (Route Handler) e usada pela UI pra esconder botão --
 * mas esconder não autoriza nada, a checagem do servidor é a de verdade.
 *
 * read_aggregates  -> dashboard, números somados, sem dado de cliente
 * read_customer_data -> lista de contas, membros, detalhe, auditoria
 * block            -> suspender workspace, bloquear conta, feature flags
 * billing          -> plano, trial, colunas de cobrança
 * impersonate      -> entrar como cliente
 * manage_operators -> mexer em platform_admins
 * hard_delete      -> remoção definitiva (§8.3 do spec)
 */
export type PlatformAbility =
  | "read_aggregates"
  | "read_customer_data"
  | "block"
  | "billing"
  | "impersonate"
  | "manage_operators"
  | "hard_delete";

const ROLE_ABILITIES: Record<PlatformRole, readonly PlatformAbility[]> = {
  owner: [
    "read_aggregates",
    "read_customer_data",
    "block",
    "billing",
    "impersonate",
    "manage_operators",
    "hard_delete",
  ],
  support: ["read_aggregates", "read_customer_data", "block", "impersonate"],
  // billing enxerga agregado (dashboard), não dado de cliente.
  billing: ["read_aggregates", "billing"],
};

export function can(role: PlatformRole, ability: PlatformAbility): boolean {
  return ROLE_ABILITIES[role].includes(ability);
}
