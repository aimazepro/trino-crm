import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export interface ImportRow {
  personName?: string;
  personEmail?: string;
  personPhone?: string;
  personPosition?: string;
  organizationName?: string;
  organizationWebsite?: string;
  organizationCnpj?: string;
  organizationSegment?: string;
  organizationCity?: string;
  organizationState?: string;
  dealTitle?: string;
  dealValue?: string;
  dealStageName?: string;
  dealExpectedCloseDate?: string;
  dealStatus?: string;
  activitySubject?: string;
  activityType?: string;
  activityDueDate?: string;
  noteContent?: string;
}

export interface ImportRequest {
  rows: ImportRow[];
  duplicateStrategy: "merge" | "create_all";
  recordOwner: string;
  stageMappings: Record<string, string>;
  pipelineId: string;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  // dd/MM/yyyy
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

function normalizeStatus(raw: string | undefined): "Ativo" | "Ganho" | "Perdido" {
  const s = (raw ?? "").toLowerCase().trim();
  if (s === "ganho" || s === "won") return "Ganho";
  if (s === "perdido" || s === "lost") return "Perdido";
  return "Ativo";
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cs) {
          try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: ImportRequest = await req.json();
  const { rows, duplicateStrategy, recordOwner, stageMappings, pipelineId } = body;
  const ownerId = recordOwner || user.id;

  if (!rows?.length) return NextResponse.json({ error: "Nenhuma linha" }, { status: 400 });

  const counts = { contacts: 0, companies: 0, deals: 0 };
  const errors: string[] = [];

  // Cache to avoid duplicate DB lookups per import batch
  const companyCache: Record<string, string> = {};
  const contactCache: Record<string, string> = {};

  // Fetch stage -> pipeline mapping
  const { data: allStagesData } = await supabase
    .from("pipeline_stages")
    .select("id, pipeline_id");
  const stageIdToPipelineMap: Record<string, string> = {};
  for (const s of allStagesData ?? []) {
    if (s.id && s.pipeline_id) stageIdToPipelineMap[s.id] = s.pipeline_id;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowLabel = `Linha ${i + 2}`;

    try {
      // ── Company ──────────────────────────────────────────────────────
      let companyId: string | null = null;
      if (row.organizationName?.trim()) {
        const orgName = row.organizationName.trim();
        const cacheKey = orgName.toLowerCase();

        if (companyCache[cacheKey]) {
          companyId = companyCache[cacheKey];
        } else if (duplicateStrategy === "merge") {
          const { data: existing } = await supabase
            .from("companies")
            .select("id")
            .eq("name", orgName)
            .limit(1)
            .maybeSingle();
          if (existing) {
            companyId = existing.id;
          }
        }

        if (!companyId) {
          const { data, error } = await supabase.from("companies").insert({
            user_id: user.id,
            name: orgName,
            website: row.organizationWebsite?.trim() || null,
            cnpj: row.organizationCnpj?.trim() || null,
            segment: row.organizationSegment?.trim() || null,
            city: row.organizationCity?.trim() || null,
            state: row.organizationState?.trim() || null,
          }).select("id").single();
          if (error || !data) {
            errors.push(`${rowLabel}: erro ao criar empresa "${orgName}" — ${error?.message}`);
          } else {
            companyId = data.id;
            counts.companies++;
          }
        }
        if (companyId) companyCache[cacheKey] = companyId;
      }

      // ── Contact ──────────────────────────────────────────────────────
      let contactId: string | null = null;
      if (row.personName?.trim()) {
        const personName = row.personName.trim();
        const personEmail = row.personEmail?.trim() || "";
        const cacheKey = `${personName.toLowerCase()}|${personEmail.toLowerCase()}`;

        if (contactCache[cacheKey]) {
          contactId = contactCache[cacheKey];
        } else if (duplicateStrategy === "merge" && personEmail) {
          const { data: existing } = await supabase
            .from("contacts")
            .select("id")
            .contains("emails", [{ value: personEmail }])
            .limit(1)
            .maybeSingle();
          if (existing) contactId = existing.id;
        }

        if (!contactId) {
          const emails = personEmail ? [{ value: personEmail, type: "Trabalho" }] : [];
          const phones = row.personPhone?.trim()
            ? [{ value: row.personPhone.trim(), type: "Trabalho" }]
            : [];
          const { data, error } = await supabase.from("contacts").insert({
            user_id: user.id,
            name: personName,
            role: row.personPosition?.trim() || "",
            company_id: companyId,
            emails,
            phones,
          }).select("id").single();
          if (error || !data) {
            errors.push(`${rowLabel}: erro ao criar contato "${personName}" — ${error?.message}`);
          } else {
            contactId = data.id;
            counts.contacts++;
          }
        }
        if (contactId) contactCache[cacheKey] = contactId;
      }

      // ── Deal ─────────────────────────────────────────────────────────
      const rawStage = row.dealStageName?.trim() || "";
      const stageId = stageMappings[rawStage] || null;
      const targetPipelineId = (stageId && stageIdToPipelineMap[stageId]) || pipelineId;

      if (row.dealTitle?.trim() && targetPipelineId) {
        if (!stageId && rawStage) {
          errors.push(`${rowLabel}: etapa "${rawStage}" não mapeada — negócio ignorado`);
          continue;
        }
        if (!stageId) {
          // No stage in CSV — skip deal silently
          continue;
        }

        const status = normalizeStatus(row.dealStatus);
        const value = parseFloat(row.dealValue?.replace(/[^\d.,]/g, "").replace(",", ".") || "0") || 0;
        const expectedCloseDate = parseDate(row.dealExpectedCloseDate);

        const { data, error } = await supabase.from("deals").insert({
          user_id: user.id,
          title: row.dealTitle.trim(),
          value,
          contact_id: contactId,
          company_id: companyId,
          pipeline_id: targetPipelineId,
          stage_id: stageId,
          status,
          days_in_stage: 0,
          owner_id: ownerId,
          expected_close_date: expectedCloseDate,
        }).select("id").single();

        if (error || !data) {
          errors.push(`${rowLabel}: erro ao criar negócio "${row.dealTitle}" — ${error?.message}`);
          continue;
        }
        counts.deals++;

        // History entry
        await supabase.from("deal_history").insert({
          deal_id: data.id,
          description: "Negócio importado via CSV",
          subtext: "Importação em lote",
        });

        // Activity
        if (row.activitySubject?.trim() && row.activityDueDate?.trim()) {
          const actDate = parseDate(row.activityDueDate);
          if (actDate) {
            await supabase.from("activities").insert({
              deal_id: data.id,
              title: row.activitySubject.trim(),
              type: row.activityType?.trim() || "Outros",
              date: actDate + "T09:00:00",
              completed: false,
            });
          }
        }

        // Note
        if (row.noteContent?.trim()) {
          await supabase.from("deal_notes").insert({
            deal_id: data.id,
            content: row.noteContent.trim(),
          });
        }
      }
    } catch (err) {
      errors.push(`${rowLabel}: erro inesperado — ${String(err)}`);
    }
  }

  return NextResponse.json({ ...counts, errors });
}
