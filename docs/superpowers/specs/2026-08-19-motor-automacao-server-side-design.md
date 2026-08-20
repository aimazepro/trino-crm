# Motor de automação server-side — design

**Status:** aprovado, pronto para plano de implementação
**Origem:** `docs/BACKLOG.md` § "🟡 Fase 2 — Entrada de leads + motor de automação server-side" → seção "Motor"
**Escopo:** só o motor (S-2, `send_webhook`, fila de retry de webhook, bug do `step.note`, fila de email, tela de log, S-4, sequências). A metade "Entrada de leads" da Fase 2 (rota `x-api-key`, webhook de entrada, distribuição automática) fica para depois — este documento não cobre.

## Contexto

Fase 1 (multi-tenancy) está feita, deployada e verificada em produção (`main`, https://trino-crm.vercel.app). Não redescobrir isso.

Fonte de verdade dos itens: `docs/BACKLOG.md` §154-207, com referência ao `docs/AUDIT-2026-08-19-saas-deep-dive.md`.

**Problema central (S-2, ALTO):** `src/lib/run-automations.ts` roda no navegador do usuário, chamado por `src/hooks/use-crm-mutations.ts` em 5 pontos (`moveDeal`, `markDealStatus`, `updateDealFields`, criação de deal, criação de atividade). Fechar a aba no meio para a automação sem retry, sem fila, sem log. Pior: eventos que não passam pelo navegador (import CSV, API pública, webhook de entrada — todos planejados para a segunda metade da Fase 2) nunca disparam automação nenhuma. Isso bate direto no modelo de negócio: lead que entra por importação ou API é justamente o caso que mais paga, e é o que não recebe WhatsApp automático hoje.

**Achado durante a exploração, fora do backlog original:**
- `moveDealToPipeline` (`use-crm-mutations.ts:47-73`) muda `stage_id` mas nunca chama `runAutomations` — mover negócio entre pipelines não dispara `stage_changed` hoje. A arquitetura de trigger no banco (seção 1) corrige isso de graça.
- `supabase/functions/process-sequences/index.ts` grava `user_id` em vez de `workspace_id` nos inserts — quebrado desde o rename da Fase 1, além do bug já conhecido do `step.note`. Ver seção 4.
- Existem dois mecanismos de sequência distintos: `enrollDealInSequence` (client, em `src/lib/sequence-helpers.ts`, cria todas as atividades de uma vez, não manda WhatsApp/email de verdade — é uma lista de tarefas manual) e `start_sequence` (ação do motor, incremental via `process-sequences`, quebrado). Ficam como fluxos diferentes; só o segundo entra no escopo deste trabalho.

## 1. Arquitetura — outbox + workers

```
deals/activities (INSERT/UPDATE)
        │  trigger Postgres (AFTER INSERT/UPDATE)
        ▼
automation_events (outbox: pending/processing/done/failed)
        │  claim_pending_automation_events() SKIP LOCKED
        ▼
POST /api/automations/run   ← pg_cron a cada 1min, Bearer AUTOMATION_DISPATCH_SECRET
        │  motor: lógica de run-automations.ts portada para
        │  src/lib/automation-engine.ts, client Supabase admin
        ├─► automation_runs / automation_run_steps (log por passo)
        ├─► automation_email_queue (pending)    → POST /api/automations/email-queue
        ├─► automation_whatsapp_queue (pending) → POST /api/whatsapp/queue (já existe)
        └─► send_webhook: SSRF guard + HMAC (src/lib/webhook-security.ts) → log em automation_run_steps
```

### Por que outbox via trigger de banco, não enqueue explícito no app

Decisão tomada explicitamente contra a alternativa (trocar as 5 chamadas de `runAutomations()` por inserts explícitos em cada call-site). O trigger no banco garante que **qualquer** caminho que grave em `deals`/`activities` dispara automação — inclusive os que a Fase 2 (import CSV, API pública, webhook de entrada) ainda vai criar — sem precisar lembrar de conectar cada novo entry point. Corrige de graça o bug do `moveDealToPipeline` acima, porque o trigger reage à coluna que mudou, não a qual função JS mexeu nela.

### Funções de trigger

Uma função por tabela:

- `deals` AFTER INSERT → emite `deal_created`.
- `deals` AFTER UPDATE, ordem de prioridade (replica exatamente o comportamento atual, um trigger por UPDATE, sem duplicar):
  1. `NEW.stage_id IS DISTINCT FROM OLD.stage_id` → `stage_changed`
  2. senão `NEW.status = 'Ganho' AND OLD.status IS DISTINCT FROM 'Ganho'` → `deal_won`
  3. senão `NEW.status = 'Perdido' AND OLD.status IS DISTINCT FROM 'Perdido'` → `deal_lost`
  4. senão, se qualquer outra coluna do row mudou (`UPDATE` não é só bookkeeping como `updated_at`) → `deal_updated`
- `activities` AFTER INSERT → `activity_created`.

Cada emissão insere uma linha em `automation_events` (não chama a automação diretamente do trigger — mantém a lógica de condição/ação fora do PL/pgSQL, em TypeScript, testável e legível).

### Tabela `automation_events`

```
id            uuid pk
workspace_id  uuid not null
entity_type   text not null   -- 'deal' | 'activity'
entity_id     uuid not null
trigger       text not null   -- TriggerType
status        text not null default 'pending'  -- pending|processing|done|failed
attempts      int not null default 0
error         text
created_at    timestamptz not null default now()
claimed_at    timestamptz
```

O worker relê a linha atual de `deals`/`activities` no momento do claim (não carrega snapshot do trigger) — mais simples, e sempre reflete o estado mais recente caso o evento demore a ser processado.

### `src/lib/automation-engine.ts`

Porta a lógica pura de `run-automations.ts` (`evaluateRule`, `conditionsPass`, `interpolate`, `executeAction`, os 11 tipos de ação) recebendo um `SupabaseClient` (admin, não browser) por parâmetro. `src/lib/run-automations.ts` e as 5 chamadas em `use-crm-mutations.ts` são removidos — o trigger no banco cobre tudo.

## 2. Filas de saída

- **WhatsApp**: reusa `src/app/api/whatsapp/queue/route.ts`, sem mudança — já segue o padrão certo (claim RPC, `reapStuck`, secret Bearer, `pg_cron`).
- **Email**: nova rota `src/app/api/automations/email-queue/route.ts`, mesmo padrão. Usa a RPC `claim_pending_email_queue` (já existe e já foi corrigida na migração `20260819220000`). Mantém a lógica de OAuth/refresh do Gmail como está hoje — só troca a casca de execução de Deno para Next. `supabase/functions/process-email-queue` é removida depois que a rota nova estiver validada em produção.
- **Sequências**: nova rota `src/app/api/automations/sequences/route.ts` substituindo `supabase/functions/process-sequences`. Ver seção 4.

Motivo de migrar email e sequências para o app em vez de corrigir in-place no Deno: um runtime só para todas as filas orientadas a `pg_cron`, em vez de Deno + Next duplicados fazendo o mesmo tipo de trabalho — menos superfície para manter, mesmo padrão de secret/claim/reap em todo lugar.

## 3. Log de execução

Duas tabelas novas, granularidade por passo (não por execução — precisa dar para responder "por que o WhatsApp não disparou nesse negócio" olhando o passo específico):

```
automation_runs
  id             uuid pk
  workspace_id   uuid not null
  automation_id  uuid not null references automations
  event_id       uuid references automation_events
  trigger        text not null
  deal_id        uuid
  started_at     timestamptz not null default now()
  finished_at    timestamptz
  status         text not null  -- running|success|partial|failed

automation_run_steps
  id             uuid pk
  run_id         uuid not null references automation_runs
  step_id        text not null       -- id do step dentro do JSON automations.steps
  action_type    text not null
  status         text not null       -- success|failed
  error          text
  response_code  int               -- só send_webhook usa
  created_at     timestamptz not null default now()
```

Tela nova em `configuracoes/automacoes/[id]/log` (ou rota equivalente) lista `automation_runs` por automação com drill-down nos steps. Sem essa tela o motor não é vendável (item já mapeado no backlog).

`send_webhook` grava seu resultado (URL, response code, erro) em `automation_run_steps` em vez de `webhook_deliveries` — decisão explícita: `webhook_deliveries.webhook_id` é NOT NULL e aponta para uma assinatura registrada em `webhooks`, e a URL de um passo de automação não é uma assinatura registrada. Resolve a inconsistência apontada no backlog (SSRF guard + HMAC iguais aos outros 3 caminhos) sem misturar dois conceitos na mesma tabela.

## 4. Sequências

`process-sequences` migra para `src/app/api/automations/sequences/route.ts` (mesma decisão que email, seção 2) e corrige, no mesmo movimento:

- Troca `user_id` por `workspace_id` nos inserts em `automation_email_queue`/`automation_whatsapp_queue`/`activities` — quebrado desde o rename da Fase 1.
- Usa `parseSequenceStepNote(step.note, step.day_offset)` (já existe em `src/lib/sequence-helpers.ts`) em vez do `step.note` cru — extrai `.title`/`.notes` para montar assunto/corpo do email e texto do WhatsApp, em vez de jogar o JSON serializado inteiro.
- Passos `Email` e `WhatsApp` chamam os mesmos executores do motor (`executeAction` casos `send_email`/`send_whatsapp` de `automation-engine.ts`) em vez de duplicar a lógica de insert na fila — uma implementação só para "enfileirar email"/"enfileirar WhatsApp", chamada tanto pelo motor de automação quanto pelo avanço de sequência.

`enrollDealInSequence` (botão manual "iniciar sequência", client-side, cria as atividades todas de uma vez como lista de tarefas) fica como está — fluxo diferente, fora de escopo.

## 5. S-4 — `api/webhooks/trigger` sem checar dono

`src/app/api/webhooks/trigger/route.ts` recebe `webhookId` do client e grava em `webhook_deliveries` sem verificar que o webhook pertence ao workspace de quem chamou — dá para poluir o log de entregas de outro tenant.

Fix: antes de logar, `SELECT id FROM webhooks WHERE id = :webhookId AND workspace_id = :callerWorkspaceId`. Se não encontrar, responde 403 em vez de logar sob o `webhookId` alheio. O envio em si (`url`/`secret` fornecidos pelo próprio client, que já é dono do formulário de teste) não muda.

## 6. SSRF guard + HMAC — deduplicação

Hoje existem 3 cópias idênticas de `isPrivateOrUnsafeUrl` + `hmacSha256`: `src/app/api/webhooks/trigger/route.ts`, `src/lib/webhooks.ts`, e a versão Deno em `supabase/functions/dispatch-webhooks/index.ts`. Extrai a versão Node para `src/lib/webhook-security.ts`, importado pelas duas rotas Next existentes e pelo novo `send_webhook` do motor (`automation-engine.ts`). A cópia Deno não muda — runtime diferente, não é importável — fica como está, fora de escopo.

## 7. Fila de retry `dispatch-webhooks`

Hoje `webhooks.ts` (`dispatchWebhooks`) e `api/webhooks/trigger` gravam `status='sent'` ou `status='failed'` direto na primeira tentativa — nunca `'pending'` — por isso a fila de retry (`supabase/functions/dispatch-webhooks`, que lê `WHERE status='pending' AND attempts<5`) nunca tem o que processar.

Fix: na primeira falha, gravar `status='pending'` (não `'failed'`) quando `attempts < 5`; só vira `'failed'` terminal quando a fila de retry esgotar as tentativas (ela já tem essa lógica). `dispatch-webhooks` em si não muda de comportamento.

A implementação verifica se `pg_cron` já chama essa function periodicamente — pode estar morta em dois pontos ao mesmo tempo (nada produz `pending` **e** ninguém agenda a chamada).

## 8. Cron novo

3 jobs novos no `pg_cron`: `automations/run`, `automations/email-queue`, `automations/sequences`. Todos usam o mesmo secret `AUTOMATION_DISPATCH_SECRET` já usado pelo WhatsApp (env var, não service-role key) — não piora o S-1 (que segue proposital em aberto, fora de escopo deste trabalho).

## Erros e retry

Todo worker novo segue o padrão de `whatsapp/queue/route.ts`: claim via RPC `SKIP LOCKED` marcando `processing`; `reapStuck` derruba para `failed` linhas presas em `processing` por mais de 15min (nunca reprocessa às cegas — evita duplicar efeito colateral como reenviar mensagem). `automation_events`, `automation_email_queue`, `automation_whatsapp_queue` e a claim de sequências seguem o mesmo desenho.

## Fora de escopo (explícito)

- Entrada de leads (rota `x-api-key`, webhook de entrada, endpoint de formulário, gatilho `lead_recebido`, distribuição automática, campos de atribuição, doc de integração, infra Cloudflare) — outra metade da Fase 2, outro documento.
- S-1 (service-role key em texto puro em `cron.job.command`) — proposital em aberto, decisão do dono.
- `/login` auto-cadastro sem convite — achado na Fase 1, não relacionado ao motor.
- Criptografia de token do Gmail em `integrations` — se a exploração da implementação encontrar inconsistência com `OAUTH_ENCRYPTION_KEY`, vira item novo de backlog, não conserto silencioso aqui.
- Testes automatizados — projeto não tem suite hoje; verificação é manual, descrita abaixo.

## Verificação

Sem suite automatizada no projeto. Verificação manual pós-deploy:
1. Disparar cada um dos 6 triggers pela UI (criar deal, mover etapa, mover pipeline, marcar ganho/perdido, editar campo, criar atividade) e conferir `automation_runs`/`automation_run_steps` populados corretamente.
2. Conferir as 3 filas novas (`email-queue`, `whatsapp/queue`, `sequences`) drenando via `pg_cron`.
3. Testar `send_webhook` contra URL de teste (ex. webhook.site): confirma SSRF guard bloqueando IP privado, HMAC presente, log em `automation_run_steps`.
4. Testar S-4: tentar logar com `webhookId` de um workspace diferente do chamador, confirmar 403 (precisa 2 workspaces de teste).
5. Confirmar que `dispatch-webhooks` está de fato agendada no `pg_cron` e que uma falha grava `pending` e é reprocessada.

## Arquivos novos/alterados (visão geral)

**Novos:**
- `src/lib/automation-engine.ts` (lógica pura, portada de `run-automations.ts`)
- `src/lib/webhook-security.ts` (SSRF guard + HMAC, extraído)
- `src/app/api/automations/run/route.ts`
- `src/app/api/automations/email-queue/route.ts`
- `src/app/api/automations/sequences/route.ts`
- `configuracoes/automacoes/[id]/log` (ou rota equivalente, tela de log)
- Migração: `automation_events`, `automation_runs`, `automation_run_steps`, triggers em `deals`/`activities`, `claim_pending_automation_events`

**Alterados:**
- `src/hooks/use-crm-mutations.ts` (remove as 5 chamadas de `runAutomations`)
- `src/app/api/webhooks/trigger/route.ts` (fix S-4, usa `webhook-security.ts`)
- `src/lib/webhooks.ts` (usa `webhook-security.ts`, grava `pending` em vez de `failed` na 1ª falha)

**Removidos (após validar as rotas novas em produção):**
- `src/lib/run-automations.ts`
- `supabase/functions/process-email-queue`
- `supabase/functions/process-sequences`
