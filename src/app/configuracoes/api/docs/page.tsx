"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Zap,
  Key,
  Lock,
  Gauge,
  Briefcase,
  Users,
  Building2,
  Calendar,
  FileText,
  GitBranch,
  Sliders,
  UserCheck,
  Globe,
  AlertTriangle,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  Layers,
} from "lucide-react";

interface EndpointDoc {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  scope: string;
  title: string;
  description: string;
  note?: string;
  params?: {
    name: string;
    type: string;
    required: boolean;
    location?: "body" | "query" | "path";
    description: string;
  }[];
  curl: string;
  response: string;
}

interface SectionItem {
  id: string;
  label: string;
  icon: typeof Zap;
}

const NAV_SECTIONS: SectionItem[] = [
  { id: "quickstart", label: "Início rápido", icon: Zap },
  { id: "generate-key", label: "Como gerar API Key", icon: Key },
  { id: "auth", label: "Autenticação", icon: Lock },
  { id: "me", label: "Verificar API Key", icon: ShieldCheck },
  { id: "rate-limit", label: "Rate limiting", icon: Gauge },
  { id: "deals", label: "Negócios", icon: Briefcase },
  { id: "contacts", label: "Contatos", icon: Users },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "activities", label: "Atividades", icon: Calendar },
  { id: "notes", label: "Notas", icon: FileText },
  { id: "pipelines", label: "Pipelines", icon: GitBranch },
  { id: "custom-fields", label: "Campos custom", icon: Sliders },
  { id: "users", label: "Usuários", icon: UserCheck },
  { id: "lead-forms", label: "Formulários de Lead", icon: Globe },
  { id: "errors", label: "Erros", icon: AlertTriangle },
];

const SCOPES_TABLE = [
  { scope: "all", desc: "Acesso irrestrito a todos os endpoints da API" },
  { scope: "read_deals", desc: "Listar e visualizar detalhes de negócios" },
  { scope: "edit_deals", desc: "Criar, editar, mover de etapa, reabrir e duplicar negócios" },
  { scope: "delete_deals", desc: "Exclusão lógica de negócios (soft-delete)" },
  { scope: "read_contacts", desc: "Listar e visualizar contatos vinculados" },
  { scope: "edit_contacts", desc: "Criar, atualizar e excluir contatos" },
  { scope: "read_companies", desc: "Listar e visualizar empresas" },
  { scope: "edit_companies", desc: "Criar, atualizar e excluir empresas" },
  { scope: "read_activities", desc: "Listar tarefas e compromissos" },
  { scope: "edit_activities", desc: "Criar, atualizar, marcar concluído e excluir atividades" },
  { scope: "read_notes", desc: "Listar anotações vinculadas aos negócios" },
  { scope: "edit_notes", desc: "Criar novas anotações em negócios" },
  { scope: "read_pipelines", desc: "Consultar pipelines e etapas (stages)" },
  { scope: "read_custom_fields", desc: "Consultar campos personalizados existentes" },
  { scope: "create_custom_fields", desc: "Criar novos campos customizados" },
  { scope: "read_users", desc: "Listar membros ativos e vendedores do workspace" },
];

const ERROR_CODES_TABLE = [
  { status: "400", code: "VALIDATION_ERROR", desc: "Corpo da requisição inválido, JSON malformado ou campos obrigatórios ausentes" },
  { status: "401", code: "AUTH_REQUIRED", desc: "Header 'Authorization: Bearer trn_...' ausente na requisição" },
  { status: "401", code: "INVALID_API_KEY", desc: "API key inválida, incorreta ou revogada pelo administrador" },
  { status: "402", code: "SUBSCRIPTION_REQUIRED", desc: "Workspace sem plano ativo ou trial expirado (reservado)" },
  { status: "403", code: "INSUFFICIENT_SCOPE", desc: "A chave autenticada não possui a permissão requerida para o endpoint" },
  { status: "404", code: "NOT_FOUND", desc: "Recurso solicitado não existe ou não pertence ao seu workspace" },
  { status: "409", code: "CONFLICT", desc: "Requisição com a mesma Idempotency-Key ainda está em processamento ou chave duplicada" },
  { status: "429", code: "RATE_LIMIT_EXCEEDED", desc: "Limite de requisições por minuto excedido. Aguarde os segundos indicados no header Retry-After" },
  { status: "500", code: "INTERNAL_ERROR", desc: "Erro interno no servidor ao processar a solicitação" },
];

