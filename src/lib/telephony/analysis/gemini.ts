// Analise de ligacao pelo Gemini.

import { GoogleGenAI } from "@google/genai";
import {
  ANALYSIS_JSON_SCHEMA,
  SYSTEM_PROMPT,
  buildBriefing,
  parseAnalysis,
  type Analysis,
  type AnalysisInput,
} from "./prompt";

// Modelo configuravel: nome de modelo do Gemini muda com frequencia, e travar
// um no codigo garante quebra silenciosa no dia em que ele for aposentado.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

export async function analyzeWithGemini(input: AnalysisInput): Promise<Analysis> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const ai = new GoogleGenAI({ apiKey });

  // O Gemini devolve 503 UNAVAILABLE quando o modelo esta sobrecarregado -- e
  // isso aconteceu ja na primeira chamada real. E transitorio, entao uma unica
  // falha nao pode virar erro na cara do vendedor.
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildBriefing(input),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: ANALYSIS_JSON_SCHEMA,
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini não devolveu conteúdo. Verifique o modelo configurado.");
      }
      return parseAnalysis(text);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const transient =
        message.includes("503") ||
        message.includes("UNAVAILABLE") ||
        message.includes("high demand");
      if (!transient || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Falha ao chamar o Gemini");
}
