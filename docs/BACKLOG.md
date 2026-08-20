# BACKLOG — TrinoCRM

**Fonte única de verdade do que falta fazer.** Consolida a auditoria, os
handoffs de WhatsApp e o `known-gaps.md` num lugar só, para que nada se perca
entre sessões.

> **Regra:** item não sai deste arquivo. Ou vira `[x]` com a data, ou vira
> "Descartado" com o motivo. Nunca some.

Última atualização: 2026-08-19 (design da Fase 1 escrito).

**Detalhe de cada item** está nos docs de origem, referenciados por sigla:
- `AUD` → `docs/AUDIT-2026-08-19-saas-deep-dive.md` (auditoria profunda, o plano mestre)
- `WPP` → `docs/2026-08-19-whatsapp-evolution-implementacao.md` (como o WhatsApp foi construído)
- `HAND` → `docs/HANDOFF-2026-08-19-whatsapp-automacoes.md` (handoff da sessão de automações)
- `GAPS` → `docs/known-gaps.md` (cantos cortados de propósito)
- `DES1` → `docs/superpowers/specs/2026-08-19-multi-tenancy-design.md` (design da Fase 1)

---

## Estado do repo

| | |
|---|---|
| Branch | `main`, working tree limpo |
| Produção | deployada e verificada (Fase 1 no ar) |
| `origin/main` | em dia |

Deploy é manual: `vercel deploy --prod`. `git push` não deploya.

---

## ✅ Já feito (não refazer)

- [x] **CRM core** — pipelines, kanban, negócios, contatos, empresas, atividades, campos customizados, soft-delete. Real e em uso. `AUD §3`
- [x] **Gmail** — OAuth, envio, sync, pixel de abertura. Tokens criptografados. `AUD §3`
- [x] **Google Calendar** — push instantâneo, Meet, pull manual. `AUD §3`
- [x] **Webhooks de saída** — 8 entregas `sent` comprovadas. `AUD §3`
- [x] **Faxina do banco (2026-08-19)** — 601 MB → 16 MB. Job `purge-cron-logs` diário. `AUD §6.5`
- [x] **WhatsApp via Evolution API (2026-08-19)** — conexão real com QR, envio de texto/imagem/áudio, recebimento por webhook, status de leitura, `/conversas` em tempo real, assinatura, gravador de voz. Verificado ponta a ponta. `WPP`
- [x] **Automações de WhatsApp ligadas ao driver (2026-08-19)** — fila drenada por `/api/whatsapp/queue`, mensagem automática cai na mesma thread das manuais. Verificado em produção com automação real. `WPP`, `HAND`
- [x] **Bug do `CHECK` das filas (2026-08-19)** — `claim_pending_*_queue` gravava `processing`, constraint não aceitava. Nenhuma automação de email ou WhatsApp jamais saiu deste CRM. Migração `20260819220000`. `HAND`
- [x] **Fase 1 — Multi-tenancy (2026-08-19)** — `workspace_id` real, RLS por papel, convite
  por link, fecha S-6 e S-3 de brinde. Ver seção própria abaixo. `DES1`

---

## 🔴 Fase 0 — Estancar o sangramento

Sem features. Torna o produto honesto e seguro antes de crescer. `AUD §6`

