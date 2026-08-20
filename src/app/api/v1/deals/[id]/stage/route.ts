import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_deals");
  if (!auth.ok) return auth.response;

  const { stageId } = await request.json();
  if (!stageId) return apiError("VALIDATION_ERROR", "stageId é obrigatório", 400);

  const { data: stage } = await admin.from("pipeline_stages").select("id, pipeline_id").eq("id", stageId).maybeSingle();
  if (!stage) return apiError("VALIDATION_ERROR", "stageId não encontrado", 400);
  const { data: stagePipeline } = await admin.from("pipelines").select("id").eq("id", stage.pipeline_id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!stagePipeline) return apiError("VALIDATION_ERROR", "stageId não encontrado neste workspace", 400);

  const { data: deal } = await admin.from("deals").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).is("deleted_at", null).maybeSingle();
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const { error } = await admin.from("deals").update({ stage_id: stageId, days_in_stage: 0, stage_entered_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", auth.ctx.workspaceId);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess({ id, stageId });
}
