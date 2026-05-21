import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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

Deno.serve(async () => {
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

    const body = JSON.stringify(delivery.payload);
    const signature = webhook.secret ? await hmacSha256(webhook.secret, body) : null;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
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
