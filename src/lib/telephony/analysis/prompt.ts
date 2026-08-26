// Prompt e contrato de saida da analise de ligacao.
//
// Compartilhado entre provedores de IA de proposito: trocar Gemini por Claude
// nao pode mudar o formato do que fica salvo no banco, senao a UI passa a
// renderizar duas formas diferentes do mesmo campo.

import { z } from "zod";

export const AnalysisSchema = z.object({
  resumo: z.string(),
  pontos_chave: z.array(z.string()),
  objecoes: z.array(z.string()),
  proximos_passos: z.array(z.string()),
  sentimento: z.enum(["positivo", "neutro", "negativo"]),
  qualidade: z.number().min(0).max(10),
  observacao_coach: z.string(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

/** Mesmo contrato em JSON Schema, para provedores que pedem nesse formato. */
export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    resumo: { type: "string" },
    pontos_chave: { type: "array", items: { type: "string" } },
    objecoes: { type: "array", items: { type: "string" } },
    proximos_passos: { type: "array", items: { type: "string" } },
    sentimento: { type: "string", enum: ["positivo", "neutro", "negativo"] },
    qualidade: { type: "number" },
    observacao_coach: { type: "string" },
  },
  required: [
    "resumo",
    "pontos_chave",
    "objecoes",
    "proximos_passos",
    "sentimento",
    "qualidade",
    "observacao_coach",
  ],
} as const;

export const SYSTEM_PROMPT = `Você analisa ligações de vendas B2B em português do Brasil para um CRM.

Receba a transcrição (quando houver), as notas do vendedor e o resultado da chamada.
Produza uma análise curta e útil para o vendedor e o gestor.

Regras:
- Escreva em português do Brasil, direto, sem elogio vazio.
- Se a ligação for curta ou não tiver conteúdo, diga isso claramente em vez de inventar substância.
- Liste apenas objeções que realmente apareceram. Se não houve nenhuma, devolva lista vazia.
- "qualidade" é uma nota de 0 a 10 para a condução da ligação pelo vendedor. Se não houver
  material suficiente para julgar, use 0 e diga isso na observação.
- "observacao_coach" é uma frase de feedback acionável para o vendedor.
- Responda apenas com o JSON no formato pedido, sem texto em volta.`;

export interface AnalysisInput {
  contactName: string | null;
  toNumber: string;
  durationSeconds: number;
  disposition: string | null;
  notes: string;
  transcript: string;
}

export function buildBriefing(input: AnalysisInput): string {
  return [
    `Contato: ${input.contactName ?? "não identificado"} (${input.toNumber})`,
    `Duração: ${input.durationSeconds}s`,
    `Resultado marcado pelo vendedor: ${input.disposition ?? "não classificado"}`,
    input.notes ? `\nNotas do vendedor:\n${input.notes}` : "",
    input.transcript
      ? `\nTranscrição:\n${input.transcript}`
      : "\n(Sem transcrição desta ligação.)",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Modelo de IA pode devolver JSON dentro de cerca de markdown mesmo com saida
 * estruturada pedida. Melhor limpar aqui do que descobrir em producao.
 */
export function parseAnalysis(raw: string): Analysis {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return AnalysisSchema.parse(JSON.parse(cleaned));
}
