# Entrada de Leads + API Pública — design

**Status:** aprovado, pronto para plano de implementação
**Origem:** `docs/BACKLOG.md` § "🟡 Fase 2 — Entrada de leads + motor de automação server-side" → seção "Entrada de leads"
**Escopo:** a segunda metade da Fase 2. O Motor (automação server-side) está feito, deployado e verificado em produção — não redescobrir, não remedir. Este documento cobre tudo que falta: API pública completa (CRUD nos 7 recursos do CRM), autenticação por Bearer key, rate limiting, formulário público de captação, gatilho `lead_recebido`, distribuição automática, campos de atribuição, doc de integração, infra Cloudflare.

## Contexto

Fase 1 (multi-tenancy) e o Motor (Fase 2, metade 1) estão em produção, `main`, https://trino-crm.vercel.app. `api_keys` (tabela + hash SHA-256) já existe; nenhuma rota valida contra ela hoje — zero API pública real.

A tela `/configuracoes/api` (`src/app/configuracoes/api/page.tsx`) já foi construída pedindo "Proprietário padrão" e "Permissões" por key, mas nenhum dos dois é gravado no banco (`api_keys` só tem `name`/`key_hash`/`key_prefix`/`revoked`) — a UI promete controle de acesso que não existe. O dono trouxe como referência a documentação pública de um concorrente ("DMhub", `crm.destruindometas.com.br`) cujo layout de tela e cópia batem quase literalmente com o que já está neste repo — reforça o achado já registrado em `docs/BACKLOG.md` § Fase 5 ("front foi parcialmente copiado de outro sistema", risco de marca a conferir, fora do escopo deste documento).

**Decisão de escopo, explícita do dono:** não é só "entrada de lead" — é a API pública inteira, todos os recursos que a referência mostra, funcional de ponta a ponta. Não fica pela metade.

## 1. Modelo de dado

### `api_keys` — 2 colunas novas

```sql
alter table api_keys
  add column default_owner_id uuid references auth.users(id),
  add column permissions jsonb not null default '["all"]'::jsonb;
```

`permissions` guarda um array dos 16 valores abaixo (o mesmo vocabulário que a tela já usa em `ALL_PERMISSIONS`, só passa a ser persistido):

```
all, read_deals, edit_deals, delete_deals,
read_contacts, edit_contacts,
read_companies, edit_companies,
read_activities, edit_activities,
read_notes, edit_notes,          -- novos, a tela também ganha os 2 checkboxes que faltam
read_pipelines,
read_custom_fields, create_custom_fields,
read_users
```

`default_owner_id` é o piso de atribuição: todo deal/atividade criado via essa key cai nesse dono a menos que a requisição mande `ownerId` explícito.

### `deals` — campos de atribuição + origem

```sql
alter table deals
  add column utm_source text,
  add column utm_medium text,
  add column utm_campaign text,
  add column utm_content text,
  add column utm_term text,
  add column campaign_id text,       -- id livre da plataforma de anúncio (Meta/Google), não FK interna
  add column origin text not null default 'app';
  -- origin ∈ 'app' | 'import' | 'api' | 'form'
```

`source` já existe (canal, ex. "Facebook Ads"); os `utm_*` são o detalhe da campanha. `origin` é o mecanismo de criação — é o que o trigger do Motor usa pra decidir `deal_created` vs `lead_recebido` (seção 5).

### `lead_forms` — tabela nova

O endpoint de formulário é público, sem Bearer (decisão da seção 3) — precisa de um identificador público-seguro próprio, diferente da API key secreta.

```sql
create table lead_forms (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id),
  name             text not null,
  pipeline_id      uuid references pipelines(id),      -- null = pipeline padrão (menor sort_order)
  stage_id         uuid references pipeline_stages(id), -- null = primeira etapa do pipeline resolvido
  default_owner_id uuid references auth.users(id),
  source_label     text not null default 'Formulário',
  honeypot_field   text not null default '_hp',
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
-- RLS: select/insert/update/delete só workspace_members do workspace (mesmo padrão de webhooks).
-- Leitura pública (sem RLS bypass) não é necessária: o endpoint usa service role.
```

