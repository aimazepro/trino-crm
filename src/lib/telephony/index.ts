// Registro de provedores.
//
// Todo o resto do sistema pede o provedor por nome e recebe a interface. Trocar
// de operadora = adicionar um arquivo aqui e mudar telephony_accounts.provider.

import type { ProviderName, TelephonyProvider } from "./types";
import { mockProvider } from "./providers/mock";
import { api4comProvider } from "./providers/api4com";

const PROVIDERS: Record<ProviderName, TelephonyProvider> = {
  mock: mockProvider,
  api4com: api4comProvider,
};

export function getProvider(name: string): TelephonyProvider {
  const p = PROVIDERS[name as ProviderName];
  if (!p) throw new Error(`provedor de telefonia desconhecido: ${name}`);
  return p;
}

export function providerExists(name: string): boolean {
  return name in PROVIDERS;
}

export * from "./types";
