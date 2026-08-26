// Adapter de analise de ligacao.
//
// Mesma ideia da camada de operadora: a rota nao sabe qual IA respondeu. Trocar
// de provedor e mudar CALL_ANALYSIS_PROVIDER -- o formato salvo no banco e a
// tela nao mudam.

import { analyzeWithGemini, geminiConfigured } from "./gemini";
import { analyzeWithClaude, claudeConfigured } from "./claude";
import type { Analysis, AnalysisInput } from "./prompt";

export type AnalysisProviderName = "gemini" | "claude";

export interface AnalysisProviderStatus {
  provider: AnalysisProviderName | null;
  configured: boolean;
  /** O que falta, em português, para a UI mostrar sem adivinhação. */
  missing: string | null;
}

/**
 * Escolha explicita por env quando houver; senao, o primeiro que estiver
 * configurado. Explicito ganha para que ter as duas chaves no ambiente nao
 * decida por sorteio quem responde (e quem cobra).
 */
export function resolveAnalysisProvider(): AnalysisProviderStatus {
  const requested = (process.env.CALL_ANALYSIS_PROVIDER ?? "").toLowerCase();

  if (requested === "gemini") {
    return geminiConfigured()
      ? { provider: "gemini", configured: true, missing: null }
      : {
          provider: "gemini",
          configured: false,
          missing: "Defina GEMINI_API_KEY nas variáveis de ambiente.",
        };
  }
  if (requested === "claude" || requested === "anthropic") {
    return claudeConfigured()
      ? { provider: "claude", configured: true, missing: null }
      : {
          provider: "claude",
          configured: false,
          missing: "Defina ANTHROPIC_API_KEY nas variáveis de ambiente.",
        };
  }

  if (geminiConfigured()) return { provider: "gemini", configured: true, missing: null };
  if (claudeConfigured()) return { provider: "claude", configured: true, missing: null };

  return {
    provider: null,
    configured: false,
    missing:
      "Nenhuma IA configurada. Defina GEMINI_API_KEY (ou ANTHROPIC_API_KEY) nas variáveis de ambiente.",
  };
}

export async function analyzeCall(
  input: AnalysisInput,
): Promise<{ analysis: Analysis; provider: AnalysisProviderName }> {
  const { provider, configured, missing } = resolveAnalysisProvider();
  if (!provider || !configured) {
    throw new Error(missing ?? "Análise por IA não configurada.");
  }

  const analysis =
    provider === "gemini" ? await analyzeWithGemini(input) : await analyzeWithClaude(input);

  return { analysis, provider };
}

export type { Analysis, AnalysisInput };
