import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function makeAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getValidToken(userId: string): Promise<{ token: string; email: string } | null> {
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
    return { token: integration.access_token as string, email: integration.account_email as string };
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_OAUTH_CLIENT_ID!,
      client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET!,
      refresh_token: integration.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) return null;

  await admin.from("integrations").update({
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq("user_id", userId).eq("provider", "gmail");

  return { token: tokens.access_token as string, email: integration.account_email as string };
}

type GmailPayload = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
};

function decodeBase64Url(str: string) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload: GmailPayload): string {
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    const text = decodeBase64Url(payload.body.data);
    return `<pre style="white-space:pre-wrap;font-family:inherit">${text}</pre>`;
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const body = extractBody(part);
      if (body) return body;
    }
  }
  return "";
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactEmail, contactId, dealId } = await req.json();
  if (!contactEmail || !contactId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const integration = await getValidToken(user.id);
  if (!integration) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  const { token, email: myEmail } = integration;
  const admin = makeAdmin();

  const query = `from:${contactEmail} OR to:${contactEmail}`;
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listRes.json();
  const messages: { id: string }[] = listData.messages ?? [];

  const { data: existing } = await admin
    .from("emails")
    .select("gmail_message_id")
    .eq("user_id", user.id)
    .eq("contact_id", contactId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingIds = new Set(((existing ?? []) as any[]).map((e) => e.gmail_message_id as string));

  let synced = 0;
  for (const msg of messages) {
    if (existingIds.has(msg.id)) continue;

    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const msgData = await msgRes.json();
    const headers: { name: string; value: string }[] = msgData.payload?.headers ?? [];

    const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    const fromEmail = getHeader("From");
    const toEmail = getHeader("To");
    const subject = getHeader("Subject");
    const dateStr = getHeader("Date");
    const createdAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

    const bodyHtml = extractBody(msgData.payload ?? {});
    const direction = fromEmail.includes(myEmail) ? "sent" : "received";

    await admin.from("emails").insert({
      user_id: user.id,
      contact_id: contactId,
      deal_id: dealId ?? null,
      gmail_message_id: msg.id,
      direction,
      subject,
      body_html: bodyHtml,
      from_email: fromEmail,
      to_email: toEmail,
      created_at: createdAt,
    });
    synced++;
  }

  return NextResponse.json({ success: true, synced });
}
