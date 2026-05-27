import { createClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "./token-crypto";

function makeAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getValidGmailToken(
  userId: string
): Promise<{ token: string; email: string } | null> {
  const admin = makeAdmin();
  const { data } = await admin
    .from("integrations")
    .select("access_token, refresh_token, expires_at, account_email")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .eq("active", true)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const integration = data as any;
  if (!integration) return null;

  const expiresAt = new Date(integration.expires_at as string).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return {
      token: decryptToken(integration.access_token as string),
      email: integration.account_email as string,
    };
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_OAUTH_CLIENT_ID!,
      client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET!,
      refresh_token: decryptToken(integration.refresh_token as string),
      grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) {
    await admin
      .from("integrations")
      .update({ active: false })
      .eq("user_id", userId)
      .eq("provider", "gmail");
    return null;
  }

  const newEncrypted = encryptToken(tokens.access_token);
  await admin
    .from("integrations")
    .update({
      access_token: newEncrypted,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "gmail");

  return { token: tokens.access_token as string, email: integration.account_email as string };
}

export async function getValidGmailTokenSendOnly(
  userId: string
): Promise<string | null> {
  const result = await getValidGmailToken(userId);
  return result?.token ?? null;
}
