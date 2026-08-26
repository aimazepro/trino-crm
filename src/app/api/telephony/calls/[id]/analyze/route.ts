// Analise da ligacao por IA.
//
// Materia-prima: a transcricao capturada no navegador durante a chamada, mais as
// notas e a classificacao do vendedor. Transcricao e analise ficam em colunas
// separadas de proposito -- a transcricao nunca muda, a analise pode ser
// regerada com outro prompt sem destruir o original.
//
// Sem ANTHROPIC_API_KEY a rota falha explicando o que falta, em vez de devolver
// um resumo inventado.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createTelephonyAdmin,
  getSessionUser,
  resolveWorkspaceId,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AnalysisSchema = z.object({
  resumo: z.string(),
  pontos_chave: z.array(z.string()),
  objecoes: z.array(z.string()),
  proximos_passos: z.array(z.string()),
  sentimento: z.enum(["positivo", "neutro", "negativo"]),
  qualidade: z.number(),
  observacao_coach: z.string(),
});

const SYSTEM = `Você analisa ligações de vendas B2B em português do Brasil para um CRM.

Receba a transcrição (quando houver), as notas do vendedor e o resultado da chamada.
Produza uma análise curta e útil para o vendedor e o gestor.

Regras:
- Escreva em português do Brasil, direto, sem elogio vazio.
- Se a ligação for curta ou não tiver conteúdo, diga isso claramente em vez de inventar substância.
- Liste apenas objeções que realmente apareceram. Se não houve nenhuma, devolva lista vazia.
- "qualidade" é uma nota de 0 a 10 para a condução da ligação pelo vendedor. Se não houver
  material suficiente para julgar, use 0 e diga isso na observação.
- "observacao_coach" é uma frase de feedback acionável para o vendedor.`;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Análise por IA não configurada. Defina ANTHROPIC_API_KEY nas variáveis de ambiente.",
        reason: "missing_api_key",
      },
      { status: 503 },
    );
  }

  const { id } = await params;
  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    const { data: call } = await admin
      .from("telephony_calls")
      .select("id, to_number, duration_seconds, status, disposition, notes, transcript, analysis, deal_id, contact_id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!call) return NextResponse.json({ error: "Chamada não encontrada" }, { status: 404 });

    const transcript = (call.transcript ?? "").trim();
    const notes = (call.notes ?? "").trim();

    if (!transcript && !notes) {
      return NextResponse.json(
        {
          error:
            "Sem material para analisar: esta ligação não tem transcrição nem notas.",
          reason: "no_material",
        },
        { status: 422 },
      );
    }

    let contactName: string | null = null;
    if (call.contact_id) {
      const { data: contact } = await admin
        .from("contacts")
        .select("name")
        .eq("id", call.contact_id)
        .maybeSingle();
      contactName = contact?.name ?? null;
    }

    const briefing = [
      `Contato: ${contactName ?? "não identificado"} (${call.to_number})`,
      `Duração: ${call.duration_seconds}s`,
      `Resultado marcado pelo vendedor: ${call.disposition ?? "não classificado"}`,
      notes ? `\nNotas do vendedor:\n${notes}` : "",
      transcript ? `\nTranscrição:\n${transcript}` : "\n(Sem transcrição desta ligação.)",
    ]
      .filter(Boolean)
      .join("\n");

    const client = new Anthropic();

    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(AnalysisSchema),
      },
      messages: [{ role: "user", content: briefing }],
    });

    const analysis = response.parsed_output;
    if (!analysis) {
      return NextResponse.json(
        { error: "A IA não devolveu uma análise válida. Tente de novo." },
        { status: 502 },
      );
    }

    await admin
      .from("telephony_calls")
      .update({ analysis, analyzed_at: new Date().toISOString() })
      .eq("id", call.id);

    return NextResponse.json({ analysis, analyzedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Chave da Anthropic inválida ou sem crédito." },
        { status: 502 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Limite de uso da IA atingido. Tente daqui a pouco." },
        { status: 429 },
      );
    }
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/analyze", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