### `api_idempotency_keys` — genérico, todo `POST`

```sql
create table api_idempotency_keys (
  workspace_id    uuid not null references workspaces(id),
  idempotency_key text not null,
  method          text not null,
  path            text not null,
  response_status int not null,
  response_body   jsonb not null,
  created_at      timestamptz not null default now(),
  primary key (workspace_id, idempotency_key, method, path)
);
```

Cliente manda header `Idempotency-Key`. Se a combinação já existe e tem menos de 24h, a rota devolve a resposta gravada sem reprocessar — protege qualquer `POST` (não só criação de deal) contra retry de webhook/integração. Sem header, comportamento normal (sempre processa).

### `api_rate_limit_windows` — janela fixa por key

```sql
create table api_rate_limit_windows (
  api_key_id     uuid not null references api_keys(id),
  window_start   timestamptz not null,  -- date_trunc('minute', now())
  request_count  int not null default 0,
  primary key (api_key_id, window_start)
);
```

A cada requisição: `INSERT ... ON CONFLICT (api_key_id, window_start) DO UPDATE SET request_count = request_count + 1 RETURNING request_count`. `request_count > 60` (default, configurável por key via nova coluna `api_keys.rate_limit_per_min`) → `429`. Linhas com mais de 1h são apagadas pelo job diário `purge-cron-logs` já existente (mesma faxina, uma tabela a mais na lista).

## 2. Camada de autenticação — `/api/v1/*`

Helper único, `resolveApiKey(request)` em `src/lib/api-auth.ts`, usado por toda rota nova:

1. Lê `Authorization: Bearer trn_...` (troca o `x-api-key` que o backlog citava originalmente — a key já nasce com prefixo `trn_` na tela de criação, só nunca foi checada em lugar nenhum. Bearer é o padrão que a doc de referência usa e o que qualquer integrador espera).
2. SHA-256 do token, compara com `api_keys.key_hash where revoked=false`. Sem match → `401 INVALID_API_KEY`. Sem header → `401 AUTH_REQUIRED`.
3. Checa/incrementa `api_rate_limit_windows`. Estourou → `429 RATE_LIMIT_EXCEEDED`, header `Retry-After`.
4. Atualiza `api_keys.last_used_at`.
5. Devolve `{ workspaceId, defaultOwnerId, permissions[] }`.

`hasPermission(permissions, needed)` → `true` se `"all"` ou `needed` está no array. Rota sem a permissão certa → `403 INSUFFICIENT_SCOPE`.

Toda resposta leva `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset`. Erros seguem `{ error: { code, message } }` — tabela de códigos (400 `VALIDATION_ERROR`, 401 `AUTH_REQUIRED`/`INVALID_API_KEY`, 403 `INSUFFICIENT_SCOPE`, 404 `NOT_FOUND`, 429 `RATE_LIMIT_EXCEEDED`, 500 `INTERNAL_ERROR`). `402 SUBSCRIPTION_REQUIRED` fica documentado no formato mas **sem checagem real** — não existe billing ainda (Fase 6, decisão já registrada do dono de tratar depois).

`GET /api/v1/me` — só resolve a key e devolve `{ workspace, key_name, default_owner_id, permissions }`. Sem permissão própria (qualquer key válida responde) — é o endpoint de "minha key funciona?" do quickstart.

`proxy.ts` ganha `/api/v1` na exclusão do matcher — chamada de máquina, sem cookie de sessão (mesma razão já documentada ali pra `api/whatsapp/webhook`).

## 3. Endpoints — CRUD completo

