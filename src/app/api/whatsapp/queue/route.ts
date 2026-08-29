import type { Database } from "@/lib/supabase/database.types";
// Drains automation_whatsapp_queue through the WhatsApp driver.
//
// The queue used to be drained by a Supabase Edge Function that posted straight
// to the Meta Cloud API — an integration this CRM never had credentials for, so
// every automated message failed. It lives here instead because the driver does
// (JID resolution, the encrypted instance token, the signature, the thread row):
// duplicating that in Deno would mean two implementations of "send a WhatsApp"
// that drift apart. pg_cron still owns the schedule and calls this route.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdmin, loadConnection, loadConnectionById } from "@/lib/whatsapp/connection";
import { sendWhatsAppMessage, UnreachableNumberError } from "@/lib/whatsapp/send";
import { getDriver } from "@/lib/whatsapp";
import type { WhatsAppConnection } from "@/lib/whatsapp/types";
import { assertFeatureEnabled } from "@/lib/feature-flags-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Small on purpose. Every item costs at least one provider round trip, and the
 * scheduler comes back a minute later — a large batch only trades throughput
 * for the risk of the function timing out mid-drain.
 */
const BATCH_SIZE = 10;

/** How long a claimed row may sit in `processing` before it is declared dead. */
const STUCK_AFTER_MINUTES = 15;

/**
 * The caller is pg_cron, over the public internet, so this needs its own token.
 *
 * Deliberately not the service role key: this project holds two of those (the
 * legacy `eyJ...` JWT in the app env and the newer `sb_secret_...` the cron jobs
 * carry), and an endpoint that accepts "the service role key" would silently
 * reject whichever one the caller happened to use. A dedicated secret is also
 * rotatable without touching database access.
 */
function authorized(req: NextRequest): boolean {
  const expected = process.env.AUTOMATION_DISPATCH_SECRET ?? "";
  if (!expected) {
    console.error("whatsapp/queue: AUTOMATION_DISPATCH_SECRET não está definido — fila parada");
    return false;
  }

  const presented = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

function firstPhone(phones: any[]): string {
  if (!phones?.length) return "";
  const p = phones[0];
  return typeof p === "string" ? p : (p?.value ?? p?.phone ?? p?.number ?? "");
}

async function finish(
  admin: SupabaseClient<Database>,
  id: string,
  patch: Partial<Database["public"]["Tables"]["automation_whatsapp_queue"]["Update"]>,
): Promise<void> {
  await admin.from("automation_whatsapp_queue").update(patch).eq("id", id);
}

/**
 * A crash between claiming a row and finishing it leaves that row `processing`
 * forever, invisible to both the queue and the user. They are failed rather
 * than retried: the send may well have gone out before the crash, and a
 * duplicate message to a customer is worse than a visible failure.
 */
async function reapStuck(admin: SupabaseClient<Database>): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString();
  await admin
    .from("automation_whatsapp_queue")
    .update({ status: "failed", error: "Processamento interrompido antes de concluir." })
    .eq("status", "processing")
    .lt("created_at", cutoff);
}

/** The connection for this queue item's workspace, resolved once per batch. */
async function connectionFor(
  admin: SupabaseClient<Database>,
  workspaceId: string,
  cache: Map<string, WhatsAppConnection | null>,
): Promise<WhatsAppConnection | null> {
  if (cache.has(workspaceId)) return cache.get(workspaceId)!;

  const connection = await loadConnection(admin, workspaceId);
  cache.set(workspaceId, connection);
  return connection;
}

/**
 * A workspace with `whatsapp` disabled must not have its already-queued
 * automations keep sending -- cached per batch since the same workspace
 * shows up across many queue rows and the check is a DB round trip.
 */
async function whatsappEnabledFor(
  admin: SupabaseClient<Database>,
  workspaceId: string,
  cache: Map<string, boolean>,
): Promise<boolean> {
  if (cache.has(workspaceId)) return cache.get(workspaceId)!;

  const check = await assertFeatureEnabled(admin, workspaceId, "whatsapp");
  cache.set(workspaceId, check.ok);
  return check.ok;
}

