import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_notes");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json();
  if (!body.dealId || !body.content) return apiError("VALIDATION_ERROR", "dealId e content são obrigatórios", 400);

  const { data: deal } = await admin.from("deals").select("id").eq("id", body.dealId).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!deal) return apiError("VALIDATION_ERROR", "dealId não encontrado neste workspace", 400);

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/notes", async () => {
    const { data, error } = await admin.from("deal_notes").insert({ deal_id: body.dealId, content: body.content }).select("*").single();
    if (error || !data) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message } } };
    return { status: 201, body: { data } };
  });
}

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_notes");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const dealId = url.searchParams.get("dealId");
  if (!dealId) return apiError("VALIDATION_ERROR", "dealId é obrigatório", 400);

  const { data: deal } = await admin.from("deals").select("id").eq("id", dealId).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const { data, error } = await admin.from("deal_notes").select("*").eq("deal_id", dealId).order("created_at", { ascending: false });
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return new Response(JSON.stringify({ data: data ?? [] }), { headers: { "Content-Type": "application/json" } });
}
