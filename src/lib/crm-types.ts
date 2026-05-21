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
  parentCompanyId?: string;
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

export interface Activity {
  id: string;
  dealId: string;
  title: string;
  description?: string;
  date: string; 
  type: string; 
  completed: boolean;
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  contactId: string;
  companyId?: string;
  pipelineId: string;
  stageId: string; 
  status: LeadStatus;
  lossReason?: string; 
  expectedCloseDate?: string; 
  probability?: number;
  source?: string; 
  labels: string[]; 
  daysInStage: number; 
  
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

export interface CrmState {
  pipelines: Pipeline[];
  deals: Deal[];
  contacts: Contact[];
  companies: Company[];
  labels: Label[];
  whatsappConnected?: boolean;
}