const ENDPOINTS_DATA: Record<string, EndpointDoc[]> = {
  deals: [
    {
      id: "create-deal",
      method: "POST",
      path: "/api/v1/deals",
      scope: "edit_deals",
      title: "Criar negócio (Entrada de Lead)",
      description: "Cria um novo negócio no funil de vendas. Suporta atribuição automática de contato inline com deduplicação por e-mail ou telefone.",
      note: "Gatilho automático 'lead_recebido' é disparado para acionar automações e distribuição round-robin. A chave 'warnings' só aparece na resposta quando há algo a avisar (ex: customField inexistente) — se não houver avisos, a chave não é incluída.",
      params: [
        { name: "title", type: "string", required: false, description: "Título do negócio. Se omitido, é gerado automaticamente como 'Lead — Nome do Contato'." },
        { name: "value", type: "number", required: false, description: "Valor monetário da oportunidade (ex: 5000)." },
        { name: "pipeline", type: "string", required: false, description: "Nome ou ID do pipeline. Se omitido, usa o pipeline padrão do workspace." },
        { name: "stage", type: "string", required: false, description: "Nome ou ID da etapa. Se omitido, usa a 1ª etapa do pipeline." },
        { name: "contactId", type: "string (uuid)", required: false, description: "ID de um contato já cadastrado no workspace." },
        { name: "contact", type: "object", required: false, description: "Dados do contato inline: { name (obrigatório), email, phone }. Cria ou reaproveita contato existente sem duplicar." },
        { name: "ownerId", type: "string (uuid)", required: false, description: "ID do vendedor responsável. Se omitido, usa o proprietário padrão configurado na API key." },
        { name: "note", type: "string", required: false, description: "Observação inicial que será adicionada como primeira nota na timeline do negócio." },
        { name: "source", type: "string", required: false, description: "Canal de origem (ex: 'Facebook Ads', 'Google Ads', 'Site', 'Indicação')." },
        { name: "utmSource", type: "string", required: false, description: "Parâmetro UTM source (ex: 'facebook')." },
        { name: "utmMedium", type: "string", required: false, description: "Parâmetro UTM medium (ex: 'cpc', 'stories')." },
        { name: "utmCampaign", type: "string", required: false, description: "Nome da campanha UTM." },
        { name: "utmContent", type: "string", required: false, description: "Conteúdo do anúncio UTM." },
        { name: "utmTerm", type: "string", required: false, description: "Termo ou palavra-chave UTM." },
        { name: "campaignId", type: "string", required: false, description: "ID externo da campanha na plataforma de anúncio (Meta/Google)." },
        { name: "customFields", type: "object", required: false, description: "Objeto com campos customizados, chaveado pelo ID do campo (não o nome/label): { \"id_do_campo\": \"valor\" }. Descubra os IDs em GET /api/v1/custom-fields." },
      ],
      curl: `curl -X POST https://api-crm.aimaze.com.br/api/v1/deals \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: lead-facebook-98234" \\
  -d '{
    "title": "Lead Meta Ads - Carlos Eduardo",
    "value": 4500,
    "pipeline": "Funil Comercial",
    "stage": "Novo Lead",
    "contact": {
      "name": "Carlos Eduardo",
      "email": "carlos@empresa.com.br",
      "phone": "+5511987654321"
    },
    "note": "Interessado no plano corporativo para 20 usuários",
    "source": "Facebook Ads",
    "utmSource": "facebook",
    "utmCampaign": "campanha-q3",
    "customFields": {
      "segmento": "Tecnologia",
      "tamanho_empresa": "10-50"
    }
  }'`,
      response: `{
  "data": {
    "id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "contactId": "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
    "created": true
  }
}`,
    },
    {
      id: "list-deals",
      method: "GET",
      path: "/api/v1/deals",
      scope: "read_deals",
      title: "Listar negócios",
      description: "Retorna a lista de negócios do workspace com paginação por cursor decrescente.",
      params: [
        { name: "limit", type: "number", required: false, location: "query", description: "Quantidade máxima de registros por página (1 a 100, padrão: 50)." },
        { name: "cursor", type: "string (base64)", required: false, location: "query", description: "Cursor obtido no campo nextCursor da requisição anterior." },
        { name: "status", type: "string", required: false, location: "query", description: "Filtrar por status ('Ativo', 'Ganho', 'Perdido')." },
        { name: "pipeline", type: "string (uuid)", required: false, location: "query", description: "ID do pipeline para filtrar." },
        { name: "stage", type: "string (uuid)", required: false, location: "query", description: "ID da etapa para filtrar." },
        { name: "owner", type: "string (uuid)", required: false, location: "query", description: "ID do vendedor/responsável." },
        { name: "updatedSince", type: "string (ISO date)", required: false, location: "query", description: "Data/hora mínima de atualização (ex: 2026-08-01T00:00:00Z)." },
      ],
      curl: `curl -X GET "https://api-crm.aimaze.com.br/api/v1/deals?status=Ativo&limit=20" \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": [
    {
      "id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
      "title": "Lead Meta Ads - Carlos Eduardo",
      "value": 4500,
      "status": "Ativo",
      "pipeline_id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "stage_id": "3c2b1a0f-9e8d-7c6b-5a4f-3e2d1c0b9a8f",
      "owner_id": "5d4c3b2a-1f0e-9d8c-7b6a-5f4e3d2c1b0a",
      "contact_id": "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
      "source": "Facebook Ads",
      "origin": "api",
      "created_at": "2026-08-21T14:30:00Z",
      "updated_at": "2026-08-21T14:30:00Z"
    }
  ],
  "nextCursor": "MjAyNi0wOC0yMVQxNDozMDowMFp8N2ZhODRiODAtMWEyYi00YzNkLThlNGYtNWE2YjdjOGQ5ZTBm"
}`,
    },
    {
      id: "get-deal",
      method: "GET",
      path: "/api/v1/deals/:id",
      scope: "read_deals",
      title: "Buscar negócio por ID",
      description: "Obtém todos os detalhes cadastrais de um negócio específico através do seu ID (UUID).",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID único do negócio." },
      ],
      curl: `curl -X GET https://api-crm.aimaze.com.br/api/v1/deals/7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": {
    "id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "title": "Lead Meta Ads - Carlos Eduardo",
    "value": 4500,
    "status": "Ativo",
    "pipeline_id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "stage_id": "3c2b1a0f-9e8d-7c6b-5a4f-3e2d1c0b9a8f",
    "contact_id": "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
    "owner_id": "5d4c3b2a-1f0e-9d8c-7b6a-5f4e3d2c1b0a",
    "source": "Facebook Ads",
    "utm_source": "facebook",
    "utm_campaign": "campanha-q3",
    "created_at": "2026-08-21T14:30:00Z"
  }
}`,
    },
    {
      id: "update-deal",
      method: "PATCH",
      path: "/api/v1/deals/:id",
      scope: "edit_deals",
      title: "Atualizar negócio",
      description: "Atualiza campos parciais do negócio. Envie somente os campos que deseja modificar.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID único do negócio." },
        { name: "title", type: "string", required: false, description: "Novo título do negócio." },
        { name: "value", type: "number", required: false, description: "Novo valor da oportunidade." },
        { name: "ownerId", type: "string (uuid)", required: false, description: "Reatribuir a outro vendedor ativo." },
        { name: "contactId", type: "string (uuid)", required: false, description: "Vincular a outro contato." },
        { name: "expectedCloseDate", type: "string (ISO date)", required: false, description: "Previsão de fechamento." },
        { name: "source", type: "string", required: false, description: "Canal de origem." },
        { name: "utmSource", type: "string", required: false, description: "Parâmetro UTM source." },
        { name: "utmMedium", type: "string", required: false, description: "Parâmetro UTM medium." },
        { name: "utmCampaign", type: "string", required: false, description: "Nome da campanha UTM." },
        { name: "utmContent", type: "string", required: false, description: "Conteúdo do anúncio UTM." },
        { name: "utmTerm", type: "string", required: false, description: "Termo ou palavra-chave UTM." },
        { name: "campaignId", type: "string", required: false, description: "ID externo da campanha na plataforma de anúncio." },
        { name: "customFields", type: "object", required: false, description: "Campos customizados a serem atualizados, chaveados pelo ID do campo." },
      ],
      curl: `curl -X PATCH https://api-crm.aimaze.com.br/api/v1/deals/7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "value": 6000,
    "expectedCloseDate": "2026-09-30T18:00:00Z"
  }'`,
      response: `{
  "data": {
    "id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "title": "Lead Meta Ads - Carlos Eduardo",
    "value": 6000,
    "expected_close_date": "2026-09-30T18:00:00Z",
    "updated_at": "2026-08-21T15:10:00Z"
  },
  "warnings": []
}`,
    },
    {
      id: "move-deal-stage",
      method: "PATCH",
      path: "/api/v1/deals/:id/stage",
      scope: "edit_deals",
      title: "Mover etapa do negócio",
      description: "Move o negócio para uma nova etapa do pipeline, resetando a contagem de tempo na etapa.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID único do negócio." },
        { name: "stageId", type: "string (uuid)", required: true, description: "ID da nova etapa de destino." },
      ],
      curl: `curl -X PATCH https://api-crm.aimaze.com.br/api/v1/deals/7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f/stage \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "stageId": "3c2b1a0f-9e8d-7c6b-5a4f-3e2d1c0b9a8f"
  }'`,
      response: `{
  "data": {
    "id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "stageId": "3c2b1a0f-9e8d-7c6b-5a4f-3e2d1c0b9a8f"
  }
}`,
    },
    {
      id: "reopen-deal",
      method: "PATCH",
      path: "/api/v1/deals/:id/reopen",
      scope: "edit_deals",
      title: "Reabrir negócio",
      description: "Reabre um negócio que havia sido marcado como 'Perdido' ou 'Ganho', retornando seu status para 'Ativo'.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID único do negócio." },
      ],
      curl: `curl -X PATCH https://api-crm.aimaze.com.br/api/v1/deals/7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f/reopen \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": {
    "id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "status": "Ativo"
  }
}`,
    },
    {
      id: "duplicate-deal",
      method: "POST",
      path: "/api/v1/deals/:id/duplicate",
      scope: "edit_deals",
      title: "Duplicar negócio",
      description: "Cria uma cópia exata do negócio mantendo valores, contatos, empresa e pipeline vinculados.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID do negócio a duplicar." },
      ],
      curl: `curl -X POST https://api-crm.aimaze.com.br/api/v1/deals/7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f/duplicate \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Idempotency-Key: dup-deal-7fa84"`,
      response: `{
  "data": {
    "id": "9b8c7d6e-5f4a-3b2c-1d0e-9f8a7b6c5d4e"
  }
}`,
    },
    {
      id: "delete-deal",
      method: "DELETE",
      path: "/api/v1/deals/:id",
      scope: "delete_deals",
      title: "Excluir negócio (Soft delete)",
      description: "Realiza a exclusão lógica do negócio, marcando a data de remoção sem apagar o histórico de forma destrutiva.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID único do negócio." },
      ],
      curl: `curl -X DELETE https://api-crm.aimaze.com.br/api/v1/deals/7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": {
    "id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "deletedAt": "2026-08-21T16:00:00.000Z"
  }
}`,
    },
  ],
  contacts: [
    {
      id: "create-contact",
      method: "POST",
      path: "/api/v1/contacts",
      scope: "edit_contacts",
      title: "Criar contato",
      description: "Cadastra uma nova pessoa de contato no CRM vinculada ao workspace.",
      params: [
        { name: "name", type: "string", required: true, description: "Nome completo do contato." },
        { name: "email", type: "string", required: false, description: "Endereço de e-mail principal." },
        { name: "phone", type: "string", required: false, description: "Telefone com DDD / DDI (ex: +5511999999999)." },
        { name: "role", type: "string", required: false, description: "Cargo ou função do contato." },
        { name: "companyId", type: "string (uuid)", required: false, description: "ID da empresa à qual o contato pertence." },
      ],
      curl: `curl -X POST https://api-crm.aimaze.com.br/api/v1/contacts \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Mariana Souza",
    "email": "mariana.souza@empresa.com",
    "phone": "+5511988887777",
    "role": "Diretora de Marketing"
  }'`,
      response: `{
  "data": {
    "id": "8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
    "name": "Mariana Souza",
    "emails": [{ "value": "mariana.souza@empresa.com", "type": "Comercial" }],
    "phones": [{ "value": "+5511988887777", "type": "Celular" }],
    "role": "Diretora de Marketing",
    "created_at": "2026-08-21T14:40:00Z"
  }
}`,
    },
    {
      id: "list-contacts",
      method: "GET",
      path: "/api/v1/contacts",
      scope: "read_contacts",
      title: "Listar contatos",
      description: "Lista os contatos cadastrados ordenados pelos mais recentes.",
      params: [
        { name: "limit", type: "number", required: false, location: "query", description: "Limite de itens retornados (máximo: 100)." },
        { name: "updatedSince", type: "string (ISO date)", required: false, location: "query", description: "Filtrar criados a partir desta data." },
      ],
      curl: `curl -X GET "https://api-crm.aimaze.com.br/api/v1/contacts?limit=25" \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": [
    {
      "id": "8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
      "name": "Mariana Souza",
      "emails": [{ "value": "mariana.souza@empresa.com", "type": "Comercial" }],
      "phones": [{ "value": "+5511988887777", "type": "Celular" }],
      "role": "Diretora de Marketing",
      "created_at": "2026-08-21T14:40:00Z"
    }
  ]
}`,
    },
    {
      id: "get-contact",
      method: "GET",
      path: "/api/v1/contacts/:id",
      scope: "read_contacts",
      title: "Buscar contato por ID",
      description: "Retorna todos os dados de um contato específico.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID único do contato." },
      ],
      curl: `curl -X GET https://api-crm.aimaze.com.br/api/v1/contacts/8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": {
    "id": "8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
    "name": "Mariana Souza",
    "emails": [{ "value": "mariana.souza@empresa.com", "type": "Comercial" }],
    "phones": [{ "value": "+5511988887777", "type": "Celular" }],
    "role": "Diretora de Marketing"
  }
}`,
    },
    {
      id: "update-contact",
      method: "PATCH",
      path: "/api/v1/contacts/:id",
      scope: "edit_contacts",
      title: "Atualizar contato",
      description: "Atualiza os dados de um contato existente.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID do contato." },
        { name: "name", type: "string", required: false, description: "Nome do contato." },
        { name: "email", type: "string", required: false, description: "Novo e-mail principal." },
        { name: "phone", type: "string", required: false, description: "Novo telefone." },
        { name: "role", type: "string", required: false, description: "Novo cargo." },
        { name: "companyId", type: "string (uuid)", required: false, description: "ID da empresa vinculada." },
      ],
      curl: `curl -X PATCH https://api-crm.aimaze.com.br/api/v1/contacts/8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "role": "Vice-Presidente de Marketing"
  }'`,
      response: `{
  "data": {
    "id": "8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
    "name": "Mariana Souza",
    "role": "Vice-Presidente de Marketing"
  }
}`,
    },
    {
      id: "delete-contact",
      method: "DELETE",
      path: "/api/v1/contacts/:id",
      scope: "edit_contacts",
      title: "Excluir contato",
      description: "Remove um contato do workspace.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID do contato." },
      ],
      curl: `curl -X DELETE https://api-crm.aimaze.com.br/api/v1/contacts/8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": {
    "id": "8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
    "deleted": true
  }
}`,
    },
  ],
  companies: [
    {
      id: "create-company",
      method: "POST",
      path: "/api/v1/companies",
      scope: "edit_companies",
      title: "Criar ou localizar empresa",
      description: "Cria uma nova organização. Se já existir empresa com o mesmo CNPJ ou Nome exato no workspace, atualiza os dados sem duplicar.",
      params: [
        { name: "name", type: "string", required: true, description: "Razão social ou nome fantasia da empresa." },
        { name: "cnpj", type: "string", required: false, description: "CNPJ com ou sem pontuação." },
        { name: "website", type: "string", required: false, description: "Website institucional (ex: https://empresa.com)." },
        { name: "segment", type: "string", required: false, description: "Segmento de mercado (ex: Varejo, SaaS, Saúde)." },
        { name: "size", type: "string", required: false, description: "Porte da empresa (ex: '1-10', '11-50', '50+')." },
        { name: "city", type: "string", required: false, description: "Cidade da sede." },
        { name: "state", type: "string", required: false, description: "Estado / UF (ex: SP, MG, RJ)." },
      ],
      curl: `curl -X POST https://api-crm.aimaze.com.br/api/v1/companies \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Tech Corp Soluções LTDA",
    "cnpj": "12.345.678/0001-90",
    "website": "https://techcorp.com.br",
    "segment": "Tecnologia",
    "size": "50-100",
    "city": "São Paulo",
    "state": "SP"
  }'`,
      response: `{
  "data": {
    "id": "4c3b2a1f-0e9d-8c7b-6a5f-4e3d2c1b0a9f",
    "name": "Tech Corp Soluções LTDA",
    "cnpj": "12345678000190",
    "website": "https://techcorp.com.br",
    "segment": "Tecnologia",
    "size": "50-100",
    "city": "São Paulo",
    "state": "SP",
    "created_at": "2026-08-21T14:45:00Z"
  }
}`,
    },
    {
      id: "list-companies",
      method: "GET",
      path: "/api/v1/companies",
      scope: "read_companies",
      title: "Listar empresas",
      description: "Lista todas as empresas cadastradas no workspace.",
      params: [
        { name: "limit", type: "number", required: false, location: "query", description: "Máximo de registros a retornar (máx: 100)." },
      ],
      curl: `curl -X GET "https://api-crm.aimaze.com.br/api/v1/companies?limit=50" \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": [
    {
      "id": "4c3b2a1f-0e9d-8c7b-6a5f-4e3d2c1b0a9f",
      "name": "Tech Corp Soluções LTDA",
      "cnpj": "12345678000190",
      "city": "São Paulo",
      "state": "SP"
    }
  ]
}`,
    },
    {
      id: "get-company",
      method: "GET",
      path: "/api/v1/companies/:id",
      scope: "read_companies",
      title: "Buscar empresa por ID",
      description: "Retorna os detalhes de uma empresa cadastrada.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID único da empresa." },
      ],
      curl: `curl -X GET https://api-crm.aimaze.com.br/api/v1/companies/4c3b2a1f-0e9d-8c7b-6a5f-4e3d2c1b0a9f \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": {
    "id": "4c3b2a1f-0e9d-8c7b-6a5f-4e3d2c1b0a9f",
    "name": "Tech Corp Soluções LTDA",
    "cnpj": "12345678000190",
    "website": "https://techcorp.com.br",
    "segment": "Tecnologia"
  }
}`,
    },
    {
      id: "update-company",
      method: "PATCH",
      path: "/api/v1/companies/:id",
      scope: "edit_companies",
      title: "Atualizar empresa",
      description: "Atualiza os dados cadastrais da empresa.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID da empresa." },
        { name: "name", type: "string", required: false, description: "Nome da empresa." },
        { name: "website", type: "string", required: false, description: "Website." },
        { name: "segment", type: "string", required: false, description: "Segmento." },
        { name: "size", type: "string", required: false, description: "Porte." },
        { name: "city", type: "string", required: false, description: "Cidade." },
        { name: "state", type: "string", required: false, description: "Estado." },
      ],
      curl: `curl -X PATCH https://api-crm.aimaze.com.br/api/v1/companies/4c3b2a1f-0e9d-8c7b-6a5f-4e3d2c1b0a9f \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "size": "100-250"
  }'`,
      response: `{
  "data": {
    "id": "4c3b2a1f-0e9d-8c7b-6a5f-4e3d2c1b0a9f",
    "name": "Tech Corp Soluções LTDA",
    "size": "100-250"
  }
}`,
    },
    {
      id: "delete-company",
      method: "DELETE",
      path: "/api/v1/companies/:id",
      scope: "edit_companies",
      title: "Excluir empresa",
      description: "Remove a empresa do workspace.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID da empresa." },
      ],
      curl: `curl -X DELETE https://api-crm.aimaze.com.br/api/v1/companies/4c3b2a1f-0e9d-8c7b-6a5f-4e3d2c1b0a9f \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": {
    "id": "4c3b2a1f-0e9d-8c7b-6a5f-4e3d2c1b0a9f",
    "deleted": true
  }
}`,
    },
  ],
  activities: [
    {
      id: "create-activity",
      method: "POST",
      path: "/api/v1/activities",
      scope: "edit_activities",
      title: "Criar atividade",
      description: "Agenda uma reunião, ligação, envio de mensagem ou tarefa vinculada a um negócio.",
      note: "Sempre envie a data com fuso horário explícito (ex: -03:00 para horário de Brasília) para manter a sincronia de horários.",
      params: [
        { name: "dealId", type: "string (uuid)", required: true, description: "ID do negócio associado." },
        { name: "title", type: "string", required: true, description: "Título descritivo da atividade." },
        { name: "type", type: "string", required: true, description: "Tipo: 'MEETING', 'CALL', 'VIDEO_CALL', 'EMAIL', 'WHATSAPP', 'INSTAGRAM', 'LINKEDIN', 'OTHER'." },
        { name: "date", type: "string (ISO date)", required: true, description: "Data e hora agendadas com fuso explícito (ex: 2026-08-25T14:30:00-03:00)." },
        { name: "description", type: "string", required: false, description: "Detalhes ou pauta da atividade." },
        { name: "assigneeId", type: "string (uuid)", required: false, description: "ID do usuário responsável pela tarefa." },
      ],
      curl: `curl -X POST https://api-crm.aimaze.com.br/api/v1/activities \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "dealId": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "title": "Apresentação da Proposta Comercial",
    "type": "VIDEO_CALL",
    "date": "2026-08-25T15:00:00-03:00",
    "description": "Call no Google Meet para alinhar escopo e cronograma"
  }'`,
      response: `{
  "data": {
    "id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "deal_id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "title": "Apresentação da Proposta Comercial",
    "type": "VIDEO_CALL",
    "date": "2026-08-25T18:00:00.000Z",
    "completed": false
  }
}`,
    },
    {
      id: "list-activities",
      method: "GET",
      path: "/api/v1/activities",
      scope: "read_activities",
      title: "Listar atividades",
      description: "Consulta a lista de atividades agendadas.",
      params: [
        { name: "dealId", type: "string (uuid)", required: false, location: "query", description: "Filtrar atividades de um negócio específico." },
        { name: "limit", type: "number", required: false, location: "query", description: "Limite de itens retornados (máx: 100)." },
      ],
      curl: `curl -X GET "https://api-crm.aimaze.com.br/api/v1/activities?dealId=7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f" \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": [
    {
      "id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
      "deal_id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
      "title": "Apresentação da Proposta Comercial",
      "type": "VIDEO_CALL",
      "date": "2026-08-25T18:00:00.000Z",
      "completed": false
    }
  ]
}`,
    },
    {
      id: "complete-activity",
      method: "PATCH",
      path: "/api/v1/activities/:id/done",
      scope: "edit_activities",
      title: "Concluir atividade",
      description: "Marca a atividade como concluída com sucesso.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID único da atividade." },
      ],
      curl: `curl -X PATCH https://api-crm.aimaze.com.br/api/v1/activities/2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e/done \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": {
    "id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "completed": true
  }
}`,
    },
    {
      id: "delete-activity",
      method: "DELETE",
      path: "/api/v1/activities/:id",
      scope: "edit_activities",
      title: "Excluir atividade",
      description: "Remove permanentemente a atividade agendada.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID da atividade." },
      ],
      curl: `curl -X DELETE https://api-crm.aimaze.com.br/api/v1/activities/2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": {
    "id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "deleted": true
  }
}`,
    },
  ],
  notes: [
    {
      id: "create-note",
      method: "POST",
      path: "/api/v1/notes",
      scope: "edit_notes",
      title: "Criar anotação no negócio",
      description: "Registra uma nova anotação de texto na timeline do negócio.",
      params: [
        { name: "dealId", type: "string (uuid)", required: true, description: "ID do negócio onde a nota será inserida." },
        { name: "content", type: "string", required: true, description: "Texto da anotação." },
      ],
      curl: `curl -X POST https://api-crm.aimaze.com.br/api/v1/notes \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "dealId": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "content": "Cliente solicitou envio de proposta formal até sexta-feira às 12h."
  }'`,
      response: `{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "deal_id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "content": "Cliente solicitou envio de proposta formal até sexta-feira às 12h.",
    "created_at": "2026-08-21T15:00:00Z"
  }
}`,
    },
    {
      id: "list-notes",
      method: "GET",
      path: "/api/v1/notes",
      scope: "read_notes",
      title: "Listar anotações de um negócio",
      description: "Retorna a lista de todas as anotações registradas no negócio especificado.",
      params: [
        { name: "dealId", type: "string (uuid)", required: true, location: "query", description: "ID do negócio (obrigatório)." },
      ],
      curl: `curl -X GET "https://api-crm.aimaze.com.br/api/v1/notes?dealId=7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f" \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": [
    {
      "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "deal_id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
      "content": "Cliente solicitou envio de proposta formal até sexta-feira às 12h.",
      "created_at": "2026-08-21T15:00:00Z"
    }
  ]
}`,
    },
  ],
  pipelines: [
    {
      id: "list-pipelines",
      method: "GET",
      path: "/api/v1/pipelines",
      scope: "read_pipelines",
      title: "Listar pipelines e etapas",
      description: "Lista todos os funis de venda do workspace com suas respectivas etapas ordenadas.",
      params: [],
      curl: `curl -X GET https://api-crm.aimaze.com.br/api/v1/pipelines \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": [
    {
      "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "name": "Funil Comercial",
      "stages": [
        { "id": "3c2b1a0f-9e8d-7c6b-5a4f-3e2d1c0b9a8f", "name": "Novo Lead" },
        { "id": "4d3c2b1a-0f9e-8d7c-6b5a-4f3e2d1c0b9a", "name": "Contato Feito" },
        { "id": "5e4d3c2b-1a0f-9e8d-7c6b-5a4f3e2d1c0b", "name": "Proposta Enviada" },
        { "id": "6f5e4d3c-2b1a-0f9e-8d7c-6b5a4f3e2d1c", "name": "Negociação" }
      ]
    }
  ]
}`,
    },
    {
      id: "get-pipeline",
      method: "GET",
      path: "/api/v1/pipelines/:id",
      scope: "read_pipelines",
      title: "Buscar pipeline por ID",
      description: "Retorna a estrutura completa de um funil de vendas e suas etapas.",
      params: [
        { name: "id", type: "string (uuid)", required: true, location: "path", description: "ID único do pipeline." },
      ],
      curl: `curl -X GET https://api-crm.aimaze.com.br/api/v1/pipelines/9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "name": "Funil Comercial",
    "stages": [
      { "id": "3c2b1a0f-9e8d-7c6b-5a4f-3e2d1c0b9a8f", "name": "Novo Lead" },
      { "id": "4d3c2b1a-0f9e-8d7c-6b5a-4f3e2d1c0b9a", "name": "Contato Feito" }
    ]
  }
}`,
    },
  ],
  customFields: [
    {
      id: "list-custom-fields",
      method: "GET",
      path: "/api/v1/custom-fields",
      scope: "read_custom_fields",
      title: "Listar campos customizados",
      description: "Lista as definições de campos extras configuradas no workspace para uso no payload customFields.",
      params: [
        { name: "entity", type: "string", required: false, location: "query", description: "Filtrar por entidade: 'deal', 'contact', ou 'company'." },
      ],
      curl: `curl -X GET "https://api-crm.aimaze.com.br/api/v1/custom-fields?entity=deal" \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": [
    {
      "id": "cf_segmento",
      "label": "Segmento",
      "entity": "deal",
      "field_type": "select",
      "field_group": "Geral",
      "options": ["Tecnologia", "Varejo", "Saúde", "Educação"],
      "required": false
    }
  ]
}`,
    },
    {
      id: "create-custom-field",
      method: "POST",
      path: "/api/v1/custom-fields",
      scope: "create_custom_fields",
      title: "Criar campo customizado",
      description: "Registra uma nova definição de campo personalizado no workspace.",
      params: [
        { name: "label", type: "string", required: true, description: "Nome visível do campo no CRM." },
        { name: "entity", type: "string", required: true, description: "Entidade associada: 'deal', 'contact', ou 'company'." },
        { name: "fieldType", type: "string", required: false, description: "Tipo do campo: 'text', 'number', 'date', 'select', 'multiselect', 'currency'." },
        { name: "fieldGroup", type: "string", required: false, description: "Grupo de exibição (padrão: 'Geral')." },
        { name: "required", type: "boolean", required: false, description: "Se o preenchimento é obrigatório na interface." },
        { name: "options", type: "string[]", required: false, description: "Array de opções quando o tipo for select ou multiselect." },
      ],
      curl: `curl -X POST https://api-crm.aimaze.com.br/api/v1/custom-fields \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "label": "Origem Detalhada",
    "entity": "deal",
    "fieldType": "text",
    "fieldGroup": "Qualificação"
  }'`,
      response: `{
  "data": {
    "id": "cf_origem_detalhada",
    "label": "Origem Detalhada",
    "entity": "deal",
    "field_type": "text"
  }
}`,
    },
  ],
  users: [
    {
      id: "list-users",
      method: "GET",
      path: "/api/v1/users",
      scope: "read_users",
      title: "Listar usuários e vendedores",
      description: "Lista os membros ativos do workspace para obtenção de seus IDs e uso no parâmetro ownerId.",
      params: [],
      curl: `curl -X GET https://api-crm.aimaze.com.br/api/v1/users \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`,
      response: `{
  "data": [
    {
      "id": "5d4c3b2a-1f0e-9d8c-7b6a-5f4e3d2c1b0a",
      "name": "Ricardo Vendedor",
      "email": "ricardo@trinocrm.com.br",
      "role": "seller"
    },
    {
      "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "name": "Juliana Gestora",
      "email": "juliana@trinocrm.com.br",
      "role": "admin"
    }
  ]
}`,
    },
  ],
  leadForms: [
    {
      id: "public-lead-form",
      method: "POST",
      path: "/api/v1/leads/form/:formId",
      scope: "Público (Sem autenticação)",
      title: "Envio de formulário de captação pública",
      description: "Recebe leads direto de landing pages (Elementor, WordPress, Wix, React) sem expor sua API Key secreta. Protegido por campo honeypot invisível para prevenir bots.",
      note: "Aceita Content-Type 'application/json', 'application/x-www-form-urlencoded' e 'multipart/form-data'.",
      params: [
        { name: "formId", type: "string (uuid)", required: true, location: "path", description: "ID público do formulário gerado em /configuracoes/api." },
        { name: "name", type: "string", required: true, description: "Nome do lead." },
        { name: "email", type: "string", required: false, description: "E-mail do lead (obrigatório se não enviar telefone)." },
        { name: "phone", type: "string", required: false, description: "Telefone do lead (obrigatório se não enviar e-mail)." },
        { name: "note", type: "string", required: false, description: "Mensagem ou observação deixada no formulário." },
        { name: "_hp", type: "string", required: false, description: "Campo Honeypot anti-spam. Mantenha vazio no front; se preenchido por bot, a submissão é ignorada silenciosamente." },
      ],
      curl: `curl -X POST https://api-crm.aimaze.com.br/api/v1/leads/form/e1b2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Ana Paula Mendonça",
    "email": "ana.paula@gmail.com",
    "phone": "+5511977776666",
    "note": "Solicitou contato pelo formulário do site institucional.",
    "_hp": ""
  }'`,
      response: `{
  "data": {
    "received": true
  }
}`,
    },
  ],
};

