import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";
import { applyDealCustomFields } from "@/lib/api-lead-helpers";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

async function loadOwnedDeal(admin: ReturnType<typeof createAdmin>, workspaceId: string, id: string) {
  const { data } = await admin.from("deals").select("*").eq("id", id).eq("workspace_id", workspaceId).is("deleted_at", null).maybeSingle();
  return data;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_deals");
  if (!auth.ok) return auth.response;

  const deal = await loadOwnedDeal(admin, auth.ctx.workspaceId, id);
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);
  return apiSuccess(deal);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_deals");
  if (!auth.ok) return auth.response;

  const deal = await loadOwnedDeal(admin, auth.ctx.workspaceId, id);
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  for (const [apiKey, dbKey] of [
    ["title", "title"], ["value", "value"], ["ownerId", "owner_id"], ["contactId", "contact_id"],
    ["source", "source"], ["utmSource", "utm_source"], ["utmMedium", "utm_medium"],
    ["utmCampaign", "utm_campaign"], ["utmContent", "utm_content"], ["utmTerm", "utm_term"],
    ["campaignId", "campaign_id"], ["expectedCloseDate", "expected_close_date"],
  ] as const) {
    if (apiKey in body) patch[dbKey] = body[apiKey];
  }

  if (patch.contact_id) {
    const { data: owned } = await admin.from("contacts").select("id").eq("id", patch.contact_id as string).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
    if (!owned) return apiError("VALIDATION_ERROR", "contactId não encontrado neste workspace", 400);
  }
  if (patch.owner_id) {
    const { data: member } = await admin.from("workspace_members").select("member_user_id").eq("workspace_id", auth.ctx.workspaceId).eq("member_user_id", patch.owner_id as string).eq("status", "accepted").maybeSingle();
    if (!member) return apiError("VALIDATION_ERROR", "ownerId não encontrado neste workspace", 400);
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from("deals").update(patch as Database["public"]["Tables"]["deals"]["Update"]).eq("id", id).eq("workspace_id", auth.ctx.workspaceId);
    if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  }

  const warnings = await applyDealCustomFields(admin, auth.ctx.workspaceId, id, body.customFields);
  const updated = await loadOwnedDeal(admin, auth.ctx.workspaceId, id);
  return apiSuccess(updated, warnings);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "delete_deals");
  if (!auth.ok) return auth.response;

  const deal = await loadOwnedDeal(admin, auth.ctx.workspaceId, id);
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("deals")
    .update({ deleted_at: nowIso, delete_reason: "Excluído via API" })
    .eq("id", id)
    .eq("workspace_id", auth.ctx.workspaceId);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess({ id, deletedAt: nowIso });
}