- [ ] **S-1 · CRÍTICO — chave service-role em texto puro no banco.**
  Os jobs do `pg_cron` guardam o header inteiro dentro de `cron.job.command`,
  incluindo uma secret key que bypassa RLS de todas as 43 tabelas de todos os
  tenants. Vaza em dump, backup e transcript de sessão de IA. Ação: rotacionar
  a chave e re-agendar os jobs lendo do Supabase Vault (`vault.decrypted_secrets`)
  ou via função `SECURITY DEFINER`. **Primeira coisa a fazer, antes de qualquer
  feature** — trava o score da auditoria em ≤69 sozinho. `AUD §S-1`
  - [x] **Job 4 ("webhooks", 2026-08-20)** — `dispatch-webhooks` ganhou checagem
    de bearer própria (`AUTOMATION_DISPATCH_SECRET`) e foi redeployado com
    `verify_jwt: false`; o job trocou o header de `sb_secret_...` para
    `AUTOMATION_DISPATCH_SECRET`. Verificado ao vivo (curl com/sem token,
    ticks de cron sucessivos com 200). 1 dos 4 vazamentos fechado.
  - [ ] **Jobs 1 ("email-queue") e 3 ("sequences")** ainda carregam o
    `sb_secret_...` exposto em `cron.job.command` hoje — só serão apontados
    para as novas rotas Next.js (`/api/automations/email-queue`,
    `/api/automations/sequences`) e trocados para `AUTOMATION_DISPATCH_SECRET`
    depois que esta branch for deployada (`vercel deploy --prod`) e as rotas
    confirmadas no ar. SQL pronto em
    `.superpowers/sdd/2026-08-19-motor-automacao-server-side/task-13-post-deploy-checklist.md`.
  - [ ] Job novo `automations-run` (worker do motor de automação) também
    fica pendente do mesmo deploy — mesmo checklist acima.
  - [ ] **Jobs 2 ("whatsapp-queue") e 4 ("webhooks"): `AUTOMATION_DISPATCH_SECRET` em texto puro** —
    exposição menor que `sb_secret_...` acima (secret dedicado, rotável, sem bypass de RLS),
    mas mesma classe (credencial visível a quem tem acesso SQL a `cron.job`). Pendente fix via Vault.
- [ ] **Ocultar as telas de decoração** — `/configuracoes/billing` (manter no
  código, ver Fase 6), `/prospeccao`, `/analise-calls`. `AUD §6.3`
- [ ] **Consertar os links 404** — `/configuracoes/api/docs` e
  `/ajuda/integracao-leads-externos` ficam como link, apontando para a doc que
  será escrita na Fase 2. `AUD §6.3`
- [ ] **`.env.example` + validação fail-fast de env vars.** 12 vars são lidas
  com `!`; faltando uma, quebra em runtime e não no boot. `AUD §S-5`
- [ ] **Security headers** — `next.config.ts` só tem rewrites. Sem CSP, HSTS,
  X-Frame-Options, Referrer-Policy. `AUD §S-5`
- [ ] **Agendar `api/cron/calendar-pull` no `pg_cron`.** Funciona, mas
  `CRON_SECRET` nunca foi setado em produção → está inerte. `AUD §3`
- [ ] **Cadência dos crons.** 4 jobs de minuto em minuto contra filas vazias
  queimam ~130 mil invocações/mês das 500 mil do free tier. Agora que a fila de
  WhatsApp é usada, reavaliar quais podem cair para 5 min. `AUD §6.5`
- [x] **S-6 — revogar `EXECUTE` do `anon`** em `is_workspace_member`,
  `replace_deal_labels`, `replace_deal_products` — fechado junto com a Fase 1 (também
  `my_workspace_ids`, `my_role`, `is_ws_manager`, `is_ws_admin`, as 4 novas). `AUD §S-6`
- [ ] **Ligar proteção contra senha vazada** (HaveIBeenPwned) no Supabase Auth.
  Cadastro é aberto, sem convite nem verificação de domínio. `AUD §S-5`

---

## ✅ Fase 1 — Multi-tenancy (feita em 2026-08-19)

A fundação. Era o bloqueador declarado do "vender como produto". `AUD §6`

> ✅ **Implementada e deployada em produção em 2026-08-19, seguindo o `DES1`.**
> Migração aplicada com os 7 asserts + teste sintético de isolamento entre tenants, todos
> passando antes do commit. `tsc`/`next build` limpos. `main` mesclada e no ar em
> `https://trino-crm.vercel.app`, verificada (zero runtime errors nos 15 min pós-deploy).
>
> **Duas decisões tomadas na execução, fora do `DES1`:** (1) a página de usuários tinha um
> par de status `blocked`/`active` que o design não previu — removido em vez de virar outra
> migração; hoje só `pending`/`accepted` existe, remoção de acesso é `DELETE` mesmo (a RLS já
> cobre). (2) `resolveWorkspaceOwner()` em `src/lib/whatsapp/connection.ts` virou
> `resolveWorkspaceId()`, sem o fallback `?? userId` — o dono agora tem linha seedada em
> `workspace_members`, então o fallback só escondia uma falha real de lookup.
>
> **Achado não resolvido, fora do escopo desta fase:** `/login` ainda permite auto-cadastro
> (`supabase.auth.signUp` sem convite). Com múltiplos workspaces reais, isso deixa de ser
> cosmético — qualquer um cria conta própria sem passar pelo convite. Avaliar se fecha ou não.

