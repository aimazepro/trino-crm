import type { Pipeline, PipelineStage, Deal, Contact, Company, Label, Note, HistoryLog, Activity, Appointment } from "@/lib/crm-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformPipeline(row: any): Pipeline {
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
export function transformContact(row: any): Contact {
  return {
    id: row.id, name: row.name, role: row.role ?? "",
    companyId: row.company_id ?? undefined,
    emails: row.emails ?? [], phones: row.phones ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformCompany(row: any): Company {
  return {
    id: row.id, name: row.name,
    website: row.website ?? undefined, segment: row.segment ?? undefined,
    size: row.size ?? undefined, city: row.city ?? undefined,
    state: row.state ?? undefined, cnpj: row.cnpj ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformLabel(row: any): Label {
  return { id: row.id, name: row.name, color: row.color };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformDeal(row: any): Deal {
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
    stageEnteredAt: row.stage_entered_at ?? row.updated_at ?? row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: row.deleted_by ?? undefined,
    deleteReason: row.delete_reason ?? undefined,
    deleteNote: row.delete_note ?? undefined,
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
      date: new Date(a.date).toISOString(), endDate: a.end_date ? new Date(a.end_date).toISOString() : undefined,
      type: a.type, completed: a.completed, createdAt: a.created_at,
      guests: a.guests ?? [], assigneeId: a.assignee_id ?? undefined,
      googleEventId: a.google_event_id ?? undefined, meetLink: a.meet_link ?? undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: ((a.activity_attachments ?? []) as any[]).map((att) => ({
        id: att.id, fileName: att.file_name, filePath: att.file_path, sizeBytes: att.size_bytes,
      })),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appointments: ((row.appointments ?? []) as any[]).map((a): Appointment => ({
      id: a.id, dealId: a.deal_id, attendant: a.attendant, procedure: a.procedure,
      link: a.link ?? undefined, date: a.date, status: a.status, createdAt: a.created_at,
    })),
  };
}

export function dealToDb(fields: Partial<Deal>): Record<string, unknown> {
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
