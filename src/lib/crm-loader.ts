import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmState, CrmNotification } from "@/lib/crm-types";
import { transformPipeline, transformContact, transformCompany, transformLabel, transformDeal } from "@/lib/crm-transforms";
import { seedDefaultPipelines } from "@/lib/crm-seeds";

export async function loadCrmData(supabase: SupabaseClient, userId: string): Promise<CrmState> {
  const [
    { data: pipelinesRaw, error: pErr },
    { data: contactsRaw, error: cErr },
    { data: companiesRaw, error: coErr },
    { data: labelsRaw, error: lErr },
    { data: dealsRaw, error: dErr },
    { data: notificationsRaw, error: nErr },
  ] = await Promise.all([
    supabase.from("pipelines").select("*, pipeline_stages(*)").order("created_at"),
    supabase.from("contacts").select("*").order("name").range(0, 499),
    supabase.from("companies").select("*").order("name").range(0, 499),
    supabase.from("labels").select("*"),
    supabase.from("deals").select(`
      *, deal_notes(*), deal_history(*), deal_products(*),
      deal_labels(label_id), activities(*), appointments(*)
    `).order("created_at"),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }),
  ]);

  if (pErr) console.error("[CRM] load pipelines failed:", pErr);
  if (cErr) console.error("[CRM] load contacts failed:", cErr);
  if (coErr) console.error("[CRM] load companies failed:", coErr);
  if (lErr) console.error("[CRM] load labels failed:", lErr);
  if (dErr) console.error("[CRM] load deals failed:", dErr);

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
    deals: (dealsRaw ?? []).map(transformDeal),
    notifications,
  };
}
