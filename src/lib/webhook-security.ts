import crypto from "crypto";

// Shared by every Node-side outbound webhook sender: src/lib/webhooks.ts
// (registered subscriptions), src/app/api/webhooks/trigger/route.ts (manual
// test-send from Settings), and src/lib/automation-engine.ts (the motor's
// send_webhook action). The Deno copy in
// supabase/functions/dispatch-webhooks/index.ts stays separate — different
// runtime, can't import this file — and is kept in sync by hand if this list
// ever changes.
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

export function isPrivateOrUnsafeUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "https:") return true;
  return PRIVATE_IP_PATTERNS.some((re) => re.test(parsed.hostname));
}

export function hmacSha256(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}
