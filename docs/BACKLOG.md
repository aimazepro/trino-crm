# BACKLOG — TrinoCRM

**Fonte única de verdade do que falta fazer.** Consolida a auditoria, os
handoffs de WhatsApp e o `known-gaps.md` num lugar só, para que nada se perca
entre sessões.

> **Regra:** item não sai deste arquivo. Ou vira `[x]` com a data, ou vira
> "Descartado" com o motivo. Nunca some.

Última atualização: 2026-08-21 (Fase 0 — 6 de 7 itens fechados; item 6 bloqueado por custo, ver seção Fase 0).

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
| Branch | `fase0-hardening` (não mergeada em `main` ainda) |
| Produção | deployada e verificada (Fase 1 + Fase 2 + Fase 0 itens 1-5,7 no ar) |
| `origin/main` | não recebeu push desta sessão — deploy prod é direto via `vercel deploy --prod`, independe de merge/push |

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

- [x] **S-1 · CRÍTICO — chave service-role em texto puro no banco. FECHADO 2026-08-21.**
  Os jobs do `pg_cron` guardavam o header inteiro dentro de `cron.job.command`,
  incluindo uma secret key que bypassava RLS de todas as 43 tabelas de todos os
  tenants. `AUD §S-1`
  - [x] **Jobs 1 ("email-queue"), 3 ("sequences"), 4 ("webhooks") e 6
    ("automations-run") — confirmado direto no banco em 2026-08-20.**
    Todos chamavam `AUTOMATION_DISPATCH_SECRET`; nenhum carregava mais
    `sb_secret_...`. A parte "bypassa RLS de todas as 43 tabelas" fechada
    naquela sessão — verificado, não presumido.
  - [x] **`AUTOMATION_DISPATCH_SECRET` em texto puro em `cron.job.command`
    — FECHADO 2026-08-21.** Eram **5 jobs** (1 email-queue, 2 whatsapp-queue,
    3 sequences, 4 webhooks, 6 automations-run), não 4 — job 2 tinha ficado
    de fora da contagem da sessão anterior. Secret movido pro Supabase Vault
    (`vault.create_secret`, name `automation_dispatch_secret`); os 5
    `cron.job.command` agora resolvem o header via
    `(select decrypted_secret from vault.decrypted_secrets where name = 'automation_dispatch_secret')`
    em vez de literal. Verificado: nenhum command contém mais o token,
    `net._http_response` pós-mudança 100% `status_code = 200` (zero 401).
- [x] **Ocultar as telas de decoração — FECHADO 2026-08-21.**
  `/configuracoes/billing`: link "Planos e Faturamento" tirado do menu de
  configurações (`src/app/configuracoes/layout.tsx`) — a página é 100%
  mockada (faturas fake hardcoded, botão "Alterar plano" sem ação real),
  prometia cobrança que não existe. Código fica, ver Fase 6.
  `/prospeccao` e `/analise-calls`: **não eram só decoração, eram 404 de
  verdade** — os dois links no sidebar (`src/components/layout/sidebar.tsx`)
  apontavam pra rotas sem `page.tsx` nenhum. Tirados do menu; código nunca
  existiu, nada pra manter. `AUD §6.3`
- [x] **Consertar os links 404 — FECHADO 2026-08-21 (achado já resolvido
  pela Fase 2, só faltava confirmar e marcar).** `/configuracoes/api/docs` e
  `/ajuda/integracao-leads-externos` já existem como páginas reais com
  conteúdo (a doc que a Fase 2 escreveu) — confirmado com `npm run build`:
  as duas aparecem na lista de rotas estáticas geradas, sem erro. Não eram
  mais 404. `AUD §6.3`
- [x] **`.env.example` + validação fail-fast de env vars — FECHADO 2026-08-21.**
  ~40 call sites de `process.env.X!` espalhadas (5 vars únicas) mais outras
  lidas com throw manual em request time (`OAUTH_ENCRYPTION_KEY`,
  `EVOLUTION_API_URL/KEY`) só quebravam quando alguém batia na rota. Agora
  `src/lib/env.ts` valida as 9 vars obrigatórias uma vez, em
  `src/instrumentation.ts` (`register()`, roda no boot do processo Node —
  cold start na Vercel — antes de aceitar requests). Testado isolado (tsx):
  throw claro listando as faltantes quando nenhuma está setada, silencioso
  quando todas presentes; e via `next build` + `next start` real, log
  confirmando que `register()` roda. `.env.example` documenta as 15 vars
  (obrigatórias e opcionais, com o que cada uma faz e pra onde cai o
  fallback). Conferido via `vercel env ls production` antes do deploy: as
  9 obrigatórias já existiam em prod — boot não quebrou. `AUD §S-5`
