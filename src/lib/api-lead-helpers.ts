import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Dedupes by email or phone within the workspace; creates if no match. Never merges/updates an existing contact's fields. */
export async function findOrCreateContact(
  admin: Admin,
  workspaceId: string,
  input: { name: string; email?: string; phone?: string; companyId?: string | null }
): Promise<{ id: string; created: boolean }> {
  const { data: candidates } = await admin
    .from("contacts")
    .select("id, emails, phones")
    .eq("workspace_id", workspaceId);

  const emailLower = input.email?.toLowerCase().trim();
  const phoneDigits = input.phone ? digitsOnly(input.phone) : undefined;

  const match = (candidates ?? []).find((c) => {
    const emails = ((c.emails as string[] | null) ?? []).map((e) => e.toLowerCase().trim());
    const phones = ((c.phones as string[] | null) ?? []).map((p) => digitsOnly(p));
    return (emailLower && emails.includes(emailLower)) || (phoneDigits && phones.includes(phoneDigits));
  });

  if (match) return { id: match.id, created: false };

  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      emails: input.email ? [input.email] : [],
      phones: input.phone ? [input.phone] : [],
      company_id: input.companyId ?? null,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(`falha ao criar contact: ${error?.message}`);
  return { id: created.id, created: true };
}

/** Dedupes by cnpj (digits-only) if provided, else by exact case-insensitive name. */
export async function findOrCreateCompany(
  admin: Admin,
  workspaceId: string,
  input: { name: string; cnpj?: string }
): Promise<{ id: string; created: boolean }> {
  if (input.cnpj) {
    const cnpjDigits = digitsOnly(input.cnpj);
    const { data: byCnpj } = await admin
      .from("companies")
      .select("id, cnpj")
      .eq("workspace_id", workspaceId);
    const match = (byCnpj ?? []).find((c) => c.cnpj && digitsOnly(c.cnpj) === cnpjDigits);
    if (match) return { id: match.id, created: false };
  } else {
    const { data: byName } = await admin
      .from("companies")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", input.name)
      .maybeSingle();
    if (byName) return { id: byName.id, created: false };
  }

  const { data: created, error } = await admin
    .from("companies")
    .insert({ workspace_id: workspaceId, name: input.name, cnpj: input.cnpj ?? null })
    .select("id")
    .single();

  if (error || !created) throw new Error(`falha ao criar company: ${error?.message}`);
  return { id: created.id, created: true };
}

/**
 * pipelineInput/stageInput accept either a uuid or an exact (case-insensitive)
 * name. Missing/unmatched pipeline -> lowest sort_order pipeline in the
 * workspace. Missing/unmatched stage -> lowest `order` stage in the resolved
 * pipeline. Returns null only if the workspace has zero pipelines.
 */
export async function resolvePipelineStage(
  admin: Admin,
  workspaceId: string,
  pipelineInput?: string,
  stageInput?: string
): Promise<{ pipelineId: string; stageId: string } | null> {
  const { data: pipelines } = await admin
    .from("pipelines")
    .select("id, name, sort_order")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true });

  if (!pipelines || pipelines.length === 0) return null;

  const pipeline =
    (pipelineInput &&
      pipelines.find((p) => p.id === pipelineInput || p.name.toLowerCase() === pipelineInput.toLowerCase())) ||
    pipelines[0];

  const { data: stages } = await admin
    .from("pipeline_stages")
    .select("id, name, order")
    .eq("pipeline_id", pipeline.id)
    .order("order", { ascending: true });

  if (!stages || stages.length === 0) throw new Error(`pipeline '${pipeline.name}' não tem etapas`);

  const stage =
    (stageInput &&
      stages.find((s) => s.id === stageInput || s.name.toLowerCase() === stageInput.toLowerCase())) ||
    stages[0];

  return { pipelineId: pipeline.id, stageId: stage.id };
}

/**
 * Writes/updates deal_field_values for the given deal. Unknown field ids
 * (not present in custom_fields for entity='deal' in this workspace) are
 * skipped and returned as warnings instead of erroring the whole request —
 * same behavior as the reference API doc.
 */
export async function applyDealCustomFields(
  admin: Admin,
  workspaceId: string,
  dealId: string,
  customFields: Record<string, string> | undefined
): Promise<{ field: string; message: string }[]> {
  if (!customFields) return [];
  const warnings: { field: string; message: string }[] = [];

  const { data: validFields } = await admin
    .from("custom_fields")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("entity", "deal");
  const validIds = new Set((validFields ?? []).map((f) => f.id));

  for (const [fieldId, value] of Object.entries(customFields)) {
    if (!validIds.has(fieldId)) {
      warnings.push({ field: fieldId, message: "Custom field not found" });
      continue;
    }
    await admin
      .from("deal_field_values")
      .upsert({ deal_id: dealId, field_id: fieldId, value }, { onConflict: "deal_id,field_id" });
  }
  return warnings;
}
