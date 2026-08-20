import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_contacts");
  if (!auth.ok) return auth.response;

  const { data } = await admin.from("contacts").select("*").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!data) return apiError("NOT_FOUND", "Contato não encontrado", 404);
  return apiSuccess(data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_contacts");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("contacts").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Contato não encontrado", 404);

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if ("name" in body) patch.name = body.name;
  if ("email" in body) patch.emails = body.email ? [{ value: body.email, type: "Comercial" }] : [];
  if ("phone" in body) patch.phones = body.phone ? [{ value: body.phone, type: "Celular" }] : [];
  if ("companyId" in body) patch.company_id = body.companyId;
  if ("role" in body) patch.role = body.role;

  if (patch.company_id) {
    const { data: ownedCompany } = await admin.from("companies").select("id").eq("id", patch.company_id as string).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
    if (!ownedCompany) return apiError("VALIDATION_ERROR", "companyId não encontrado neste workspace", 400);
  }

  const { data, error } = await admin.from("contacts").update(patch as Database["public"]["Tables"]["contacts"]["Update"]).eq("id", id).eq("workspace_id", auth.ctx.workspaceId).select("*").single();
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_contacts");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("contacts").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Contato não encontrado", 404);

  const { error } = await admin.from("contacts").delete().eq("id", id).eq("workspace_id", auth.ctx.workspaceId);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess({ id, deleted: true });
}
