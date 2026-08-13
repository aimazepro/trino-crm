# Changelog

Histórico de mudanças notáveis do projeto, em ordem cronológica. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) — cada entrada é datada e agrupada por tipo (Added/Fixed/Changed), pensado tanto pra quem desenvolve quanto pra uma IA retomar contexto de sessões passadas sem precisar reler o histórico de commits inteiro.

## 2026-08-12

### Added
- Integração real com Google Calendar: criar/editar/apagar uma atividade no CRM (Ligação, Reunião, Videochamada, etc.) agora cria/atualiza/apaga o evento correspondente no Google Calendar automaticamente, com nome `"Título — Negócio"` (ou só o título quando não há negócio vinculado).
- Google Meet automático para atividades tipo Reunião/Videochamada — link exibido no modal de Atividade (chip com botão "Copiar").
- Sincronização manual real via "Sincronizar agora" em Configurações > Calendário — puxa pro CRM mudanças feitas direto no Google Calendar. Só eventos originados pelo CRM voltam; um evento criado só no Google (sem negócio pra vincular) não vira atividade nova.
- Toggle Bidirecional/Unidirecional passa a persistir no banco (`integrations.sync_type`) em vez de só no `localStorage` do navegador.
- `TimeField` (`src/components/ui/time-field.tsx`): campo de horário com sugestão em dropdown (múltiplos de 15min; no campo de fim, mostra duração a partir do início). Usado no modal de Atividade e nas etapas de Sequência.
- Migration `supabase/migrations/20260812190000_google_calendar_sync.sql`: colunas `google_event_id`/`meet_link`/`calendar_synced_at` em `activities`; `sync_type`/`calendar_id`/`sync_token`/`last_synced_at` em `integrations`.
- Docs da feature: [spec](docs/superpowers/specs/2026-08-12-google-calendar-sync-design.md) e [plano de implementação](docs/superpowers/plans/2026-08-12-google-calendar-sync.md).

### Fixed
- `redirect_uri_mismatch` no OAuth do Google Calendar (redirect URI não registrado no Google Cloud Console).
- **Segurança:** rota `/api/calendar/sync-activity` não tinha autenticação nenhuma — qualquer requisição anônima podia apagar ou reenviar o evento de calendário de qualquer usuário/tenant só sabendo o `activityId`. Corrigido com checagem de sessão + verificação de que a atividade pertence a quem chamou.
- Race condition no delete: apagar uma atividade no CRM disparava o delete no Google em paralelo com o delete no banco; o delete no banco quase sempre ganhava a corrida e o evento ficava órfão no Google Calendar pra sempre. Agora o delete no Google é aguardado antes do delete no banco.
- Editar uma atividade Reunião/Videochamada regenerava um Google Meet **novo** a cada edição, podendo invalidar o link que já tinha sido copiado/compartilhado. Agora só pede Meet novo se a atividade ainda não tiver um.
- Marcar uma atividade antiga (nunca sincronizada) como "feita" criava um evento novo no Google **no passado**, com convite por email desnecessário pros convidados.
- Cron de sincronização (`/api/cron/calendar-pull`) ficava aberto (sem autenticação) sempre que `CRON_SECRET` não estivesse configurado — agora falha fechado.
- Sincronização Google→CRM podia confundir atividade de usuários diferentes quando um convidado também era usuário do CRM com Google Calendar conectado (mesmo `google_event_id` em ambas as agendas).
- Evento dia-inteiro do Google era gravado incorretamente nos campos de data/hora da atividade — agora é ignorado no pull.
- Bug no `TimeField`: digitar uma hora de 2 dígitos acima de 23 (ex: "950" tentando chegar em 9:50) travava o campo permanentemente.

### Changed
- Cron automático de sincronização a cada 2 minutos (`vercel.ts`) foi **removido** — a conta Vercel está no plano Hobby, que só permite cron 1x/dia, e declarar um cron mais frequente quebrava o deploy do **projeto inteiro** (não só dessa feature), toda vez. Por enquanto a sincronização Google → CRM é só sob demanda, via botão "Sincronizar agora". A sincronização CRM → Google continua instantânea normalmente.

### Known issues / próximos passos
- Sem teste ponta-a-ponta ainda contra uma conta Google real (só verificação de tipo/lint até aqui).
- Página de Agenda (visualização mensal/semanal/diário estilo Google, com eventos externos ao vivo e linha do horário atual) — desenhada como Fase 3 na spec, **não implementada**.
- Cadência automática do pull Google → CRM pendente de decisão: upgrade pro plano Vercel Pro (libera cron frequente), scheduler externo batendo em `/api/cron/calendar-pull`, ou manter só manual mesmo.
