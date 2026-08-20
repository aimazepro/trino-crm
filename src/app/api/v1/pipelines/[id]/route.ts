import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_pipelines");
  if (!auth.ok) return auth.response;

  const { data: pipeline } = await admin.from("pipelines").select("id, name").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!pipeline) return apiError("NOT_FOUND", "Pipeline não encontrado", 404);

  const { data: stages } = await admin.from("pipeline_stages").select("id, name, order").eq("pipeline_id", id).order("order");
  return apiSuccess({ ...pipeline, stages: (stages ?? []).map((s) => ({ id: s.id, name: s.name })) });
}
