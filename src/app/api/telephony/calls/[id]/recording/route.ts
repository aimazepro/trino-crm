// Gravacao da ligacao: upload e leitura.
//
// O audio nunca e servido direto do bucket nem do provedor: quem quiser ouvir
// passa por aqui, com sessao valida e pertencendo ao workspace da chamada.
// Assim revogar acesso e apagar por retencao continuam sendo decisao nossa.
//
// Duas origens possiveis, distinguidas pelo prefixo de recording_key:
//   supabase:<caminho>  audio capturado no navegador (modo simulado)
//   qualquer outra      referencia do provedor, buscada pelo adapter

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/telephony";
import {
  createTelephonyAdmin,
  credentialsOf,
  getSessionUser,
  loadAccount,
  resolveWorkspaceId,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";

const BUCKET = "call-recordings";
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    const { data: call } = await admin
      .from("telephony_calls")
      .select("id, workspace_id, recording_status")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!call) return NextResponse.json({ error: "Chamada não encontrada" }, { status: 404 });

    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: "Áudio vazio" }, { status: 400 });
    }
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Áudio acima do limite de 25 MB" }, { status: 413 });
    }

    const contentType = req.headers.get("content-type") || "audio/webm";
    const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("mp4") ? "mp4" : "webm";
    const path = `${workspaceId}/${call.id}.${ext}`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: true });

    if (upErr) {
      return NextResponse.json({ error: `Falha ao guardar o áudio: ${upErr.message}` }, { status: 502 });
    }

    const { data: account } = await admin
      .from("telephony_accounts")
      .select("recording_retention_days")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    const retention = account?.recording_retention_days ?? 180;

    await admin
      .from("telephony_calls")
      .update({
        recording_status: "stored",
        recording_key: `supabase:${path}`,
        recording_expires_at: new Date(Date.now() + retention * 86400_000).toISOString(),
      })
      .eq("id", call.id);

    return NextResponse.json({ ok: true, bytes: bytes.byteLength });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/recording POST", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    const { data: call } = await admin
      .from("telephony_calls")
      .select("id, provider, provider_call_id, recording_status, recording_key")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!call) return NextResponse.json({ error: "Chamada não encontrada" }, { status: 404 });
    if (call.recording_status === "deleted") {
      return NextResponse.json({ error: "Gravação removida por retenção." }, { status: 410 });
    }
    if (call.recording_status !== "stored") {
      return NextResponse.json({ error: "Sem gravação para esta chamada." }, { status: 404 });
    }

    // Áudio capturado no navegador.
    if (call.recording_key?.startsWith("supabase:")) {
      const path = call.recording_key.slice("supabase:".length);
      const { data: blob, error } = await admin.storage.from(BUCKET).download(path);
      if (error || !blob) {
        return NextResponse.json({ error: "Gravação indisponível" }, { status: 404 });
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      const contentType = blob.type || "audio/webm";

      // Range é obrigatório aqui, não um refinamento. O Safari só toca <audio>
      // servido por uma resposta 206 com Content-Range: com um 200 simples ele
      // carrega o arquivo, não reproduz nada e não acusa erro nenhum -- foi
      // exatamente esse o sintoma de "a gravação não toca".
      const range = req.headers.get("range");
      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        const start = match?.[1] ? Number(match[1]) : 0;
        const end = match?.[2] ? Number(match[2]) : buf.byteLength - 1;

        if (Number.isNaN(start) || start >= buf.byteLength) {
          return new NextResponse(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${buf.byteLength}` },
          });
        }

        const last = Math.min(end, buf.byteLength - 1);
        const slice = buf.subarray(start, last + 1);

        return new NextResponse(slice, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(slice.byteLength),
            "Content-Range": `bytes ${start}-${last}/${buf.byteLength}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, no-store",
          },
        });
      }

      return new NextResponse(buf, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(buf.byteLength),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (!call.provider_call_id) {
      return NextResponse.json({ error: "Sem gravação para esta chamada." }, { status: 404 });
    }

    const account = await loadAccount(admin, workspaceId);
    if (!account) return NextResponse.json({ error: "Conta não configurada" }, { status: 409 });

    const ref = await getProvider(call.provider).fetchRecording({
      credentials: credentialsOf(account),
      providerCallId: call.provider_call_id,
    });
    if (!ref) return NextResponse.json({ error: "Gravação indisponível" }, { status: 404 });

    if (ref.url.startsWith("data:")) {
      const [meta, b64] = ref.url.split(",");
      const contentType = meta.slice(5).replace(";base64", "") || ref.contentType;
      const bytes = Buffer.from(b64, "base64");
      return new NextResponse(new Uint8Array(bytes), {
        headers: { "Content-Type": contentType, "Cache-Control": "private, no-store" },
      });
    }

    const upstream = await fetch(ref.url, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Falha ao buscar a gravação" }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? ref.contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/recording GET", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