/** Same idea as connectionFor, keyed by connection id for group-broadcast rows. */
async function connectionForId(
  admin: SupabaseClient<Database>,
  connectionId: string,
  cache: Map<string, WhatsAppConnection | null>,
): Promise<WhatsAppConnection | null> {
  if (cache.has(connectionId)) return cache.get(connectionId)!;

  const connection = await loadConnectionById(admin, connectionId);
  cache.set(connectionId, connection);
  return connection;
}

/**
 * The message text. Automations resolve their template at enqueue time, where
 * the deal is in hand to interpolate against; this fallback only covers a row
 * that carries a template id and nothing else.
 */
async function resolveText(admin: SupabaseClient<Database>, item: any): Promise<string> {
  const message = (item.message ?? "").trim();
  if (message) return message;
  if (!item.template_id) return "";

  const { data } = await admin
    .from("whatsapp_templates")
    .select("message")
    .eq("id", item.template_id)
    .maybeSingle();

  return ((data as any)?.message ?? "").trim();
}

/**
 * The salesperson behind `{{nome_vendedor}}`.
 *
 * Falls back to auth.users for anyone whose workspace_members row doesn't
 * carry a name (e.g. an invite still pending) — auth.users is the one
 * source that always has something behind it.
 */
async function ownerName(admin: SupabaseClient<Database>, ownerId: string | null): Promise<string> {
  if (!ownerId) return "";

  const { data: member } = await admin
    .from("workspace_members")
    .select("name, email")
    .eq("member_user_id", ownerId)
    .limit(1)
    .maybeSingle();

  const invited = ((member as any)?.name ?? "").trim();
  if (invited) return invited;

  const { data } = await admin.auth.admin.getUserById(ownerId);
  const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = String(meta.full_name ?? meta.name ?? "").trim();
  if (fullName) return fullName;

  // Last resort. Better a login handle in the message than "aqui é ."
  const email = data?.user?.email ?? (member as any)?.email ?? "";
  return email.split("@")[0] ?? "";
}

interface DealContext {
  phone: string;
  vars: Record<string, string>;
}

