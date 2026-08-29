import { NextRequest, NextResponse } from "next/server";
import {
  createAdmin,
  getSessionUser,
  loadConnection,
  resolveWorkspaceId,
} from "@/lib/whatsapp/connection";
import {
  ConversationNotFoundError,
  MAX_TEXT_LENGTH,
  sendWhatsAppMessage,
  UnreachableNumberError,
} from "@/lib/whatsapp/send";
import type { OutboundMedia } from "@/lib/whatsapp/types";
import { assertFeatureEnabled } from "@/lib/feature-flags-server";

export const dynamic = "force-dynamic";

/** Guards the function against an oversized upload before anything is read. */
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

/* eslint-disable @typescript-eslint/no-explicit-any */

function mediaKindFor(mimetype: string): OutboundMedia["kind"] {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype.startsWith("video/")) return "video";
  return "document";
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdmin();
  const ownerId = await resolveWorkspaceId(admin, user.id);

  const featureCheck = await assertFeatureEnabled(admin, ownerId, "whatsapp");
  if (!featureCheck.ok) return featureCheck.response;

  const connection = await loadConnection(admin, ownerId);

  if (!connection || connection.status !== "open") {
    return NextResponse.json(
      { error: "WhatsApp não está conectado. Conecte em Configurações > WhatsApp." },
      { status: 409 },
    );
  }

  let conversationId: string | undefined;
  let phoneInput: string | undefined;
  let text: string | null = null;
  let media: (OutboundMedia & { bytes: Buffer }) | null = null;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    conversationId = (form.get("conversationId") as string) || undefined;
    phoneInput = (form.get("phone") as string) || undefined;
    const caption = (form.get("caption") as string) || undefined;
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
    }
    if (file.size > MAX_MEDIA_BYTES) {
      return NextResponse.json({ error: "Arquivo maior que 16 MB" }, { status: 413 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimetype = file.type || "application/octet-stream";
    media = {
      bytes,
      data: bytes,
      mimetype,
      filename: file.name || "arquivo",
      kind: mediaKindFor(mimetype),
      caption,
    };
  } else {
    const body = (await req.json().catch(() => null)) as any;
    conversationId = body?.conversationId;
    phoneInput = body?.phone;
    text = typeof body?.text === "string" ? body.text.trim() : null;

    if (!text) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "Mensagem longa demais" }, { status: 400 });
    }
  }

  try {
    const outcome = await sendWhatsAppMessage(admin, connection, {
      conversationId,
      phone: phoneInput,
      text,
      media,
      sentBy: user.id,
    });

    return NextResponse.json(
      {
        id: outcome.messageId,
        conversationId: outcome.conversationId,
        status: outcome.status,
        ...(outcome.error ? { error: outcome.error } : {}),
      },
      { status: outcome.status === "sent" ? 200 : 502 },
    );
  } catch (err) {
    // No message row is written for these: nothing was ever addressable, so a
    // failed bubble in the thread would imply a send that never had a target.
    if (err instanceof UnreachableNumberError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof ConversationNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Falha ao abrir a conversa";
    console.error("whatsapp/send: resolve", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
