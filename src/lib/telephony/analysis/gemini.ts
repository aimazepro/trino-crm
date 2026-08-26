// Analise de ligacao pelo Gemini.

import { GoogleGenAI, createPartFromBase64, createUserContent } from "@google/genai";
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
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

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

// ---- transcricao ----------------------------------------------------------
//
// A transcricao saiu do navegador. A Web Speech API so existe no Chrome, e no
// Safari nao devolveu uma unica palavra: 100% das ligacoes em producao ficaram
// com transcript vazio, o que desabilitava o botao Analisar. Transcrever aqui,
// a partir da gravacao que ja esta guardada, funciona igual em todo navegador e
// entrega texto melhor -- ao custo de alguns milhares de tokens por ligacao.

// O limite de request do Gemini com dados inline e 20 MB. A 128 kb/s isso da
// ~18 minutos de conversa; acima disso a analise segue so com as notas em vez
// de estourar a chamada.
const MAX_INLINE_AUDIO_BYTES = 18 * 1024 * 1024;

const TRANSCRIPTION_PROMPT = [
  "Transcreva integralmente este audio de uma ligacao comercial em portugues do Brasil.",
  "Marque cada fala com VENDEDOR: ou CLIENTE: quando der para distinguir as vozes;",
  "quando nao der, use FALA:. Nao resuma, nao comente, nao invente nada:",
  "devolva apenas a transcricao. Se o audio nao tiver fala inteligivel, devolva vazio.",
].join(" ");

export function geminiCanTranscribe(): boolean {
  return geminiConfigured();
}

/**
 * Transcreve a gravacao. Devolve null quando nao ha o que transcrever -- audio
 * grande demais, ou silencio -- para o chamador seguir com o que tiver.
 */
export async function transcribeWithGemini(
  audio: Uint8Array,
  mimeType: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  if (audio.byteLength === 0 || audio.byteLength > MAX_INLINE_AUDIO_BYTES) return null;

  // O mimeType do contêiner pode vir com codecs (audio/mp4; codecs=mp4a.40.2);
  // a API só aceita o tipo base.
  const baseType = mimeType.split(";")[0].trim() || "audio/mp4";

  const ai = new GoogleGenAI({ apiKey });
  const data = Buffer.from(audio).toString("base64");

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: createUserContent([
          createPartFromBase64(data, baseType),
          TRANSCRIPTION_PROMPT,
        ]),
        config: { temperature: 0, maxOutputTokens: 8192 },
      });
      const text = (response.text ?? "").trim();
      return text.length > 0 ? text : null;
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

  throw lastError instanceof Error ? lastError : new Error("Falha ao transcrever no Gemini");
}