Todos sob `/api/v1/`, JSON, paginação por cursor (`?limit=50&cursor=...`, base64 opaco de `created_at,id`, ordenado desc; resposta inclui `next_cursor` quando há mais). Custom fields entram/saem como objeto `customFields` — campo desconhecido não quebra a chamada, volta em `warnings: [{field, message}]` no corpo da resposta (mesmo comportamento da referência).

| Recurso | Endpoints | Permissão | Filtros de lista |
|---|---|---|---|
| **Deals** | `POST` `GET` `GET :id` `PATCH :id` `DELETE :id` (soft delete — grava `deleted_at`/`deleted_by`/`delete_reason`, mesma convenção já usada no resto do app) `PATCH :id/stage` `PATCH :id/reopen` `POST :id/duplicate` | `read_deals` / `edit_deals` / `delete_deals` | `status`, `pipeline`, `stage`, `owner`, `updatedSince` |
| **Contacts** | `POST` `GET` `GET :id` `PATCH :id` `DELETE :id` | `read_contacts` / `edit_contacts` (delete também exige `edit_contacts` — não existe checkbox de exclusão dedicado pra contato na tela) | `updatedSince` |
| **Companies** | `POST` `GET` `GET :id` `PATCH :id` `DELETE :id` | `read_companies` / `edit_companies` | `updatedSince` |
| **Activities** | `POST` `GET` `PATCH :id` `PATCH :id/done` `DELETE :id` | `read_activities` / `edit_activities` | `dealId`, `updatedSince` |
| **Notes** | `POST` `GET` (filtra por `dealId`, obrigatório na listagem) | `read_notes` / `edit_notes` | `dealId` |
| **Pipelines** | `GET` `GET :id` (só leitura — descoberta de IDs antes de criar deal) | `read_pipelines` | — |
| **Custom fields** | `GET` `POST` | `read_custom_fields` / `create_custom_fields` | — |
| **Users** | `GET` (só leitura — descoberta de vendedores pra `ownerId`) | `read_users` | — |

**`POST /api/v1/deals`** é o endpoint central de entrada de lead — o mesmo exemplo da doc de referência ("lead do Facebook direto no pipeline"). Corpo:

```json
{
  "title": "Lead Facebook - João Silva",
  "value": 5000,
  "pipeline": "Vendas",           // nome OU id; ausente → pipeline padrão (menor sort_order)
  "stage": "Novo",                // idem; ausente → primeira etapa do pipeline resolvido
  "ownerId": "uuid opcional",     // ausente → default_owner_id da key
  "contactId": "uuid opcional",   // OU:
  "contact": { "name": "João Silva", "email": "joao@x.com", "phone": "31999998888" },
  "note": "Perguntou sobre plano X",  // opcional, vira a primeira nota do deal
  "source": "Facebook Ads",
  "utmSource": "facebook", "utmMedium": "cpc", "utmCampaign": "...", "utmContent": "...", "utmTerm": "...",
  "campaignId": "120210...",
  "customFields": { "cl_orcamento": "10000-20000" }
}
```

Se `contact` vier inline: dedupe por email OU telefone dentro do workspace (reaproveita se achar; contact novo se não achar — nunca duplica). Companies (quando `POST /api/v1/companies` ou inline futuro) dedupe por `cnpj` (dígitos, se vier) senão por `name` exato, mesma lógica. `title` ausente → gera a partir do nome do contato ("Lead — João Silva"). `origin='api'` sempre nesta rota.

**Fora de escopo, documentado como próximo passo** (não builda agora): API para gerenciar webhooks de saída (já existe UI própria em `/configuracoes/webhooks`, seria redundante); qualquer endpoint de billing/assinatura.

## 4. Formulário público — `lead_forms`

**`POST /api/v1/leads/form/:formId`** — sem `Authorization`, `formId` é o uuid não-secreto de `lead_forms`.

