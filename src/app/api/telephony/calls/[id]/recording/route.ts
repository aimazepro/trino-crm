// Gravacao da ligacao: upload e leitura.
//
// O audio nunca e servido direto do bucket nem do provedor: quem quiser ouvir
// passa por aqui, com sessao valida e pertencendo ao workspace da chamada.
// Assim revogar acesso e apagar por retencao continuam sendo decisao nossa.
//
// Duas origens possiveis, distinguidas pelo prefixo de recording_key:
//   supabase:<caminho>  audio capturado no navegador (modo simulado)
//   qualquer outra      referencia do provedor, buscada pelo adapter
//
// O audio do navegador NAO sobe por esta rota. O corpo de request da Vercel para
// em 4,5 MB, o que a ~155 kb/s da menos de 4 minutos de conversa -- e ligacao de
// 5 e 7 minutos voltava 413, que o cliente lia como sucesso e descartava. O POST
// aqui so emite uma URL assinada e depois confirma; os bytes vao do navegador
// direto para o Storage, sem teto e sem passar pela funcao.

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/telephony";
import {
  createTelephonyAdmin,
  credentialsOf,
  getRequesterRole,
  getSessionUser,
  loadAccount,
  resolveWorkspaceId,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";

const BUCKET = "call-recordings";
// Teto de armazenamento. Nao e mais o gargalo desde que os bytes deixaram de
// passar pela funcao; existe so para um bug de cliente nao encher o bucket. A
// ~155 kb/s isso da ~45 minutos. Acima de 18 MB (~15 min) a transcricao e
// pulada, porque e o limite do audio inline do Gemini -- a ligacao fica salva e
// ouvivel, a analise sai so com as notas.
const MAX_BYTES = 50 * 1024 * 1024;

type PostBody =
  | { action: "upload-url"; contentType?: string }
  | { action: "confirm"; contentType?: string };

function extensionFor(contentType: string): string {
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("mp4") || contentType.includes("m4a")) return "mp4";
  return "webm";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const admin = createTelephonyAdmin();

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    // admin = service role, ignora a RLS de telephony_calls. Sem este corte,
    // um vendedor conseguia gerar URL de upload e confirmar gravação de uma
    // ligação de outra pessoa. user_id é nullable e .eq() nunca casa com
    // NULL, então ligação sem usuário atribuído também fica fora para
    // não-gerente -- coerente com a policy do banco.
    const role = await getRequesterRole();
    const isManager = role === "admin" || role === "gerente";

    let callQuery = admin
      .from("telephony_calls")
      .select("id, workspace_id, recording_status")
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (!isManager) callQuery = callQuery.eq("user_id", user.id);
    const { data: call } = await callQuery.maybeSingle();
    if (!call) return NextResponse.json({ error: "Chamada não encontrada" }, { status: 404 });

    const contentType = body.contentType || "audio/webm";
    const ext = extensionFor(contentType);
    const path = `${workspaceId}/${call.id}.${ext}`;

    // O caminho é escolhido aqui, nunca pelo cliente: a URL assinada só serve
    // para este arquivo, deste workspace, desta chamada.
    if (body.action === "upload-url") {
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path, { upsert: true });

      if (error || !data) {
        return NextResponse.json(
          { error: `Falha ao preparar o envio: ${error?.message ?? "sem token"}` },
          { status: 502 },
        );
      }
      return NextResponse.json({ path: data.path, token: data.token, ext });
    }

    if (body.action !== "confirm") {
      return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
    }

    // Confirmar não é acreditar: o arquivo é procurado no bucket, e o tamanho
    // conferido aqui, porque o limite deixou de existir do lado do cliente.
    const { data: listed, error: listErr } = await admin.storage
      .from(BUCKET)
      .list(workspaceId, { search: `${call.id}.${ext}`, limit: 1 });

    const object = listed?.[0];
    if (listErr || !object) {
      return NextResponse.json(
        { error: "Áudio não chegou ao armazenamento." },
        { status: 404 },
      );
    }

    const size = Number((object.metadata as { size?: number } | null)?.size ?? 0);
    if (size === 0) {
      await admin.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: "Áudio vazio" }, { status: 400 });
    }
    if (size > MAX_BYTES) {
      await admin.storage.from(BUCKET).remove([path]);
      return NextResponse.json(
        { error: `Áudio acima do limite de ${MAX_BYTES / 1024 / 1024} MB` },
        { status: 413 },
      );
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

    return NextResponse.json({ ok: true, bytes: size });
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

    // Mesmo corte do POST acima: sem isso, esta rota servia o áudio de
    // qualquer ligação do workspace pra qualquer vendedor -- a RLS de
    // telephony_calls autoriza, mas o admin client (service role) ignora.
    const role = await getRequesterRole();
    const isManager = role === "admin" || role === "gerente";

    let callQuery = admin
      .from("telephony_calls")
      .select("id, provider, provider_call_id, recording_status, recording_key")
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (!isManager) callQuery = callQuery.eq("user_id", user.id);
    const { data: call } = await callQuery.maybeSingle();

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
