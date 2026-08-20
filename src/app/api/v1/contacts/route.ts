import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_contacts");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json();
  if (!body.name) return apiError("VALIDATION_ERROR", "name é obrigatório", 400);

  if (body.companyId) {
    const { data: ownedCompany } = await admin.from("companies").select("id").eq("id", body.companyId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!ownedCompany) return apiError("VALIDATION_ERROR", "companyId não encontrado neste workspace", 400);
  }

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/contacts", async () => {
    const { data, error } = await admin
      .from("contacts")
      .insert({
        workspace_id: ctx.workspaceId, name: body.name,
        emails: body.email ? [{ value: body.email, type: "Comercial" }] : [],
        phones: body.phone ? [{ value: body.phone, type: "Celular" }] : [],
        company_id: body.companyId ?? null, role: body.role ?? null,
      })
      .select("*")
      .single();
    if (error || !data) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message } } };
    return { status: 201, body: { data } };
  });
}

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_contacts");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const updatedSince = url.searchParams.get("updatedSince");

  let query = admin.from("contacts").select("*").eq("workspace_id", auth.ctx.workspaceId).order("created_at", { ascending: false }).limit(limit);
  if (updatedSince) query = query.gte("created_at", updatedSince); // contacts has no updated_at column — created_at is the closest available filter
  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return new Response(JSON.stringify({ data: data ?? [] }), { headers: { "Content-Type": "application/json" } });
}
