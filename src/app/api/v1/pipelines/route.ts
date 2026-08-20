import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_pipelines");
  if (!auth.ok) return auth.response;

  const { data: pipelines, error } = await admin.from("pipelines").select("id, name, sort_order").eq("workspace_id", auth.ctx.workspaceId).order("sort_order");
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  const { data: stages } = await admin.from("pipeline_stages").select("id, name, order, pipeline_id").in("pipeline_id", (pipelines ?? []).map((p) => p.id)).order("order");

  const data = (pipelines ?? []).map((p) => ({
    id: p.id, name: p.name,
    stages: (stages ?? []).filter((s) => s.pipeline_id === p.id).map((s) => ({ id: s.id, name: s.name })),
  }));

  return new Response(JSON.stringify({ data }), { headers: { "Content-Type": "application/json" } });
}
