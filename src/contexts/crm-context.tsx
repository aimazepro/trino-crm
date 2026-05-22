"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CrmState, Pipeline, PipelineStage, Deal, Contact, Company,
  Label, HistoryLog, Note, Appointment, Activity, CrmNotification,
} from "@/lib/crm-types";
import { runAutomations } from "@/lib/run-automations";

interface CrmContextType {
  state: CrmState;
  loading: boolean;
  moveDeal: (dealId: string, newStageId: string) => void;
  markDealStatus: (dealId: string, status: "Ganho" | "Perdido" | "Ativo", reason?: string) => void;
  updateDealFields: (dealId: string, fields: Partial<Deal>) => void;
  addDealNote: (dealId: string, content: string) => void;
  deleteDealNote: (dealId: string, noteId: string) => void;
  updateDealNote: (dealId: string, noteId: string, content: string) => void;
  addDealHistory: (dealId: string, description: string, subtext: string) => void;
  addDeal: (deal: Deal) => Promise<string | null>;
  deleteDeal: (dealId: string) => void;
  addPipeline: (pipeline: Pipeline) => Promise<string | null>;
  deletePipeline: (pipelineId: string) => void;
  updatePipeline: (pipelineId: string, fields: Partial<Pipeline>) => void;
  updateContact: (contactId: string, fields: Partial<Contact>) => void;
  addContact: (contact: Contact) => Promise<string | null>;
  updateCompany: (companyId: string, fields: Partial<Company>) => void;
  addCompany: (company: Company) => Promise<string | null>;
  addLabel: (label: Label) => Promise<string | null>;
  addAppointment: (appointment: Omit<Appointment, "id" | "createdAt" | "status">) => void;
  updateAppointment: (appointmentId: string, fields: Partial<Appointment>) => void;
  deleteAppointment: (appointmentId: string) => void;
  addActivity: (activity: Omit<Activity, "id" | "createdAt" | "completed">) => void;
  updateActivity: (activityId: string, fields: Partial<Activity>) => void;
  deleteActivity: (activityId: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformPipeline(row: any): Pipeline {
  return {
    id: row.id,
    name: row.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stages: ((row.pipeline_stages ?? []) as any[])
      .sort((a, b) => a.order - b.order)
      .map((s): PipelineStage => ({ id: s.id, name: s.name, maxDays: s.max_days, order: s.order })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformContact(row: any): Contact {
  return {
    id: row.id, name: row.name, role: row.role ?? "",
    companyId: row.company_id ?? undefined,
    emails: row.emails ?? [], phones: row.phones ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformCompany(row: any): Company {
  return {
    id: row.id, name: row.name,
    website: row.website ?? undefined, segment: row.segment ?? undefined,
    size: row.size ?? undefined, city: row.city ?? undefined,
    state: row.state ?? undefined, cnpj: row.cnpj ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformLabel(row: any): Label {
  return { id: row.id, name: row.name, color: row.color };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformDeal(row: any): Deal {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byDate = (a: any, b: any) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  return {
    id: row.id, title: row.title, value: row.value,
    contactId: row.contact_id, companyId: row.company_id ?? undefined,
    pipelineId: row.pipeline_id, stageId: row.stage_id,
    status: row.status, lossReason: row.loss_reason ?? undefined,
    expectedCloseDate: row.expected_close_date ?? undefined,
    probability: row.probability ?? undefined, source: row.source ?? undefined,
    ownerId: row.owner_id ?? undefined,
    daysInStage: row.days_in_stage,
    createdAt: row.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labels: ((row.deal_labels ?? []) as any[]).map((dl) => dl.label_id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notes: ((row.deal_notes ?? []) as any[]).sort(byDate).map((n): Note => ({
      id: n.id, content: n.content, createdAt: n.created_at,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history: ((row.deal_history ?? []) as any[]).sort(byDate).map((h): HistoryLog => ({
      id: h.id, description: h.description, subtext: h.subtext ?? "", createdAt: h.created_at,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: ((row.deal_products ?? []) as any[]).map((p) => ({
      id: p.id, name: p.name, quantity: p.quantity, price: p.price,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activities: ((row.activities ?? []) as any[]).map((a): Activity => ({
      id: a.id, dealId: a.deal_id, title: a.title, description: a.description ?? undefined,
      date: a.date, type: a.type, completed: a.completed, createdAt: a.created_at,
      guests: a.guests ?? [],
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appointments: ((row.appointments ?? []) as any[]).map((a): Appointment => ({
      id: a.id, dealId: a.deal_id, attendant: a.attendant, procedure: a.procedure,
      link: a.link ?? undefined, date: a.date, status: a.status, createdAt: a.created_at,
    })),
  };
}

function dealToDb(fields: Partial<Deal>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (fields.title !== undefined) db.title = fields.title;
  if (fields.value !== undefined) db.value = fields.value;
  if ("contactId" in fields) db.contact_id = fields.contactId ?? null;
  if ("companyId" in fields) db.company_id = fields.companyId ?? null;
  if (fields.pipelineId !== undefined) db.pipeline_id = fields.pipelineId;
  if (fields.stageId !== undefined) db.stage_id = fields.stageId;
  if (fields.status !== undefined) db.status = fields.status;
  if (fields.lossReason !== undefined) db.loss_reason = fields.lossReason ?? null;
  if (fields.expectedCloseDate !== undefined) db.expected_close_date = fields.expectedCloseDate ?? null;
  if (fields.probability !== undefined) db.probability = fields.probability ?? null;
  if (fields.source !== undefined) db.source = fields.source ?? null;
  if ("ownerId" in fields) db.owner_id = fields.ownerId ?? null;
  if (fields.daysInStage !== undefined) db.days_in_stage = fields.daysInStage;
  return db;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
  return ctx;
}

// Prevents StrictMode double-invoke from seeding pipelines twice
let _pipelinesSeedDone = false;

export function CrmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CrmState>({ pipelines: [], deals: [], contacts: [], companies: [], labels: [], notifications: [] });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const [
        { data: pipelinesRaw, error: pErr },
        { data: contactsRaw },
        { data: companiesRaw },
        { data: labelsRaw },
        { data: dealsRaw },
        { data: notificationsRaw, error: nErr },
      ] = await Promise.all([
        supabase.from("pipelines").select("*, pipeline_stages(*)").order("created_at"),
        supabase.from("contacts").select("*").order("name"),
        supabase.from("companies").select("*").order("name"),
        supabase.from("labels").select("*"),
        supabase.from("deals").select(`
          *, deal_notes(*), deal_history(*), deal_products(*),
          deal_labels(label_id), activities(*), appointments(*)
        `).order("created_at"),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      ]);
      if (pErr) console.error("[CRM] load pipelines failed:", pErr);

      const pipelines = (pipelinesRaw ?? []).map(transformPipeline);

      // Seed default pipelines for new accounts
      if (pipelines.length === 0 && user && !_pipelinesSeedDone) {
        _pipelinesSeedDone = true;
        const DEFAULT_PIPELINES = [
          { name: "Prospecção", stages: ["Entrada de Leads", "Tentando contato", "Contato realizado com a empresa", "Contato realizado com o decisor", "Reunião Agendada"] },
          { name: "Inbound", stages: ["Formulário Preenchido", "Qualificado pelo formulário", "Tentando contato", "Contato realizado", "Reunião Agendada"] },
          { name: "Social Selling", stages: ["MQL Cadastrado", "Tentando contato", "Contato realizado", "Conversa Significativa", "Reunião Agendada"] },
          { name: "Negociação", stages: ["Reunião Realizada", "Proposta Agendada", "Proposta Apresentada", "Negociação", "Contrato"] },
        ];
        for (const def of DEFAULT_PIPELINES) {
          const { data: pData } = await supabase.from("pipelines").insert({ user_id: user.id, name: def.name }).select().single();
          if (pData) {
            const stageRows = def.stages.map((s, i) => ({ pipeline_id: pData.id, name: s, max_days: 7, order: i }));
            const { data: sData } = await supabase.from("pipeline_stages").insert(stageRows).select();
            pipelines.push({
              id: pData.id,
              name: pData.name,
              stages: (sData ?? []).sort((a: any, b: any) => a.order - b.order).map((s: any): PipelineStage => ({ id: s.id, name: s.name, maxDays: s.max_days, order: s.order })),
            });
          }
        }
      }

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
        notifications = (notificationsRaw ?? []).map((n: any): CrmNotification => ({
          id: n.id,
          userId: n.user_id,
          type: n.type,
          title: n.title,
          subtext: n.subtext ?? "",
          href: n.href,
          read: n.read,
          createdAt: n.created_at,
        }));
      }

      if (notifications.length === 0 && user) {
        const SEED_NOTIFICATIONS = [
          {
            type: "activity" as const,
            title: "Ligação",
            subtext: "Hoje as 19:00",
            href: "/atividades",
            read: true
          },
          {
            type: "deal_status" as const,
            title: "teste01",
            subtext: "Negocio ganho!",
            href: "/negocios/cmpga4jdo01aihyn49mudi6i1",
            read: false
          },
          {
            type: "email_open" as const,
            title: "joaoreiscefet@gmail.com abriu seu email",
            subtext: "ola joao",
            href: "/negocios/cmpga4jdo01aihyn49mudi6i1?tab=gmail",
            read: false
          },
          {
            type: "email_open" as const,
            title: "joaoreiscefet@gmail.com abriu seu email",
            subtext: "teste01",
            href: "/negocios/cmpga4jdo01aihyn49mudi6i1?tab=gmail",
            read: false
          },
          {
            type: "email_open" as const,
            title: "joaoreiscefet@gmail.com abriu seu email",
            subtext: "email teste",
            href: "/negocios/cmpga4jdo01aihyn49mudi6i1?tab=gmail",
            read: false
          },
          {
            type: "deal_status" as const,
            title: "negocio teste",
            subtext: "Negocio perdido",
            href: "/negocios/cmpga01qo019yhyn4ra8slrc4",
            read: false
          },
          {
            type: "deal_status" as const,
            title: "Negócio Exemplo",
            subtext: "Negocio ganho!",
            href: "/negocios/cmpg7azcw016nhyn4d9k766sw",
            read: false
          },
          {
            type: "deal_status" as const,
            title: "teste",
            subtext: "Negocio ganho!",
            href: "/negocios/cmpeqeyjy0njshyn42kjw4gj6",
            read: false
          },
          {
            type: "activity" as const,
            title: "Reunião",
            subtext: "Hoje as 00:00",
            href: "/atividades",
            read: true
          },
          {
            type: "activity" as const,
            title: "Reunião",
            subtext: "1 dia atrasado",
            href: "/atividades",
            read: false
          },
          {
            type: "activity" as const,
            title: "Ligação",
            subtext: "1 dia atrasado",
            href: "/atividades",
            read: false
          },
          {
            type: "deal_status" as const,
            title: "Ivone estética",
            subtext: "Negocio perdido",
            href: "/negocios/cmpeqf7iu0njvhyn4w12u6xa9",
            read: false
          }
        ];

        if (!nErr) {
          const insertData = SEED_NOTIFICATIONS.map((n, i) => ({
            user_id: user.id,
            type: n.type,
            title: n.title,
            subtext: n.subtext,
            href: n.href,
            read: n.read,
            created_at: new Date(Date.now() - i * 60000).toISOString(),
          }));
          const { data: inserted, error: seedErr } = await supabase.from("notifications").insert(insertData).select();
          if (!seedErr && inserted) {
            notifications = inserted.map((n: any): CrmNotification => ({
              id: n.id,
              userId: n.user_id,
              type: n.type,
              title: n.title,
              subtext: n.subtext ?? "",
              href: n.href,
              read: n.read,
              createdAt: n.created_at,
            }));
          }
        } else {
          notifications = SEED_NOTIFICATIONS.map((n, i) => ({
            id: `seed_${i}`,
            userId: user.id,
            type: n.type,
            title: n.title,
            subtext: n.subtext,
            href: n.href,
            read: n.read,
            createdAt: new Date(Date.now() - i * 60000).toISOString(),
          }));
          localStorage.setItem("crm_notifications", JSON.stringify(notifications));
        }
      }

      notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setState({
        pipelines,
        contacts: (contactsRaw ?? []).map(transformContact),
        companies: (companiesRaw ?? []).map(transformCompany),
        labels: (labelsRaw ?? []).map(transformLabel),
        deals: (dealsRaw ?? []).map(transformDeal),
        notifications,
      });
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveDeal = (dealId: string, newStageId: string) => {
    const deal = state.deals.find((d) => d.id === dealId);
    const allStages = state.pipelines.flatMap((p) => p.stages);
    const oldStage = allStages.find((s) => s.id === deal?.stageId);
    const newStage = allStages.find((s) => s.id === newStageId);
    const description = "Etapa alterada";
    const subtext = `De ${oldStage?.name ?? "?"} para ${newStage?.name ?? "?"}`;

    setState((prev) => {
      const deals = prev.deals.map((d) => {
        if (d.id !== dealId) return d;
        const log: HistoryLog = {
          id: `log_${Date.now()}`, description, subtext,
          createdAt: new Date().toISOString(),
        };
        return { ...d, stageId: newStageId, daysInStage: 0, history: [log, ...d.history] };
      });
      return { ...prev, deals };
    });
    supabase.from("deals").update({ stage_id: newStageId, days_in_stage: 0 }).eq("id", dealId)
      .then(({ error }) => { if (error) console.error("[CRM] moveDeal failed:", error); });
    supabase.from("deal_history").insert({ deal_id: dealId, description, subtext })
      .then(({ error }) => { if (error) console.error("[CRM] moveDeal history insert failed:", error); });
    if (deal && userId) {
      runAutomations("stage_changed", { ...deal, stageId: newStageId }, { userId, pipelines: state.pipelines });
    }
  };

  const markDealStatus = (dealId: string, status: "Ganho" | "Perdido" | "Ativo", reason?: string) => {
    const deal = state.deals.find((d) => d.id === dealId);
    const description = status === "Ativo" ? "Negócio reaberto" : `Negócio marcado como ${status}`;
    const subtext = reason ? `Motivo: ${reason}` : "";

    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => {
        if (d.id !== dealId) return d;
        const log: HistoryLog = {
          id: `log_${Date.now()}`,
          description,
          subtext,
          createdAt: new Date().toISOString(),
        };
        return { ...d, status, lossReason: reason, history: [log, ...d.history] };
      }),
    }));
    supabase.from("deals").update({ status, loss_reason: reason ?? null }).eq("id", dealId)
      .then(({ error }) => { if (error) console.error("[CRM] markDealStatus failed:", error); });
    supabase.from("deal_history").insert({ deal_id: dealId, description, subtext })
      .then(({ error }) => { if (error) console.error("[CRM] markDealStatus history insert failed:", error); });
    if (deal && userId && (status === "Ganho" || status === "Perdido")) {
      const trigger = status === "Ganho" ? "deal_won" : "deal_lost";
      const updatedDeal = { ...deal, status, lossReason: reason };
      runAutomations(trigger, updatedDeal, { userId, pipelines: state.pipelines });
      // Webhook dispatch handled by DB trigger trg_deals_webhook on deals UPDATE.

      const notifSub = status === "Ganho" ? "Negocio ganho!" : "Negocio perdido";
      supabase.from("notifications").insert({
        user_id: userId,
        type: "deal_status",
        title: deal.title,
        subtext: notifSub,
        href: `/negocios/${dealId}`,
        read: false
      }).then(({ error }) => {
        if (error) {
          console.warn("[CRM] insert deal notification failed, pushing locally:", error);
          const localNotif: CrmNotification = {
            id: `local_deal_${Date.now()}`,
            userId,
            type: "deal_status",
            title: deal.title,
            subtext: notifSub,
            href: `/negocios/${dealId}`,
            read: false,
            createdAt: new Date().toISOString()
          };
          setState(prev => {
            const updated = [localNotif, ...prev.notifications];
            localStorage.setItem("crm_notifications", JSON.stringify(updated));
            return { ...prev, notifications: updated };
          });
          const event = new CustomEvent("new-notification", { detail: localNotif });
          window.dispatchEvent(event);
        }
      });
    }
  };

  const updateDealFields = (dealId: string, fields: Partial<Deal>) => {
    const deal = state.deals.find((d) => d.id === dealId);
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => (d.id === dealId ? { ...d, ...fields } : d)),
    }));
    if (deal && userId) {
      runAutomations("deal_updated", { ...deal, ...fields }, { userId, pipelines: state.pipelines });
    }
    const dbFields = dealToDb(fields);
    if (Object.keys(dbFields).length > 0) {
      supabase.from("deals").update(dbFields).eq("id", dealId)
        .then(({ error }) => { if (error) console.error("[CRM] updateDealFields failed:", error); });
    }
    if (fields.labels !== undefined) {
      supabase.from("deal_labels").delete().eq("deal_id", dealId).then(async () => {
        if (fields.labels!.length > 0) {
          await supabase.from("deal_labels").insert(
            fields.labels!.map((lid) => ({ deal_id: dealId, label_id: lid }))
          );
        }
      });
    }
    if (fields.products !== undefined) {
      supabase.from("deal_products").delete().eq("deal_id", dealId).then(async () => {
        if (fields.products!.length > 0) {
          await supabase.from("deal_products").insert(
            fields.products!.map((p) => ({
              deal_id: dealId,
              name: p.name,
              quantity: p.quantity,
              price: p.price
            }))
          );
        }
      });
    }
  };

  const addDealNote = (dealId: string, content: string) => {
    const tempNote: Note = { id: `note_${Date.now()}`, content, createdAt: new Date().toISOString() };
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => d.id === dealId ? { ...d, notes: [tempNote, ...d.notes] } : d),
    }));
    supabase.from("deal_notes").insert({ deal_id: dealId, content }).select().single()
      .then(({ data, error }) => {
        if (error) {
          console.error("[CRM] addDealNote failed:", error);
          setState((prev) => ({
            ...prev,
            deals: prev.deals.map((d) => d.id === dealId ? { ...d, notes: d.notes.filter((n) => n.id !== tempNote.id) } : d),
          }));
          return;
        }
        if (data) {
          setState((prev) => ({
            ...prev,
            deals: prev.deals.map((d) => d.id === dealId
              ? { ...d, notes: d.notes.map((n) => n.id === tempNote.id ? { ...n, id: data.id, createdAt: data.created_at } : n) }
              : d),
          }));
        }
      });
  };

  const deleteDealNote = (dealId: string, noteId: string) => {
    setState(prev => ({
      ...prev,
      deals: prev.deals.map(d => d.id === dealId ? { ...d, notes: d.notes.filter(n => n.id !== noteId) } : d),
    }));
    supabase.from("deal_notes").delete().eq("id", noteId)
      .then(({ error }) => { if (error) console.error("[CRM] deleteDealNote failed:", error); });
  };

  const updateDealNote = (dealId: string, noteId: string, content: string) => {
    setState(prev => ({
      ...prev,
      deals: prev.deals.map(d => d.id === dealId ? { ...d, notes: d.notes.map(n => n.id === noteId ? { ...n, content } : n) } : d),
    }));
    supabase.from("deal_notes").update({ content }).eq("id", noteId)
      .then(({ error }) => { if (error) console.error("[CRM] updateDealNote failed:", error); });
  };

  const addDealHistory = (dealId: string, description: string, subtext: string) => {
    const log: HistoryLog = { id: `hist_${Date.now()}`, description, subtext, createdAt: new Date().toISOString() };
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => d.id === dealId ? { ...d, history: [log, ...d.history] } : d),
    }));
    supabase.from("deal_history").insert({ deal_id: dealId, description, subtext })
      .then(({ error }) => { if (error) console.error("[CRM] addDealHistory failed:", error); });
  };

  const addDeal = async (deal: Deal): Promise<string | null> => {
    if (!userId) { console.error("[CRM] addDeal: no userId"); alert("Sessão ainda carregando."); return null; }
    const { data, error } = await supabase.from("deals").insert({
      user_id: userId, title: deal.title, value: deal.value,
      contact_id: deal.contactId || null,
      company_id: deal.companyId || null, pipeline_id: deal.pipelineId,
      stage_id: deal.stageId, status: deal.status, days_in_stage: 0,
    }).select().single();
    if (error || !data) {
      console.error("[CRM] addDeal failed:", error);
      alert(`Erro ao criar negócio: ${error?.message ?? "desconhecido"}`);
      return null;
    }
    if (deal.labels.length > 0) {
      await supabase.from("deal_labels").insert(deal.labels.map((lid) => ({ deal_id: data.id, label_id: lid })));
    }
    const { data: histRow } = await supabase.from("deal_history").insert({
      deal_id: data.id, description: "Negócio criado", subtext: "Criado manualmente",
    }).select().single();
    const firstLog: HistoryLog = {
      id: histRow?.id ?? `h_${Date.now()}`,
      description: "Negócio criado",
      subtext: "Criado manualmente",
      createdAt: histRow?.created_at ?? new Date().toISOString(),
    };

    const newDeal: Deal = { ...deal, id: data.id, history: [firstLog], notes: [], products: [], activities: [], appointments: [] };
    setState((prev) => ({ ...prev, deals: [...prev.deals, newDeal] }));
    runAutomations("deal_created", newDeal, { userId, pipelines: state.pipelines });
    // Webhook dispatch handled by DB trigger trg_deals_webhook on deals INSERT.
    return data.id;
  };

  const deleteDeal = (dealId: string) => {
    setState((prev) => ({ ...prev, deals: prev.deals.filter((d) => d.id !== dealId) }));
    supabase.from("deals").delete().eq("id", dealId)
      .then(({ error }) => { if (error) console.error("[CRM] deleteDeal failed:", error); });
  };

  const addPipeline = async (pipeline: Pipeline): Promise<string | null> => {
    if (!userId) {
      console.error("[CRM] addPipeline: userId not loaded");
      alert("Sessão ainda carregando. Tente novamente.");
      return null;
    }
    const { data, error } = await supabase.from("pipelines")
      .insert({ user_id: userId, name: pipeline.name }).select().single();
    if (error || !data) {
      console.error("[CRM] addPipeline failed:", error);
      alert(`Erro ao criar pipeline: ${error?.message ?? "desconhecido"}`);
      return null;
    }

    let stages: PipelineStage[] = pipeline.stages;
    if (pipeline.stages.length > 0) {
      const { data: stagesData, error: sErr } = await supabase.from("pipeline_stages").insert(
        pipeline.stages.map((s) => ({
          pipeline_id: data.id, name: s.name, max_days: s.maxDays, order: s.order,
        }))
      ).select();
      if (sErr) {
        console.error("[CRM] pipeline_stages insert failed, rolling back:", sErr);
        await supabase.from("pipelines").delete().eq("id", data.id);
        alert(`Erro ao criar etapas: ${sErr.message}`);
        return null;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stages = (stagesData ?? []).sort((a: any, b: any) => a.order - b.order)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any): PipelineStage => ({ id: s.id, name: s.name, maxDays: s.max_days, order: s.order }));
    }

    const newPipeline: Pipeline = { id: data.id, name: data.name, stages };
    setState((prev) => ({ ...prev, pipelines: [...prev.pipelines, newPipeline] }));
    return data.id;
  };

  const deletePipeline = (pipelineId: string) => {
    setState((prev) => ({ ...prev, pipelines: prev.pipelines.filter((p) => p.id !== pipelineId) }));
    supabase.from("pipelines").delete().eq("id", pipelineId)
      .then(({ error }) => { if (error) console.error("[CRM] deletePipeline failed:", error); });
  };

  const updatePipeline = (pipelineId: string, fields: Partial<Pipeline>) => {
    setState((prev) => ({
      ...prev,
      pipelines: prev.pipelines.map((p) => (p.id === pipelineId ? { ...p, ...fields } : p)),
    }));
    if (fields.name) {
      supabase.from("pipelines").update({ name: fields.name }).eq("id", pipelineId)
        .then(({ error }) => { if (error) console.error("[CRM] updatePipeline name failed:", error); });
    }
    if (fields.stages) {
      supabase.from("pipeline_stages").delete().eq("pipeline_id", pipelineId).then(async () => {
        const { error } = await supabase.from("pipeline_stages").insert(
          fields.stages!.map((s) => ({
            pipeline_id: pipelineId, name: s.name, max_days: s.maxDays, order: s.order,
          }))
        );
        if (error) console.error("[CRM] updatePipeline stages failed:", error);
      });
    }
  };

  const updateContact = (contactId: string, fields: Partial<Contact>) => {
    setState((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) => (c.id === contactId ? { ...c, ...fields } : c)),
    }));
    const db: Record<string, unknown> = {};
    if (fields.name !== undefined) db.name = fields.name;
    if (fields.role !== undefined) db.role = fields.role;
    if (fields.companyId !== undefined) db.company_id = fields.companyId ?? null;
    if (fields.emails !== undefined) db.emails = fields.emails;
    if (fields.phones !== undefined) db.phones = fields.phones;
    if (Object.keys(db).length > 0) {
      supabase.from("contacts").update(db).eq("id", contactId)
        .then(({ error }) => { if (error) console.error("[CRM] updateContact failed:", error); });
    }
  };

  const addContact = async (contact: Contact): Promise<string | null> => {
    if (!userId) { alert("Sessão ainda carregando."); return null; }
    const { data, error } = await supabase.from("contacts").insert({
      user_id: userId, name: contact.name, role: contact.role, company_id: contact.companyId ?? null,
      emails: contact.emails, phones: contact.phones,
    }).select().single();
    if (error || !data) {
      console.error("[CRM] addContact failed:", error);
      alert(`Erro ao criar contato: ${error?.message ?? "desconhecido"}`);
      return null;
    }
    const newContact = { ...contact, id: data.id };
    setState((prev) => ({ ...prev, contacts: [...prev.contacts, newContact] }));
    return data.id;
  };

  const updateCompany = (companyId: string, fields: Partial<Company>) => {
    setState((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => (c.id === companyId ? { ...c, ...fields } : c)),
    }));
    const db: Record<string, unknown> = {};
    if (fields.name !== undefined) db.name = fields.name;
    if (fields.website !== undefined) db.website = fields.website ?? null;
    if (fields.segment !== undefined) db.segment = fields.segment ?? null;
    if (fields.size !== undefined) db.size = fields.size ?? null;
    if (fields.city !== undefined) db.city = fields.city ?? null;
    if (fields.state !== undefined) db.state = fields.state ?? null;
    if (fields.cnpj !== undefined) db.cnpj = fields.cnpj ?? null;
    // if (fields.parentCompanyId !== undefined) db.parent_company_id = fields.parentCompanyId ?? null;
    if (Object.keys(db).length > 0) {
      supabase.from("companies").update(db).eq("id", companyId)
        .then(({ error }) => { if (error) console.error("[CRM] updateCompany failed:", error); });
    }
  };

  const addCompany = async (company: Company): Promise<string | null> => {
    if (!userId) { alert("Sessão ainda carregando."); return null; }
    const { data, error } = await supabase.from("companies").insert({
      user_id: userId, name: company.name, website: company.website ?? null, segment: company.segment ?? null,
      size: company.size ?? null, city: company.city ?? null, state: company.state ?? null,
      cnpj: company.cnpj ?? null,
    }).select().single();
    if (error || !data) {
      console.error("[CRM] addCompany failed:", error);
      alert(`Erro ao criar empresa: ${error?.message ?? "desconhecido"}`);
      return null;
    }
    setState((prev) => ({ ...prev, companies: [...prev.companies, { ...company, id: data.id }] }));
    return data.id;
  };

  const addLabel = async (label: Label): Promise<string | null> => {
    if (!userId) return null;
    const { data, error } = await supabase.from("labels").insert({
      user_id: userId, name: label.name, color: label.color,
    }).select().single();
    if (error || !data) { console.error("[CRM] addLabel failed:", error); return null; }
    setState((prev) => ({ ...prev, labels: [...prev.labels, { ...label, id: data.id }] }));
    return data.id;
  };

  const addAppointment = (appointment: Omit<Appointment, "id" | "createdAt" | "status">) => {
    const newApt: Appointment = { ...appointment, id: `apt_${Date.now()}`, status: "Scheduled", createdAt: new Date().toISOString() };
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => d.id === appointment.dealId ? { ...d, appointments: [...d.appointments, newApt] } : d),
    }));
    supabase.from("appointments").insert({
      deal_id: appointment.dealId, attendant: appointment.attendant,
      procedure: appointment.procedure, link: appointment.link ?? null, date: appointment.date,
    }).select().single().then(({ data, error }) => {
      if (error) {
        console.error("[CRM] addAppointment failed:", error);
        setState((prev) => ({
          ...prev,
          deals: prev.deals.map((d) => d.id === appointment.dealId
            ? { ...d, appointments: d.appointments.filter((a) => a.id !== newApt.id) } : d),
        }));
        return;
      }
      if (data) {
        setState((prev) => ({
          ...prev,
          deals: prev.deals.map((d) => d.id === appointment.dealId
            ? { ...d, appointments: d.appointments.map((a) => a.id === newApt.id ? { ...a, id: data.id, createdAt: data.created_at } : a) }
            : d),
        }));
      }
    });
  };

  const updateAppointment = (appointmentId: string, fields: Partial<Appointment>) => {
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => ({
        ...d, appointments: d.appointments.map((a) => a.id === appointmentId ? { ...a, ...fields } : a),
      })),
    }));
    const db: Record<string, unknown> = {};
    if (fields.attendant !== undefined) db.attendant = fields.attendant;
    if (fields.procedure !== undefined) db.procedure = fields.procedure;
    if (fields.link !== undefined) db.link = fields.link ?? null;
    if (fields.date !== undefined) db.date = fields.date;
    if (fields.status !== undefined) db.status = fields.status;
    if (Object.keys(db).length > 0) {
      supabase.from("appointments").update(db).eq("id", appointmentId)
        .then(({ error }) => { if (error) console.error("[CRM] updateAppointment failed:", error); });
    }
  };

  const deleteAppointment = (appointmentId: string) => {
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => ({ ...d, appointments: d.appointments.filter((a) => a.id !== appointmentId) })),
    }));
    supabase.from("appointments").delete().eq("id", appointmentId)
      .then(({ error }) => { if (error) console.error("[CRM] deleteAppointment failed:", error); });
  };

  const addActivity = (activity: Omit<Activity, "id" | "createdAt" | "completed">) => {
    const deal = state.deals.find((d) => d.id === activity.dealId);
    const newAct: Activity = { ...activity, id: `act_${Date.now()}`, completed: false, createdAt: new Date().toISOString() };
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => d.id === activity.dealId ? { ...d, activities: [...d.activities, newAct] } : d),
    }));
    if (userId) {
      supabase.from("activities").insert({
        deal_id: activity.dealId, user_id: userId, title: activity.title,
        description: activity.description ?? null, date: activity.date, type: activity.type,
        guests: activity.guests ?? [],
      }).select().single().then(({ data, error }) => {
        if (error) {
          console.error("[CRM] addActivity failed:", error);
          setState((prev) => ({
            ...prev,
            deals: prev.deals.map((d) => d.id === activity.dealId
              ? { ...d, activities: d.activities.filter((a) => a.id !== newAct.id) } : d),
          }));
          return;
        }
        if (data) {
          const savedAct: Activity = {
            ...newAct,
            id: data.id,
            createdAt: data.created_at
          };
          setState((prev) => ({
            ...prev,
            deals: prev.deals.map((d) => d.id === activity.dealId
              ? { ...d, activities: d.activities.map((a) => a.id === newAct.id ? savedAct : a) }
              : d),
          }));
        }
      });

      // Format dynamic subtext for activity time
      const activityDate = new Date(activity.date);
      const today = new Date();
      const isToday = activityDate.toDateString() === today.toDateString();
      let subtext = "";
      if (isToday) {
        subtext = `Hoje as ${activityDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      } else {
        const diffTime = today.getTime() - activityDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          subtext = `${diffDays} ${diffDays === 1 ? "dia" : "dias"} atrasado`;
        } else {
          subtext = `${activityDate.toLocaleDateString("pt-BR")} as ${activityDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
        }
      }

      supabase.from("notifications").insert({
        user_id: userId,
        type: "activity",
        title: activity.title,
        subtext,
        href: "/atividades",
        read: false
      }).then(({ error }) => {
        if (error) {
          console.warn("[CRM] insert activity notification failed, pushing locally:", error);
          const localNotif: CrmNotification = {
            id: `local_act_${Date.now()}`,
            userId,
            type: "activity",
            title: activity.title,
            subtext,
            href: "/atividades",
            read: false,
            createdAt: new Date().toISOString()
          };
          setState(prev => {
            const updated = [localNotif, ...prev.notifications];
            localStorage.setItem("crm_notifications", JSON.stringify(updated));
            return { ...prev, notifications: updated };
          });
          const event = new CustomEvent("new-notification", { detail: localNotif });
          window.dispatchEvent(event);
        }
      });
    }
    if (deal && userId) {
      runAutomations("activity_created", deal, { userId, pipelines: state.pipelines });
    }
  };

  const updateActivity = (activityId: string, fields: Partial<Activity>) => {
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => ({
        ...d, activities: d.activities.map((a) => (a.id === activityId ? { ...a, ...fields } : a)),
      })),
    }));
    const db: Record<string, unknown> = {};
    if (fields.title !== undefined) db.title = fields.title;
    if (fields.description !== undefined) db.description = fields.description ?? null;
    if (fields.date !== undefined) db.date = fields.date;
    if (fields.type !== undefined) db.type = fields.type;
    if (fields.completed !== undefined) db.completed = fields.completed;
    if (fields.guests !== undefined) db.guests = fields.guests;
    if (Object.keys(db).length > 0) {
      supabase.from("activities").update(db).eq("id", activityId)
        .then(({ error }) => { if (error) console.error("[CRM] updateActivity failed:", error); });
    }
  };

  const deleteActivity = (activityId: string) => {
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== activityId) })),
    }));
    supabase.from("activities").delete().eq("id", activityId)
      .then(({ error }) => { if (error) console.error("[CRM] deleteActivity failed:", error); });
  };

  const markNotificationAsRead = (id: string) => {
    setState((prev) => {
      const notifications = prev.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      localStorage.setItem("crm_notifications", JSON.stringify(notifications));
      return { ...prev, notifications };
    });

    supabase.from("notifications").update({ read: true }).eq("id", id)
      .then(({ error }) => { if (error) console.error("[CRM] markNotificationAsRead failed:", error); });
  };

  const markAllNotificationsAsRead = () => {
    setState((prev) => {
      const notifications = prev.notifications.map((n) => ({ ...n, read: true }));
      localStorage.setItem("crm_notifications", JSON.stringify(notifications));
      return { ...prev, notifications };
    });

    if (userId) {
      supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false)
        .then(({ error }) => { if (error) console.error("[CRM] markAllNotificationsAsRead failed:", error); });
    }
  };

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`realtime:notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif: CrmNotification = {
            id: payload.new.id,
            userId: payload.new.user_id,
            type: payload.new.type,
            title: payload.new.title,
            subtext: payload.new.subtext ?? "",
            href: payload.new.href,
            read: payload.new.read,
            createdAt: payload.new.created_at,
          };

          setState((prev) => {
            if (prev.notifications.some((n) => n.id === newNotif.id)) return prev;
            const updated = [newNotif, ...prev.notifications];
            localStorage.setItem("crm_notifications", JSON.stringify(updated));
            return { ...prev, notifications: updated };
          });

          // Dispatch DOM custom event for topbar display
          const event = new CustomEvent("new-notification", { detail: newNotif });
          window.dispatchEvent(event);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  return (
    <CrmContext.Provider value={{
      state, loading,
      moveDeal, markDealStatus, updateDealFields, addDealNote, deleteDealNote, updateDealNote, addDealHistory, addDeal, deleteDeal,
      addPipeline, deletePipeline, updatePipeline,
      updateContact, addContact, updateCompany, addCompany, addLabel,
      addAppointment, updateAppointment, deleteAppointment,
      addActivity, updateActivity, deleteActivity,
      markNotificationAsRead, markAllNotificationsAsRead,
    }}>
      {children}
    </CrmContext.Provider>
  );
}