**O que o design descobriu, e que muda o plano original:**

- **A identidade do workspace já é o `auth.users.id` do dono.** Semeando `workspaces.id`
  com o mesmo uuid, migrar as 37 colunas vira `RENAME COLUMN` com valor intocado — não o
  backfill que reescreve linhas. Isso tira a Fase 1 do posto de maior risco de perda de
  dados; o aviso original abaixo está superado.
- **`workspace_settings` já é a tabela `workspaces`** (PK `owner_user_id`, mais `name`,
  `slug`, `plan`). Promover, não criar. Mesma coisa: `team_members` → `workspace_members`.
- **5 das 37 colunas são pessoais, não de tenant** (`notifications`, `emails`,
  `integrations`, `email_signatures`, `saved_reports`). Rename cego faria toda notificação
  do workspace vazar pra todo membro — invisível hoje, apareceria no primeiro convidado.
- **Existem 2 contas com dados, não 1.** Viram **dois workspaces separados** (decisão do
  dono), o que já testa multi-tenancy com 2 tenants reais no dia 1.
- **6 policies legadas `"X: user owns"` têm que morrer.** No rename o Postgres reescreve a
  expressão sozinho e ela vira `workspace_id = auth.uid()` — verdadeiro pro dono. Deixar de
  pé = dono furando toda regra de papel, sem sintoma na tela.

**Decisões travadas:** dois workspaces · 3 papéis fixos (gerente configura a operação, só
admin mexe em usuários/API keys/webhooks/credencial de WhatsApp) + `permissions jsonb`
reservado · convite por link copiável, sem email · `pg_dump` + migração única com asserts
embutidos, sem staging.

**Escopo real:** ~600 linhas no banco, 94 policies em 46 tabelas, 178 pontos de código em 59
arquivos. Fecha **S-6** e **S-3** de brinde.

**Atenção:** entre a migração e o deploy, produção fica quebrada. Precisa de uma sentada
inteira.

- [x] **`workspaces` + `workspace_members` com papéis reais.** Owner seedado como
  `admin`/`accepted` em cada workspace — sem isso as policies ficam inertes de novo.
- [x] **Migrar `user_id` → `workspace_id`** — rename de coluna, sem backfill (confirmado
  pelo `DES1`: o uuid do dono já era o do workspace).
- [x] **Reescrever as policies.** As 94 antigas (incl. as 6 `"X: user owns"`) derrubadas,
  refeitas por forma de papel. `WITH CHECK` agora trava o `workspace_id`, fecha o buraco de
  mover linha entre tenants. `AUD §S-6`
- [x] **S-3 · papéis deixam de ser cosméticos.** RLS referencia `role` via
  `my_role`/`is_ws_manager`/`is_ws_admin`; UI gateada (usuários, API keys, webhooks, empresa,
  WhatsApp = só admin; config de operação = admin+gerente). `AUD §S-3`
- [x] **Fluxo de convite real.** `POST /api/convites` (admin gera link com token) → 
  `/convite/[token]` (form de senha) → `POST /api/convites/aceitar` (service role cria/liga o
  auth user, marca `accepted`). Sem email, como decidido. `AUD §3`
- [x] **Visibilidade por papel.** Vendedor só vê os próprios negócios (RLS, não filtro de
  UI); admin/gerente veem tudo. Contatos/empresas compartilhados no workspace; atividades
  herdam a visibilidade do negócio pai via `EXISTS`. `AUD §6.1`

> ⚠️ ~~**Maior risco de perda de dados do projeto.**~~ **Superado pelo `DES1`:** não há
> backfill de valores, só rename de coluna. Continua valendo o `pg_dump` verificado antes —
> a tag `v0.1.0-pre-saas` cobre só o código, não o banco. `AUD §6.1`

---

