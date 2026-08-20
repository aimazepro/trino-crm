import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";
import { findOrCreateCompany } from "@/lib/api-lead-helpers";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_companies");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json();
  if (!body.name) return apiError("VALIDATION_ERROR", "name é obrigatório", 400);

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/companies", async () => {
    const { id, created } = await findOrCreateCompany(admin, ctx.workspaceId, { name: body.name, cnpj: body.cnpj });

    // findOrCreateCompany only sets name/cnpj on insert -- apply the rest of
    // the fields (website/segment/size/city/state) as a follow-up update,
    // whether the row is new or an existing match (both cases: the caller's
    // data wins for these secondary fields).
    const patch: Record<string, unknown> = {};
    for (const key of ["website", "segment", "size", "city", "state"] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (Object.keys(patch).length > 0) {
      await admin.from("companies").update(patch as Database["public"]["Tables"]["companies"]["Update"]).eq("id", id).eq("workspace_id", ctx.workspaceId);
    }

    const { data, error } = await admin.from("companies").select("*").eq("id", id).single();
    if (error || !data) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message } } };
    return { status: created ? 201 : 200, body: { data } };
  });
}

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_companies");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const { data, error } = await admin.from("companies").select("*").eq("workspace_id", auth.ctx.workspaceId).order("created_at", { ascending: false }).limit(limit);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return new Response(JSON.stringify({ data: data ?? [] }), { headers: { "Content-Type": "application/json" } });
}
