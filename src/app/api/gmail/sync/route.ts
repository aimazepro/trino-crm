import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getValidGmailToken } from "@/lib/gmail-token";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

function makeAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

  // contacts/deals dropped user_id entirely under Phase 1 multi-tenancy (workspace_id
  // only) -- the old .eq("user_id", ...) ownership check errored on every call, so sync
  // always 404'd before ever reaching Gmail.
  const workspaceCtx = await getWorkspaceContext(supabase);
  if (!workspaceCtx) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const admin = makeAdmin();

  const { data: contactOwner } = await admin
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("workspace_id", workspaceCtx.workspaceId)
    .maybeSingle();
  if (!contactOwner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (dealId) {
    const { data: dealOwner } = await admin
      .from("deals")
      .select("id")
      .eq("id", dealId)
      .eq("workspace_id", workspaceCtx.workspaceId)
      .maybeSingle();
    if (!dealOwner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const integration = await getValidGmailToken(user.id);
  if (!integration) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  const { token, email: myEmail } = integration;

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
      workspace_id: workspaceCtx.workspaceId,
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
