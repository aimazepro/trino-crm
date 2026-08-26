// Tipos do schema de telefonia.
//
// `src/lib/supabase/database.types.ts` e gerado a partir do banco remoto e
// ainda nao conhece as tabelas telephony_*. Em vez de regenerar 76 KB de tipos
// (e arrastar junto todo o resto do schema), este arquivo declara so a fatia
// que a telefonia usa. O cliente admin da telefonia e tipado com ela, entao as
// queries daqui continuam com autocomplete e checagem de coluna.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CallDisposition, CallStatus, DestinationType, DialMode, ExtensionMode } from "./types";

export type TelephonyAccountRow = {
  id: string;
  workspace_id: string;
  provider: string;
  provider_account_id: string | null;
  credentials_encrypted: string | null;
  status: "inactive" | "provisioning" | "active" | "suspended";
  caller_id: string | null;
  webhook_secret: string;
  recording_enabled: boolean;
  recording_retention_days: number;
  consent_mode: "announce" | "manual" | "off";
  consent_text: string;
  bill_increment_seconds: number;
  minimum_billable_seconds: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export type TelephonyExtensionRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  extension: string;
  provider_credential_id: string | null;
  sip_username: string | null;
  sip_password_encrypted: string | null;
  sip_server: string | null;
  mode: ExtensionMode;
  dial_mode: DialMode;
  callback_number: string | null;
  status: "active" | "disabled";
  linked_by: string | null;
  linked_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export type TelephonyCallRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  extension_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  activity_id: string | null;
  direction: "outbound" | "inbound";
  from_number: string | null;
  to_number: string;
  provider: string;
  provider_call_id: string | null;
  status: CallStatus;
  hangup_cause: string | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  billed_cents: number;
  rate_cents_per_minute: number;
  billing_mode: ExtensionMode;
  destination_type: DestinationType | null;
  reserved_cents: number;
  recording_status: "none" | "pending" | "stored" | "failed" | "deleted";
  recording_key: string | null;
  recording_expires_at: string | null;
  consent_given: boolean;
  disposition: CallDisposition | null;
  notes: string | null;
  script_id: string | null;
  finalized_at: string | null;
  transcript: string | null;
  transcript_source: "browser" | "provider" | "manual" | null;
  analysis: import("./analysis/prompt").Analysis | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Saida estruturada da analise da ligacao. Definida junto com o prompt em
 * ./analysis/prompt para que o schema pedido a IA e o tipo lido do banco nao
 * possam divergir em silencio.
 */
export type { Analysis as CallAnalysis } from "./analysis/prompt";

export type TelephonyLedgerRow = {
  id: string;
  workspace_id: string;
  kind: "credit_purchase" | "call_debit" | "adjustment" | "refund";
  amount_cents: number;
  balance_after_cents: number;
  call_id: string | null;
  idempotency_key: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export type TelephonyBalanceRow = {
  workspace_id: string;
  balance_cents: number;
  reserved_cents: number;
  updated_at: string;
}

export type TelephonyEventRow = {
  id: string;
  workspace_id: string | null;
  call_id: string | null;
  provider: string;
  provider_event_id: string;
  event_type: string;
  payload: unknown;
  received_at: string;
  processed_at: string | null;
  error: string | null;
}

export type TelephonyRateRow = {
  id: string;
  workspace_id: string | null;
  destination_type: DestinationType;
  cost_cents_per_minute: number;
  price_cents_per_minute: number;
  effective_from: string;
  created_at: string;
}

type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type TelephonyDatabase = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      telephony_accounts: Table<TelephonyAccountRow>;
      telephony_extensions: Table<TelephonyExtensionRow>;
      telephony_calls: Table<TelephonyCallRow>;
      telephony_ledger: Table<TelephonyLedgerRow>;
      telephony_balances: Table<TelephonyBalanceRow>;
      telephony_events: Table<TelephonyEventRow>;
      telephony_rates: Table<TelephonyRateRow>;
      workspaces: Table<{
        id: string;
        name: string;
        slug: string | null;
        plan: string;
        trial_ends_at: string | null;
        owner_user_id: string;
        created_at: string;
        updated_at: string;
      }>;
      workspace_members: Table<{
        id: string;
        workspace_id: string;
        member_user_id: string | null;
        email: string;
        name: string | null;
        role: string;
        status: string;
      }>;
      contacts: Table<{
        id: string;
        workspace_id: string;
        name: string;
        phones: unknown;
      }>;
      deals: Table<{
        id: string;
        workspace_id: string;
        title: string;
        contact_id: string | null;
        owner_id: string | null;
      }>;
      activities: Table<{
        id: string;
        deal_id: string;
        workspace_id: string;
        title: string;
        description: string | null;
        date: string;
        type: string;
        completed: boolean;
        assignee_id: string | null;
      }>;
      scripts: Table<{
        id: string;
        workspace_id: string;
        name: string;
        content: string;
        category: string | null;
        created_at: string;
      }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      telephony_start_call: { Args: Record<string, unknown>; Returns: unknown };
      telephony_attach_provider_call: { Args: Record<string, unknown>; Returns: unknown };
      telephony_finalize_call: { Args: Record<string, unknown>; Returns: unknown };
      telephony_add_credit: { Args: Record<string, unknown>; Returns: unknown };
      telephony_reconcile_stale_calls: { Args: Record<string, unknown>; Returns: number };
      telephony_mark_recording_deleted: { Args: Record<string, unknown>; Returns: unknown };
      telephony_current_rate: { Args: Record<string, unknown>; Returns: number };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type TelephonyClient = SupabaseClient<TelephonyDatabase>;

/** Cliente service role. As tabelas de telefonia com segredo nao tem grant para o browser. */
export function createTelephonyAdmin(): TelephonyClient {
  return createClient<TelephonyDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
