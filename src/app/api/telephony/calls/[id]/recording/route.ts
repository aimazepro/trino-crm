// Proxy autenticado da gravacao.
//
// A URL do provedor nunca chega ao navegador: quem quiser ouvir passa por aqui,
// com sessao valida e pertencendo ao workspace da chamada. Assim revogar acesso
// e apagar a gravacao continuam sendo decisao nossa, nao do provedor.

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    if (call.recording_status !== "stored" || !call.provider_call_id) {
      return NextResponse.json({ error: "Sem gravação para esta chamada." }, { status: 404 });
    }

    const account = await loadAccount(admin, workspaceId);
    if (!account) return NextResponse.json({ error: "Conta não configurada" }, { status: 409 });

    const ref = await getProvider(call.provider).fetchRecording({
      credentials: credentialsOf(account),
      providerCallId: call.provider_call_id,
    });
    if (!ref) return NextResponse.json({ error: "Gravação indisponível" }, { status: 404 });

    // data: URI (usado pelo provedor simulado) vira bytes aqui mesmo.
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
    console.error("telephony/recording", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