/** Behind `{{valor_negocio}}`. Empty rather than "R$ NaN" for a null/zero-ish value. */
function formatCurrencyBRL(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

/**
 * Everything the deal behind a queue row can supply: the number to send to, and
 * the values behind the `{{...}}` placeholders the template editor offers.
 *
 * Sequence steps enqueue without a phone — the enrollment knows the deal, not
 * the number — so the deal's contact is looked up here for both callers.
 */
async function loadDealContext(admin: SupabaseClient<Database>, dealId: string | null): Promise<DealContext> {
  const empty: DealContext = { phone: "", vars: {} };
  if (!dealId) return empty;

  const { data: deal } = await admin
    .from("deals")
    .select("title, value, contact_id, company_id, owner_id, pipeline_id, stage_id")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) return empty;
  const row = deal as any;

  const [contact, company, vendedor, stage, pipeline] = await Promise.all([
    row.contact_id
      ? admin.from("contacts").select("name, phones, company_id").eq("id", row.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.company_id
      ? admin.from("companies").select("name").eq("id", row.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
    ownerName(admin, row.owner_id ?? null),
    row.stage_id
      ? admin.from("pipeline_stages").select("name").eq("id", row.stage_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.pipeline_id
      ? admin.from("pipelines").select("name").eq("id", row.pipeline_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const contactRow = contact.data as any;
  const contactPhone = firstPhone(contactRow?.phones ?? []);

  return {
    phone: contactPhone.replace(/\D/g, ""),
    vars: {
      nome_contato: contactRow?.name ?? "",
      nome_empresa: (company.data as any)?.name ?? "",
      nome_negocio: row.title ?? "",
      nome_vendedor: vendedor,
      valor_negocio: formatCurrencyBRL(row.value),
      nome_etapa: (stage.data as any)?.name ?? "",
      nome_funil: (pipeline.data as any)?.name ?? "",
      telefone_contato: contactPhone,
    },
  };
}

/**
 * Fills the `{{...}}` placeholders the template editor advertises.
 *
 * Anything left over — an unknown name, or a known one with nothing behind it —
 * collapses to an empty string. No half-substituted message should ever reach a
 * customer with `{{nome_empresa}}` still in it.
 */
function fillVars(text: string, vars: Record<string, string>): string {
  return text.replace(
    /\{\{\s*([a-z0-9_]+)\s*\}\}/gi,
    (_match, name: string) => vars[name.toLowerCase()] ?? "",
  );
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdmin();
  await reapStuck(admin);

  const { data: items, error } = await admin.rpc("claim_pending_whatsapp_queue", {
    p_limit: BATCH_SIZE,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) return NextResponse.json({ processed: 0, failed: 0 });

  const connections = new Map<string, WhatsAppConnection | null>();
  let processed = 0;
  let failed = 0;

  const connectionsById = new Map<string, WhatsAppConnection | null>();
  const featureCache = new Map<string, boolean>();

  for (const item of items as any[]) {
    try {
      if (!(await whatsappEnabledFor(admin, item.workspace_id, featureCache))) {
        await finish(admin, item.id, {
          status: "failed",
          error: "Recurso 'whatsapp' não está habilitado neste workspace.",
        });
        failed++;
        continue;
      }

      if (item.group_jid) {
        // Group broadcast: no contact, no thread, no JID resolution — the
        // group JID is already the send target, straight from fetchGroups().
        const connection = item.connection_id
          ? await connectionForId(admin, item.connection_id, connectionsById)
          : await connectionFor(admin, item.workspace_id, connections);

        if (!connection || connection.status !== "open") {
          await finish(admin, item.id, {
            status: "failed",
            error: "WhatsApp não está conectado. Conecte em Configurações > WhatsApp.",
          });
          failed++;
          continue;
        }

        const template = await resolveText(admin, item);
        if (!template) {
          await finish(admin, item.id, {
            status: "failed",
            error: "A ação não tem mensagem.",
          });
          failed++;
          continue;
        }

        const context = await loadDealContext(admin, item.deal_id ?? null);
        const text = fillVars(template, context.vars).trim();
        if (!text) {
          await finish(admin, item.id, {
            status: "failed",
            error: "A mensagem ficou vazia depois de substituir as variáveis.",
          });
          failed++;
          continue;
        }

        try {
          await getDriver(connection).sendText(item.group_jid, text);
          await finish(admin, item.id, { status: "sent", sent_at: new Date().toISOString() });
          processed++;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Falha no envio";
          await finish(admin, item.id, { status: "failed", error: message.slice(0, 500) });
          failed++;
        }
        continue;
      }

      const connection = await connectionFor(admin, item.workspace_id, connections);
      if (!connection || connection.status !== "open") {
        await finish(admin, item.id, {
          status: "failed",
          error: "WhatsApp não está conectado. Conecte em Configurações > WhatsApp.",
        });
        failed++;
        continue;
      }

      const template = await resolveText(admin, item);
      if (!template) {
        await finish(admin, item.id, {
          status: "failed",
          error: "A ação não tem mensagem nem template com texto.",
        });
        failed++;
        continue;
      }

      const context = await loadDealContext(admin, item.deal_id ?? null);
      const text = fillVars(template, context.vars).trim();
      if (!text) {
        await finish(admin, item.id, {
          status: "failed",
          error: "A mensagem ficou vazia depois de substituir as variáveis.",
        });
        failed++;
        continue;
      }

      const phone = (item.phone ?? "").replace(/\D/g, "") || context.phone;
      if (!phone) {
        await finish(admin, item.id, {
          status: "failed",
          error: "Sem telefone: o negócio não tem contato com número.",
        });
        failed++;
        continue;
      }

      // sentBy stays null: no person clicked send, and the thread should show it
      // as coming from the workspace rather than from whoever built the automation.
      const outcome = await sendWhatsAppMessage(admin, connection, {
        phone,
        text,
        sentBy: null,
      });

      if (outcome.status === "sent") {
        await finish(admin, item.id, { status: "sent", sent_at: new Date().toISOString() });
        processed++;
      } else {
        await finish(admin, item.id, { status: "failed", error: outcome.error ?? "Falha no envio" });
        failed++;
      }
    } catch (err) {
      const message =
        err instanceof UnreachableNumberError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      console.error("whatsapp/queue", item.id, message);
      await finish(admin, item.id, { status: "failed", error: message.slice(0, 500) });
      failed++;
    }
  }

  return NextResponse.json({ processed, failed });
}

/* eslint-enable @typescript-eslint/no-explicit-any */
