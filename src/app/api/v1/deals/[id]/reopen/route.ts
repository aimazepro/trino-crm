import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_deals");
  if (!auth.ok) return auth.response;

  const { data: deal } = await admin.from("deals").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).is("deleted_at", null).maybeSingle();
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const { error } = await admin.from("deals").update({ status: "Ativo", loss_reason: null }).eq("id", id).eq("workspace_id", auth.ctx.workspaceId);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess({ id, status: "Ativo" });
}