function MethodBadge({ method }: { method: string }) {
  const styles: Record<string, string> = {
    GET: "bg-blue-100 text-blue-700 border-blue-200",
    POST: "bg-emerald-100 text-emerald-700 border-emerald-200",
    PATCH: "bg-amber-100 text-amber-700 border-amber-200",
    DELETE: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span
      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold font-mono border ${
        styles[method] ?? "bg-zinc-100 text-zinc-700 border-zinc-200"
      }`}
    >
      {method}
    </span>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg bg-zinc-900 text-zinc-100 text-[13px] font-mono overflow-hidden border border-zinc-800">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950/60 text-xs text-zinc-400">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-sans font-medium">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-sans">Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="text-[11px] font-sans">Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto whitespace-pre leading-relaxed">{code}</pre>
    </div>
  );
}

function EndpointCard({
  endpoint,
  isOpen,
  onToggle,
}: {
  endpoint: EndpointDoc;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-xs transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50/80 transition-colors text-left group"
      >
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-mono font-medium text-zinc-800 flex-1 truncate">
          {endpoint.path}
        </code>
        <span className="text-[11px] text-zinc-400 font-mono shrink-0 hidden sm:inline px-2 py-0.5 bg-zinc-100 rounded-md">
          {endpoint.scope}
        </span>
        <div
          className={`text-zinc-400 transition-transform duration-200 ${
            isOpen ? "rotate-90 text-amber-600" : ""
          }`}
        >
          <ChevronRight className="h-4 w-4" />
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-3 border-t border-zinc-100 space-y-4 bg-zinc-50/20">
          <div>
            <h4 className="text-sm font-semibold text-zinc-900">{endpoint.title}</h4>
            <p className="text-sm text-zinc-600 mt-1 leading-relaxed">{endpoint.description}</p>
            {endpoint.note && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg p-2.5 mt-2.5">
                💡 <span className="font-medium">{endpoint.note}</span>
              </p>
            )}
          </div>

          {endpoint.params && endpoint.params.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Parâmetros da Requisição
              </h5>
              <div className="overflow-x-auto rounded-lg border border-zinc-200/80 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-400 border-b border-zinc-100 bg-zinc-50/50">
                      <th className="py-2.5 px-3 font-medium">Campo</th>
                      <th className="py-2.5 px-3 font-medium">Tipo</th>
                      <th className="py-2.5 px-3 font-medium">Obrigatório</th>
                      <th className="py-2.5 px-3 font-medium">Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {endpoint.params.map((param) => (
                      <tr key={param.name} className="hover:bg-zinc-50/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-zinc-800">
                          {param.name}
                          {param.location && param.location !== "body" && (
                            <span className="ml-1.5 text-[10px] text-zinc-400 uppercase font-sans">
                              ({param.location})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-500">{param.type}</td>
                        <td className="py-2.5 px-3">
                          {param.required ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200/60">
                              SIM
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400">não</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600 leading-relaxed">
                          {param.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Exemplo cURL
            </h5>
            <CodeBlock code={endpoint.curl} language="bash" />
          </div>

          <div className="space-y-1.5">
            <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Exemplo de Resposta (JSON)
            </h5>
            <CodeBlock code={endpoint.response} language="json" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState<string>("quickstart");
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({
    "create-deal": true,
    "create-contact": true,
    "public-lead-form": true,
  });
  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);

  const toggleCard = (id: string) => {
    setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    Object.values(ENDPOINTS_DATA).forEach((list) => {
      list.forEach((item) => {
        next[item.id] = true;
      });
    });
    setOpenCards(next);
  };

  const collapseAll = () => {
    setOpenCards({});
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Observe which section is currently in view
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120;
      for (const sec of NAV_SECTIONS) {
        const el = document.getElementById(sec.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sec.id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopyBaseUrl = () => {
    navigator.clipboard.writeText("https://api-crm.aimaze.com.br/api/v1");
    setCopiedBaseUrl(true);
    setTimeout(() => setCopiedBaseUrl(false), 2000);
  };

  return (
    <div className="flex h-full min-h-screen bg-zinc-50/40">
      {/* Left Navigation Sidebar */}
      <aside className="w-56 shrink-0 border-r border-zinc-200/80 bg-white py-6 px-3 overflow-y-auto sticky top-0 h-screen hidden md:block">
        <Link
          href="/configuracoes/api"
          className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-6 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          <span>Voltar para API Keys</span>
        </Link>

        <div className="px-2.5 mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Navegação da API</p>
        </div>

        <nav className="space-y-0.5">
          {NAV_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors text-left ${
                  isActive
                    ? "bg-amber-50 text-amber-800 font-semibold shadow-xs"
                    : "text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isActive ? "text-amber-600" : "text-zinc-400"
                  }`}
                />
                <span className="truncate">{sec.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-8 pt-6 border-t border-zinc-100 px-2">
          <Link
            href="/ajuda/integracao-leads-externos"
            className="flex items-center gap-2 text-xs text-amber-700 hover:text-amber-800 font-medium group"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Tutorial de Integração</span>
            <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-12 pb-16">
          {/* Header Banner */}
          <div>
            <div className="flex items-center gap-3.5 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-xs">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Trino CRM API v1</h1>
                <p className="text-sm text-zinc-500">
                  Referência técnica completa da API RESTful para integração com Meta Ads, Google Ads, Zapier, Make e sistemas próprios.
                </p>
              </div>
            </div>

            {/* Base URL Pill & Controls */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-200 bg-white shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Base URL:</span>
                <code className="bg-zinc-100/90 rounded-md px-2.5 py-1 text-xs font-mono text-zinc-800 select-all border border-zinc-200/50">
                  https://api-crm.aimaze.com.br/api/v1
                </code>
                <button
                  type="button"
                  onClick={handleCopyBaseUrl}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                  title="Copiar Base URL"
                >
                  {copiedBaseUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-600 hover:bg-zinc-100 border border-zinc-200 transition-colors"
                >
                  Expandir todos
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-600 hover:bg-zinc-100 border border-zinc-200 transition-colors"
                >
                  Recolher todos
                </button>
              </div>
            </div>
          </div>

          {/* Quickstart Section */}
          <section id="quickstart" className="space-y-6">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Zap className="h-5 w-5 text-amber-500" />
              Início rápido
            </h2>
            <div className="space-y-4 text-sm text-zinc-600 leading-relaxed">
              <p>
                Com a API do Trino CRM você pode criar negócios (leads), contatos, empresas, agendar atividades e registrar notas automaticamente a partir de qualquer sistema externo (Meta Ads, Google Ads, Zapier, Make, n8n, webhooks ou seu backend proprietário).
              </p>

              {/* Practical Lead Ingestion Card */}
              <div className="rounded-xl bg-gradient-to-br from-amber-50/80 to-amber-100/30 border border-amber-200/90 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200 text-amber-900 uppercase">
                    Exemplo Prático
                  </span>
                  <p className="text-sm font-semibold text-amber-900">
                    Lead do Facebook / Meta Ads direto no funil
                  </p>
                </div>
                <p className="text-xs text-amber-800 mb-3.5">
                  Cria o lead, associa o contato (deduplicando automaticamente por e-mail ou telefone) e atribui ao vendedor:
                </p>
                <CodeBlock
                  language="bash"
                  code={`curl -X POST https://api-crm.aimaze.com.br/api/v1/deals \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: lead-meta-102938" \\
  -d '{
    "title": "Lead Meta Ads - Juliana Pereira",
    "value": 5000,
    "pipeline": "Funil Comercial",
    "stage": "Novo Lead",
    "contact": {
      "name": "Juliana Pereira",
      "email": "juliana@empresa.com",
      "phone": "+5511987654321"
    },
    "note": "Interessada na demonstração do software",
    "source": "Facebook Ads",
    "utmSource": "facebook",
    "utmCampaign": "institucional-2026"
  }'`}
                />
              </div>

              {/* Step-by-Step Card */}
              <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-4">
                <p className="text-sm font-bold text-zinc-900">Passo a passo de integração:</p>
                <ol className="list-decimal list-inside space-y-3 text-sm text-zinc-600">
                  <li>
                    <strong>Gere sua API Key</strong> em{" "}
                    <Link href="/configuracoes/api" className="text-amber-600 hover:underline font-medium">
                      Configurações &gt; API e Integrações
                    </Link>
                  </li>
                  <li>
                    <strong>Descubra os IDs dos pipelines e etapas</strong> do seu workspace:
                    <div className="mt-2">
                      <CodeBlock
                        language="bash"
                        code={`curl https://api-crm.aimaze.com.br/api/v1/pipelines \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`}
                      />
                    </div>
                  </li>
                  <li>
                    <strong>Descubra os IDs dos usuários/vendedores</strong> para atribuição:
                    <div className="mt-2">
                      <CodeBlock
                        language="bash"
                        code={`curl https://api-crm.aimaze.com.br/api/v1/users \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`}
                      />
                    </div>
                  </li>
                  <li>
                    <strong>Envie requisições de criação</strong> para <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded font-mono">/api/v1/deals</code>.
                  </li>
                </ol>
              </div>

              {/* Validate Auth / Me endpoint */}
              <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-900">Como testar se sua API Key é válida?</p>
                </div>
                <p className="text-xs text-blue-700 mb-3">
                  Use o endpoint <code className="bg-blue-100/80 px-1.5 py-0.5 rounded font-mono">GET /api/v1/me</code>. Qualquer chave ativa responde com os dados do workspace e permissões, sem necessidade de parâmetros:
                </p>
                <CodeBlock
                  language="bash"
                  code={`curl https://api-crm.aimaze.com.br/api/v1/me \\
  -H "Authorization: Bearer trn_sua_chave_aqui"`}
                />
              </div>
            </div>
          </section>

          {/* How to Generate Key Section */}
          <section id="generate-key" className="space-y-6">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Key className="h-5 w-5 text-amber-500" />
              Como gerar sua API Key
            </h2>
            <div className="space-y-4 text-sm text-zinc-600 leading-relaxed">
              <p>
                As chaves de API (API Keys) garantem acesso seguro e controlado aos dados da sua conta no Trino CRM. Cada chave pode ter escopos específicos e um vendedor padrão configurado.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs">
                    1
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-900">Acesse o Painel</h4>
                  <p className="text-xs text-zinc-500">
                    Vá em <strong>Configurações &gt; API e Integrações</strong> e clique no botão <strong>+ Nova API Key</strong>.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs">
                    2
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-900">Defina os Escopos</h4>
                  <p className="text-xs text-zinc-500">
                    Escolha um nome descritivo (ex: <em>&quot;Meta Ads Zapier&quot;</em>), selecione o proprietário padrão e marque as permissões necessárias.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs">
                    3
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-900">Copie o Token</h4>
                  <p className="text-xs text-zinc-500">
                    O token completo iniciando com <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono text-[11px]">trn_...</code> é exibido apenas <strong>uma única vez</strong>. Salve em local seguro!
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Authentication & Scopes Section */}
          <section id="auth" className="space-y-6">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Lock className="h-5 w-5 text-amber-500" />
              Autenticação & Permissões (Scopes)
            </h2>
            <div className="space-y-4 text-sm text-zinc-600 leading-relaxed">
              <p>
                Todas as requisições para a API pública devem incluir o cabeçalho <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-800">Authorization</code> utilizando o padrão <strong>Bearer Token</strong>:
              </p>

              <CodeBlock
                language="http"
                code={`Authorization: Bearer trn_1a2b3c4d5e6f7a8b9c0d...`}
              />

              <h3 className="text-sm font-bold text-zinc-900 pt-2">Tabela de Permissões Reconhecidas</h3>
              <p className="text-xs text-zinc-500">
                Ao criar sua chave, você pode conceder acesso total (<code className="font-mono text-zinc-700 bg-zinc-100 px-1 rounded">all</code>) ou restringir por operações específicas:
              </p>

              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-400 border-b border-zinc-100 bg-zinc-50/50">
                      <th className="py-2.5 px-4 font-medium">Scope (Permissão)</th>
                      <th className="py-2.5 px-4 font-medium">Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {SCOPES_TABLE.map((row) => (
                      <tr key={row.scope} className="hover:bg-zinc-50/50">
                        <td className="py-2 px-4 font-mono font-medium text-amber-800">
                          {row.scope}
                        </td>
                        <td className="py-2 px-4 text-zinc-600">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Proprietário Padrão (Default Owner)</h4>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Toda API Key possui um proprietário padrão associado. Ao criar negócios ou atividades sem informar o campo <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-700">ownerId</code>, o CRM atribui automaticamente o registro a esse usuário.
                </p>
              </div>
            </div>
          </section>

          {/* Rate Limiting & Idempotency Section */}
          <section id="rate-limit" className="space-y-6">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Gauge className="h-5 w-5 text-amber-500" />
              Rate Limiting & Idempotência
            </h2>
            <div className="space-y-4 text-sm text-zinc-600 leading-relaxed">
              <p>
                Cada chave possui um limite configurado de requisições por minuto (padrão de <strong>60 req/min</strong>). Todas as respostas contêm os headers informando o estado da janela:
              </p>

              <CodeBlock
                language="http"
                code={`X-RateLimit-Limit: 60          # Limite total configurado por minuto
X-RateLimit-Remaining: 48      # Requisições restantes na janela atual
X-RateLimit-Reset: 1710630060  # Timestamp Unix de quando o limite será resetado`}
              />

              <p className="text-xs text-zinc-500">
                Se exceder o limite, o servidor retorna <code className="font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded">HTTP 429 RATE_LIMIT_EXCEEDED</code> com o header <code className="font-mono text-zinc-700 bg-zinc-100 px-1 rounded">Retry-After</code> indicando a quantidade de segundos de espera.
              </p>

              {/* Idempotency Header Card */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-zinc-900">Proteção contra Duplicidade (Idempotência)</h3>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Qualquer requisição <code className="font-mono text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">POST</code> aceita o cabeçalho <code className="font-mono text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">Idempotency-Key: &lt;sua-chave-unica&gt;</code>. Reenviar a mesma chave dentro de 24h devolverá a resposta original gravada sem duplicar o negócio ou contato. Essencial para retries automáticos no Zapier, Make e Meta Ads.
                </p>
                <CodeBlock
                  language="bash"
                  code={`curl -X POST https://api-crm.aimaze.com.br/api/v1/deals \\
  -H "Authorization: Bearer trn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: pedido-webhook-77889" \\
  -d '{ "contact": { "name": "Roberto Costa", "email": "roberto@costa.com" } }'`}
                />
              </div>
            </div>
          </section>

          {/* Deals Endpoints */}
          <section id="deals" className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Briefcase className="h-5 w-5 text-amber-500" />
              Negócios (Deals)
            </h2>
            <p className="text-sm text-zinc-600">
              Gerencie oportunidades de venda, estágios de funil, valores, atribuições e deduplicação de contatos.
            </p>
            <div className="space-y-3">
              {ENDPOINTS_DATA.deals.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  isOpen={!!openCards[ep.id]}
                  onToggle={() => toggleCard(ep.id)}
                />
              ))}
            </div>
          </section>

          {/* Contacts Endpoints */}
          <section id="contacts" className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Users className="h-5 w-5 text-amber-500" />
              Contatos (Contacts)
            </h2>
            <p className="text-sm text-zinc-600">
              Gerencie clientes, pessoas de contato, telefones, e-mails e vínculos com empresas.
            </p>
            <div className="space-y-3">
              {ENDPOINTS_DATA.contacts.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  isOpen={!!openCards[ep.id]}
                  onToggle={() => toggleCard(ep.id)}
                />
              ))}
            </div>
          </section>

          {/* Companies Endpoints */}
          <section id="companies" className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Building2 className="h-5 w-5 text-amber-500" />
              Empresas (Companies)
            </h2>
            <p className="text-sm text-zinc-600">
              Cadastre e gerencie organizações, CNPJs, porte, localização e segmentos corporativos.
            </p>
            <div className="space-y-3">
              {ENDPOINTS_DATA.companies.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  isOpen={!!openCards[ep.id]}
                  onToggle={() => toggleCard(ep.id)}
                />
              ))}
            </div>
          </section>

          {/* Activities Endpoints */}
          <section id="activities" className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Calendar className="h-5 w-5 text-amber-500" />
              Atividades (Activities)
            </h2>
            <p className="text-sm text-zinc-600">
              Agende e controle tarefas, ligações, reuniões e interações de follow-up na agenda dos vendedores.
            </p>
            <div className="space-y-3">
              {ENDPOINTS_DATA.activities.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  isOpen={!!openCards[ep.id]}
                  onToggle={() => toggleCard(ep.id)}
                />
              ))}
            </div>
          </section>

          {/* Notes Endpoints */}
          <section id="notes" className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <FileText className="h-5 w-5 text-amber-500" />
              Notas (Notes)
            </h2>
            <p className="text-sm text-zinc-600">
              Adicione anotações internas vinculadas aos negócios que aparecem na timeline do CRM.
            </p>
            <div className="space-y-3">
              {ENDPOINTS_DATA.notes.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  isOpen={!!openCards[ep.id]}
                  onToggle={() => toggleCard(ep.id)}
                />
              ))}
            </div>
          </section>

          {/* Pipelines Endpoints */}
          <section id="pipelines" className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <GitBranch className="h-5 w-5 text-amber-500" />
              Pipelines & Etapas
            </h2>
            <p className="text-sm text-zinc-600">
              Consulte a estrutura de funis e etapas de vendas para mapeamento antes da criação de leads.
            </p>
            <div className="space-y-3">
              {ENDPOINTS_DATA.pipelines.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  isOpen={!!openCards[ep.id]}
                  onToggle={() => toggleCard(ep.id)}
                />
              ))}
            </div>
          </section>

          {/* Custom Fields Endpoints */}
          <section id="custom-fields" className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Sliders className="h-5 w-5 text-amber-500" />
              Campos Personalizados
            </h2>
            <p className="text-sm text-zinc-600">
              Liste ou crie os campos customizados que podem ser enviados no parâmetro <code className="font-mono text-xs bg-zinc-100 px-1 py-0.5 rounded">customFields</code>.
            </p>
            <div className="space-y-3">
              {ENDPOINTS_DATA.customFields.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  isOpen={!!openCards[ep.id]}
                  onToggle={() => toggleCard(ep.id)}
                />
              ))}
            </div>
          </section>

          {/* Users Endpoints */}
          <section id="users" className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <UserCheck className="h-5 w-5 text-amber-500" />
              Usuários (Membros)
            </h2>
            <p className="text-sm text-zinc-600">
              Obtenha os IDs dos vendedores do workspace para atribuir negócios e tarefas.
            </p>
            <div className="space-y-3">
              {ENDPOINTS_DATA.users.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  isOpen={!!openCards[ep.id]}
                  onToggle={() => toggleCard(ep.id)}
                />
              ))}
            </div>
          </section>

          {/* Lead Forms Endpoints */}
          <section id="lead-forms" className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Globe className="h-5 w-5 text-amber-500" />
              Formulários Públicos de Captação
            </h2>
            <p className="text-sm text-zinc-600">
              Endpoint público e seguro para capturar leads diretamente de formulários HTML ou landing pages sem necessidade de API key secreta.
            </p>
            <div className="space-y-3">
              {ENDPOINTS_DATA.leadForms.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  isOpen={!!openCards[ep.id]}
                  onToggle={() => toggleCard(ep.id)}
                />
              ))}
            </div>
          </section>

          {/* Errors Section */}
          <section id="errors" className="space-y-6">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 pb-2 border-b border-zinc-200">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Tratamento de Erros & Warnings
            </h2>
            <div className="space-y-4 text-sm text-zinc-600 leading-relaxed">
              <p>
                Todas as respostas com erro seguem a mesma estrutura padronizada em JSON:
              </p>

              <CodeBlock
                language="json"
                code={`{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Informe contactId ou contact com name e email/phone"
  }
}`}
              />

              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-400 border-b border-zinc-100 bg-zinc-50/50">
                      <th className="py-2.5 px-4 font-medium">HTTP Status</th>
                      <th className="py-2.5 px-4 font-medium">Código do Erro</th>
                      <th className="py-2.5 px-4 font-medium">Quando Acontece</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {ERROR_CODES_TABLE.map((row) => (
                      <tr key={row.code} className="hover:bg-zinc-50/50">
                        <td className="py-2.5 px-4 font-mono font-bold text-zinc-800">{row.status}</td>
                        <td className="py-2.5 px-4 font-mono font-medium text-amber-800">{row.code}</td>
                        <td className="py-2.5 px-4 text-zinc-600">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Warnings explanation */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                  Avisos / Warnings em Campos Customizados
                </h4>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Quando você envia o objeto <code className="font-mono bg-zinc-200/70 px-1 py-0.5 rounded text-zinc-800">customFields</code> e algum campo especificado não existir no workspace, a requisição <strong>não falha</strong>. O lead ou negócio é criado normalmente com status 201 e a resposta devolve o array <code className="font-mono bg-zinc-200/70 px-1 py-0.5 rounded text-zinc-800">warnings</code> contendo os campos ignorados:
                </p>
                <CodeBlock
                  language="json"
                  code={`{
  "data": {
    "id": "7fa84b80-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    "contactId": "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
    "created": true
  },
  "warnings": [
    { "field": "campo_inexistente", "message": "Custom field not found in workspace" }
  ]
}`}
                />
              </div>
            </div>
          </section>

          {/* Cross-Link Help Banner */}
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/50 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-amber-900">Precisa de um tutorial passo a passo?</h3>
              <p className="text-xs text-amber-700 mt-1">
                Confira nosso guia prático com exemplos para Facebook Lead Ads, Elementor, WordPress e Make.
              </p>
            </div>
            <Link
              href="/ajuda/integracao-leads-externos"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2.5 shadow-xs transition-colors shrink-0"
            >
              <span>Ver Guia Completo</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-200 pt-6 text-center text-xs text-zinc-400 space-y-1">
            <p>Trino CRM API v1 · Documentação Técnica Oficial</p>
            <p>Dúvidas sobre a API? Entre em contato com a equipe de suporte do Trino CRM.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
