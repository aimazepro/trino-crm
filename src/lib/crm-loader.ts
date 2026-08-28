import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmState, CrmNotification } from "@/lib/crm-types";
import { transformPipeline, transformContact, transformCompany, transformLabel, transformDeal, transformActivity } from "@/lib/crm-transforms";
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
    // `.order` + `.range` explícitos: sem eles a leitura ficava no limite
    // default do PostgREST e, passando dele, *qual* atividade caía fora era
    // imprevisível. Continua sem paginar de verdade -- é o mesmo teto de 500
    // de contatos e empresas acima, agora com um corte determinístico (as mais
    // recentes primeiro) em vez de silencioso.
    supabase.from("activities").select("*, activity_attachments(*)")
      .eq("assignee_id", userId).order("date", { ascending: false }).range(0, 499),
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
  // neste usuário num negócio de outra pessoa) faltam. Uma órfã NÃO entra em
  // `deals` -- nem como negócio real nem como stub (isso já foi tentado e
  // vazou pra KPI, forecast, export CSV e virou link morto em
  // /negocios/[id]; ver CrmState.orphanActivities). Ela vai pra uma lista à
  // parte, devolvida em `orphanActivities`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (dealsRaw ?? []) as any[];
  const embeddedActivityIds = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deals.flatMap((d) => ((d.activities ?? []) as any[]).map((a) => a.id)),
  );
  const dealById = new Map(deals.map((d) => [d.id, d]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orphanActivitiesRaw: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const activity of (assignedActivitiesRaw ?? []) as any[]) {
    if (embeddedActivityIds.has(activity.id)) continue; // já veio pelo embed
    const parent = dealById.get(activity.deal_id);
    if (parent) {
      parent.activities = [...(parent.activities ?? []), activity];
    } else {
      // Negócio de outro dono: a RLS de `deals` bloqueia a leitura (só dono e
      // gerente enxergam), mesmo a RLS de `activities` liberando esta linha
      // por assignee_id.
      orphanActivitiesRaw.push(activity);
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
    orphanActivities: orphanActivitiesRaw.map(transformActivity),
  };
}
