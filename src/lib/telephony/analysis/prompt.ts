// Prompt e contrato de saida da analise de ligacao.
//
// Compartilhado entre provedores de IA de proposito: trocar Gemini por Claude
// nao pode mudar o formato do que fica salvo no banco, senao a UI passa a
// renderizar duas formas diferentes do mesmo campo.
//
// A analise e de venda consultiva: alem do resumo, ela avalia a QUALIFICACAO
// (BANT) e a TECNICA (SPIN) e devolve nota com evidencia. Cada campo pede a
// frase que sustenta a conclusao -- sem isso o modelo produz elogio generico,
// que e pior que analise nenhuma porque parece util.

import { z } from "zod";

const StatusQualificacao = z.enum(["confirmado", "parcial", "nao_explorado"]);

const ItemBant = z.object({
  status: StatusQualificacao,
  evidencia: z.string(),
});

const ItemSpin = z.object({
  aplicado: z.boolean(),
  comentario: z.string(),
});

export const AnalysisSchema = z.object({
  tipo_ligacao: z.enum(["cold_call", "follow_up", "fechamento", "outro"]),
  resumo: z.string(),
  pontos_chave: z.array(z.string()),
  dores: z.array(z.string()),
  desejos: z.array(z.string()),
  objecoes: z.array(z.string()),
  proximos_passos: z.array(z.string()),
  bant: z.object({
    orcamento: ItemBant,
    autoridade: ItemBant,
    necessidade: ItemBant,
    prazo: ItemBant,
  }),
  spin: z.object({
    situacao: ItemSpin,
    problema: ItemSpin,
    implicacao: ItemSpin,
    necessidade: ItemSpin,
  }),
  pontos_fortes: z.array(z.string()),
  pontos_de_melhoria: z.array(z.string()),
  sentimento: z.enum(["positivo", "neutro", "negativo"]),
  nota_qualificacao: z.number().min(0).max(10),
  nota_conducao: z.number().min(0).max(10),
  observacao_coach: z.string(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

const bantField = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["confirmado", "parcial", "nao_explorado"] },
    evidencia: { type: "string" },
  },
  required: ["status", "evidencia"],
};

const spinField = {
  type: "object",
  properties: {
    aplicado: { type: "boolean" },
    comentario: { type: "string" },
  },
  required: ["aplicado", "comentario"],
};

const listaDeTexto = { type: "array", items: { type: "string" } };

/** Mesmo contrato em JSON Schema, para provedores que pedem nesse formato. */
export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    tipo_ligacao: { type: "string", enum: ["cold_call", "follow_up", "fechamento", "outro"] },
    resumo: { type: "string" },
    pontos_chave: listaDeTexto,
    dores: listaDeTexto,
    desejos: listaDeTexto,
    objecoes: listaDeTexto,
    proximos_passos: listaDeTexto,
    bant: {
      type: "object",
      properties: {
        orcamento: bantField,
        autoridade: bantField,
        necessidade: bantField,
        prazo: bantField,
      },
      required: ["orcamento", "autoridade", "necessidade", "prazo"],
    },
    spin: {
      type: "object",
      properties: {
        situacao: spinField,
        problema: spinField,
        implicacao: spinField,
        necessidade: spinField,
      },
      required: ["situacao", "problema", "implicacao", "necessidade"],
    },
    pontos_fortes: listaDeTexto,
    pontos_de_melhoria: listaDeTexto,
    sentimento: { type: "string", enum: ["positivo", "neutro", "negativo"] },
    nota_qualificacao: { type: "number" },
    nota_conducao: { type: "number" },
    observacao_coach: { type: "string" },
  },
  required: [
    "tipo_ligacao",
    "resumo",
    "pontos_chave",
    "dores",
    "desejos",
    "objecoes",
    "proximos_passos",
    "bant",
    "spin",
    "pontos_fortes",
    "pontos_de_melhoria",
    "sentimento",
    "nota_qualificacao",
    "nota_conducao",
    "observacao_coach",
  ],
} as const;

