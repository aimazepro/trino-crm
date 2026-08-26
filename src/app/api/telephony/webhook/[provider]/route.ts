// Entrada de eventos do provedor. Corpo cru e obrigatorio: a assinatura e
// calculada sobre os bytes exatos, entao nao da para reserializar o JSON.

import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/telephony/webhook";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const rawBody = await req.text();

  try {
    const result = await processWebhook(provider, req.headers, rawBody);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/webhook", provider, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
