import { CrmState } from "./crm-types";

export const MOCK_STATE: CrmState = {
  pipelines: [
    {
      id: "pipe_1",
      name: "Prospeccao",
      stages: [
        { id: "stage_1", name: "Entrada de Leads", maxDays: 7, order: 0 },
        { id: "stage_2", name: "Tentando contato", maxDays: 3, order: 1 },
        { id: "stage_3", name: "Contato realizado com a empresa", maxDays: 5, order: 2 },
        { id: "stage_4", name: "Contato realizado com o decisor", maxDays: 5, order: 3 },
        { id: "stage_5", name: "Reuniao Agendada", maxDays: 7, order: 4 },
      ]
    },
    {
      id: "pipe_2",
      name: "Inbound",
      stages: [
        { id: "stage_in_1", name: "Lead Novo", maxDays: 2, order: 0 },
        { id: "stage_in_2", name: "Qualificando", maxDays: 5, order: 1 },
        { id: "stage_in_3", name: "Apresentação", maxDays: 7, order: 2 },
      ]
    }
  ],
  labels: [
    { id: "lbl_1", name: "VIP", color: "#3B82F6" },
    { id: "lbl_2", name: "Urgente", color: "#EF4444" },
    { id: "lbl_3", name: "Frio", color: "#9CA3AF" },
  ],
  companies: [
    {
      id: "comp_1",
      name: "Valmed Servicos Ambulancia Ltda",
      website: "https://valmedambulancia.com",
      segment: "UTI móvel",
      size: "Empresa de Pequeno Porte",
      city: "SANTA LUZIA",
      state: "MG",
      cnpj: "57883097000145"
    },
    {
      id: "comp_2",
      name: "Phoenix Servicos Medicos Ltda",
      city: "SÃO PAULO",
      state: "SP",
    }
  ],
  contacts: [
    {
      id: "cont_1",
      name: "Valter Marques Da Silva",
      email: "diretoria@valmedambulancia.com",
      phone: "3197902276",
      role: "Decisor",
      companyId: "comp_1"
    },
    {
      id: "cont_2",
      name: "Elisangela Alves De Lima",
      email: "elisangela@phoenix.com",
      phone: "11999999999",
      role: "Compradora",
      companyId: "comp_2"
    }
  ],
  deals: [
    {
      id: "deal_1",
      title: "Valmed Servicos Ambulancia",
      value: 0,
      contactId: "cont_1",
      companyId: "comp_1",
      pipelineId: "pipe_1",
      stageId: "stage_1", // Entrada de Leads
      status: "Ativo",
      labels: [],
      daysInStage: 0,
      notes: [],
      history: [
        { id: "log_1", description: "Negócio criado", subtext: "Via Importação Manual", createdAt: new Date().toISOString() }
      ],
      products: []
    },
    {
      id: "deal_2",
      title: "Phoenix Servicos Medicos Ltda",
      value: 2500,
      contactId: "cont_2",
      companyId: "comp_2",
      pipelineId: "pipe_1",
      stageId: "stage_1",
      status: "Ativo",
      labels: [],
      daysInStage: 6, // Almost stagnant
      notes: [],
      history: [],
      products: [
         { id: "prod_1", name: "Consultoria Inicial", price: 2500 }
      ]
    }
  ]
};