## 🟡 Fase 2 — Entrada de leads + motor de automação server-side

Fundidas: são o mesmo subsistema. "Lead cai no sistema" só vale se disparar
automação, e automação só é confiável fora do browser. `AUD §6`

### Motor

- [ ] **S-2 · ALTO — tirar `run-automations.ts` do navegador.** Hoje importa o
  cliente Supabase do browser e é chamado de `use-crm-mutations.ts` (6
  call-sites). Fechou a aba no meio → automação para pela metade, sem retry,
  sem fila, sem log. E **evento vindo de fora não dispara nada**: import CSV,
  API, webhook de entrada. Isso bate direto no modelo de negócio — se o lead
  entra por importação ou API, o WhatsApp automático não acontece justamente no
  caso que mais paga. `AUD §S-2`, `HAND §2`
  - [ ] Verificar o checkbox `runAutomations` em
    `src/app/configuracoes/importar/page.tsx:144` e `:898` — a função que ele
    nomeia não roda no servidor. Pode estar prometendo o que não entrega.
- [ ] **`case "send_webhook"` do motor faz `fetch()` direto do browser** para
  URL arbitrária: sem guarda SSRF, sem HMAC, sem registro em
  `webhook_deliveries` — inconsistente com os outros 3 caminhos de webhook, que
  têm tudo isso. `AUD §S-2`
- [ ] **Ligar a fila de retry `dispatch-webhooks`.** Ela lê
  `webhook_deliveries WHERE status='pending'`, mas **nada nunca insere como
  `pending`** — o app grava direto `sent`/`failed`. Webhook que falha nunca é
  reprocessado. `AUD §3`
- [ ] **Bug do `step.note` nas sequências.** `process-sequences` usa `step.note`
  cru como assunto/corpo do email, mas o `note` é um **JSON serializado**
  (`parseSequenceStepNote`) — o email sairia com JSON no assunto. `AUD §3`
- [ ] **Tela de log de execução de automação.** Sem isso, automação não é
  vendável. `AUD §6`
- [ ] **Fila de email — nunca funcionou, agora pode.** Destravou com a migração
  de 2026-08-19 mas nunca rodou com o `claim` funcionando.
  `supabase/functions/process-email-queue/index.ts` ainda é o processador.
  Decisão a tomar: manter na Edge Function ou trazer para o app como foi feito
  com o WhatsApp (o padrão já está pronto em
  `src/app/api/whatsapp/queue/route.ts`). Tabela vazia, sem represa. `HAND §1`
- [ ] **S-4 · MÉDIO — `api/webhooks/trigger` aceita `webhookId` sem verificar
  dono.** Dá para poluir o log de entregas de outro tenant. `AUD §S-4`

### Entrada de leads

- [ ] **Rota pública que valida `x-api-key`** contra `api_keys` e resolve o
  workspace. A tabela e o hashing SHA-256 já existem — falta só o endpoint.
  **Hoje nenhuma rota valida `x-api-key`: não existe API pública.** `AUD §3`
- [ ] **Webhook de entrada + endpoint de formulário.**
- [ ] **Novo gatilho `lead_recebido`.**
- [ ] **Distribuição automática para vendedor** (round-robin / por regra) — é o
  que faz `deals.owner_id` valer alguma coisa.
- [ ] **Campos de atribuição no schema desde já** (`source`, `utm_*`,
  `campaign_id`). Barato agora, caro de retrofitar. `AUD §6.0`
- [ ] **Escrever a doc em `/ajuda/integracao-leads-externos`** e matar o 404.
- [ ] **Infra pedida pelo dono:** subdomínio dedicado + Cloudflare (rate limit /
  WAF na borda, já que o app não tem rate limiting próprio). `AUD §6.4`

---

## 🟢 Fase 3 — WhatsApp multi-driver

**Parcialmente feito.** O driver Evolution está pronto e verificado; falta o
resto da abstração e o "por workspace". `AUD §6`, `WPP`

- [x] Camada abstrata com interface `sendText`/`sendMedia`/`getQR`/`status` +
  normalizador de webhook de entrada. `src/lib/whatsapp/`
