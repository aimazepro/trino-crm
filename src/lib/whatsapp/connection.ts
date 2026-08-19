// Server-side helpers for the WhatsApp connection row.
//
// The connection table is not readable by the browser (no grants, see the
// migration), so every read and write goes through here with the service role.

import { createClient as createAdminClient, SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { randomBytes, randomUUID } from "crypto";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import type { ConnectionStatus, WhatsAppConnection, WhatsAppProvider } from "./types";

export function createAdmin(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** The signed-in user, read from the session cookie. Null when unauthenticated. */
export async function getSessionUser(): Promise<{ id: string; email: string | null } | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Route handlers here only read the session; refresh writes are handled
        // by the proxy, so there is nothing to persist back.
        setAll: () => {},
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * The account that owns the WhatsApp instance. A user who was invited into
 * someone else's workspace shares that owner's single instance; everyone else
 * owns their own.
 */
export async function resolveWorkspaceOwner(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await admin
    .from("team_members")
    .select("owner_user_id")
    .eq("member_user_id", userId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();

  const ownerId = (data as { owner_user_id?: string } | null)?.owner_user_id;
  return ownerId ?? userId;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToConnection(row: any): WhatsAppConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider as WhatsAppProvider,
    instanceName: row.instance_name,
    instanceId: row.instance_id,
    instanceToken: row.instance_token ? decryptToken(row.instance_token) : null,
    webhookSecret: row.webhook_secret,
    status: row.status as ConnectionStatus,
    phoneNumber: row.phone_number,
    profileName: row.profile_name,
    profilePicUrl: row.profile_pic_url,
    qrCode: row.qr_code,
    qrExpiresAt: row.qr_expires_at,
    lastError: row.last_error,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function loadConnection(
  admin: SupabaseClient,
  ownerId: string,
): Promise<WhatsAppConnection | null> {
  const { data } = await admin
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", ownerId)
    .maybeSingle();

  return data ? rowToConnection(data) : null;
}

export async function loadConnectionById(
  admin: SupabaseClient,
  connectionId: string,
): Promise<WhatsAppConnection | null> {
  const { data } = await admin
    .from("whatsapp_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();

  return data ? rowToConnection(data) : null;
}

/**
 * Instance names are human-recognisable on the Evolution side ("which account
 * is this?") but keyed on the uid, so changing the account email never orphans
 * a live instance.
 */
function buildInstanceName(ownerId: string, email: string | null): string {
  const local = (email ?? "").split("@")[0].toLowerCase();
  const slug = local.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20);
  return `trinocrm-${slug || "conta"}-${ownerId.slice(0, 8)}`;
}

/** Returns the existing connection, creating the row (not the instance) if absent. */
export async function ensureConnection(
  admin: SupabaseClient,
  ownerId: string,
  email: string | null,
): Promise<WhatsAppConnection> {
  const existing = await loadConnection(admin, ownerId);
  if (existing) return existing;

  const { data, error } = await admin
    .from("whatsapp_connections")
    .insert({
      user_id: ownerId,
      provider: "evolution",
      instance_name: buildInstanceName(ownerId, email),
      webhook_secret: randomBytes(32).toString("hex"),
      status: "disconnected",
    })
    .select("*")
    .single();

  if (error) throw new Error(`could not create WhatsApp connection: ${error.message}`);
  return rowToConnection(data);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function updateConnection(
  admin: SupabaseClient,
  connectionId: string,
  patch: Record<string, any>,
): Promise<void> {
  await admin
    .from("whatsapp_connections")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", connectionId);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function storeInstanceToken(
  admin: SupabaseClient,
  connectionId: string,
  token: string | null,
): Promise<void> {
  if (!token) return;
  await updateConnection(admin, connectionId, { instance_token: encryptToken(token) });
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
];

/**
 * Where Evolution posts events for this connection.
 *
 * WHATSAPP_WEBHOOK_BASE_URL exists so a developer running on localhost still
 * registers the deployed URL: the app and the deployment share one Supabase, so
 * messages ingested in production show up locally over Realtime. Without the
 * override, `next dev` would happily register http://localhost:3000 and the
 * webhook would never fire — which is why an unreachable base is a hard error
 * here rather than a silently broken instance.
 */
export function webhookUrlFor(connectionId: string): string {
  const base = process.env.WHATSAPP_WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    throw new Error("Defina WHATSAPP_WEBHOOK_BASE_URL (ou NEXT_PUBLIC_APP_URL) com a URL pública do app.");
  }

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error(`URL de webhook inválida: "${base}"`);
  }

  if (parsed.protocol !== "https:" || PRIVATE_HOST_PATTERNS.some((re) => re.test(parsed.hostname))) {
    throw new Error(
      `A Evolution não consegue entregar webhook em "${base}". ` +
        "Defina WHATSAPP_WEBHOOK_BASE_URL com a URL pública https do app (ex.: https://trino-crm.vercel.app).",
    );
  }

  return `${base.replace(/\/+$/, "")}/api/whatsapp/webhook/${connectionId}`;
}

export function newWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

export { randomUUID };
