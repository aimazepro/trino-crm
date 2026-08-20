import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";
import { findOrCreateContact, resolvePipelineStage, applyDealCustomFields } from "@/lib/api-lead-helpers";

export const dynamic = "force-dynamic";

interface CreateDealBody {
  title?: string;
  value?: number;
  pipeline?: string;
  stage?: string;
  ownerId?: string;
  contactId?: string;
  contact?: { name: string; email?: string; phone?: string };
  note?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  campaignId?: string;
  customFields?: Record<string, string>;
}

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_deals");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  let body: CreateDealBody;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
  }

  if (!body.contactId && !body.contact) {
    return apiError("VALIDATION_ERROR", "Informe contactId ou contact", 400);
  }
  if (body.contact && !body.contact.name) {
    return apiError("VALIDATION_ERROR", "contact.name é obrigatório", 400);
  }
  if (body.contact && !body.contact.email && !body.contact.phone) {
    return apiError("VALIDATION_ERROR", "contact precisa de email ou phone", 400);
  }

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/deals", async () => {
    let contactId = body.contactId;
    if (!contactId && body.contact) {
      const result = await findOrCreateContact(admin, ctx.workspaceId, body.contact);
      contactId = result.id;
    } else if (contactId) {
      const { data: owned } = await admin
        .from("contacts")
        .select("id")
        .eq("id", contactId)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (!owned) return { status: 400, body: { error: { code: "VALIDATION_ERROR", message: "contactId não encontrado neste workspace" } } };
    }

    const resolved = await resolvePipelineStage(admin, ctx.workspaceId, body.pipeline, body.stage);
    if (!resolved) {
      return { status: 400, body: { error: { code: "VALIDATION_ERROR", message: "Workspace não tem nenhum pipeline configurado" } } };
    }

    const { data: contactRow } = await admin.from("contacts").select("name").eq("id", contactId!).maybeSingle();
    const title = body.title || `Lead — ${contactRow?.name ?? "Sem nome"}`;

    const { data: deal, error } = await admin
      .from("deals")
      .insert({
        workspace_id: ctx.workspaceId,
        title,
        value: body.value ?? 0,
        pipeline_id: resolved.pipelineId,
        stage_id: resolved.stageId,
        contact_id: contactId,
        owner_id: body.ownerId ?? ctx.defaultOwnerId,
        source: body.source ?? null,
        utm_source: body.utmSource ?? null,
        utm_medium: body.utmMedium ?? null,
        utm_campaign: body.utmCampaign ?? null,
        utm_content: body.utmContent ?? null,
        utm_term: body.utmTerm ?? null,
        campaign_id: body.campaignId ?? null,
        origin: "api",
        status: "Ativo",
      })
      .select("id")
      .single();

    if (error || !deal) {
      return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message ?? "falha ao criar negócio" } } };
    }

    if (body.note) {
      await admin.from("deal_notes").insert({ deal_id: deal.id, content: body.note });
    }

    const warnings = await applyDealCustomFields(admin, ctx.workspaceId, deal.id, body.customFields);

    return { status: 201, body: { data: { id: deal.id, contactId, created: true }, ...(warnings.length ? { warnings } : {}) } };
  });
}

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_deals");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const cursor = url.searchParams.get("cursor");
  const status = url.searchParams.get("status");
  const pipeline = url.searchParams.get("pipeline");
  const stage = url.searchParams.get("stage");
  const owner = url.searchParams.get("owner");
  const updatedSince = url.searchParams.get("updatedSince");

  let query = admin
    .from("deals")
    .select("id, title, value, status, pipeline_id, stage_id, owner_id, contact_id, source, origin, created_at, updated_at")
    .eq("workspace_id", ctx.workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (status) query = query.eq("status", status);
  if (pipeline) query = query.eq("pipeline_id", pipeline);
  if (stage) query = query.eq("stage_id", stage);
  if (owner) query = query.eq("owner_id", owner);
  if (updatedSince) query = query.gte("updated_at", updatedSince);
  if (cursor) {
    const [cCreatedAt, cId] = Buffer.from(cursor, "base64").toString("utf8").split("|");
    query = query.or(`created_at.lt.${cCreatedAt},and(created_at.eq.${cCreatedAt},id.lt.${cId})`);
  }

  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? Buffer.from(`${last.created_at}|${last.id}`).toString("base64") : null;

  return new Response(JSON.stringify({ data: page, nextCursor }), { headers: { "Content-Type": "application/json" } });
}