- [x] **Security headers — FECHADO 2026-08-21.** `next.config.ts` ganhou
  `headers()`: CSP (sem nonce — `unsafe-inline` em script/style-src até
  implementar nonce+proxy dinâmico), HSTS, X-Frame-Options: DENY,
  X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy
  (`microphone=(self)` preservado — WhatsApp voice-recorder usa
  `getUserMedia`). `img-src` ficou permissivo (`https:`) por não dar pra
  prever de antemão todos os domínios de avatar/anexo do Gmail e mídia do
  WhatsApp — apertar isso é debt futura, não bloqueou o item. Build local +
  `next start` verificados com os headers batendo. `AUD §S-5`
- [x] **Agendar `api/cron/calendar-pull` no `pg_cron` — FECHADO 2026-08-21.**
  `CRON_SECRET` gerado, setado em `vercel env` (production) e guardado no
  Vault (`name = 'cron_secret'`, mesmo padrão do item S-1 — nunca em texto
  puro). Job `calendar-pull` (jobid 7) agendado `*/15 * * * *` via
  `net.http_get`, header resolvido do Vault. **Bug achado e corrigido no
  caminho**: `src/proxy.ts` redirecionava `/api/cron/*` pra `/login` (307)
  porque o matcher não excluía esse prefixo — a checagem de `CRON_SECRET`
  dentro da rota era código morto, nunca era alcançada. `api/cron`
  adicionado à lista de exclusão (mesma classe de `api/whatsapp/queue`,
  `api/automations`). Verificado com curl direto em prod: com o secret
  certo → `200 {"ok":true,"processed":1,"failed":0}` (1 integração real
  ativa, processada sem erro); sem secret → `401`. `AUD §3`
- [x] **Cadência dos crons — FECHADO 2026-08-21.** Medido antes de mudar:
  1510 de 1511 execuções nos últimos dias (`net._http_response`) vieram
  vazias (`processed:0, failed:0`) — confirma o desperdício. `email-queue`,
  `whatsapp-queue`, `webhooks` e `automations-run` (jobs 1,2,4,6) caíram de
  `* * * * *` pra `*/5 * * * *`, mesma cadência que `sequences` já usava.
  ~5760 → ~1152 invocações/dia nesses 4 jobs. Mudança só de config no banco
  (`cron.alter_job`), sem código — não precisou de deploy. `AUD §6.5`
- [x] **S-6 — revogar `EXECUTE` do `anon`** em `is_workspace_member`,
  `replace_deal_labels`, `replace_deal_products` — fechado junto com a Fase 1 (também
  `my_workspace_ids`, `my_role`, `is_ws_manager`, `is_ws_admin`, as 4 novas). `AUD §S-6`
