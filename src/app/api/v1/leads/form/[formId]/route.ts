import { createAdmin } from "@/lib/whatsapp/connection";
import { findOrCreateContact, resolvePipelineStage } from "@/lib/api-lead-helpers";

export const dynamic = "force-dynamic";

const PUBLIC_HOST = "api-crm.aimaze.com.br";

function jsonError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;

  // Closes the bypass of hitting trino-crm.vercel.app directly and skipping
  // the Cloudflare WAF/rate-limit in front of the dedicated subdomain (Task 17).
  const host = request.headers.get("host") ?? "";
  if (host !== PUBLIC_HOST && process.env.NODE_ENV === "production") {
    return jsonError("NOT_FOUND", "Not found", 404);
  }

  const admin = createAdmin();
  const { data: form } = await admin
    .from("lead_forms")
    .select("*")
    .eq("id", formId)
    .eq("active", true)
    .maybeSingle();
  if (!form) return jsonError("NOT_FOUND", "Formulário não encontrado", 404);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("VALIDATION_ERROR", "Corpo inválido", 400);
  }

  // request.json() accepts any valid JSON, including literal `null` or a
  // top-level array/string/number — none of those support the `body[...]`
  // property lookups below, so reject anything that isn't a plain object.
  if (typeof body !== "object" || body === null) {
    return jsonError("VALIDATION_ERROR", "Corpo inválido", 400);
  }

  // Honeypot: bots fill every field, including hidden ones. Reply 200 with no
  // side effect so the bot doesn't learn it was caught.
  const honeypotValue = body[form.honeypot_field];
  if (honeypotValue) {
    return Response.json({ data: { received: true } }, { status: 200 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const email = typeof body.email === "string" ? body.email : undefined;
  const phone = typeof body.phone === "string" ? body.phone : undefined;
  const note = typeof body.note === "string" ? body.note : undefined;

  if (!name) return jsonError("VALIDATION_ERROR", "name é obrigatório", 400);
  if (!email && !phone) return jsonError("VALIDATION_ERROR", "email ou phone é obrigatório", 400);

  const contact = await findOrCreateContact(admin, form.workspace_id, { name, email, phone });

  const resolved = await resolvePipelineStage(
    admin,
    form.workspace_id,
    form.pipeline_id ?? undefined,
    form.stage_id ?? undefined
  );
  if (!resolved) return jsonError("INTERNAL_ERROR", "Workspace sem pipeline configurado", 500);

  const { data: deal, error } = await admin
    .from("deals")
    .insert({
      workspace_id: form.workspace_id,
      title: `Lead — ${name}`,
      pipeline_id: resolved.pipelineId,
      stage_id: resolved.stageId,
      contact_id: contact.id,
      owner_id: form.default_owner_id,
      source: form.source_label,
      origin: "form",
      status: "Ativo",
    })
    .select("id")
    .single();

  if (error || !deal) return jsonError("INTERNAL_ERROR", error?.message ?? "falha ao criar negócio", 500);

  if (note) {
    await admin.from("deal_notes").insert({ deal_id: deal.id, content: note });
  }

  return Response.json({ data: { received: true } }, { status: 201 });
}
