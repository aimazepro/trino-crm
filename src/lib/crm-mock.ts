import { CrmState, Pipeline, Contact, Company, Deal, Label } from "./crm-types";

const mockLabels: Label[] = [
  { id: "lbl_1", name: "Prioridade Alta", color: "bg-red-500" },
  { id: "lbl_2", name: "Em Risco", color: "bg-orange-500" },
  { id: "lbl_3", name: "VIP", color: "bg-purple-500" },
];

const mockPipelines: Pipeline[] = [
  {
    id: "pipe_1",
    name: "Prospecção",
    stages: [
      { id: "stage_leads", name: "Entrada de Leads", maxDays: 7, order: 0 },
      { id: "stage_contact", name: "Tentando contato", maxDays: 5, order: 1 },
      { id: "stage_comp", name: "Contato realizado com a empresa", maxDays: 5, order: 2 },
      { id: "stage_decisor", name: "Contato realizado com o decisor", maxDays: 7, order: 3 },
      { id: "stage_reuniao", name: "Reunião Agendada", maxDays: 3, order: 4 },
    ]
  }
];

const mockCompanies: Company[] = [
  { id: "comp_1", name: "Clinica Vida+", city: "São Paulo", state: "SP" },
  { id: "comp_2", name: "Valmed Servicos Ambulancia Ltda" },
  { id: "comp_3", name: "Phoenix Servicos Medicos Ltda" },
];

const mockContacts: Contact[] = [
  { 
    id: "cont_1", 
    name: "Dr. Carlos Eduardo", 
    emails: [{ value: "carlos@vidamais.com.br", type: "Trabalho" }], 
    phones: [{ value: "(11) 99999-8888", type: "Pessoal" }], 
    role: "Diretor Médico", 
    companyId: "comp_1" 
  },
  { 
    id: "cont_2", 
    name: "Valter Marques Da Silva", 
    emails: [{ value: "valter@valmed.com.br", type: "Trabalho" }], 
    phones: [{ value: "(31) 98888-7777", type: "Comercial" }], 
    role: "Sócio", 
    companyId: "comp_2" 
  },
  { 
    id: "cont_3", 
    name: "Elisangela Alves De Lima", 
    emails: [{ value: "elisangela@phoenix.com", type: "Comercial" }], 
    phones: [{ value: "(21) 97777-6666", type: "Comercial" }], 
    role: "Gerente de Compras", 
    companyId: "comp_3" 
  },
];

const mockDeals: Deal[] = [
  {
    id: "deal_1",
    title: "Serviço de Remoção Vida+",
    value: 15000,
    contactId: "cont_1",
    companyId: "comp_1",
    pipelineId: "pipe_1",
    stageId: "stage_leads",
    status: "Ativo",
    daysInStage: 2,
    labels: ["lbl_1", "lbl_3"],
    notes: [
      { id: "note_1", content: "Ligar na parte da tarde.", createdAt: new Date().toISOString() }
    ],
    history: [
      { id: "hist_1", description: "Negócio criado", subtext: "Via Importação", createdAt: new Date().toISOString() }
    ],
    products: [],
    activities: [],
    appointments: []
  },
  {
    id: "deal_2",
    title: "Valmed Servicos Ambulancia",
    value: 0,
    contactId: "cont_2",
    companyId: "comp_2",
    pipelineId: "pipe_1",
    stageId: "stage_leads", // Same column to test sorting
    status: "Ativo",
    daysInStage: 0,
    labels: [],
    notes: [],
    history: [],
    products: [],
    activities: [],
    appointments: []
  },
  {
    id: "deal_3",
    title: "Phoenix Servicos Medicos Ltda",
    value: 2500,
    contactId: "cont_3",
    companyId: "comp_3",
    pipelineId: "pipe_1",
    stageId: "stage_contact",
    status: "Ativo",
    daysInStage: 6, // Should trigger stagnation warning for maxDays: 5
    labels: ["lbl_2"],
    notes: [],
    history: [],
    products: [],
    activities: [],
    appointments: []
  }
];

export const MOCK_STATE: CrmState = {
  pipelines: mockPipelines,
  deals: mockDeals,
  contacts: mockContacts,
  companies: mockCompanies,
  labels: mockLabels,
};
