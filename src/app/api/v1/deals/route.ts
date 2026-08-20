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
