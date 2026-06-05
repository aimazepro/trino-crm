import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { dispatchWebhooks } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Opens registered within this window after send are treated as automated
// delivery/scanner prefetches (mail server antivirus, image proxies that fetch
// at delivery time), NOT a human opening the email.
const PREFETCH_WINDOW_MS = 15_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;

  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  // Pure link-preview / crawler bots that hit the pixel without a human opening
  // the email. NOTE: GoogleImageProxy is deliberately NOT here — Gmail uses it
  // for real opens too; the delivery-time prefetch is caught by the time window.
  const isBotFetch =
    ua.includes("bingpreview") ||
    ua.includes("whatsapp") ||
    ua.includes("facebookexternalhit") ||
    ua.includes("slackbot") ||
    ua.includes("telegrambot") ||
    ua === "";

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await admin
    .from("emails")
    .select("id, created_at, opened_at, user_id, to_email, subject, deal_id, contact_id")
    .eq("track_id", trackId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;

  const tooSoon =
    row?.created_at != null &&
    Date.now() - new Date(row.created_at as string).getTime() < PREFETCH_WINDOW_MS;

  if (row && !row.opened_at && !isBotFetch && !tooSoon) {
    const openedAt = new Date().toISOString();

    await admin
      .from("emails")
      .update({ opened_at: openedAt })
      .eq("id", row.id);

    await admin
      .from("notifications")
      .insert({
        user_id: row.user_id,
        type: "email_open",
        title: `${row.to_email || "Destinatário"} abriu seu email`,
        subtext: row.subject || "",
        href: row.deal_id ? `/negocios/${row.deal_id}?tab=gmail` : "/atividades",
        read: false
      });

    // Fire webhooks subscribed to "email_open" with the prospect's data
    try {
      const [{ data: contact }, { data: deal }] = await Promise.all([
        row.contact_id
          ? admin.from("contacts").select("id, name, emails, phones, company_id").eq("id", row.contact_id).maybeSingle()
          : Promise.resolve({ data: null }),
        row.deal_id
          ? admin.from("deals").select("id, title, value, company_id").eq("id", row.deal_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = contact as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = deal as any;
      const companyId = d?.company_id ?? c?.company_id ?? null;
      let company: { id: string; name: string } | null = null;
      if (companyId) {
        const { data: comp } = await admin.from("companies").select("id, name").eq("id", companyId).maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cm = comp as any;
        if (cm) company = { id: cm.id, name: cm.name };
      }

      await dispatchWebhooks(admin, row.user_id, "email_open", "EMAIL_OPENED", {
        email: {
          id: row.id,
          subject: row.subject ?? "",
          to: row.to_email ?? "",
          openedAt,
        },
        contact: c
          ? { id: c.id, name: c.name ?? "", email: c.emails?.[0]?.value ?? row.to_email ?? "", phone: c.phones?.[0]?.value ?? "" }
          : { email: row.to_email ?? "" },
        deal: d ? { id: d.id, title: d.title ?? "", value: d.value ?? null } : null,
        company,
      });
    } catch (e) {
      console.error("[track] webhook dispatch failed:", e);
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
