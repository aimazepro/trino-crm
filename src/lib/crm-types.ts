export type LeadStatus = "Ativo" | "Ganho" | "Perdido";

export interface Company {
  id: string;
  name: string;
  website?: string;
  segment?: string;
  size?: string;
  city?: string;
  state?: string;
  cnpj?: string;
}

export type ContactEmail = { value: string; type: string }; 
export type ContactPhone = { value: string; type: string };

export interface Contact {
  id: string;
  name: string;
  emails: ContactEmail[];
  phones: ContactPhone[];
  role: string;
  companyId?: string; 
}

export interface Label {
  id: string;
  name: string;
  color: string; 
}

export interface Note {
  id: string;
  content: string;
  createdAt: string; 
}

export interface HistoryLog {
  id: string;
  description: string; 
  subtext: string; 
  createdAt: string; 
}

export interface DealProduct {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Appointment {
  id: string;
  dealId: string;
  attendant: string;
  procedure: string; 
  link?: string; 
  date: string; 
  status: "Scheduled" | "Cancelled" | "Done"; 
  createdAt: string;
}

export interface ActivityAttachment {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
}

export interface Activity {
  id: string;
  dealId: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  type: string;
  completed: boolean;
  createdAt: string;
  guests?: string[];
  assigneeId?: string | null;
  attachments: ActivityAttachment[];
  googleEventId?: string;
  meetLink?: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  contactId?: string;
  companyId?: string;
  pipelineId: string;
  stageId: string;
  status: LeadStatus;
  lossReason?: string;
  lossReasonId?: string;
  lossReasonNote?: string;
  expectedCloseDate?: string;
  probability?: number;
  source?: string;
  ownerId?: string;
  labels: string[];
  daysInStage: number;
  stageEnteredAt: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  deleteNote?: string;

  notes: Note[];
  history: HistoryLog[];
  products: DealProduct[];
  activities: Activity[];
  appointments: Appointment[];
}

export interface PipelineStage {
  id: string;
  name: string;
  maxDays: number; 
  order: number;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

export interface CrmNotification {
  id: string;
  userId: string;
  type: "activity" | "deal_status" | "email_open";
  title: string;
  subtext: string;
  href: string;
  read: boolean;
  createdAt: string;
}

export interface CrmState {
  pipelines: Pipeline[];
  deals: Deal[];
  contacts: Contact[];
  companies: Company[];
  labels: Label[];
  gmailConnected?: boolean;
  notifications: CrmNotification[];
  // Atividade atribuída a este usuário (assignee_id) num negócio que a RLS de
  // `deals` não deixa ele ler -- dono é outra pessoa, e só dono/gerente
  // enxergam o negócio. NÃO entra em `deals` (nem como stub, nem com flag):
  // qualquer objeto sintético ali exige que todo consumidor de `deals`
  // aprenda a ignorá-lo (KPI, forecast, export CSV, o link de /negocios/[id]
  // já quebrou uma vez assim). Vive à parte; só quem sabe tratar "atividade
  // sem negócio navegável" (hoje, só /atividades) lê daqui.
  orphanActivities: Activity[];
}

// ── Automações ──────────────────────────────────────────────────────────────

export type TriggerType =
  | 'deal_created'
  | 'stage_changed'
  | 'deal_won'
  | 'deal_lost'
  | 'deal_updated'
  | 'deal_updated_any'
  | 'activity_created'
  | 'lead_recebido';

export type AutomationConditionField =
  | 'stage' | 'pipeline' | 'status' | 'value' | 'owner' | 'label' | 'title';

export type AutomationConditionOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'not_contains'
  | 'changed_to'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than';

export interface AutomationConditionRule {
  field: AutomationConditionField;
  operator: AutomationConditionOperator;
  value: string;
  logic?: 'AND' | 'OR';
  groupId?: string;
}

export type ActionType =
  | 'create_deal'
  | 'create_activity'
  | 'move_stage'
  | 'assign_owner'
  | 'mark_won'
  | 'mark_lost'
  | 'add_label'
  | 'duplicate_deal'
  | 'create_note'
  | 'send_webhook'
  | 'send_email'
  | 'send_whatsapp'
  | 'notify_whatsapp_group'
  | 'start_sequence';

export interface AutomationStep {
  id: string;
  type: 'condition' | 'action';
  condition?: {
    rules: AutomationConditionRule[];
  };
  action?: {
    type: ActionType;
    config: Record<string, string | number | boolean>;
  };
}

export interface AutomationLabel {
  id: string;
  name: string;
  color: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: TriggerType | null;
  steps: AutomationStep[];
  labelIds: string[];
  active: boolean;
  executionCount: number;
  createdAt: string;
  updatedAt: string;
}
