import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_companies");
  if (!auth.ok) return auth.response;
  const { data } = await admin.from("companies").select("*").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!data) return apiError("NOT_FOUND", "Empresa não encontrada", 404);
  return apiSuccess(data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_companies");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("companies").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Empresa não encontrada", 404);

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "cnpj", "website", "segment", "size", "city", "state"] as const) {
    if (key in body) patch[key] = body[key];
  }
  const { data, error } = await admin.from("companies").update(patch as Database["public"]["Tables"]["companies"]["Update"]).eq("id", id).eq("workspace_id", auth.ctx.workspaceId).select("*").single();
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_companies");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("companies").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Empresa não encontrada", 404);

  const { error } = await admin.from("companies").delete().eq("id", id).eq("workspace_id", auth.ctx.workspaceId);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess({ id, deleted: true });
}
