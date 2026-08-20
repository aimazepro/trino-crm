// Drains automation_email_queue. Replaces supabase/functions/process-email-queue
// (Deno) — same reasoning as /api/whatsapp/queue/route.ts: one runtime for every
// pg_cron-invoked queue instead of Deno and Next doing the same job twice.
// Gmail OAuth/refresh logic is unchanged from the Deno version.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdmin } from "@/lib/whatsapp/connection";
import type { Database } from "@/lib/supabase/database.types";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import { firstEmail } from "@/lib/automation-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 20;
const STUCK_AFTER_MINUTES = 15;

function authorized(req: NextRequest): boolean {
  const expected = process.env.AUTOMATION_DISPATCH_SECRET ?? "";
  if (!expected) {
    console.error("automations/email-queue: AUTOMATION_DISPATCH_SECRET não está definido — fila parada");
    return false;
  }
  const presented = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

/**
 * Sequence steps enqueue with `to_email: null` (the enrollment knows the deal,
 * not an address), and send_email's own resolution at enqueue time can also
 * come up empty (no contact, or a contact with no email). Same deal->contact
 * chain the WhatsApp queue route's loadDealContext resolves a phone from --
 * see its comment for why this lives in the consumer rather than the producer.
 */
async function resolveToEmail(admin: SupabaseClient<Database>, dealId: string | null): Promise<string> {
  if (!dealId) return "";

  const { data: deal } = await admin
    .from("deals")
    .select("contact_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal?.contact_id) return "";

  const { data: contact } = await admin
    .from("contacts")
    .select("emails")
    .eq("id", deal.contact_id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return firstEmail((contact?.emails ?? []) as any[]);
}

async function reapStuck(admin: SupabaseClient<Database>): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString();
  await admin
    .from("automation_email_queue")
    .update({ status: "failed", error: "Processamento interrompido antes de concluir." })
    .eq("status", "processing")
    .lt("created_at", cutoff);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdmin();
  await reapStuck(admin);

  const { data: items, error } = await admin.rpc("claim_pending_email_queue", { p_limit: BATCH_SIZE });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) return NextResponse.json({ processed: 0, failed: 0 });

  let processed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const toEmail = item.to_email || await resolveToEmail(admin, item.deal_id);
      if (!toEmail) {
        await admin.from("automation_email_queue")
          .update({ status: "failed", error: "Nenhum email de contato encontrado para este negócio." })
          .eq("id", item.id);
        failed++;
        continue;
      }

      const { data: intRow } = await admin
        .from("integrations")
        .select("access_token, refresh_token, expires_at, id")
        .eq("workspace_id", item.workspace_id)
        .eq("provider", "gmail")
        .eq("active", true)
        .maybeSingle();

      if (!intRow) {
        await admin.from("automation_email_queue")
          .update({ status: "failed", error: "Nenhuma integração Gmail ativa." })
          .eq("id", item.id);
        failed++;
        continue;
      }

      let token = decryptToken(intRow.access_token!);

      if (intRow.expires_at && new Date(intRow.expires_at) < new Date()) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GMAIL_OAUTH_CLIENT_ID!,
            client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET!,
            refresh_token: decryptToken(intRow.refresh_token!),
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          token = refreshData.access_token;
          await admin.from("integrations")
            .update({
              access_token: encryptToken(token),
              expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            })
            .eq("id", intRow.id);
        }
      }

      const raw = Buffer.from(
        `To: ${toEmail}\r\nSubject: ${item.subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${item.body}`
      ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

      const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });

      if (gmailRes.ok) {
        await admin.from("automation_email_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.id);
        processed++;
      } else {
        const err = await gmailRes.text();
        await admin.from("automation_email_queue")
          .update({ status: "failed", error: err.slice(0, 500) })
          .eq("id", item.id);
        failed++;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("automations/email-queue", item.id, message);
      await admin.from("automation_email_queue")
        .update({ status: "failed", error: message.slice(0, 500) })
        .eq("id", item.id);
      failed++;
    }
  }

  return NextResponse.json({ processed, failed });
}