- Sem match ou `active=false` → `404` (não revela se o form existe).
- Corpo: `{ name, email?, phone?, note?, customFields? }` — sem `pipeline`/`stage`/`ownerId`/`idempotencyKey` (form não é chamada de sistema, não tem retry de webhook pra proteger); usa o que está configurado na linha de `lead_forms`.
- Honeypot: campo extra (nome configurável via `honeypot_field`, default `_hp`) — se vier preenchido, responde `200` mas não cria nada. Não avisa o bot.
- **Rejeita se `Host` não for `api-crm.aimaze.com.br`** — fecha o desvio de bater direto em `trino-crm.vercel.app` pulando o WAF do Cloudflare (seção 7).
- `origin='form'`, `source = lead_forms.source_label`.

Sem rate-limit por key aqui (não tem key) — cobertura fica pro Cloudflare.

**UI mínima em `/configuracoes/api`** (admin): listar/criar/desativar `lead_forms`, escolher pipeline/etapa/dono-padrão, copiar snippet de `<form>` HTML pronto (action apontando pro endpoint, honeypot já embutido como campo oculto). Sem isso a feature não tem uso real fora de mim mexendo via SQL.

## 5. Gatilho `lead_recebido`

`TriggerType` (`src/lib/crm-types.ts`) ganha `'lead_recebido'`.

Migration reescreve `emit_deal_automation_event()` (a mesma função do Motor, `supabase/migrations/20260820100100_automation_event_triggers.sql`): no `INSERT`, decide entre os dois triggers pela coluna nova `origin`:

```sql
IF TG_OP = 'INSERT' THEN
  IF NEW.deleted_at IS NULL THEN
    INSERT INTO automation_events (workspace_id, deal_id, trigger)
    VALUES (NEW.workspace_id, NEW.id,
      CASE WHEN NEW.origin IN ('api', 'form') THEN 'lead_recebido' ELSE 'deal_created' END);
  END IF;
  RETURN NEW;
END IF;
-- resto do UPDATE inalterado
```

Mutuamente exclusivo — `import` conta como `deal_created` (decisão de escopo: import CSV já existe e usa outro fluxo, `lead_recebido` é só pras duas portas de entrada novas desta spec). `deal_created` continua servindo criação manual/import/ações do motor (`create_deal`/`duplicate_deal`).

## 6. Distribuição automática

Zero código novo de engine — `assign_owner` com `ownerMode: "round_robin"` já existe (`src/lib/automation-engine.ts:381`) e já balanceia pelo menor número de deals abertos entre os ids configurados, sem estado externo.

Cada workspace configura sua própria automação (trigger `lead_recebido` → ação `assign_owner`) em `/automacoes`, do jeito que já configura as outras — pode encadear WhatsApp/email de boas-vindas no mesmo fluxo. `default_owner_id` (da key ou do `lead_forms`) é o piso: nunca fica `owner_id` nulo se configurado, mesmo sem automação nenhuma rodando; o round-robin da automação é a camada mais esperta por cima, opcional.

## 7. Infra Cloudflare

Domínio: `api-crm.aimaze.com.br` (zona `aimaze.com.br`, já no Cloudflare do dono — trino-crm ainda não tem domínio próprio, só `trino-crm.vercel.app`).

- **DNS:** `CNAME api-crm → cname.vercel-dns.com`, proxy Cloudflare ligado (nuvem laranja — é o que ativa WAF/rate-limit na borda).
- **Vercel:** adicionar `api-crm.aimaze.com.br` como domínio customizado do projeto `trino-crm`.
- **Rate limit na borda:** regra 100 req/min por IP em `api-crm.aimaze.com.br/*` — complementa (não substitui) o rate-limit por key da seção 2, cobre especificamente o endpoint de formulário público que não tem key pra limitar.
- **WAF:** conjunto de regras gerenciadas padrão da Cloudflare, ligado. Sem regra de bloqueio de país/bot customizada — over-engineering pra agora.
- **Acesso:** dono gera um API Token no dashboard Cloudflare (`My Profile → API Tokens`, escopo `Zone:DNS Edit` + `Zone:Firewall Services Edit` na zona `aimaze.com.br`), cola em `.env.local` como `CLOUDFLARE_API_TOKEN`. A implementação chama a API REST da Cloudflare via `curl`/`fetch` pra criar o registro DNS e as regras — pré-requisito da fase de infra no plano (seção 9), não bloqueia as fases anteriores.

