import type { Database } from "@/lib/supabase/database.types";
// Ties a phone number to the CRM records behind it.
//
// Both entry points need this and must agree: a conversation opened from a deal
// and the same conversation re-found when the person replies have to land on
// one row with the same links, or the thread forks.

import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ConversationLinks {
  contactId: string | null;
  dealId: string | null;
  ownerId: string | null;
}

/**
 * Deals in this CRM are Ativo / Ganho / Perdido — there is no "open". Filtering
 * on the English word matched nothing, which is why conversations were being
 * created with a null deal_id and the "Abrir negócio" button never appeared.
 */
const ACTIVE_DEAL_STATUS = "Ativo";

export async function resolveConversationLinks(
  admin: SupabaseClient<Database>,
  userId: string,
  phone: string,
): Promise<ConversationLinks> {
  const { data: contactId } = await admin.rpc("find_contact_by_phone", {
    p_user_id: userId,
    p_phone: phone,
  });

  if (!contactId) return { contactId: null, dealId: null, ownerId: null };

  const forContact = () =>
    admin
      .from("deals")
      .select("id, owner_id, status, updated_at")
      .eq("workspace_id", userId)
      .eq("contact_id", contactId as string)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1);

  // An active deal is the one a salesperson wants on screen. When every deal
  // for the contact is already won or lost, the most recent one is still better
  // context than no link at all — it is what "the last deal" means to the user.
  const { data: active } = await forContact().eq("status", ACTIVE_DEAL_STATUS).maybeSingle();
  const deal = active ?? (await forContact().maybeSingle()).data;

  return {
    contactId: contactId as string,
    dealId: (deal as any)?.id ?? null,
    ownerId: (deal as any)?.owner_id ?? null,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
