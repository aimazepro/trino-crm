import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_deals");
  if (!auth.ok) return auth.response;

  const { data: original } = await admin.from("deals").select("*").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).is("deleted_at", null).maybeSingle();
  if (!original) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const { data: copy, error } = await admin
    .from("deals")
    .insert({
      workspace_id: original.workspace_id, title: `${original.title} (cópia)`, value: original.value,
      pipeline_id: original.pipeline_id, stage_id: original.stage_id, contact_id: original.contact_id,
      company_id: original.company_id, owner_id: original.owner_id, source: original.source,
      status: "Ativo", origin: "app",
    })
    .select("id")
    .single();

  if (error || !copy) return apiError("INTERNAL_ERROR", error?.message ?? "falha ao duplicar", 500);
  return apiSuccess({ id: copy.id }, undefined, 201);
}