## 8. Documentação pública

- **`/ajuda/integracao-leads-externos`** (mata o 404 hoje, já linkado em `/configuracoes/api`) — guia com vídeo/passo-a-passo pra Facebook Lead Ads, Elementor, WordPress, Zapier/Make (a promessa que a tela já faz).
- **`/configuracoes/api/docs`** (mata o outro 404) — referência completa no formato da doc mostrada pelo dono: quickstart, autenticação, scopes, rate limiting, cada recurso com exemplo `curl`, tabela de erros. Só documenta o que existe (sem CRUD de webhook/billing).

## 9. Segurança — resumo

- Bearer key: hash SHA-256, nunca texto puro em log/banco (mesmo padrão de `api_keys.key_hash` já existente).
- `permissions` real, enforced por rota — fecha a mentira atual da tela.
- Rate limit em duas camadas: por key (app, todas as rotas `/api/v1`) + por IP (Cloudflare, só o subdomínio dedicado).
- `Idempotency-Key` genérico em todo `POST` — protege contra retry duplicado de qualquer integração, não só lead.
- Honeypot + Host-header check no formulário público (única rota sem key).
- RLS em `lead_forms`/`api_idempotency_keys`/`api_rate_limit_windows` seguindo o padrão já estabelecido (`workspace_members` via `my_workspace_ids()`), sem policy nova a inventar.

## 10. Rollout — fases do plano de implementação

Uma spec só (decisão do dono), plano de implementação em fases numeradas para permitir pausa entre uma e outra sem perder o fio, dado o tamanho (bem maior que as 13 tasks do Motor, que já custou ~US$300):

1. **Schema** — todas as migrations desta seção 1, de uma vez (baixo risco, sem dado a migrar).
2. **Camada de auth** — `resolveApiKey`, rate limit, idempotência, `/me`, exclusão no `proxy.ts`.
3. **`POST /api/v1/deals`** + dedupe de contact — é o endpoint que fecha "Entrada de Leads" de verdade; testável ponta a ponta sozinho.
4. **Gatilho `lead_recebido`** + automação-modelo de distribuição — depende da fase 3 existir pra ter o que disparar.
5. **Resto do CRUD** (contacts, companies, activities, notes, pipelines read, custom-fields, users read, demais verbos de deals).
6. **Formulário público** (`lead_forms` + endpoint + UI mínima) — depende da fase 2 (auth layer) mas não do CRUD da fase 5.
7. **Infra Cloudflare** — depende do token do dono; pode rodar em paralelo com 5/6.
8. **Doc pública** — depende de 3–6 estarem funcionais pra documentar de verdade, não de mentira como a tela atual.

## 11. Testes que o plano precisa cobrir

- `POST /api/v1/deals` com `contact` inline novo, com `contact` repetido (dedupe), com `contactId` direto.
- `Idempotency-Key` repetida em duas chamadas — segunda não cria linha nova, devolve a mesma resposta.
- Rate limit: 61ª chamada no mesmo minuto → `429` com `Retry-After`.
- `permissions` sem `edit_deals` tentando `POST /deals` → `403`.
- `lead_recebido` dispara e `deal_created` não, pra deal com `origin='api'`; o inverso pra `origin='app'`.
- Formulário: honeypot preenchido → `200` fake, sem linha criada. Host errado → rejeitado.
- `default_owner_id` da key preenche `owner_id` quando a automação de round-robin não está configurada.