- [x] Driver `evolution`, QR real, `/conversas` em tempo real.
- [x] Fila `automation_whatsapp_queue` ligada ao driver.
- [ ] **Passos de WhatsApp das sequências** — o código existe e resolve o
  telefone pelo contato do negócio, mas **esse ramo nunca rodou**. `HAND`
- [ ] **Driver `uazapi`.** Dono tem conta, não tem token de teste. O trabalho
  real é o normalizador de webhook de entrada (~1 dia); o envio é quase idêntico
  ao da Evolution. `AUD §6.1`
- [ ] **Driver `meta_cloud`** (API oficial, para quem precisa de template
  aprovado). Aprovação de template só existe nesse driver; em Evolution/uazapi
  "template" é snippet local. `AUD §6.1`
- [ ] **Provider + credenciais + `instance_id` por workspace.** Depende da
  Fase 1. Hoje é uma instância só, do dono. `AUD §6`
- [ ] **Automação com mídia.** A fila manda só texto. `sendWhatsAppMessage`
  aceita mídia, mas nada enfileira mídia. Feature nova, não bug. `HAND`
- [ ] **Migrar Evolution → uazapi quando a contagem de instâncias virar
  trabalho.** Evolution é self-hosted: com dezenas de workspaces, ser o
  provedor de infra de WhatsApp dos clientes vira um segundo produto com
  plantão. `AUD §6.1`

---

## 🔵 Fase 4 — Pós-venda

Inexistente hoje: os 6 gatilhos são todos de evento. `AUD §6`, `AUD §6.0`

- [ ] **Gatilhos temporais** ("X dias após ganhar", "X dias sem atividade").
  Sem isso, automação de pós-venda é impossível por construção. Depende do
  motor server-side (Fase 2).
- [ ] **Avaliador agendado** — o `pg_cron` de 1 min já existe.
- [ ] **Pipeline de pós-venda/CS separado** — pipelines já são múltiplos, custo
  zero.
- [ ] **Encadeamento pós-ganho:** onboarding, NPS, check-in recorrente, gatilho
  de upsell.

---

## 🟣 Fase 4b — VoIP

Pedido do dono em 2026-08-19. Torna `/configuracoes/telefone` e `/ligacoes`
reais. `AUD §6.4`

- [ ] **Decidir provedor vs. WebRTC** (referência citada: api4com; alternativas
  Twilio, Zenvia).
- [ ] **Ligação de dentro do CRM** pelos vendedores, com duração e status.
- [ ] **Gravação de chamada** — implica **LGPD**: consentimento, retenção,
  storage. O free tier do Supabase não comporta áudio.
- [ ] **Analytics de ligação** — hoje `/ligacoes` plota `SAMPLE_CALLS`
  hardcoded com `recordingUrl: "sample.mp3"`.

---

## ⚪ Fase 5 — Endurecimento & confiança

`AUD §6`

- [ ] **Rate limiting.** Zero em qualquer rota. Piores casos: `api/gmail/send` e
  `api/import/csv` (itera `rows` sem teto — payload de 1M linhas trava a
  function). Inclui as rotas novas de WhatsApp. `AUD §S-5`
- [ ] **Validação de schema com zod.** Zero hoje: toda rota faz
  `await req.json()` e desestrutura. `AUD §S-5`
- [ ] **Observabilidade** — Sentry + health check.
- [ ] **Testes E2E** dos caminhos críticos + CI. Não há nenhum teste hoje.
- [ ] **Responsividade mobile** — 41 de 42 páginas assumem desktop.
- [ ] **Extrair design system.** Conferir antes se há risco de marca: o front
  foi parcialmente copiado de outro sistema. `AUD §6.4`
- [ ] **Relatório de atribuição de origem** (ROI por campanha) usando os campos
  plantados na Fase 2. É o diferencial que fecha o ciclo entre o serviço de
  tráfego da agência e o CRM que ela revende. `AUD §6.0`

---

## ⚫ Fase 6 — Billing

> ⚠️ **LEMBRETE EXPLÍCITO DO DONO: trabalhar nisso no futuro. Não esquecer.**
> A tela `/configuracoes/billing` fica oculta mas permanece no código. `AUD §6.3`