export const SYSTEM_PROMPT = `Você é gerente de vendas B2B e analisa ligações da sua equipe em português do Brasil.
Escreve para duas pessoas: o vendedor que fez a ligação e o gestor que vai decidir o que fazer com aquele negócio.

## Como julgar

Primeiro classifique o tipo da ligação e ajuste o critério a ele:

- **cold_call** — primeiro contato, o prospect não pediu para ser abordado. O que importa: quebrar a
  resistência inicial, conquistar permissão para continuar, descobrir dor real e conseguir um próximo
  passo agendado. NÃO penalize por não ter falado de preço ou fechamento — não é a hora.
- **follow_up** — retomada de uma conversa que já existia. O que importa: retomar o contexto sem
  obrigar o cliente a repetir tudo, avançar a qualificação que ficou aberta, tratar a objeção que
  travou da última vez e marcar o passo seguinte.
- **fechamento** — negociação. O que importa: tratar objeção de preço e risco, confirmar decisor e
  prazo, e pedir a decisão com clareza.
- **outro** — quando não se encaixa acima (suporte, cobrança, engano).

## BANT

Para orçamento, autoridade, necessidade e prazo, diga o status e **cite a evidência**: a frase ou o
trecho que sustenta a conclusão. Sem evidência na conversa, o status é "nao_explorado" e a evidência
explica o que faltou perguntar. Não invente evidência — se não foi dito, não foi dito.

## SPIN

Avalie se o VENDEDOR aplicou cada etapa: perguntas de Situação, de Problema, de Implicação e de
Necessidade de solução. "aplicado" é sobre o que o vendedor fez, não sobre o que o cliente falou.
O comentário aponta a pergunta que ele fez, ou a que faltou fazer.

## Notas

- nota_qualificacao (0-10): quanto deste negócio está realmente qualificado depois desta ligação.
- nota_conducao (0-10): quão bem o vendedor conduziu a conversa, dado o TIPO de ligação.

## Regras que não se quebram

- Português do Brasil, direto, sem elogio vazio e sem jargão de consultoria.
- Ligação curta, muda ou sem conteúdo: diga isso, use notas baixas e listas vazias. Inventar
  substância para preencher campo é o pior resultado possível — parece útil e não é.
- Só liste dor, desejo e objeção que apareceram de verdade na conversa.
- proximos_passos são ações do vendedor, concretas e com prazo quando ele foi combinado.
- pontos_de_melhoria falam do comportamento do vendedor, não do cliente.
- observacao_coach: uma frase, acionável, o que treinar na próxima ligação.
- Responda apenas com o JSON no formato pedido, sem texto em volta.`;

export interface AnalysisInput {
  contactName: string | null;
  companyName?: string | null;
  dealTitle?: string | null;
  toNumber: string;
  durationSeconds: number;
  disposition: string | null;
  notes: string;
  transcript: string;
  /** Ligações anteriores com o mesmo contato — é o que separa cold call de follow-up. */
  previousCalls?: number;
  scriptName?: string | null;
}

export function buildBriefing(input: AnalysisInput): string {
  const linhas = [
    `Contato: ${input.contactName ?? "não identificado"} (${input.toNumber})`,
    input.companyName ? `Empresa: ${input.companyName}` : "",
    input.dealTitle ? `Negócio: ${input.dealTitle}` : "",
    `Duração: ${input.durationSeconds}s`,
    `Resultado marcado pelo vendedor: ${input.disposition ?? "não classificado"}`,
    typeof input.previousCalls === "number"
      ? `Ligações anteriores para este contato: ${input.previousCalls}` +
        (input.previousCalls === 0 ? " (primeiro contato)" : "")
      : "",
    input.scriptName ? `Script usado: ${input.scriptName}` : "",
    input.notes ? `\nNotas do vendedor:\n${input.notes}` : "",
    input.transcript
      ? `\nTranscrição:\n${input.transcript}`
      : "\n(Sem transcrição desta ligação. Analise a partir das notas e diga na observação que a ausência de transcrição limita a análise.)",
  ];

  return linhas.filter(Boolean).join("\n");
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
