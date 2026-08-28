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

// Gmail's messages.list `q=` full-text search is unreliable for this use case (index
// lag on very recent mail, excludes Spam/Trash unless `in:anywhere` is added, and
// address matching against the raw header string doesn't reliably account for Gmail's
// own dot-insensitivity in local-parts). Confirmed via 6+ instrumented syncs this
// session: q= search found 45-46 old "sent" messages but 0 "received" ones despite a
// real external reply sitting in the inbox. Fix: list INBOX/SENT labels directly (no
// text search, no lag) and match the contact by parsed header address in code.
function extractEmailAddress(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  return (match ? match[1] : headerValue).trim().toLowerCase();
}

function normalizeEmail(headerValue: string): string {
  const address = extractEmailAddress(headerValue);
  const [local, domain] = address.split("@");
  if (!domain) return address;
  const domainLower = domain.toLowerCase();
  if (domainLower === "gmail.com" || domainLower === "googlemail.com") {
    const localNormalized = local.replace(/\./g, "").split("+")[0];
    return `${localNormalized}@gmail.com`;
  }
  return address;
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

  async function listLabel(labelId: string): Promise<{ id: string }[]> {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${labelId}&maxResults=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) {
      // Most likely cause: the connected account authorized before gmail.readonly was
      // requested -- Google silently returns an insufficient-scope error here rather
      // than failing the connect itself.
      console.error(`[gmail/sync] messages.list(${labelId}) failed:`, data.error ?? data);
      throw Object.assign(new Error(data.error?.message ?? "Gmail list failed"), {
        reconnectRequired: data.error?.status === "PERMISSION_DENIED",
      });
    }
    return data.messages ?? [];
  }

  let inboxMsgs: { id: string }[], sentMsgs: { id: string }[];
  try {
    [inboxMsgs, sentMsgs] = await Promise.all([listLabel("INBOX"), listLabel("SENT")]);
  } catch (err) {
    const e = err as Error & { reconnectRequired?: boolean };
    return NextResponse.json({ error: e.message, reconnectRequired: e.reconnectRequired }, { status: 502 });
  }

  const seen = new Set<string>();
  const messages: { id: string }[] = [...inboxMsgs, ...sentMsgs].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const contactEmailNormalized = normalizeEmail(contactEmail);

  const { data: existing } = await admin
    .from("emails")
    .select("gmail_message_id")
    .eq("user_id", user.id)
    .eq("contact_id", contactId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingIds = new Set(((existing ?? []) as any[]).map((e) => e.gmail_message_id as string));

  let synced = 0;
  let skippedNoMatch = 0;
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

    // Only messages actually to/from this contact belong here -- INBOX/SENT listing
    // above pulls in the whole mailbox, so this filter replaces the old (unreliable)
    // Gmail q= search-based filtering.
    const fromNormalized = normalizeEmail(fromEmail);
    const toNormalized = normalizeEmail(toEmail);
    if (fromNormalized !== contactEmailNormalized && toNormalized !== contactEmailNormalized) {
      skippedNoMatch++;
      continue;
    }

    const bodyHtml = extractBody(msgData.payload ?? {});
    const direction = normalizeEmail(fromEmail) === normalizeEmail(myEmail) ? "sent" : "received";

    const { error: insertError } = await admin.from("emails").insert({
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
    if (insertError) {
      console.error("[gmail/sync] insert failed:", insertError, { msgId: msg.id, direction, fromEmail, toEmail });
      continue;
    }
    synced++;

    if (direction === "received") {
      // Surface the reply in the deal's "Todos"/"Histórico" timeline (deal-scoped,
      // same as every other deal event) and notify the owner, mirroring the
      // email_open notification in /api/track/[trackId].
      if (dealId) {
        const { error: historyErr } = await admin.from("deal_history").insert({
          deal_id: dealId,
          description: "Email recebido",
          subtext: subject,
          // Dono da caixa que sincronizou -- é quem recebeu a resposta.
          actor_user_id: user.id,
        });
        if (historyErr) console.error("[gmail/sync] deal_history insert failed:", historyErr);
      }

      const { error: notifErr } = await admin.from("notifications").insert({
        user_id: user.id,
        workspace_id: workspaceCtx.workspaceId,
        type: "email_reply",
        title: `${fromEmail || "Contato"} respondeu seu email`,
        subtext: subject || "",
        href: dealId ? `/negocios/${dealId}?tab=gmail` : "/atividades",
        read: false,
      });
      if (notifErr) console.error("[gmail/sync] notification insert failed:", notifErr);
    }
  }

  // TEMP DEBUG (remove after confirming reply-sync fix in prod)
  console.log("[gmail/sync][TEMP]", {
    contactEmail,
    contactEmailNormalized,
    myEmail,
    inboxCount: inboxMsgs.length,
    sentCount: sentMsgs.length,
    totalCandidates: messages.length,
    skippedNoMatch,
    synced,
  });

  return NextResponse.json({ success: true, synced });
}
