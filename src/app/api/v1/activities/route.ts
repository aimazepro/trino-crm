import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError, readOptionalUuid } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_activities");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json();
  if (!body.dealId || !body.title || !body.type || !body.date) {
    return apiError("VALIDATION_ERROR", "dealId, title, type e date são obrigatórios", 400);
  }
  const { data: deal } = await admin.from("deals").select("id").eq("id", body.dealId).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!deal) return apiError("VALIDATION_ERROR", "dealId não encontrado neste workspace", 400);

  // `if (body.assigneeId)` era falso para "", que então escapava desta
  // checagem e ia parar na coluna uuid como 22P02. Ver readOptionalUuid.
  const assigneeIdRead = readOptionalUuid(body, "assigneeId");
  if (!assigneeIdRead.ok) return apiError("VALIDATION_ERROR", assigneeIdRead.message, 400);
  const assigneeId = assigneeIdRead.value ?? null;

  if (assigneeId) {
    const { data: assignee } = await admin.from("workspace_members").select("member_user_id").eq("workspace_id", ctx.workspaceId).eq("member_user_id", assigneeId).eq("status", "accepted").maybeSingle();
    if (!assignee) return apiError("VALIDATION_ERROR", "assigneeId não encontrado neste workspace", 400);
  }

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/activities", async () => {
    const { data, error } = await admin
      .from("activities")
      .insert({
        workspace_id: ctx.workspaceId, deal_id: body.dealId, title: body.title, type: body.type,
        date: body.date, description: body.description ?? null, assignee_id: assigneeId,
      })
      .select("*")
      .single();
    if (error || !data) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message } } };
    return { status: 201, body: { data } };
  });
}

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_activities");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const dealId = url.searchParams.get("dealId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  let query = admin.from("activities").select("*").eq("workspace_id", auth.ctx.workspaceId).order("date", { ascending: false }).limit(limit);
  if (dealId) query = query.eq("deal_id", dealId);
  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return new Response(JSON.stringify({ data: data ?? [] }), { headers: { "Content-Type": "application/json" } });
}
