import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// Keep in sync with EVENTS in src/app/configuracoes/webhooks/page.tsx
const EVENT_CODES: Record<string, string> = {
  deal_created: "DEAL_CREATED",
  deal_won: "DEAL_WON",
  deal_lost: "DEAL_LOST",
  contact_created: "CONTACT_CREATED",
  activity_created: "ACTIVITY_CREATED",
  email_open: "EMAIL_OPENED",
};

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
  return PRIVATE_IP_PATTERNS.some((re) => re.test(parsed.hostname));
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function authorized(req: Request): boolean {
  const expected = Deno.env.get("AUTOMATION_DISPATCH_SECRET") ?? "";
  if (!expected) return false;
  const presented = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return presented === expected;
}

async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }

  const { data: deliveries } = await supabase
    .from("webhook_deliveries")
    .select("*, webhooks(url, secret)")
    .eq("status", "pending")
    .lt("attempts", 5)
    .limit(50);

  if (!deliveries || deliveries.length === 0) return new Response(JSON.stringify({ processed: 0 }));

  let processed = 0;
  for (const delivery of deliveries) {
    const webhook = delivery.webhooks;
    if (!webhook) continue;

    if (isPrivateOrUnsafeUrl(webhook.url)) {
      await supabase.from("webhook_deliveries").update({
        status: "failed",
        error: "Blocked: unsafe destination URL",
        attempts: delivery.attempts + 1,
      }).eq("id", delivery.id);
      continue;
    }

    const eventCode = EVENT_CODES[delivery.event] ?? delivery.event;
    const envelope = {
      event: eventCode,
      timestamp: new Date().toISOString(),
      payload: delivery.payload,
    };
    const body = JSON.stringify(envelope);
    const signature = webhook.secret ? await hmacSha256(webhook.secret, body) : null;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-crm-event": eventCode,
    };
    if (signature) headers["X-Signature"] = `sha256=${signature}`;

    try {
      const res = await fetch(webhook.url, { method: "POST", headers, body });
      const updates: any = { attempts: delivery.attempts + 1 };

      if (res.ok) {
        updates.status = "sent";
        updates.sent_at = new Date().toISOString();
        updates.response_code = res.status;
        processed++;
      } else {
        updates.response_code = res.status;
        updates.error = await res.text();
        if (delivery.attempts + 1 >= 5) updates.status = "failed";
      }

      await supabase.from("webhook_deliveries").update(updates).eq("id", delivery.id);
    } catch (e) {
      const updates: any = { attempts: delivery.attempts + 1, error: String(e) };
      if (delivery.attempts + 1 >= 5) updates.status = "failed";
      await supabase.from("webhook_deliveries").update(updates).eq("id", delivery.id);
    }
  }

  return new Response(JSON.stringify({ processed }));
});
