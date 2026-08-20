import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isPrivateOrUnsafeUrl, hmacSha256 } from "@/lib/webhook-security";
import { getWorkspaceContext } from "@/lib/workspace-context";

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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getWorkspaceContext(supabase);

    if (!ctx) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, event, payload, secret, webhookId } = await request.json();

    if (!url) {
      return Response.json({ error: "Missing destination URL" }, { status: 400 });
    }

    if (webhookId) {
      const { data: owned } = await supabase
        .from("webhooks")
        .select("id")
        .eq("id", webhookId)
        .maybeSingle();
      if (!owned) {
        return Response.json({ error: "Webhook não encontrado" }, { status: 403 });
      }
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
      const { error: deliveryError } = await supabase.from("webhook_deliveries").insert({
        webhook_id: webhookId,
        workspace_id: ctx.workspaceId,
        event: event,
        payload: payload,
        status: status,
        attempts: 1,
        response_code: responseCode,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        error: errorMessage,
      });
      if (deliveryError) {
        console.error("[webhooks/trigger] falha ao registrar webhook_deliveries:", deliveryError);
      }
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
