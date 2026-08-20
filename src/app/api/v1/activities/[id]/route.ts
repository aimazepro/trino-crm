import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_activities");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("activities").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Atividade não encontrada", 404);

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  for (const [apiKey, dbKey] of [["title", "title"], ["description", "description"], ["date", "date"], ["assigneeId", "assignee_id"], ["type", "type"]] as const) {
    if (apiKey in body) patch[dbKey] = body[apiKey];
  }

  if (patch.assignee_id) {
    const { data: assignee } = await admin.from("workspace_members").select("member_user_id").eq("workspace_id", auth.ctx.workspaceId).eq("member_user_id", patch.assignee_id as string).eq("status", "accepted").maybeSingle();
    if (!assignee) return apiError("VALIDATION_ERROR", "assigneeId não encontrado neste workspace", 400);
  }

  const { data, error } = await admin.from("activities").update(patch as Database["public"]["Tables"]["activities"]["Update"]).eq("id", id).eq("workspace_id", auth.ctx.workspaceId).select("*").single();
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_activities");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("activities").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Atividade não encontrada", 404);

  const { error } = await admin.from("activities").delete().eq("id", id).eq("workspace_id", auth.ctx.workspaceId);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess({ id, deleted: true });
}
