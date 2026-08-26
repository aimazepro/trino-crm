// Analise de ligacao pelo Claude.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  AnalysisSchema,
  SYSTEM_PROMPT,
  buildBriefing,
  type Analysis,
  type AnalysisInput,
} from "./prompt";

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function analyzeWithClaude(input: AnalysisInput): Promise<Analysis> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(AnalysisSchema),
    },
    messages: [{ role: "user", content: buildBriefing(input) }],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Claude não devolveu uma análise válida.");
  return parsed as Analysis;
}
