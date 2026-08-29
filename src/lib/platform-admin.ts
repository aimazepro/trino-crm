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
