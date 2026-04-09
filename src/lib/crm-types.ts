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

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  companyId?: string; // Relation to Company
}

export interface Label {
  id: string;
  name: string;
  color: string; // Tailwind class like "bg-blue-500" or hex code
}

export interface Note {
  id: string;
  content: string;
  createdAt: string; // ISO string
}

export interface HistoryLog {
  id: string;
  description: string; // e.g. "Etapa alterada"
  subtext: string; // e.g. "De Prospecção para Qualificação"
  createdAt: string; // ISO string
}

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  contactId: string;
  companyId?: string;
  pipelineId: string;
  stageId: string; // Current column
  status: LeadStatus;
  lossReason?: string; // If lost
  expectedCloseDate?: string; // ISO string
  probability?: number;
  labels: string[]; // Array of Label IDs
  daysInStage: number; // Counter for SLA check
  
  // Nested relations for the detail page
  notes: Note[];
  history: HistoryLog[];
  products: Product[];
}

export interface PipelineStage {
  id: string;
  name: string;
  maxDays: number; // Stagnation limit
  order: number;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

// Typings for the Context API State
export interface CrmState {
  pipelines: Pipeline[];
  deals: Deal[];
  contacts: Contact[];
  companies: Company[];
  labels: Label[];
}
