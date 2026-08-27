import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmState, CrmNotification } from "@/lib/crm-types";
import { transformPipeline, transformContact, transformCompany, transformLabel, transformDeal } from "@/lib/crm-transforms";
import { seedDefaultPipelines } from "@/lib/crm-seeds";
import type { Database } from "@/lib/supabase/database.types";

export async function loadCrmData(supabase: SupabaseClient<Database>, userId: string): Promise<CrmState> {
  const [
    { data: pipelinesRaw, error: pErr },
    { data: contactsRaw, error: cErr },
    { data: companiesRaw, error: coErr },
    { data: labelsRaw, error: lErr },
    { data: dealsRaw, error: dErr },
    { data: notificationsRaw, error: nErr },
    // Segunda leitura, direto na tabela activities. O embed acima
    // (deals(...activities(*))) só entrega atividade de negócio que este
    // usuário já enxerga pela RLS de `deals` (dono ou gerente) -- o PostgREST
    // filtra o PAI (deals) antes de aplicar o embed, então uma tarefa
    // atribuída a este usuário num negócio de OUTRO dono nunca chega aqui,
    // mesmo a RLS de `activities` autorizando a leitura por assignee_id. Essa
    // query busca exatamente essas "órfãs".
    { data: assignedActivitiesRaw, error: aErr },
  ] = await Promise.all([
    supabase.from("pipelines").select("*, pipeline_stages(*)").order("sort_order"),
    supabase.from("contacts").select("*").order("name").range(0, 499),
    supabase.from("companies").select("*").order("name").range(0, 499),
    supabase.from("labels").select("*"),
    supabase.from("deals").select(`
      *, deal_notes(*), deal_history(*), deal_products(*),
      deal_labels(label_id), activities(*, activity_attachments(*)), appointments(*)
    `).is("deleted_at", null).order("created_at"),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    supabase.from("activities").select("*, activity_attachments(*)").eq("assignee_id", userId),
  ]);

  if (pErr) console.error("[CRM] load pipelines failed:", pErr);
  if (cErr) console.error("[CRM] load contacts failed:", cErr);
  if (coErr) console.error("[CRM] load companies failed:", coErr);
  if (lErr) console.error("[CRM] load labels failed:", lErr);
  if (dErr) console.error("[CRM] load deals failed:", dErr);
  if (aErr) console.error("[CRM] load assigned activities failed:", aErr);

  // Junta as duas fontes de atividade sem duplicar por id. A maioria das
  // atividades atribuídas a este usuário já veio pelo embed (negócio próprio,
  // ou usuário é gerente e enxerga todo mundo); só as "órfãs" (atribuídas
  // neste usuário num negócio de outra pessoa) faltam. Uma órfã não tem
  // negócio visível para pendurar (a RLS de `deals` bloqueia o dono alheio) --
  // ganha um deal-stub mínimo só para existir em /atividades e afins; não é
  // um negócio navegável (sem pipeline/stage reais, some do Kanban sozinho).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (dealsRaw ?? []) as any[];
  const embeddedActivityIds = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deals.flatMap((d) => ((d.activities ?? []) as any[]).map((a) => a.id)),
  );
  const dealById = new Map(deals.map((d) => [d.id, d]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const activity of (assignedActivitiesRaw ?? []) as any[]) {
    if (embeddedActivityIds.has(activity.id)) continue; // já veio pelo embed
    const parent = dealById.get(activity.deal_id);
    if (parent) {
      parent.activities = [...(parent.activities ?? []), activity];
    } else {
      deals.push({
        id: activity.deal_id, title: "Negócio de outro responsável",
        value: 0, pipeline_id: null, stage_id: null, status: "Ativo",
        days_in_stage: 0, stage_entered_at: activity.created_at,
        created_at: activity.created_at, updated_at: activity.created_at,
        deal_labels: [], deal_notes: [], deal_history: [], deal_products: [],
        appointments: [], activities: [activity],
      });
      dealById.set(activity.deal_id, deals[deals.length - 1]);
    }
  }

  const pipelines = await seedDefaultPipelines(
    supabase, userId,
    (pipelinesRaw ?? []).map(transformPipeline),
  );

  let notifications: CrmNotification[] = [];
  if (nErr) {
    console.warn("[CRM] load notifications failed, using localStorage fallback:", nErr);
    try {
      const cached = localStorage.getItem("crm_notifications");
      if (cached) notifications = JSON.parse(cached);
    } catch (e) {
      console.error(e);
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notifications = (notificationsRaw ?? []).map((n: any): CrmNotification => ({
      id: n.id, userId: n.user_id, type: n.type, title: n.title,
      subtext: n.subtext ?? "", href: n.href, read: n.read, createdAt: n.created_at,
    }));
  }
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    pipelines,
    contacts: (contactsRaw ?? []).map(transformContact),
    companies: (companiesRaw ?? []).map(transformCompany),
    labels: (labelsRaw ?? []).map(transformLabel),
    deals: deals.map(transformDeal),
    notifications,
  };
}