- [ ] **Stripe por trás da tela.** Assinatura por workspace + por usuário,
  limites por plano, trial, webhooks de assinatura idempotentes.
- [ ] Até lá: ativação manual, com criação de conta automática.

Por último de propósito: cobrar por algo que ainda muda de forma é caro de
refazer.

---

## 🧪 Testes que faltam

Nada disso foi exercitado. `HAND`

- [ ] **Passo "WhatsApp" de uma sequência.** Caminho diferente do da automação:
  `process-sequences` enfileira sem telefone e a rota resolve pelo contato.
  Nunca rodou. Criar sequência com passo em `day_offset: 0`, inscrever um
  negócio, esperar o cron de 5 min.
- [ ] **Fila de email ponta a ponta.**
- [ ] **Reaper de linha travada.** Linha em `processing` há mais de 15 min vira
  `failed`. Nunca disparou.
- [ ] **Batch com mais de uma mensagem.** O lote é de 10, sequencial; nunca
  rodou com mais de 1.
- [ ] **Workspace com membro convidado.** Tudo foi testado com a conta dona;
  `team_members` está vazia. `resolveWorkspaceOwner()` faz um convidado usar a
  instância do dono — não verificado.

---

## 🧹 Limpezas rápidas

- [ ] Apagar a Edge Function órfã: `supabase functions delete process-whatsapp-queue`
  (removida do repo, continua publicada). `HAND`
- [ ] Apagar o template WhatsApp `dfgd` — lixo de teste, só variáveis sem texto.
- [ ] Apagar as linhas de teste de `automation_whatsapp_queue`.
- [ ] Decidir se `main` vai para o `origin` (21 commits à frente; produção está
  à frente do GitHub).

---

## 📋 Cantos cortados de propósito

Mantidos em `docs/known-gaps.md`, que continua sendo o lugar deles. Resumo:

- [ ] `mergeDeals()` não transfere `deal_history`, emails, ligações nem threads
  de WhatsApp. `GAPS`
- [ ] Botão "Anexar" da aba Notas (`src/components/deal/deal-tabs.tsx`) tem
  `<input type="file">` sem handler nenhum. `GAPS`, `HAND`
- [ ] Storage no free tier do Supabase = 1 GB. Migrar mídia de WhatsApp para R2
  quando apertar. `WPP`

---

## ⚠️ Armadilhas que já custaram caro

Ler antes de mexer nas áreas correspondentes.

- **Número do contato não é JID.** CRM guarda `38999225622`, WhatsApp responde
  `553899225622` — falta o código do país *e* sobra o nono dígito. Nunca montar
  JID por regra; perguntar em `POST /chat/whatsappNumbers`.
- **`team_members` só tem quem foi convidado.** A conta dona do workspace não
  tem linha lá. Buscar nome de vendedor só nessa tabela devolve vazio para todo
  negócio do dono.
- **Rota chamada por máquina precisa entrar na exclusão do `src/proxy.ts`.**
  Senão o middleware responde 307 para `/login`, e `pg_cron` lê 307 como
  sucesso e nunca repete.
- **Negócio é `Ativo`/`Ganho`/`Perdido`**, nunca `"open"`.
- **Áudio precisa ser Opus/Ogg**, e o binário do ffmpeg precisa de
  `outputFileTracingIncludes` no `next.config.ts`.
- **Cron não-diário na Vercel Hobby quebra o deploy do projeto inteiro**, não só
  a feature. Por isso o agendamento vive no `pg_cron`.
- **Deploy é manual.** `git push` não deploya.

---

## 🔑 Segredos

- **`AUTOMATION_DISPATCH_SECRET`** — autentica `/api/whatsapp/queue`. Vive em
  **três** lugares: `.env.local`, envs de Production da Vercel, e dentro do
  comando do `pg_cron` job 2. Rotacionar exige mudar nos três.
- **`EVOLUTION_API_KEY`** é a chave **global** da Evolution: controla todas as
  instâncias do servidor, inclusive as de clientes (`aimaze`, `pixeomkt`,
  `sinpase`). Não colar em chat, issue ou commit.
- **`OAUTH_ENCRYPTION_KEY`** precisa bater entre local e Vercel, senão o
  connect do Gmail quebra.
