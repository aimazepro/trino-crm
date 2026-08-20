import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isPrivateOrUnsafeUrl, hmacSha256 } from "@/lib/webhook-security";

type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  active: boolean;
};

/**
 * Dispatch an event to every active webhook of `userId` subscribed to `eventKey`.
 * Runs server-side with a service-role client (bypasses RLS), so it can be used
 * from unauthenticated routes such as the tracking pixel. Logs each attempt in
 * webhook_deliveries. Fire-and-forget per webhook; failures never throw.
 */
export async function dispatchWebhooks(
  admin: SupabaseClient<Database>,
  userId: string,
  eventKey: string,
  eventCode: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
): Promise<void> {
  const { data } = await admin
    .from("webhooks")
    .select("id, url, events, secret, active")
    .eq("workspace_id", userId)
    .eq("active", true);

  const hooks = ((data ?? []) as WebhookRow[]).filter((w) =>
    w.events?.includes(eventKey)
  );
  if (hooks.length === 0) return;

  const envelope = {
    event: eventCode,
    timestamp: new Date().toISOString(),
    payload,
  };
  const bodyString = JSON.stringify(envelope);

  await Promise.all(
    hooks.map(async (wh) => {
      let status = "failed";
      let responseCode: number | null = null;
      let errorMessage: string | null = null;

      if (isPrivateOrUnsafeUrl(wh.url)) {
        errorMessage = "Invalid destination URL";
      } else {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-crm-event": eventCode,
        };
        if (wh.secret) {
          headers["X-Signature"] = `sha256=${hmacSha256(wh.secret, bodyString)}`;
        }
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(wh.url, {
            method: "POST",
            headers,
            body: bodyString,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          responseCode = res.status;
          if (res.ok) status = "sent";
          else errorMessage = `HTTP error! Status: ${res.status}`;
        } catch (e) {
          errorMessage = e instanceof Error ? e.message : String(e);
        }
      }

      await admin.from("webhook_deliveries").insert({
        webhook_id: wh.id,
        workspace_id: userId,
        event: eventCode,
        payload: envelope,
        status: status === "sent" ? "sent" : "pending",
        attempts: 1,
        response_code: responseCode,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        error: errorMessage,
      });
    })
  );
}
