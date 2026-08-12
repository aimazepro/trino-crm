# Sync real com Google Calendar — push instantâneo, pull, naming, Google Meet

**Status:** approved
**Date:** 2026-08-12

## Contexto

`/configuracoes/calendario` conecta o OAuth de verdade (corrigido nesta mesma sessão, ver commit `f063442`), mas depois disso tudo é fachada:

- `handleSyncNow` em [calendario/page.tsx](../../../src/app/configuracoes/calendario/page.tsx) só faz `setTimeout(1200)` — não chama a Calendar API.
- `syncType` (bidirecional/unidirecional) e `lastSyncTime` só existem em `localStorage` do navegador — não persistem no banco, um servidor não teria como ler.
- Nenhum arquivo do projeto chama `googleapis.com/calendar/v3/...events` — as únicas chamadas Google existentes são a troca de token OAuth e `userinfo`.
- `activities` não tem coluna pra guardar o evento do Google vinculado; `integrations` não tem coluna pra guardar preferência de sync nem token de sincronização incremental.

Objetivo: quando o usuário cria/edita/apaga uma atividade no CRM, isso vira um evento real no Google Calendar (na hora, sem clicar em "sincronizar"), com nome e Google Meet corretos; e quando o próprio usuário edita um desses eventos direto no Google, isso volta pro CRM em até ~2min.

## Fases

1. **Push CRM → Calendar** (instantâneo) + naming + Google Meet — entrega o pedido principal.
2. **Pull Calendar → CRM** (polling) + toggle/botão da página de configurações virando reais.
3. **Página de Agenda** (mensal/semanal/diário, estilo Google, linha vermelha da hora atual, mostrando também eventos 100% externos ao vivo) — fora de escopo aqui, spec própria depois que 1 e 2 estiverem no ar.

## 1. Modelo de dados

Migration nova:

```sql
alter table activities
  add column google_event_id text,
  add column meet_link text,
  add column calendar_synced_at timestamptz;

alter table integrations
  add column sync_type text not null default 'bidirecional'
    check (sync_type in ('bidirecional', 'unidirecional')),
  add column calendar_id text not null default 'primary',
  add column sync_token text,
  add column last_synced_at timestamptz;
```

`sync_type` sai do `localStorage` e passa a ser lido/gravado direto na tabela (mesma linha já usada pra guardar os tokens).

## 2. Cliente Calendar API

Novo `src/lib/google-calendar.ts`:

- `getValidAccessToken(userId, provider)`: lê `integrations`, decripta com `decryptToken` ([token-crypto.ts](../../../src/lib/token-crypto.ts)), se `expires_at` já passou faz refresh (`grant_type=refresh_token`) e regrava `access_token`/`expires_at` encriptados.
- `createEvent` / `updateEvent` / `deleteEvent` / `listEvents`: chamam `calendar/v3/calendars/{calendarId}/events...`. `createEvent`/`updateEvent` aceitam `withMeet: boolean` — quando true, manda `conferenceDataVersion=1` + `conferenceData.createRequest` e lê `conferenceData.entryPoints` da resposta pra extrair o link do Meet.

## 3. Push instantâneo (Fase 1)

Nova rota `POST /api/calendar/sync-activity` (`{ activityId, action: "upsert" | "delete" }`):

- Carrega a atividade + negócio (`deals.title`) + integração do **assignee** da atividade (cada vendedor sincroniza no próprio Google, via `assignee_id`).
- Sem integração ativa → no-op silencioso (não quebra o save no CRM).
- Nome do evento: `"{título} — {negócio.title}"`; sem negócio vinculado, só o título.
- `type` é `"Reunião"` ou `"Videochamada"` → `withMeet: true`. Resposta grava `meet_link` na atividade e retorna pro client, que mostra um chip **"Google Meet [link] [copiar]"** acima do campo Notas do [activity-modal.tsx](../../../src/components/deal/activity-modal.tsx) — campo próprio, não concatenado no texto livre da nota (evita perder o link se o usuário editar a nota).
- `guests` (já existe no schema, hoje sem efeito nenhum) viram `attendees` reais do evento.
- Atividade sem `endDate` → evento de 30min a partir do início (Google exige fim).
- Roda em **ambos** os modos de sync (uni/bidirecional) — o toggle só decide a direção de volta (Fase 2).
- `action: "delete"` apaga o evento no Google quando a atividade é apagada no CRM.

