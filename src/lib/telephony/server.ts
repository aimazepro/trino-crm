// Helpers server-side da telefonia.
//
// As tabelas telephony_accounts e telephony_extensions guardam credencial de
// provedor e senha SIP, entao nao tem grant nenhum para o browser: toda leitura
// e escrita passa por aqui com service role. Mesmo desenho de
// src/lib/whatsapp/connection.ts -- os helpers de sessao sao repetidos de
// proposito para nao mexer no modulo do WhatsApp, que esta em producao.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import {
  createTelephonyAdmin,
  type TelephonyAccountRow,
  type TelephonyClient,
  type TelephonyExtensionRow,
} from "./db";

export { createTelephonyAdmin };
export type { TelephonyClient };

/** O usuario logado, lido do cookie de sessao. Null quando nao autenticado. */
export async function getSessionUser(): Promise<{ id: string; email: string | null } | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function resolveWorkspaceId(
  admin: TelephonyClient,
  userId: string,
): Promise<string> {
  const { data } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("member_user_id", userId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();

  if (!data) throw new Error(`no workspace membership found for user ${userId}`);
  return data.workspace_id;
}

/** Dono = workspaces.owner_user_id. "dono" nao e um papel de workspace_members. */
export async function isWorkspaceOwner(
  admin: TelephonyClient,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("workspaces")
    .select("owner_user_id")
    .eq("id", workspaceId)
    .maybeSingle();
  return data?.owner_user_id === userId;
}

/**
 * Telefonia ilimitada ocupa vaga do plano, entao so vale em plano pago.
 * Trial e free continuam podendo usar o modo por minuto (pre-pago).
 */
export function isPaidPlan(plan: string | null | undefined): boolean {
  const p = (plan ?? "").toLowerCase();
  return p !== "" && p !== "trial" && p !== "free" && p !== "expired";
}

export function newWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/** URL publica que o provedor chama. Recusa host privado -- webhook precisa sair pra internet. */
export function webhookUrlFor(provider: string): string {
  const base =
    process.env.TELEPHONY_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  if (!base) throw new Error("TELEPHONY_WEBHOOK_BASE_URL ou NEXT_PUBLIC_APP_URL nao configurado");

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error(`URL base invalida para webhook: ${base}`);
  }
  if (url.protocol !== "https:") {
    throw new Error("O webhook de telefonia exige https");
  }
  const host = url.hostname;
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error(`Host privado nao alcancavel pelo provedor: ${host}`);
  }

  return `${url.origin.replace(/\/$/, "")}/api/telephony/webhook/${provider}`;
}

export async function loadAccount(
  admin: TelephonyClient,
  workspaceId: string,
): Promise<TelephonyAccountRow | null> {
  const { data } = await admin
    .from("telephony_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data ?? null;
}

/** Cria a linha da conta na primeira visita. Nao fala com provedor nenhum. */
export async function ensureAccount(
  admin: TelephonyClient,
  workspaceId: string,
): Promise<TelephonyAccountRow> {
  const existing = await loadAccount(admin, workspaceId);
  if (existing) return existing;

  const { data, error } = await admin
    .from("telephony_accounts")
    .insert({
      workspace_id: workspaceId,
      provider: (process.env.TELEPHONY_PROVIDER ?? "mock") as string,
      webhook_secret: newWebhookSecret(),
      status: "inactive",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`falha ao criar conta de telefonia: ${error?.message ?? "sem retorno"}`);
  }
  return data;
}

export function credentialsOf(account: TelephonyAccountRow): Record<string, unknown> {
  if (!account.credentials_encrypted) return {};
  try {
    return JSON.parse(decryptToken(account.credentials_encrypted)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function storeCredentials(
  admin: TelephonyClient,
  accountId: string,
  credentials: Record<string, unknown>,
): Promise<void> {
  await admin
    .from("telephony_accounts")
    .update({ credentials_encrypted: encryptToken(JSON.stringify(credentials)) })
    .eq("id", accountId);
}

export async function loadExtensionForUser(
  admin: TelephonyClient,
  workspaceId: string,
  userId: string,
): Promise<TelephonyExtensionRow | null> {
  const { data } = await admin
    .from("telephony_extensions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function listExtensions(
  admin: TelephonyClient,
  workspaceId: string,
): Promise<TelephonyExtensionRow[]> {
  const { data } = await admin
    .from("telephony_extensions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("linked_at", { ascending: true });
  return data ?? [];
}

export function extensionSipPassword(ext: TelephonyExtensionRow): string {
  return ext.sip_password_encrypted ? decryptToken(ext.sip_password_encrypted) : "";
}

export async function storeExtensionSecret(
  admin: TelephonyClient,
  extensionId: string,
  sipPassword: string,
): Promise<void> {
  await admin
    .from("telephony_extensions")
    .update({ sip_password_encrypted: encryptToken(sipPassword) })
    .eq("id", extensionId);
}

/** Resposta camelCase para o browser. Segredo nenhum atravessa esta funcao. */
export function publicExtension(ext: TelephonyExtensionRow) {
  return {
    id: ext.id,
    userId: ext.user_id,
    extension: ext.extension,
    mode: ext.mode,
    dialMode: ext.dial_mode,
    status: ext.status,
    linkedAt: ext.linked_at,
    callbackNumber: ext.callback_number,
  };
}
