// Analise da ligacao por IA.
//
// Materia-prima: a transcricao capturada no navegador durante a chamada, mais as
// notas e a classificacao do vendedor. Transcricao e analise ficam em colunas
// separadas de proposito -- a transcricao nunca muda, a analise pode ser
// regerada com outro prompt (ou outro provedor) sem destruir o original.
//
// Qual IA responde e decidido em src/lib/telephony/analysis. Esta rota nao sabe.

import { NextRequest, NextResponse } from "next/server";
import { analyzeCall, resolveAnalysisProvider } from "@/lib/telephony/analysis";
import {
  createTelephonyAdmin,
  getSessionUser,
  resolveWorkspaceId,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const status = resolveAnalysisProvider();
  if (!status.configured) {
    return NextResponse.json(
      { error: `Análise por IA não configurada. ${status.missing}`, reason: "not_configured" },
      { status: 503 },
    );
  }

  const { id } = await params;
  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    const { data: call } = await admin
      .from("telephony_calls")
      .select("id, to_number, duration_seconds, status, disposition, notes, transcript, contact_id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!call) return NextResponse.json({ error: "Chamada não encontrada" }, { status: 404 });

    const transcript = (call.transcript ?? "").trim();
    const notes = (call.notes ?? "").trim();

    if (!transcript && !notes) {
      return NextResponse.json(
        { error: "Sem material para analisar: esta ligação não tem transcrição nem notas.", reason: "no_material" },
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

    const { analysis, provider } = await analyzeCall({
      contactName,
      toNumber: call.to_number,
      durationSeconds: call.duration_seconds,
      disposition: call.disposition,
      notes,
      transcript,
    });

    const analyzedAt = new Date().toISOString();
    await admin
      .from("telephony_calls")
      .update({ analysis, analyzed_at: analyzedAt })
      .eq("id", call.id);

    return NextResponse.json({ analysis, analyzedAt, provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/analyze", message);

    // Erro de cota ou credencial da IA não é erro do CRM: devolve o texto do
    // provedor para o dono conseguir agir sem abrir log.
    const lower = message.toLowerCase();
    if (lower.includes("api key") || lower.includes("unauthenticated") || lower.includes("permission")) {
      return NextResponse.json({ error: `Credencial da IA recusada: ${message}` }, { status: 502 });
    }
    if (lower.includes("quota") || lower.includes("rate limit") || lower.includes("429")) {
      return NextResponse.json({ error: "Limite de uso da IA atingido. Tente daqui a pouco." }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
