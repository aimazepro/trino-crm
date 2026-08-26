// Analise da ligacao por IA.
//
// Materia-prima: a transcricao da gravacao, mais as notas e a classificacao do
// vendedor. Transcricao e analise ficam em colunas separadas de proposito -- a
// transcricao nunca muda, a analise pode ser regerada com outro prompt (ou outro
// provedor) sem destruir o original. Quem transcreve e esta rota, uma vez por
// ligacao: o texto fica salvo e a reanalise nao paga transcricao de novo.
//
// Qual IA responde e decidido em src/lib/telephony/analysis. Esta rota nao sabe.

import { NextRequest, NextResponse } from "next/server";
import { analyzeCall, resolveAnalysisProvider } from "@/lib/telephony/analysis";
import { geminiCanTranscribe, transcribeWithGemini } from "@/lib/telephony/analysis/gemini";
import {
  createTelephonyAdmin,
  getSessionUser,
  resolveWorkspaceId,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "call-recordings";

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
      .select("id, to_number, duration_seconds, status, disposition, notes, transcript, contact_id, deal_id, script_id, started_at, recording_status, recording_key")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!call) return NextResponse.json({ error: "Chamada não encontrada" }, { status: 404 });

    let transcript = (call.transcript ?? "").trim();
    const notes = (call.notes ?? "").trim();

    // Transcricao a partir da gravacao. Antes ela vinha da Web Speech API do
    // navegador, que so o Chrome implementa -- no Safari nenhuma ligacao gerou
    // transcript, e o botao Analisar ficava desabilitado. Transcrever aqui vale
    // para todo navegador, e o texto fica guardado: a proxima analise da mesma
    // ligacao nao paga de novo.
    if (
      !transcript &&
      call.recording_status === "stored" &&
      call.recording_key?.startsWith("supabase:") &&
      geminiCanTranscribe()
    ) {
      try {
        const path = call.recording_key.slice("supabase:".length);
        const { data: blob } = await admin.storage.from(BUCKET).download(path);
        if (blob) {
          const audio = new Uint8Array(await blob.arrayBuffer());
          const text = await transcribeWithGemini(audio, blob.type || "audio/mp4");
          if (text) {
            transcript = text;
            await admin.from("telephony_calls").update({ transcript }).eq("id", call.id);
          }
        }
      } catch (err) {
        // Falhar aqui nao pode matar a analise: as notas do vendedor ainda sao
        // material valido, e a ligacao ja esta salva de qualquer jeito.
        console.error(
          "telephony/analyze transcribe",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

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

    let dealTitle: string | null = null;
    if (call.deal_id) {
      const { data: deal } = await admin
        .from("deals")
        .select("title")
        .eq("id", call.deal_id)
        .maybeSingle();
      dealTitle = deal?.title ?? null;
    }

    let scriptName: string | null = null;
    if (call.script_id) {
      const { data: script } = await admin
        .from("scripts")
        .select("name")
        .eq("id", call.script_id)
        .maybeSingle();
      scriptName = script?.name ?? null;
    }

    // Quantas ligações vieram antes desta para o mesmo contato. É o que separa
    // cold call de follow-up, e os dois pedem critério de avaliação diferente:
    // cobrar fechamento de um primeiro contato seria avaliar errado.
    let previousCalls = 0;
    if (call.contact_id) {
      const { count } = await admin
        .from("telephony_calls")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("contact_id", call.contact_id)
        .lt("started_at", call.started_at);
      previousCalls = count ?? 0;
    }

    const { analysis, provider } = await analyzeCall({
      contactName,
      dealTitle,
      scriptName,
      previousCalls,
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

    return NextResponse.json({ analysis, analyzedAt, provider, transcript });
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
