"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CrmState, Pipeline, PipelineStage, Deal, Contact, Company,
  Label, HistoryLog, Note, Appointment, Activity, CrmNotification,
} from "@/lib/crm-types";
import { dealToDb } from "@/lib/crm-transforms";
import { runAutomations } from "@/lib/run-automations";

interface MutationParams {
  state: CrmState;
  setState: React.Dispatch<React.SetStateAction<CrmState>>;
  userId: string | null;
  supabase: SupabaseClient;
}

export function useCrmMutations({ state, setState, userId, supabase }: MutationParams) {
  const moveDeal = (dealId: string, newStageId: string) => {
    const deal = state.deals.find((d) => d.id === dealId);
    const allStages = state.pipelines.flatMap((p) => p.stages);
    const oldStage = allStages.find((s) => s.id === deal?.stageId);
    const newStage = allStages.find((s) => s.id === newStageId);
    const description = "Etapa alterada";
    const subtext = `De ${oldStage?.name ?? "?"} para ${newStage?.name ?? "?"}`;
    const now = new Date().toISOString();

    setState((prev) => {
      const deals = prev.deals.map((d) => {
        if (d.id !== dealId) return d;
        const log: HistoryLog = { id: `log_${Date.now()}`, description, subtext, createdAt: now };
        return { ...d, stageId: newStageId, daysInStage: 0, stageEnteredAt: now, history: [log, ...d.history] };
      });
      return { ...prev, deals };
    });
    supabase.from("deals").update({ stage_id: newStageId, days_in_stage: 0, stage_entered_at: now }).eq("id", dealId)
      .then(({ error }) => { if (error) console.error("[CRM] moveDeal failed:", error); });
    supabase.from("deal_history").insert({ deal_id: dealId, description, subtext })
      .then(({ error }) => { if (error) console.error("[CRM] moveDeal history insert failed:", error); });
    if (deal && userId) {
      runAutomations("stage_changed", { ...deal, stageId: newStageId }, { userId, pipelines: state.pipelines });
    }
  };

  const moveDealToPipeline = (dealId: string, newPipelineId: string, newStageId: string) => {
    const deal = state.deals.find((d) => d.id === dealId);
    if (!deal) return;
    const fromPipeline = state.pipelines.find((p) => p.id === deal.pipelineId);
    const toPipeline = state.pipelines.find((p) => p.id === newPipelineId);
    const toStage = toPipeline?.stages.find((s) => s.id === newStageId);
    const now = new Date().toISOString();
    const description = `Pipeline alterada: ${fromPipeline?.name ?? "?"} → ${toPipeline?.name ?? "?"}`;
    const subtext = toStage ? `Etapa: ${toStage.name}` : "";

    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => {
        if (d.id !== dealId) return d;
        const log: HistoryLog = { id: `log_${Date.now()}`, description, subtext, createdAt: now };
        return { ...d, pipelineId: newPipelineId, stageId: newStageId, daysInStage: 0, stageEnteredAt: now, history: [log, ...d.history] };
      }),
    }));

    supabase.from("deals")
      .update({ pipeline_id: newPipelineId, stage_id: newStageId, stage_entered_at: now, days_in_stage: 0 })
      .eq("id", dealId)
      .then(({ error }) => { if (error) console.error("[CRM] moveDealToPipeline failed:", error); });

    supabase.from("deal_history").insert({ deal_id: dealId, description, subtext })
      .then(({ error }) => { if (error) console.error("[CRM] moveDealToPipeline history insert failed:", error); });
  };

  const markDealStatus = (dealId: string, status: "Ganho" | "Perdido" | "Ativo", reason?: string) => {
    const deal = state.deals.find((d) => d.id === dealId);
    const description = status === "Ativo" ? "Negócio reaberto" : `Negócio marcado como ${status}`;
    const subtext = reason ? `Motivo: ${reason}` : "";

    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => {
        if (d.id !== dealId) return d;
        const log: HistoryLog = { id: `log_${Date.now()}`, description, subtext, createdAt: new Date().toISOString() };
        return { ...d, status, lossReason: reason, history: [log, ...d.history] };
      }),
    }));
    supabase.from("deals").update({ status, loss_reason: reason ?? null }).eq("id", dealId)
      .then(({ error }) => { if (error) console.error("[CRM] markDealStatus failed:", error); });
    supabase.from("deal_history").insert({ deal_id: dealId, description, subtext })
      .then(({ error }) => { if (error) console.error("[CRM] markDealStatus history insert failed:", error); });

    if (deal && userId && (status === "Ganho" || status === "Perdido")) {
      const trigger = status === "Ganho" ? "deal_won" : "deal_lost";
      runAutomations(trigger, { ...deal, status, lossReason: reason }, { userId, pipelines: state.pipelines });

      const notifSub = status === "Ganho" ? "Negocio ganho!" : "Negocio perdido";
      supabase.from("notifications").insert({
        user_id: userId, type: "deal_status", title: deal.title,
        subtext: notifSub, href: `/negocios/${dealId}`, read: false,
      }).then(({ error }) => {
        if (error) {
          console.warn("[CRM] insert deal notification failed, pushing locally:", error);
          const localNotif: CrmNotification = {
            id: `local_deal_${Date.now()}`, userId, type: "deal_status",
            title: deal.title, subtext: notifSub, href: `/negocios/${dealId}`,
            read: false, createdAt: new Date().toISOString(),
          };
          setState(prev => {
            const updated = [localNotif, ...prev.notifications];
            localStorage.setItem("crm_notifications", JSON.stringify(updated));
            return { ...prev, notifications: updated };
          });
          window.dispatchEvent(new CustomEvent("new-notification", { detail: localNotif }));
        }
      });
    }
  };

  const DEAL_FIELD_LABELS: Partial<Record<keyof Deal, string>> = {
    ownerId: "Proprietário", contactId: "Contato", companyId: "Empresa",
    value: "Valor", expectedCloseDate: "Previsão de fechamento",
  };

  const updateDealFields = (dealId: string, fields: Partial<Deal>) => {
    const deal = state.deals.find((d) => d.id === dealId);
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => (d.id === dealId ? { ...d, ...fields } : d)),
    }));
    if (deal) {
      for (const key of Object.keys(fields) as (keyof Deal)[]) {
        const label = DEAL_FIELD_LABELS[key];
        if (label && fields[key] !== deal[key]) {
          addDealHistory(dealId, `${label} alterado`, "");
        }
      }
    }
    if (deal && userId) {
      runAutomations("deal_updated", { ...deal, ...fields }, { userId, pipelines: state.pipelines });
    }
    const dbFields = dealToDb(fields);
    if (Object.keys(dbFields).length > 0) {
      supabase.from("deals").update(dbFields).eq("id", dealId)
        .then(({ error }) => { if (error) console.error("[CRM] updateDealFields failed:", error); });
    }
    if (fields.labels !== undefined) {
      supabase.rpc("replace_deal_labels", { p_deal_id: dealId, p_label_ids: fields.labels })
        .then(({ error }) => { if (error) console.error("[CRM] replace_deal_labels failed:", error); });
    }
    if (fields.products !== undefined) {
      supabase.rpc("replace_deal_products", {
        p_deal_id: dealId,
        p_products: JSON.stringify(fields.products.map((p) => ({ name: p.name, quantity: p.quantity, price: p.price }))),
      }).then(({ error }) => { if (error) console.error("[CRM] replace_deal_products failed:", error); });
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
          addDealHistory(dealId, "Nota adicionada", content.slice(0, 80));
        }
      });
  };

  const deleteDealNote = (dealId: string, noteId: string) => {
    setState(prev => ({
      ...prev,
      deals: prev.deals.map(d => d.id === dealId ? { ...d, notes: d.notes.filter(n => n.id !== noteId) } : d),
    }));
    supabase.from("deal_notes").delete().eq("id", noteId)
      .then(({ error }) => {
        if (error) { console.error("[CRM] deleteDealNote failed:", error); return; }
        addDealHistory(dealId, "Nota removida", "");
      });
  };

  const updateDealNote = (dealId: string, noteId: string, content: string) => {
    setState(prev => ({
      ...prev,
      deals: prev.deals.map(d => d.id === dealId ? { ...d, notes: d.notes.map(n => n.id === noteId ? { ...n, content } : n) } : d),
    }));
    supabase.from("deal_notes").update({ content }).eq("id", noteId)
      .then(({ error }) => {
        if (error) { console.error("[CRM] updateDealNote failed:", error); return; }
        addDealHistory(dealId, "Nota editada", content.slice(0, 80));
      });
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
      contact_id: deal.contactId || null, company_id: deal.companyId || null,
      pipeline_id: deal.pipelineId, stage_id: deal.stageId, status: deal.status, days_in_stage: 0,
      owner_id: deal.ownerId || userId,
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
      description: "Negócio criado", subtext: "Criado manualmente",
      createdAt: histRow?.created_at ?? new Date().toISOString(),
    };
    const newDeal: Deal = { ...deal, id: data.id, history: [firstLog], notes: [], products: [], activities: [], appointments: [] };
    setState((prev) => ({ ...prev, deals: [...prev.deals, newDeal] }));
    runAutomations("deal_created", newDeal, { userId, pipelines: state.pipelines });
    return data.id;
  };

  const deleteDeal = (dealId: string) => {
    setState((prev) => ({ ...prev, deals: prev.deals.filter((d) => d.id !== dealId) }));
    supabase.from("deals").delete().eq("id", dealId)
      .then(({ error }) => { if (error) console.error("[CRM] deleteDeal failed:", error); });
  };

  const addPipeline = async (pipeline: Pipeline): Promise<string | null> => {
    if (!userId) { console.error("[CRM] addPipeline: userId not loaded"); alert("Sessão ainda carregando. Tente novamente."); return null; }
    const { data, error } = await supabase.from("pipelines").insert({ user_id: userId, name: pipeline.name }).select().single();
    if (error || !data) {
      console.error("[CRM] addPipeline failed:", error);
      alert(`Erro ao criar pipeline: ${error?.message ?? "desconhecido"}`);
      return null;
    }
    let stages: PipelineStage[] = pipeline.stages;
    if (pipeline.stages.length > 0) {
      const { data: stagesData, error: sErr } = await supabase.from("pipeline_stages").insert(
        pipeline.stages.map((s) => ({ pipeline_id: data.id, name: s.name, max_days: s.maxDays, order: s.order }))
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
          fields.stages!.map((s) => ({ pipeline_id: pipelineId, name: s.name, max_days: s.maxDays, order: s.order }))
        );
        if (error) console.error("[CRM] updatePipeline stages failed:", error);
      });
    }
  };

  const logContactHistory = (contactId: string, description: string, subtext = "") => {
    if (!userId) return;
    supabase.from("contact_history").insert({ contact_id: contactId, user_id: userId, description, subtext })
      .then(({ error }) => { if (error) console.error("[CRM] logContactHistory failed:", error); });
  };

  const logCompanyHistory = (companyId: string, description: string, subtext = "") => {
    if (!userId) return;
    supabase.from("company_history").insert({ company_id: companyId, user_id: userId, description, subtext })
      .then(({ error }) => { if (error) console.error("[CRM] logCompanyHistory failed:", error); });
  };

  const CONTACT_FIELD_LABELS: Partial<Record<keyof Contact, string>> = {
    name: "Nome", role: "Cargo", companyId: "Empresa", emails: "Email", phones: "Telefone",
  };

  const updateContact = (contactId: string, fields: Partial<Contact>) => {
    const contact = state.contacts.find((c) => c.id === contactId);
    setState((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) => (c.id === contactId ? { ...c, ...fields } : c)),
    }));
    if (contact) {
      for (const key of Object.keys(fields) as (keyof Contact)[]) {
        const label = CONTACT_FIELD_LABELS[key];
        if (label && JSON.stringify(fields[key]) !== JSON.stringify(contact[key])) {
          logContactHistory(contactId, `${label} alterado`, "");
        }
      }
    }
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
    setState((prev) => ({ ...prev, contacts: [...prev.contacts, { ...contact, id: data.id }] }));
    return data.id;
  };

  const deleteContact = (contactId: string) => {
    setState((prev) => ({ ...prev, contacts: prev.contacts.filter((c) => c.id !== contactId) }));
    supabase.from("contacts").delete().eq("id", contactId)
      .then(({ error }) => { if (error) console.error("[CRM] deleteContact failed:", error); });
  };

  const COMPANY_FIELD_LABELS: Partial<Record<keyof Company, string>> = {
    name: "Nome", website: "Site", segment: "Segmento", size: "Porte", city: "Cidade", state: "Estado", cnpj: "CNPJ",
  };

  const updateCompany = (companyId: string, fields: Partial<Company>) => {
    const company = state.companies.find((c) => c.id === companyId);
    setState((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => (c.id === companyId ? { ...c, ...fields } : c)),
    }));
    if (company) {
      for (const key of Object.keys(fields) as (keyof Company)[]) {
        const label = COMPANY_FIELD_LABELS[key];
        if (label && fields[key] !== company[key]) {
          logCompanyHistory(companyId, `${label} alterado`, "");
        }
      }
    }
    const db: Record<string, unknown> = {};
    if (fields.name !== undefined) db.name = fields.name;
    if (fields.website !== undefined) db.website = fields.website ?? null;
    if (fields.segment !== undefined) db.segment = fields.segment ?? null;
    if (fields.size !== undefined) db.size = fields.size ?? null;
    if (fields.city !== undefined) db.city = fields.city ?? null;
    if (fields.state !== undefined) db.state = fields.state ?? null;
    if (fields.cnpj !== undefined) db.cnpj = fields.cnpj ?? null;
    if (Object.keys(db).length > 0) {
      supabase.from("companies").update(db).eq("id", companyId)
        .then(({ error }) => { if (error) console.error("[CRM] updateCompany failed:", error); });
    }
  };

  const addCompany = async (company: Company): Promise<string | null> => {
    if (!userId) { alert("Sessão ainda carregando."); return null; }
    const { data, error } = await supabase.from("companies").insert({
      user_id: userId, name: company.name, website: company.website ?? null,
      segment: company.segment ?? null, size: company.size ?? null,
      city: company.city ?? null, state: company.state ?? null, cnpj: company.cnpj ?? null,
    }).select().single();
    if (error || !data) {
      console.error("[CRM] addCompany failed:", error);
      alert(`Erro ao criar empresa: ${error?.message ?? "desconhecido"}`);
      return null;
    }
    setState((prev) => ({ ...prev, companies: [...prev.companies, { ...company, id: data.id }] }));
    return data.id;
  };

  const deleteCompany = (companyId: string) => {
    setState((prev) => ({ ...prev, companies: prev.companies.filter((c) => c.id !== companyId) }));
    supabase.from("companies").delete().eq("id", companyId)
      .then(({ error }) => { if (error) console.error("[CRM] deleteCompany failed:", error); });
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

  const addActivity = (activity: Omit<Activity, "id" | "createdAt" | "attachments" | "completed"> & { completed?: boolean }) => {
    const deal = state.deals.find((d) => d.id === activity.dealId);
    const newAct: Activity = {
      ...activity, id: `act_${Date.now()}`, completed: activity.completed ?? false,
      createdAt: new Date().toISOString(), attachments: [],
    };
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => d.id === activity.dealId ? { ...d, activities: [...d.activities, newAct] } : d),
    }));
    if (userId) {
      supabase.from("activities").insert({
        deal_id: activity.dealId, user_id: userId, title: activity.title,
        description: activity.description ?? null, date: activity.date,
        end_date: activity.endDate ?? null, type: activity.type,
        completed: activity.completed ?? false, assignee_id: activity.assigneeId ?? userId,
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
          setState((prev) => ({
            ...prev,
            deals: prev.deals.map((d) => d.id === activity.dealId
              ? { ...d, activities: d.activities.map((a) => a.id === newAct.id ? { ...newAct, id: data.id, createdAt: data.created_at } : a) }
              : d),
          }));
          addDealHistory(activity.dealId, "Atividade criada", activity.title);
        }
      });

      const activityDate = new Date(activity.date);
      const today = new Date();
      const isToday = activityDate.toDateString() === today.toDateString();
      let subtext = "";
      if (isToday) {
        subtext = `Hoje as ${activityDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      } else {
        const diffDays = Math.floor((today.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          subtext = `${diffDays} ${diffDays === 1 ? "dia" : "dias"} atrasado`;
        } else {
          subtext = `${activityDate.toLocaleDateString("pt-BR")} as ${activityDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
        }
      }

      supabase.from("notifications").insert({
        user_id: userId, type: "activity", title: activity.title,
        subtext, href: "/atividades", read: false,
      }).then(({ error }) => {
        if (error) {
          console.warn("[CRM] insert activity notification failed, pushing locally:", error);
          const localNotif: CrmNotification = {
            id: `local_act_${Date.now()}`, userId, type: "activity",
            title: activity.title, subtext, href: "/atividades",
            read: false, createdAt: new Date().toISOString(),
          };
          setState(prev => {
            const updated = [localNotif, ...prev.notifications];
            localStorage.setItem("crm_notifications", JSON.stringify(updated));
            return { ...prev, notifications: updated };
          });
          window.dispatchEvent(new CustomEvent("new-notification", { detail: localNotif }));
        }
      });
    }
    if (deal && userId) {
      runAutomations("activity_created", deal, { userId, pipelines: state.pipelines });
    }
  };

  const updateActivity = (activityId: string, fields: Partial<Activity>) => {
    const owningDeal = state.deals.find((d) => d.activities.some((a) => a.id === activityId));
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
    if (fields.endDate !== undefined) db.end_date = fields.endDate ?? null;
    if (fields.type !== undefined) db.type = fields.type;
    if (fields.completed !== undefined) db.completed = fields.completed;
    if (fields.guests !== undefined) db.guests = fields.guests;
    if (fields.assigneeId !== undefined) db.assignee_id = fields.assigneeId ?? null;
    if (Object.keys(db).length > 0) {
      supabase.from("activities").update(db).eq("id", activityId)
        .then(({ error }) => {
          if (error) { console.error("[CRM] updateActivity failed:", error); return; }
          if (fields.completed === true && owningDeal) {
            addDealHistory(owningDeal.id, "Atividade concluída", "");
          }
        });
    }
  };

  const deleteActivity = (activityId: string) => {
    const owningDeal = state.deals.find((d) => d.activities.some((a) => a.id === activityId));
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== activityId) })),
    }));
    supabase.from("activities").delete().eq("id", activityId)
      .then(({ error }) => {
        if (error) { console.error("[CRM] deleteActivity failed:", error); return; }
        if (owningDeal) addDealHistory(owningDeal.id, "Atividade removida", "");
      });
  };

  const addActivityAttachment = async (activityId: string, file: File) => {
    if (!userId) return;
    const path = `${userId}/${activityId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("activity-attachments").upload(path, file);
    if (uploadError) { console.error("[CRM] attachment upload failed:", uploadError); return; }
    const { data, error } = await supabase.from("activity_attachments").insert({
      activity_id: activityId, user_id: userId, file_name: file.name, file_path: path, size_bytes: file.size,
    }).select().single();
    if (error || !data) { console.error("[CRM] attachment insert failed:", error); return; }
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => ({
        ...d,
        activities: d.activities.map((a) => a.id === activityId
          ? { ...a, attachments: [...a.attachments, { id: data.id, fileName: data.file_name, filePath: data.file_path, sizeBytes: data.size_bytes }] }
          : a),
      })),
    }));
  };

  const deleteActivityAttachment = (attachmentId: string) => {
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => ({
        ...d,
        activities: d.activities.map((a) => ({ ...a, attachments: a.attachments.filter((att) => att.id !== attachmentId) })),
      })),
    }));
    supabase.from("activity_attachments").delete().eq("id", attachmentId)
      .then(({ error }) => { if (error) console.error("[CRM] deleteActivityAttachment failed:", error); });
  };

  const markNotificationAsRead = (id: string) => {
    setState((prev) => {
      const notifications = prev.notifications.map((n) => n.id === id ? { ...n, read: true } : n);
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

  return {
    moveDeal, moveDealToPipeline, markDealStatus, updateDealFields,
    addDealNote, deleteDealNote, updateDealNote, addDealHistory,
    addDeal, deleteDeal,
    addPipeline, deletePipeline, updatePipeline,
    updateContact, addContact, deleteContact,
    updateCompany, addCompany, deleteCompany,
    addLabel,
    addAppointment, updateAppointment, deleteAppointment,
    addActivity, updateActivity, deleteActivity,
    addActivityAttachment, deleteActivityAttachment,
    markNotificationAsRead, markAllNotificationsAsRead,
  };
}
