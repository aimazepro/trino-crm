import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Gmail's image proxy prefetches images on delivery (before recipient opens),
// which fires the tracking pixel prematurely. Ignore pixel hits within this
// window after send to filter out the prefetch.
const PROXY_PREFETCH_WINDOW_MS = 15_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await admin
    .from("emails")
    .select("id, created_at, opened_at")
    .eq("track_id", trackId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;

  if (row && !row.opened_at) {
    const ageMs = Date.now() - new Date(row.created_at as string).getTime();
    if (ageMs >= PROXY_PREFETCH_WINDOW_MS) {
      await admin
        .from("emails")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
