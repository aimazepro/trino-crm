// Normalizacao e classificacao de numero brasileiro.
//
// A classificacao decide a tarifa, entao errar aqui e errar a cobranca:
// celular custa varias vezes o preco de um fixo.

import type { DestinationType } from "./types";

/**
 * Converte para E.164 assumindo Brasil quando o numero vem sem pais.
 * Devolve null se nao restar um numero discavel.
 */
export function toE164BR(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;

  // Ja veio com o 55 na frente e comprimento de numero nacional completo.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  // DDD + numero (10 ou 11 digitos).
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  // 0800 e afins: nao levam DDI.
  if (digits.length === 11 && digits.startsWith("0800")) return digits;
  if (digits.startsWith("0800") || digits.startsWith("0300")) return digits;
  // Internacional ja discavel.
  if (digits.length > 13) return `+${digits}`;

  return null;
}

/** Somente o nacional (DDD + assinante), sem +55. */
function nationalPart(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return digits.startsWith("55") ? digits.slice(2) : digits;
}

export function classifyDestination(e164: string | null): DestinationType {
  if (!e164) return "mobile";

  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("0800") || digits.startsWith("0300")) return "tollfree";
  if (!digits.startsWith("55")) return "international";

  const national = nationalPart(e164);
  const subscriber = national.slice(2); // tira o DDD

  // Celular no Brasil: 9 digitos comecando em 9 (ou 6-9 em numeracao antiga).
  if (subscriber.length === 9) return "mobile";
  if (subscriber.length === 8) {
    return /^[6-9]/.test(subscriber) ? "mobile" : "landline";
  }
  return "mobile";
}

/** (11) 98765-4321 */
export function formatBR(e164: string | null): string {
  if (!e164) return "";
  const national = nationalPart(e164);
  if (national.length === 11) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  }
  if (national.length === 10) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }
  return e164;
}

/** DDD do destino, para escolher a bina mais proxima quando houver pool. */
export function areaCodeOf(e164: string | null): string | null {
  if (!e164) return null;
  const national = nationalPart(e164);
  return national.length >= 10 ? national.slice(0, 2) : null;
}