- [ ] **BLOQUEADO (custo) — Ligar proteção contra senha vazada** (HaveIBeenPwned)
  no Supabase Auth. Não é toggle simples como se pensava: a feature só existe
  no **plano Pro do Supabase ($25/mês) ou acima** — confirmado 2026-08-21 via
  `get_organization` (org "Trino Digital Business" está no plano **free**) e
  na doc oficial ("Leaked password protection is available on the Pro Plan
  and above"). Decisão do usuário 2026-08-21: pular por ora, não fazer
  upgrade sem decisão explícita depois. Cadastro continua aberto, sem convite
  nem verificação de domínio, enquanto isso ficar pendente. `AUD §S-5`

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

**Status 2026-08-20:** implementado inteiro (13 tasks, spec+plano em
`docs/superpowers/`), revisado (por tarefa + revisão final de branch inteiro),
**mergeado em `main` e deployado em produção** — confirmado via `git log`
(`e2b523b`, `0fba2fb`, `47fc400`, `7cf0e6a` etc. já em `main`) e via consulta
direta a `cron.job` no banco (jobs 1/3/4/6 rodando com
`AUTOMATION_DISPATCH_SECRET`, ver S-1 acima). Itens abaixo marcados `[x]`
estão feitos e em produção.

- [x] **S-2 · ALTO — tirar `run-automations.ts` do navegador.** Hoje importa o
  cliente Supabase do browser e é chamado de `use-crm-mutations.ts` (6
  call-sites). Fechou a aba no meio → automação para pela metade, sem retry,
  sem fila, sem log. E **evento vindo de fora não dispara nada**: import CSV,
  API, webhook de entrada. Isso bate direto no modelo de negócio — se o lead
  entra por importação ou API, o WhatsApp automático não acontece justamente no
  caso que mais paga. `AUD §S-2`, `HAND §2`
  - [ ] Verificar o checkbox `runAutomations` em
    `src/app/configuracoes/importar/page.tsx:144` e `:898` — a função que ele
    nomeia não roda no servidor. Pode estar prometendo o que não entrega.
- [x] **`case "send_webhook"` do motor faz `fetch()` direto do browser** para
  URL arbitrária: sem guarda SSRF, sem HMAC, sem registro em
  `webhook_deliveries` — inconsistente com os outros 3 caminhos de webhook, que
  têm tudo isso. `AUD §S-2`
- [x] **Ligar a fila de retry `dispatch-webhooks`.** Ela lê
  `webhook_deliveries WHERE status='pending'`, mas **nada nunca insere como
  `pending`** — o app grava direto `sent`/`failed`. Webhook que falha nunca é
  reprocessado. `AUD §3`
- [x] **Bug do `step.note` nas sequências.** `process-sequences` usa `step.note`
  cru como assunto/corpo do email, mas o `note` é um **JSON serializado**
  (`parseSequenceStepNote`) — o email sairia com JSON no assunto. `AUD §3`
- [x] **Tela de log de execução de automação.** Sem isso, automação não é
  vendável. `AUD §6`
- [x] **Fila de email — nunca funcionou, agora pode.** Destravou com a migração
  de 2026-08-19 mas nunca rodou com o `claim` funcionando.
  `supabase/functions/process-email-queue/index.ts` ainda é o processador.
  Decisão a tomar: manter na Edge Function ou trazer para o app como foi feito
  com o WhatsApp (o padrão já está pronto em
  `src/app/api/whatsapp/queue/route.ts`). Tabela vazia, sem represa. `HAND §1`
- [x] **S-4 · MÉDIO — `api/webhooks/trigger` aceita `webhookId` sem verificar
  dono.** Dá para poluir o log de entregas de outro tenant. `AUD §S-4`

### Entrada de leads

**Status 2026-08-20:** implementado inteiro (19 tasks, spec+plano em
`docs/superpowers/`), revisado (por tarefa + revisão final de branch inteira,
que achou e já corrigiu 3 Critical + 6 Important antes de fechar),
**mergeado em `main` (merge commit `a1298f4`) e deployado em produção**.
Itens abaixo marcados `[x]` estão feitos e em produção. Produção já foi
auditada e limpa de dados de verificação (deals/contatos/chaves de teste
desta plan). As 2 chaves antigas pré-existentes (`lp`, `bvnbv`, permissão
`all`, nunca usadas, sem contexto claro) foram revogadas pelo dono em
2026-08-20 após confirmação.

- [x] **Rota pública Bearer-auth** contra `api_keys` (hash SHA-256) e resolve o
  workspace, com permissões reais por rota, rate limit por chave e
  `Idempotency-Key` em todo `POST`. **`x-api-key` virou `Authorization:
  Bearer`, decisão registrada na spec** (padrão que a doc de referência usa).
  `AUD §3`
- [x] **Webhook de entrada + endpoint de formulário.**
  `POST /api/v1/leads/form/:formId` — sem auth, honeypot, host-gate pro
  Cloudflare, aceita tanto JSON quanto `application/x-www-form-urlencoded`
  (formulário HTML puro sem JS).
- [x] **Novo gatilho `lead_recebido`.** Trigger `origin in ('api','form')`,
  Motor confirmado sem regressão (branch UPDATE idêntico ao original).
- [x] **Distribuição automática para vendedor** — `assign_owner` (Motor) já
  existente cobre round-robin; `default_owner_id` da key/form agora é
  persistido de verdade (era o Critical C1 da revisão final: a tela de API
  keys nunca salvava isso).
- [x] **Campos de atribuição no schema desde já** (`source`, `utm_*`,
  `campaign_id`). `AUD §6.0`
- [x] **Escrever a doc em `/ajuda/integracao-leads-externos`** e matar o 404 —
  mais `/configuracoes/api/docs`, referência completa.
- [x] **Infra pedida pelo dono:** subdomínio dedicado + Cloudflare (rate limit /
  WAF na borda, já que o app não tem rate limiting próprio). `AUD §6.4`
  — 2026-08-20: `api-crm.aimaze.com.br` criado (CNAME proxied →
  `cname.vercel-dns.com`) e anexado ao projeto Vercel `trino-crm`. Rate
  limit + WAF ligados via API depois que o dono adicionou a permissão
  "Zone WAF" ao token:
  1. **Rate limit**: ruleset `f36e7e41f989420cbad8185b0692b00d`, regra
     `ac59e17c3f8041b7ac5c77615fb1aad4` — `(http.host eq
     "api-crm.aimaze.com.br")`, block, 17 req/10s por `ip.src`
     (≈100/min — o plano da conta só aceita janela de 10s, não 60s como o
     plano original pedia), mitigation timeout 10s (idem, teto do plano).
  2. **WAF gerenciado**: "Cloudflare Managed Free Ruleset" ligado no
     entrypoint `http_request_firewall_managed`
     (`f8804dadad8b4ea2b6233b87ddde509c`) — plano da zona é Free, não Pro,
     então é o "Managed Free Ruleset", não o "Cloudflare Managed Ruleset"
     completo.
  **Verificação fim-a-fim feita em 2026-08-20** —
  `curl https://api-crm.aimaze.com.br/api/v1/me` responde `401
  AUTH_REQUIRED` (rota pública da API viva em produção, não mais 307 para
  `/login`). Fecha o item.

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

## 🟣 Fase 4b — VoIP — **IMPLEMENTADA E EM PRODUÇÃO (2026-08-26)**

Pedido do dono em 2026-08-19. `/configuracoes/telefone` e `/ligacoes` agora são
reais. `AUD §6.4`

Construído com camada de adapter (`src/lib/telephony`) em vez de integração
direta: nenhuma rota fala com um provedor específico. Ver
`docs/superpowers/specs/2026-08-26-voip-telefonia-design.md` e o memo de
provedores em `docs/2026-08-26-voip-provedores-memo.md`.

- [x] **Decidir provedor vs. WebRTC** — decidido *não* decidir ainda, de
  propósito. Adapter + provedor `mock` que emite os mesmos webhooks assinados de
  uma operadora real, então o sistema inteiro é exercitável antes de qualquer
  contrato. Adapter `api4com` escrito contra a doc pública, marcado como
  não-verificado.
- [x] **Ligação de dentro do CRM** — aba "Ligações" do negócio e detalhe do
  contato, com diálogo que mostra o script de cold call, cronômetro, notas e
  disposição no encerramento.
- [x] **Gravação de chamada + LGPD** — consentimento configurável, retenção com
  expurgo diário e áudio servido só por proxy autenticado. Áudio fica no
  provedor (não no Supabase); a interface `RecordingStore` deixa a troca para
  Cloudflare R2 ser um arquivo novo quando o volume pedir.
- [x] **Analytics de ligação** — `SAMPLE_CALLS` removido; os cinco gráficos
  plotam o CDR real. O filtro de período, que existia no state e nunca era
  aplicado, agora funciona.

**Pendências reais desta fase (decisão do dono, não código):**

- [ ] **Escolher e contratar o provedor.** O memo ranqueia Zenvia Voice > Telnyx
  > API4COM para revenda. Achado que muda a conta: **R$ 0,38/min é o preço de
  balcão histórico da própria API4COM** — revender nesse valor dá margem ~zero.
- [ ] **Checkout de créditos.** Hoje o dono lança crédito manualmente; a RPC já
  é idempotente, então o gateway pluga sem mudar nada do resto.
- [ ] **Bina dinâmica por DDD** — é operação contínua (comprar DID por região,
  monitorar bloqueio por spam), não código. Define taxa de atendimento.
- [ ] **Chamadas recebidas (inbound)**, discador preditivo, transferência e
  conferência — fora do escopo do V1.

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
- [x] **`main` → `origin`, resolvido.** 2026-08-20: `main` e `origin/main` em
  dia, 0 commits de diferença.
- [x] **`docs/historico-conversa-calendario-oauth.md` — apagado (2026-08-20).**
  Achado untracked, 129 KB / 3344 linhas, dump bruto de conversa sobre a
  integração OAuth do Calendar. Continha o **client secret do Google em texto
  puro** (`GOCSPX-...`), não só o client_id — credencial de verdade, não
  identificador público. Apagado por decisão do dono. `GMAIL_OAUTH_CLIENT_SECRET`
  já trocado na Vercel prod e redeployado (dpl `bYpdAt39SBnojQoVaS6SNyjPxFba`).
  Falta: (1) testar conectar Gmail/Calendar em produção com o secret novo,
  (2) só depois de confirmar, apagar o secret antigo (`...PPf-i`) no Google
  Cloud Console.

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
