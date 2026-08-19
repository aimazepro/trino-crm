import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdmin, loadConnectionById } from "@/lib/whatsapp/connection";
import { handleInboundEvent } from "@/lib/whatsapp/ingest";
import { getDriver, WEBHOOK_SECRET_HEADER } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Evolution inlines media as base64, so payloads are much larger than a plain
// event. Anything past this is not a message we want.
const MAX_BODY_BYTES = 24 * 1024 * 1024;

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  const admin = createAdmin();
  const connection = await loadConnectionById(admin, connectionId);

  // Same answer for "no such connection" and "wrong secret", so the endpoint
  // can't be used to enumerate connection ids.
  if (!connection || !secretMatches(req.headers.get(WEBHOOK_SECRET_HEADER), connection.webhookSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    const event = getDriver(connection).normalizeInbound(payload);
    await handleInboundEvent(admin, connection, event);
  } catch (err) {
    // Always answer 200 below: Evolution retries on failure, and a retry storm
    // of a message we can't parse is worse than dropping it. The log is the
    // record.
    console.error("whatsapp/webhook: ingestion failed", err);
  }

  return NextResponse.json({ ok: true });
}