Disparo: chamado direto de `addActivity` / `updateActivity` / `deleteActivity` em [use-crm-mutations.ts](../../../src/hooks/use-crm-mutations.ts), logo após o `insert`/`update`/`delete` no Supabase confirmar — mesmo padrão client-orchestrated que o resto do arquivo já usa, sem precisar de trigger/webhook novo pra essa direção. Fica instantâneo porque roda no mesmo request da ação do usuário.

## 4. Pull por polling (Fase 2)

Cron novo (`vercel.ts`, `crons: [{ path: "/api/cron/calendar-pull", schedule: "*/2 * * * *" }]`) — a cada 2min, pra cada `integrations` ativa com `sync_type = 'bidirecional'`:

- `listEvents` com `sync_token` salvo (incremental) — se não tiver token ainda, faz sync completo inicial e guarda o token retornado.
- Evento com `google_event_id` batendo em alguma `activities` → atualiza título/horário/notas/`completed` (se o evento foi cancelado no Google) na atividade correspondente.
- Evento cancelado no Google → **desvincula** (`google_event_id = null`), não apaga a atividade do CRM — apagar automaticamente por causa de uma ação externa é risco de perda de dado.
- Evento **sem** `google_event_id` correspondente (criado direto no Google, nunca originado do CRM) → ignorado nesta fase, não vira atividade nova. Fica reservado pra Fase 3 (Agenda) mostrar ao vivo, sem gravar no banco.
- Atualiza `last_synced_at`.

## 5. Botão/toggle da página de configurações

- Toggle Bidirecional/Unidirecional grava em `integrations.sync_type` (Supabase update direto, mesmo padrão da página hoje).
- "Sincronizar agora" chama uma rota que roda um ciclo de pull igual ao do cron (só que na hora) + backfill: qualquer atividade do usuário sem `google_event_id` é empurrada pro Google. Isso torna o botão real, cobre o "instantâneo" pra quem não quer esperar o cron.

## 6. Tratamento de erro

- Token revogado/refresh falhou → marca `integrations.active = false`, próxima visita à página de configurações mostra banner de erro pedindo reconectar. Push/pull dessa integração vira no-op até reconectar — nunca bloqueia salvar a atividade no CRM.
- Erro/rate-limit da Calendar API → loga (`console.error`, mesmo padrão do resto do arquivo), atividade continua salva normalmente no CRM mesmo se o Google falhar.

## Fora de escopo aqui

- Página de Agenda (Fase 3, item 3 acima).
- Seletor de calendário alternativo (`calendar_id` fixo em `"primary"` por enquanto — o dropdown "Calendário para sincronizar" na página continua só mostrando a conta principal).
- Push webhook real-time do Google (trade-off decidido em favor do polling de 2min — evita exigir verificação de domínio no Google Search Console e cron de renovação de canal).

## Verificação

Sem framework de teste no projeto (`package.json` só tem `dev`/`build`/`start`/`lint`) — verificação manual:

1. Criar atividade tipo Reunião com negócio vinculado → evento aparece no Google Calendar como `"{título} — {negócio}"`, com Meet; chip de copiar aparece no modal.
2. Editar horário do evento direto no Google → em até 2min a atividade no CRM reflete o novo horário.
3. Cancelar evento no Google → atividade some do vínculo (`google_event_id` null) mas continua existindo no CRM.
4. Desconectar integração → criar/editar atividade continua funcionando normalmente no CRM, sem erro pro usuário.
