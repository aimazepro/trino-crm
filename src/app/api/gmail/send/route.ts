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

async function getValidToken(userId: string): Promise<string | null> {
  const admin = makeAdmin();
  const { data } = await admin
    .from("integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .eq("active", true)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const integration = data as any;
  if (!integration) return null;

  const expiresAt = new Date(integration.expires_at as string).getTime();
  if (Date.now() < expiresAt - 60_000) return integration.access_token as string;

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

  return tokens.access_token as string;
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

  const { to, subject: rawSubject, bodyHtml: rawBody, contactId, dealId, contactName, contactEmail: contactEmailVar } = await req.json();
  if (!to || !rawSubject || !rawBody || !contactId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const ownerName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "";

  const replaceVars = (text: string) =>
    text
      .replace(/\{\{contact_name\}\}/g, contactName ?? "")
      .replace(/\{\{contact_email\}\}/g, contactEmailVar ?? to)
      .replace(/\{\{owner_name\}\}/g, ownerName);

  const subject = replaceVars(rawSubject);
  let bodyHtml = replaceVars(rawBody);

  // Append signature if user has one enabled
  const { data: sigData } = await makeAdmin()
    .from("email_signatures")
    .select("*")
    .eq("user_id", user.id)
    .eq("enabled", true)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sig = sigData as any;
  if (sig) {
    const photoCell = sig.photo_url
      ? `<td style="vertical-align:top;padding-right:12px"><img src="${sig.photo_url}" alt="" style="width:70px;height:70px;border-radius:50%;object-fit:cover" /></td>`
      : "";
    const lines: string[] = [];
    if (sig.name) lines.push(`<strong style="font-size:14px;color:#333">${sig.name}</strong>`);
    if (sig.role) lines.push(`<span style="font-size:12px;color:#666">${sig.role}</span>`);
    if (sig.company) lines.push(`<span style="font-size:12px;color:#666">${sig.company}</span>`);
    if (sig.phone) lines.push(`<span style="font-size:12px;color:#666">${sig.phone}</span>`);
    const logoBlock = sig.logo_url
      ? `<div style="margin-top:8px"><img src="${sig.logo_url}" alt="" style="max-height:50px;max-width:200px" /></div>`
      : "";
    const sigHtml = `<br/><br/><table cellpadding="0" cellspacing="0"><tr>${photoCell}<td style="vertical-align:top">${lines.join("<br/>")}${logoBlock}</td></tr></table>`;
    bodyHtml = bodyHtml + sigHtml;
  }

  const accessToken = await getValidToken(user.id);
  if (!accessToken) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  const admin = makeAdmin();

  const { data: emailRow, error: insertErr } = await admin.from("emails").insert({
    user_id: user.id,
    contact_id: contactId,
    deal_id: dealId ?? null,
    direction: "sent",
    subject,
    body_html: bodyHtml,
    from_email: "",
    to_email: to,
  }).select("track_id, id").single();

  if (insertErr || !emailRow) return NextResponse.json({ error: "DB error" }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = emailRow as any;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://trino-crm.vercel.app").replace(/\/$/, "");
  const trackUrl = `${appUrl}/api/track/${row.track_id}`;
  const pixel = `<img src="${trackUrl}" width="1" height="1" style="display:none" />`;
  const trackedHtml = bodyHtml + pixel;

  const { data: intData } = await admin
    .from("integrations")
    .select("account_email")
    .eq("user_id", user.id)
    .eq("provider", "gmail")
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromEmail = (intData as any)?.account_email ?? "";

  // RFC 2047 encode subject for non-ASCII characters
  const encodedSubject = /[^\x20-\x7E]/.test(subject)
    ? `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`
    : subject;

  const bodyB64 = Buffer.from(trackedHtml, "utf-8").toString("base64");

  const mime = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    bodyB64,
  ].join("\r\n");

  const encoded = Buffer.from(mime).toString("base64url");

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });

  const sent = await sendRes.json();
  if (!sendRes.ok) {
    await admin.from("emails").delete().eq("id", row.id);
    return NextResponse.json({ error: sent.error?.message ?? "Gmail send failed" }, { status: 500 });
  }

  await admin.from("emails").update({
    gmail_message_id: sent.id,
    from_email: fromEmail,
  }).eq("id", row.id);

  return NextResponse.json({ success: true, id: row.id });
}
