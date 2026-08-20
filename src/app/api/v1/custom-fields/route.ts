import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_custom_fields");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const entity = url.searchParams.get("entity");
  let query = admin.from("custom_fields").select("*").eq("workspace_id", auth.ctx.workspaceId).order("sort_order");
  if (entity) query = query.eq("entity", entity);
  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return new Response(JSON.stringify({ data: data ?? [] }), { headers: { "Content-Type": "application/json" } });
}

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "create_custom_fields");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json();
  if (!body.label || !body.entity) return apiError("VALIDATION_ERROR", "label e entity são obrigatórios", 400);

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/custom-fields", async () => {
    const { data, error } = await admin
      .from("custom_fields")
      .insert({
        workspace_id: ctx.workspaceId, label: body.label, entity: body.entity,
        field_type: body.fieldType ?? "text", field_group: body.fieldGroup ?? "Geral",
        required: body.required ?? false, options: body.options ?? [],
      })
      .select("*")
      .single();
    if (error || !data) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message } } };
    return { status: 201, body: { data } };
  });
}
