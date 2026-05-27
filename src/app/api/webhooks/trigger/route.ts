import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
];

function isPrivateOrUnsafeUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "https:") return true;
  const hostname = parsed.hostname;
  return PRIVATE_IP_PATTERNS.some((re) => re.test(hostname));
}

export const dynamic = "force-dynamic";

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Can be ignored
          }
        },
      },
    }
  );
}

function hmacSha256(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, event, payload, secret, webhookId } = await request.json();

    if (!url) {
      return Response.json({ error: "Missing destination URL" }, { status: 400 });
    }

    if (isPrivateOrUnsafeUrl(url)) {
      return Response.json({ error: "Invalid destination URL" }, { status: 400 });
    }

    const bodyString = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-crm-event": event,
    };

    if (secret) {
      const signature = hmacSha256(secret, bodyString);
      headers["X-Signature"] = `sha256=${signature}`;
    }

    let status = "failed";
    let responseCode: number | null = null;
    let errorMessage: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: bodyString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      responseCode = res.status;

      if (res.ok) {
        status = "sent";
      } else {
        errorMessage = `HTTP error! Status: ${res.status}`;
      }
    } catch (e: any) {
      errorMessage = e.message || String(e);
    }

    // Log the delivery attempt in webhook_deliveries if we have a webhookId
    if (webhookId) {
      await supabase.from("webhook_deliveries").insert({
        webhook_id: webhookId,
        user_id: user.id,
        event: event,
        payload: payload,
        status: status,
        attempts: 1,
        response_code: responseCode,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        error: errorMessage,
      });
    }

    return Response.json({
      success: status === "sent",
      status: responseCode,
      error: errorMessage,
    });
  } catch (e: any) {
    return Response.json(
      { error: e.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
