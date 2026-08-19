# Auditoria profunda — TrinoCRM → SaaS multi-tenant

> Data: 2026-08-19. Evidência: código local (`main`, working tree limpo) + projeto Supabase live `etdkzpiehoivrviylemd` (via MCP, somente leitura). Nenhum código foi alterado.

## Veredito

**Como CRM single-user para uso interno: 70/100 — utilizável com ressalvas.**
**Como SaaS multi-tenant para vender: BLOQUEADO (0 de multi-tenancy real + telas que prometem o que não existe).**

Score travado em ≤69 pela regra "segredo exposto" (ver S-1) e por "authz ausente onde o produto promete" (papéis de usuário são decorativos).

---

## 1. Correção importante ao handoff anterior

O handoff dizia que automações/webhooks eram "fachada suspeita, grau de completude não auditado". **Está errado, e a favor do projeto.** Existe uma camada de execução server-side real, viva e agendada, que o handoff não conhecia:

| Componente | Estado real |
|---|---|
| Supabase Edge Functions | **4 deployadas e ACTIVE**: `process-email-queue`, `process-whatsapp-queue`, `process-sequences`, `dispatch-webhooks` (todas v4, `verify_jwt: true`) |
| `pg_cron` + `pg_net` | **instalados e rodando** — 4 jobs ativos |
| `cron.job` #1 `email-queue` | `* * * * *` → `process-email-queue` |
| `cron.job` #2 `whatsapp-queue` | `* * * * *` → `process-whatsapp-queue` |
| `cron.job` #3 `sequences` | `*/5 * * * *` → `process-sequences` |
| `cron.job` #4 `webhooks` | `* * * * *` → `dispatch-webhooks` |
| RPCs de claim | `claim_pending_email_queue(p_limit)`, `claim_pending_whatsapp_queue(p_limit)` — padrão de claim atômico, correto |

**Consequência estratégica:** o problema do "cron do Vercel Hobby" **já tem solução no próprio projeto**. `pg_cron` + `pg_net` chamam qualquer URL em qualquer cadência, de graça. O `api/cron/calendar-pull` pode ser agendado a cada 2 min por aí hoje, sem Vercel Pro. A pergunta 4 do handoff ("assinar Vercel Pro?") deixa de ser bloqueante.

**Porém:** nada nunca passou por essas filas. `automation_email_queue` = 0 linhas, `automation_whatsapp_queue` = 0, `sequence_enrollments` = 0. A infra existe e nunca foi exercitada — é **não-verificada**, não "funcional confirmada".

---

## 2. Segurança

### Fundação sólida (não mexer, só estender)

- `src/proxy.ts` (o `middleware.ts` do Next 16) redireciona todo request não-autenticado para `/login`. Matcher isenta corretamente só `api/auth/callback` e `api/track`.
- **RLS habilitado em 43/43 tabelas públicas**, todas com pelo menos 1 policy. Nenhuma tabela órfã.
- Tokens OAuth criptografados em repouso: AES-256-GCM (`src/lib/token-crypto.ts`). Verificado no banco: **0 tokens em texto puro**, 0 segredos de webhook em texto puro.
- OAuth com `state` em cookie httpOnly, validado no callback (`api/auth/gmail/callback:14-35`).
- Guarda anti-SSRF nos webhooks (https obrigatório + bloqueio de faixas privadas) em 3 lugares: `src/lib/webhooks.ts`, `api/webhooks/trigger`, e a edge function.
- XSS de email tratado com DOMPurify (`src/components/deal/email-tab.tsx:204,507`).
- `api/cron/calendar-pull` falha fechado se `CRON_SECRET` não estiver setado.
- 14 de 16 rotas de API checam `getUser()`. As 2 sem check são as de início de OAuth — protegidas pelo `proxy.ts`.
- `tsc --noEmit` passa limpo.

### S-1 · CRÍTICO — chave secreta do Supabase em texto puro no banco

Os 4 jobs do `pg_cron` guardam o header de autorização inteiro dentro de `cron.job.command`:

```
'{"Authorization":"Bearer sb_secret_...","Content-Type":"application/json"}'::jsonb
```

- É uma **secret key de classe service-role** — bypassa RLS de todos os 43 tables de todos os tenants.
- Fica legível por qualquer um com acesso ao SQL Editor / dashboard / conexão direta ao Postgres, e vaza em qualquer dump, backup ou transcript de sessão de IA (**incluindo esta**).
- Mitigação existente: `cron.job` tem RLS com policy por `current_user`, e o schema `cron` não está exposto no PostgREST. Ou seja, **não é lida por `anon` pela internet** — não é o pior cenário. Mas o segredo está armazenado onde não devia e já circulou.

**Ação: rotacionar a chave e re-agendar os jobs sem embutir o segredo** (usar `vault.decrypted_secrets` do Supabase Vault, ou uma função `SECURITY DEFINER` que lê o segredo). Essa é a primeira coisa a fazer, antes de qualquer feature.

### S-2 · ALTO — o motor de automação roda no navegador

`src/lib/run-automations.ts:1` importa `@/lib/supabase/client` e é chamado de `src/hooks/use-crm-mutations.ts` (6 call-sites: `deal_created`, `stage_changed`, `deal_won/lost`, `deal_updated`, `activity_created`).

Implicações:
- Fechou a aba no meio → automação para pela metade. Sem retry, sem fila, sem log de execução.
- Não existe execução por evento vindo de fora (import CSV, API, webhook de entrada).
- `case "send_webhook"` (linha 205) faz `fetch()` direto do browser para URL arbitrária: **sem guarda SSRF, sem HMAC, sem registro em `webhook_deliveries`** — inconsistente com os outros 3 caminhos de webhook, que têm tudo isso. E o CORS do browser vai barrar boa parte dos destinos silenciosamente (`.catch(console.warn)`).
- Um cliente malicioso pode chamar `runAutomations` com qualquer payload; toda a lógica de negócio é confiada ao cliente.

### S-3 · ALTO — papéis de usuário são puramente cosméticos

`team_members` tem `role` (Admin/Gerente/Vendedor) e a tela `/configuracoes/usuarios` deixa trocar. Mas:
- **Zero verificação de papel em qualquer lugar do código.** `grep` por `role ===` só acha classes de cor CSS.
- Nenhuma RLS policy referencia `role`.
- `is_workspace_member(owner_id)` só checa `status='accepted'` — não distingue papéis.

Quando o multi-tenant existir, "Vendedor" e "Admin" terão exatamente o mesmo poder no banco. Hoje é inofensivo porque `team_members` tem **0 linhas**.

### S-4 · MÉDIO — `api/webhooks/trigger` aceita `webhookId` sem verificar dono

Linha 118: insere em `webhook_deliveries` com o `webhook_id` que o cliente mandou e `user_id` do usuário logado. Não valida que aquele webhook pertence a ele → dá pra poluir o log de entregas de outro tenant. Também é um proxy HTTP autenticado sem rate limit (o guarda SSRF cobre IPs literais, não hostnames que resolvem para rede interna).

### S-5 · MÉDIO — superfície sem limites

- **Zero rate limiting** em qualquer rota. `api/gmail/send` e `api/import/csv` são os piores casos (`import/csv:94` itera `rows` sem teto — payload de 1M linhas trava a function).
- **Zero validação de schema** (sem zod/valibot). Toda rota faz `await req.json()` e desestrutura.
- **Zero security headers** — `next.config.ts` só tem rewrites. Sem CSP, HSTS, X-Frame-Options, Referrer-Policy.
- **Sem `.env.example`** e sem fail-fast de env vars. 12 vars são lidas com `!` (non-null assertion); faltando uma, quebra em runtime, não no boot.
- Proteção contra senha vazada (HaveIBeenPwned) **desligada** no Supabase Auth. Cadastro é aberto (`signUp` em `login/page.tsx:53`) sem convite nem verificação de domínio.

### S-6 · BAIXO

- 3 funções `SECURITY DEFINER` executáveis por `anon`/`authenticated` via `/rest/v1/rpc/`: `is_workspace_member`, `replace_deal_labels`, `replace_deal_products`. As duas últimas respeitam RLS internamente; a primeira sempre retorna `false` para anon. Revogar `EXECUTE` do `anon` mesmo assim.
- Políticas duplicadas e sobrepostas em `deals`/`contacts`/`activities`: existe uma policy `ALL` antiga (`"deals: user owns"`) **mais** as 4 policies `workspace_*`. Permissivas são OR'd, então funciona — mas o `with_check` do UPDATE acaba permitindo trocar `user_id` para outro workspace do qual o usuário seja membro. Consolidar quando reescrever para multi-tenant.

---

## 3. Inventário: funcional × decoração

### ✅ Funcional de verdade (verificado)

| Área | Evidência |
|---|---|
| CRM core: pipelines, kanban, negócios, contatos, empresas, atividades | 11 deals, 23 activities no banco; contexto + mutations completos |
| Campos customizados + grupos | `configuracoes/campos` (1115 linhas), tabelas `custom_fields`/`custom_field_groups`/`deal_field_values` |
| Soft-delete de negócios + motivos de perda/exclusão | migration `20260808160000` |
| Gmail: OAuth, envio, sync, pixel de abertura | 2 integrations ativas, tokens criptografados; `api/track` grava `opened_at` + notificação + dispara webhook |
| Google Calendar: push instantâneo + Meet + pull manual | `src/lib/google-calendar.ts`, rotas `sync-activity`/`sync-now` |
| Webhooks de saída (evento `email_open`) | 3 webhooks cadastrados, **8 entregas com status `sent`** — comprovadamente funcionando ponta a ponta |
| Templates de email, produtos, tipos de atividade, scripts, metas, importação CSV | todos com CRUD real no Supabase |
| Métricas / Forecast / Insights | leem do contexto CRM (dados reais), não são mock |
| Duplicatas | lê do contexto CRM |
| API keys: geração + hash SHA-256 + revogação | grava em `api_keys` (2 chaves) |

### ⚠️ Meio-caminho — infra pronta, nunca exercitada

| Área | O que falta |
|---|---|
| Fila de email de automação | Edge function + cron rodando, mas **0 linhas processadas**. Só é alimentada pelo motor client-side. Nunca testada. |
| Fila de WhatsApp | Idem. **E aponta para a Meta Cloud API** (`graph.facebook.com/v18.0`), não uazapi. Usa `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` — **uma credencial global única**, incompatível com "instância por workspace". |
| Sequências (runner) | `process-sequences` roda a cada 5 min, mas 0 enrollments. Bug: usa `step.note` cru como assunto/corpo do email — o `note` é um **JSON serializado** (`parseSequenceStepNote`), então o email sairia com JSON no assunto. |
| `dispatch-webhooks` (retry) | Lê `webhook_deliveries WHERE status='pending'`. **Nada nunca insere com status `pending`** — o app grava direto `sent`/`failed`. Fila de retry órfã: 0 pending. Webhooks que falham nunca são reprocessados. |
| `api/cron/calendar-pull` | Funciona, mas sem agendamento e `CRON_SECRET` nunca setado em prod → inerte. Resolvível com `pg_cron` hoje. |
| Convite de usuário | Insere linha em `team_members` e para aí. **Nenhum email enviado, nenhum usuário auth criado, nenhum fluxo de aceite, `member_user_id` nunca preenchido.** Logo `is_workspace_member()` sempre retorna `false` e **todas as policies de workspace estão inertes**. |
| API pública | Chaves são geradas e hasheadas, mas **nenhuma rota valida `x-api-key`**. Não existe API pública. |

### ❌ Decoração pura (100% falso)

| Tela | O que é |
|---|---|
| `/configuracoes/billing` | `const INVOICES` hardcoded — "Plano Pro R$297", cartão "4242", 3 faturas fictícias. Botões sem handler. Zero Stripe. |
| `/configuracoes/telefone` | `CREDIT_PACKS` hardcoded, saldo fixo em R$0, "Ramal 1070" fixo. `useState` local simula ativação. Zero telefonia. |
| `/configuracoes/whatsapp` | QR code **base64 estático embutido no arquivo** com comentário "Placeholder QR — in production this comes from the backend". `setTimeout(1500)` simula refresh. |
| `/conversas` | `MOCK_CONVERSATIONS` com 1 conversa de teste ("TESTE", "oi"). Cronômetro de gravação de áudio é `setInterval` fake. |
| `/ligacoes` | `SAMPLE_CALLS` hardcoded, `recordingUrl: "sample.mp3"`. Todos os gráficos plotam dados inventados. |
| `/configuracoes/api` → "Ver documentação" | link para `/configuracoes/api/docs` — **página não existe, 404**. |
| Menu lateral → "Prospecção" | `/prospeccao` — **página não existe, 404**. |
| Menu lateral → "Análise de Calls" | `/analise-calls` — **página não existe, 404**. |
| link "Ajuda: integração leads externos" | `/ajuda/integracao-leads-externos` — **404**. |

---

## 4. Design & usabilidade

**Ponto forte:** consistência visual real. Paleta zinc + âmbar aplicada de forma disciplinada em ~20k linhas de UI. Densidade de informação boa para CRM. Estados vazios existem na maioria das telas. Componentes de deal são bem decompostos (17 arquivos em `components/deal/`).

**Problemas:**

1. **Mentira de interface é o problema nº1 de UX.** Cinco telas afirmam capacidades inexistentes com dados fabricados. Isso não é "falta de feature" — em produto pago é risco de reputação e de disputa comercial. Prioridade máxima: esconder atrás de flag ou marcar como "em breve" **antes** de qualquer demo/venda.
2. **4 links de navegação levam a 404.** Erro básico, corrigível em minutos.
3. **Design system inexistente enquanto convenção.** Só 2 arquivos em `components/ui/` (`time-field`, `BulkFieldSelect`). Cores/spacing/tipografia estão duplicados em string Tailwind em cada uma das 42 páginas. Consequência prática: temas por workspace (white-label — típico de SaaS) hoje é impossível sem reescrever tudo. `page.tsx` de 1115 e 1309 linhas são sintoma disso.
4. **Sem tratamento de erro visível ao usuário.** O padrão dominante é `console.error` + `alert()`. Sem toast, sem error boundary, sem estado de "falhou, tente de novo". Quando uma automação falha, o usuário não fica sabendo — não existe tela de log de execução.
5. **Sem responsividade real.** Só `conversas` tem breakpoint `md:`. As outras 41 páginas assumem desktop. Vendedor no celular é caso de uso central de CRM.
6. **Sem acessibilidade.** Sem `aria-label` sistemático, foco não gerenciado nos modais, contraste não verificado.
7. **Incoerência de dados nos papéis:** o banco tem default `'vendedor'` (minúsculo), a UI grava `'Vendedor'` (maiúsculo). Vai quebrar comparação assim que alguém gatilhar lógica por papel.
8. **`/negocios` e `/pipeline` e `/dashboard`** coexistem via rewrites em `next.config.ts` — URLs duplicadas, ruim para memória muscular e para links compartilhados.

---

## 5. Operação

| Item | Estado |
|---|---|
| Testes | **Nenhum framework.** `package.json` só tem dev/build/start/lint. Verificação = `tsc` + `eslint` + manual. |
| Lint | **70 erros, 65 warnings.** Maioria `no-explicit-any`. |
| CI | Nenhum workflow. |
| Deploy | Manual (`npx vercel deploy --prod`). `git push` não deploya. |
| Rollback | Tag `v0.1.0-pre-saas` existe (bom). Sem procedimento escrito para reverter migrations. |
| Observabilidade | Zero. Sem Sentry, sem health check, sem log estruturado. Falha de automação só aparece em `console.error` do browser do usuário. |
| Migrations | 18 arquivos locais, mas aplicadas direto no projeto live via MCP. Sem ambiente de staging — **toda migration é testada em produção.** |
| Backup | Não verificado (fora do alcance de leitura). |

---

## 6. Decomposição proposta

Ordem escolhida por dependência técnica, não por apelo comercial. Cada fase termina em algo verificável.

**Fase 0 — Estancar o sangramento (1 sessão, sem features)**
Rotacionar a chave em `cron.job` e re-agendar via Vault. Esconder/flaggar as 5 telas de decoração. Consertar os 4 links 404. Criar `.env.example` + validação fail-fast de env. Adicionar security headers. Agendar `calendar-pull` no `pg_cron`.
*Isso torna o produto honesto e seguro antes de crescer.*

**Fase 1 — Multi-tenancy (a fundação; nada depende menos disso)**
`workspaces` + `workspace_members` com papéis reais. Migrar `user_id` → `workspace_id` em ~40 tabelas. Reescrever as policies (consolidando as duplicadas). Fluxo de convite real (email + aceite + `member_user_id`). Enforcement de papéis na RLS, não só na UI. Decidir e implementar a visibilidade "vendedor vê só o dele × vê tudo".
*Maior risco do projeto. Precisa de staging antes.*

**Fase 2 — Entrada de leads + motor de automação server-side** *(fundidas: são o mesmo subsistema)*
Motor: tirar `run-automations.ts` do browser; fila de eventos + worker; corrigir o `send_webhook` sem guarda SSRF/HMAC; ligar a fila de retry `dispatch-webhooks` (inserir como `pending`); corrigir o bug do `step.note` JSON nas sequências; **tela de log de execução** (sem isso automação não é vendável).
Entrada: rota pública que **valida `x-api-key`** contra `api_keys` e resolve o workspace (a tabela e o hashing já existem — falta só o endpoint); webhook de entrada + endpoint de formulário; novo gatilho `lead_recebido`; **distribuição automática para vendedor** (round-robin / por regra), que é o que faz `deals.owner_id` valer alguma coisa; campos de atribuição (`source`, `utm_*`, `campaign_id`) no schema desde já. Matar o 404 de `/ajuda/integracao-leads-externos` com a doc real.
*Fundidas porque "lead cai no sistema" só tem valor se disparar automação (distribuir, notificar, iniciar sequência) — e a automação só é confiável se sair do browser.*

**Fase 3 — WhatsApp multi-driver**
Camada de mensageria abstrata com 3 drivers atrás de uma interface (`sendText`/`sendMedia`/`getQR`/`status`) + um normalizador de webhook de entrada por driver: `evolution` (primeiro, já em uso), `uazapi` (depois), `meta_cloud` (oficial, para quem precisa de template aprovado). Provider + credenciais + `instance_id` **por workspace**. QR real na tela de conexão. `/conversas` com dados reais em tempo real (webhook de entrada → insert → Supabase Realtime, mesmo padrão de `use-realtime-notifications.ts`). Ligar a fila `automation_whatsapp_queue` e os passos WhatsApp das sequências ao driver ativo do workspace.
*Depende da Fase 1: "instância por workspace" precisa que workspace exista.*

**Fase 4 — Pós-venda**
**Gatilhos temporais** (“X dias após ganhar”, “X dias sem atividade”) — hoje impossíveis: os 6 gatilhos são todos de evento. Avaliador agendado (o `pg_cron` de 1 min já existe). Pipeline de pós-venda/CS separado (pipelines já são múltiplos — custo zero). Encadeamento pós-ganho: onboarding, NPS, check-in recorrente, gatilho de upsell.
*Depende da Fase 2: gatilho temporal só é confiável com motor server-side.*

**Fase 4b — VoIP** *(adicionada em 2026-08-19 a pedido do dono)*
Ligação de dentro do CRM, gravação, analytics. Torna `/configuracoes/telefone` e `/ligacoes` reais. Decidir provedor vs. WebRTC. Depende de storage para áudio (fora do free tier) e de tratamento LGPD do consentimento de gravação.

**Fase 5 — Endurecimento & confiança**
Rate limiting, validação com zod, observabilidade (Sentry + health check), primeiros testes E2E dos caminhos críticos, CI. Responsividade mobile (41 de 42 páginas assumem desktop). Extrair design system. **Relatório de atribuição de origem** (ROI por campanha) usando os campos plantados na Fase 2.

**Fase 6 — Billing**
Stripe por trás da tela de billing: assinatura por workspace + por usuário, limites por plano, trial, webhooks de assinatura idempotentes.
*Por último porque cobrar por algo que ainda muda de forma é caro de refazer. Até lá: ativação manual, com criação de conta automática.*

---

## 6.0 Contexto de negócio (revelado em 2026-08-19) — reordena o plano

O dono tem uma agência de marketing/tráfego. A cadeia de valor real é:

```
ele gera tráfego (pago + orgânico)  →  LEAD  →  CRM  →  vendedor trabalha  →  VENDA  →  pós-venda
```

Uso em duas camadas: para a própria agência **e** revendido aos clientes de marketing dela. Ativação manual no início, cobrança por workspace (e por usuário dentro dele) no futuro.

**Diagnóstico que decorre disso: o CRM cobre só o meio da cadeia. As duas pontas não existem.**

| Ponta | Estado |
|---|---|
| **Entrada de leads** | **Inexistente.** Não há nenhuma forma de um lead entrar sem digitação manual ou import CSV. `api_keys` são geradas e hasheadas mas **nenhuma rota valida `x-api-key`**. Não há webhook de entrada, nem endpoint de formulário, nem integração com Meta Lead Ads. O card promocional em `configuracoes/api/page.tsx:424` anuncia "integração de leads externos" e aponta para `/ajuda/integracao-leads-externos` — **404**. A intenção existia; a implementação nunca. |
| **Pós-venda** | **Inexistente.** `TriggerType` tem exatamente 6 valores, todos eventos de negócio (`deal_created`, `stage_changed`, `deal_won`, `deal_lost`, `deal_updated`, `activity_created`). **Não há gatilho temporal** (“X dias após ganhar”), nem gatilho de lead recebido, nem encadeamento pós-ganho. Sem gatilho temporal, automação de pós-venda é impossível por construção. |

Consequência: o pedido “tornar funcional o que é decoração” e o objetivo comercial apontam para o **mesmo lugar**, e não é onde o plano original começava. A ordem foi revisada na seção 6.2.

### Ideia de produto (não solicitada, mas decorre do modelo)

Ele vende tráfego **e** venderá o CRM para os mesmos clientes. O diferencial óbvio é **atribuição de origem ponta a ponta**: carregar `source` / `utm_*` / `campaign_id` no momento da entrada do lead e reportar *qual campanha gerou os negócios ganhos e quanto faturou*. Isso fecha o ciclo entre o serviço de tráfego dele e o CRM — vira prova de ROI da agência dentro do próprio produto que ele revende. Custo marginal baixo **desde que os campos entrem no schema junto com a ingestão de leads** (Fase 2); caro de retrofitar depois. Recomendação: reservar os campos na Fase 2 mesmo que o relatório só venha na Fase 5.

## 6.1 Decisões do dono do produto (2026-08-19)

Respondidas antes de qualquer desenho, conforme pedido.

| # | Pergunta | Decisão | Impacto |
|---|---|---|---|
| 1 | Visibilidade dentro do workspace | **Vendedor vê só os próprios negócios; dono/gerente vê tudo de todos.** Escopo exato decidido pela auditoria (ver abaixo). | `deals.owner_id` **já existe**. Policies: `workspace_id` + (`owner_id = auth.uid()` OR papel ∈ {admin, gerente}). |
| 2 | uazapi | **Tem conta, não tem token de teste.** Usa **Evolution API** hoje. | Ver Fase 3: driver abstrato, Evolution primeiro. |
| 3 | Escopo WhatsApp v1 | **Tudo**: conversas 1:1 em tempo real, disparo por automação, passos em sequências, templates. **E API oficial + não-oficial.** | Força a abstração multi-driver desde o dia 1 — ela deixa de ser opcional. |
| 4 | Dados atuais | **Viram o primeiro workspace** (backfill). | Migration da Fase 1 precisa de backfill, é irreversível sem backup. Ver risco abaixo. |

**Decisão de escopo da carteira (tomada pela auditoria, dono não tinha preferência técnica):** filtrar por dono **apenas negócios**; atividades herdam a visibilidade do negócio pai (as policies de `activities` já funcionam assim hoje, via `EXISTS` em `deals` — custo zero); **contatos e empresas ficam compartilhados no workspace**.

Justificativa ligada ao modelo dele: ele **gera e distribui os leads centralmente**. Se contatos fossem privados por vendedor, a própria distribuição ficaria cega e dois vendedores ligariam para a mesma empresa sem saber — o pior sintoma possível num CRM alimentado por tráfego pago. Também é a opção mais barata: `deals.owner_id` já existe, `contacts`/`companies` não precisam de coluna nova. Entrega exatamente o que ele pediu ("cada vendedor vê seus negócios, eu vejo tudo") sem o custo e o efeito colateral da carteira fechada total.

**Recomendação sobre Evolution → uazapi:** fazer. Não aumenta a complexidade, porque a exigência de "oficial + não-oficial" já obriga a ter ≥2 drivers. Com a interface no lugar, trocar de provedor é config. Custo da abstração ≈ 1 dia; o trabalho real é o normalizador de webhook de entrada, ≈ 1 dia por driver (os payloads de entrada divergem muito; o caminho de envio é quase idêntico entre Evolution e uazapi).

A diferença decisiva entre Evolution e uazapi **não é a API, é a hospedagem**: Evolution é self-hosted (você provisiona, escala e monitora 1 instância por workspace, e o número banido é seu problema operacional); uazapi é gerenciado. Com poucos clientes, Evolution é tranquilo. Com dezenas de workspaces, ser o provedor de infra de WhatsApp dos clientes vira um segundo produto com plantão. Plano: Evolution para dev e primeiros clientes, migrar quando a contagem de instâncias virar trabalho.

**Nota sobre templates:** aprovação de template só existe na API oficial da Meta. Em Evolution/uazapi, "template" é snippet local. A tela `/configuracoes/whatsapp-templates` serve os dois; o campo de status de aprovação só se aplica ao driver `meta_cloud`.

**Risco aberto da decisão 4:** o backfill será aplicado direto em produção, porque não existe staging. Combinado com "toda migration é testada em produção" (seção 5), a Fase 1 é o ponto de maior risco de perda de dados do projeto inteiro. Mitigação mínima antes de rodar: backup verificado + a tag `v0.1.0-pre-saas` não cobre o banco, só o código.

## 6.3 Destino de cada tela falsa — decidido pelo dono (2026-08-19)

| Tela | Destino | Nota |
|---|---|---|
| `/configuracoes/whatsapp` | **MANTER — virar real com Evolution API** | É a tela de conexão; o QR estático vira QR real de `/instance/connect/{instanceName}` |
| `/conversas` | **MANTER — virar real com Evolution API** | Inbox em tempo real via webhook de entrada + Supabase Realtime |
| `/configuracoes/telefone` | **MANTER — virar real com VoIP** | Dono quer VoIP próprio ou conectado (referência: api4com). Vendedores ligam de dentro do sistema. |
| `/ligacoes` | **MANTER — virar real com VoIP** | Dashboard de ligações precisa de dados reais: duração, status, **gravações**, análise |
| `/configuracoes/billing` | **OCULTAR por enquanto, deixar no código** | ⚠️ **LEMBRETE EXPLÍCITO DO DONO: trabalhar nisso no futuro. Não esquecer.** Stripe por workspace + por usuário. |

### Links de navegação 404

| Link | Destino |
|---|---|
| `/prospeccao` | **OCULTAR** |
| `/analise-calls` | **OCULTAR** |
| `/configuracoes/api/docs` | **MANTER o link** — a doc será escrita quando a API pública estiver rodando, e o link passa a apontar pra ela |
| `/ajuda/integracao-leads-externos` | idem — vira a doc de ingestão de leads |

## 6.4 Escopo ampliado pelo dono (2026-08-19)

1. **API pública real, não decorativa.** Validar `x-api-key` contra `api_keys` (tabela e hashing já existem). Webhooks de entrada e saída funcionando. Dono pediu ajuda com a infra: **subdomínio dedicado + proteção Cloudflare** (rate limit / WAF na borda, já que o app não tem rate limiting próprio). Documentação pública em `/configuracoes/api/docs`.
2. **VoIP real** (nova fase, não estava no plano). Ligação de dentro do CRM pelos vendedores, com registro de duração/status, **gravação de chamada** e analytics. Referência citada: api4com. Decidir entre integrar provedor (api4com/Twilio/Zenvia) ou WebRTC próprio. Gravação implica **LGPD**: consentimento, retenção e storage (o free tier do Supabase não comporta áudio — precisa de bucket externo ou Supabase Pro).
3. **Multi-usuário reforçado**: "quero que qualquer usuário possa usar esse sistema" — confirma a Fase 1.
4. **Nota do dono**: o front foi parcialmente copiado de outro sistema (ele se ofereceu para mostrar a referência, só o front). Relevante ao decidir o design system na Fase 5 — e vale conferir se há risco de marca/identidade visual antes de vender o produto.

## 6.5 Manutenção executada em 2026-08-19

**Banco estava com 601 MB, acima do limite de 500 MB do free tier.** 97% era log de cron:
- `net._http_response` 391 MB (inchaço de tuplas do `pg_net`)
- `cron.job_run_details` 195 MB (**408.192 execuções** desde 22/05/2026 — 4 jobs de minuto em minuto processando filas vazias; só 4 falhas)
- dados reais de negócio: ~15 MB

Ação: `TRUNCATE` nas duas tabelas + job `purge-cron-logs` (jobid 5, diário às 03:00, retém 3 dias). **Resultado: 601 MB → 16 MB.**

⚠️ **Pendente relacionado:** os 4 jobs continuam rodando de minuto em minuto contra filas vazias, queimando ~130 mil invocações/mês das 500 mil do free tier. Enquanto as filas não forem usadas (Fase 2), vale reduzir a cadência para 5 min ou desativar. Não feito — é mudança de comportamento, não faxina.

## 6.6 Stack da Evolution API — analisada em 2026-08-19

Docker Swarm + Traefik + Let's Encrypt. Imagem `evoapicloud/evolution-api:v2.3.7` (**Evolution v2** — os caminhos são `/instance/create`, `/instance/connect/{instance}`, `/webhook/set/{instance}`, `/message/sendText/{instance}`). `SERVER_URL=https://wsapi.pixeo.com.br`, porta interna 8080, 1 réplica.

> Segredos (`AUTHENTICATION_API_KEY`, senha do Postgres, senha do RabbitMQ) **deliberadamente não registrados aqui**. Vão em `.env.local` / env da Vercel. O dono foi avisado e pretende rotacioná-los.

### O que a config revela — e o que precisa mudar antes de codar

| Config atual | Consequência | Ação recomendada |
|---|---|---|
| `DATABASE_SAVE_DATA_NEW_MESSAGE=false` | **Evolution não persiste mensagem recebida.** Se o nosso webhook falhar ou o deploy estiver fora do ar, a mensagem some — não há de onde recuperar. Inaceitável para inbox de CRM. | **Mudar para `true`.** Vira a fonte de recuperação. |
| `DATABASE_SAVE_MESSAGE_UPDATE=false` | Sem status de entrega/leitura persistido. A UI de `/conversas` já desenha ✓ e ✓✓ — ficariam sempre falsos. | **Mudar para `true`.** |
| `DATABASE_SAVE_DATA_CHATS=false` | Sem lista de conversas do lado da Evolution; teríamos que reconstruir 100% no nosso banco. | **Mudar para `true`** (barato, ajuda no bootstrap da inbox). |
| `S3_ENABLED=false` | **Mídia não é armazenada.** A UI de `/conversas` tem microfone e clipe de anexo. Áudio/imagem/documento chegariam como base64 no webhook e se perderiam. | Decidir: habilitar S3 (MinIO/Cloudflare R2) **ou** baixar a mídia no nosso handler e gravar no Supabase Storage. Atenção: **free tier do Supabase = 1 GB de storage** — áudio de WhatsApp enche rápido. R2 é mais barato. |
| `WEBHOOK_GLOBAL_ENABLED=false` | Correto para o nosso caso. Webhook **por instância** (`/webhook/set/{instance}`) continua funcionando e é o que queremos — cada workspace aponta para a sua própria URL. | **Manter como está.** |
| `RABBITMQ_ENABLED=true`, `RABBITMQ_GLOBAL_ENABLED=false` | A doc da Evolution recomenda RabbitMQ em vez de webhook. **Não serve para nós:** o app roda em Vercel serverless, que não sustenta consumidor AMQP de longa duração. | **Ficar com webhook.** Deixar o RabbitMQ ligado não atrapalha. (Se um dia houver worker dedicado, reavaliar.) |
| `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true` | `fetchInstances` devolve o token de cada instância. Quem tiver a chave global vê o token de **todos** os workspaces. | Aceitável enquanto o servidor é dele. Vira problema se algum dia um cliente tiver acesso. Reavaliar na Fase 1. |
| `CHATWOOT_ENABLED=true` | **Resolvido (2026-08-19): não usa.** O Chatwoot foi apagado há tempos; a config ficou órfã apontando para um banco `chatwoot` inexistente. Sem conflito de "dono da conversa" — o CRM é o único consumidor da instância. | **Mudar para `false`** e remover `CHATWOOT_IMPORT_DATABASE_CONNECTION_URI`. Config morta tentando conectar em banco que não existe. |
| `limits: cpus 1 / memory 1024M`, `replicas: 1` | ⚠️ **Teto de capacidade.** Cada instância Baileys custa ~100–200 MB de RAM. **1 GB ≈ 5 a 8 instâncias**, ou seja 5–8 workspaces com WhatsApp. | Suficiente para os primeiros clientes. Confirma a análise da seção 6.1: escalar self-hosted vira trabalho de infra. Subir o limite de memória é a mitigação imediata. |
| `QRCODE_LIMIT=30`, `DEL_INSTANCE=false` | Ok. | Sem ação. |

### Arquitetura decorrente

```
WhatsApp → Evolution (wsapi.pixeo.com.br)
   → webhook por instância → rota nova no CRM (valida assinatura + resolve workspace)
   → grava mensagem no Supabase → Supabase Realtime → /conversas atualiza sozinho
```

Envio segue o caminho inverso via `/message/sendText/{instance}`, com o `instanceName` e o token resolvidos a partir do workspace.

**Pendências para a próxima sessão:** buscar em `docs.evolutionfoundation.com.br/llms.txt` os contratos exatos de `/webhook/set`, `/message/sendText` e `/instance/connectionState` (os de `/instance/create` e `/instance/connect` já estão levantados na seção 6.1).

## 7. Evidência checada

Código: 42 páginas, 16 rotas de API, `src/proxy.ts`, `src/lib/*` (automações, webhooks, crypto, calendar, sequences), 4 edge functions, `next.config.ts`, `vercel.ts`, `package.json`, 18 migrations.
Banco live: advisors de segurança, RLS de 43 tabelas, definições de policies de 7 tabelas-chave, `cron.job`, edge functions deployadas, extensões, contagens de linhas, estado de criptografia de tokens/segredos.
Comandos: `tsc --noEmit` (limpo), `npx eslint` (70 erros).

## 8. Evidência faltando

- Não testei nada em runtime (nenhum fluxo executado no app rodando).
- Não vi política de backup/PITR do Supabase.
- Não sei se `WHATSAPP_TOKEN` está setado nas secrets das Edge Functions (se não estiver, a fila falha silenciosa 100% das vezes).
- Não vi documentação/credenciais da uazapi.
- Não avaliei LGPD (dados de contatos de terceiros, retenção, exportação, exclusão) — obrigatório antes de vender no Brasil.

## 6.7 Conectividade da Evolution — validada em 2026-08-19

`GET /instance/fetchInstances` com header `apikey` → **HTTP 200**. Credenciais em `.env.local` como `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` (arquivo coberto por `.env*` no `.gitignore`, confirmado fora do controle de versão).

**Três instâncias já existem e estão conectadas (`status: open`):**

| Instância | Número | Observação |
|---|---|---|
| `aimaze` | 553491101680@s.whatsapp.net | Baileys (não-oficial) |
| `pixeomkt` | 553888601343@s.whatsapp.net | Baileys (não-oficial) |
| `sinpase` | 528363650367191 | **Sem sufixo `@s.whatsapp.net` → formato de WhatsApp Business Cloud API (oficial)** |

**Implicação boa:** a mesma Evolution já abstrai o canal oficial e o não-oficial. O requisito do dono de ter "as duas opções" não exige dois drivers no CRM — exige **um** driver Evolution, com o tipo de integração escolhido na criação da instância (`integration` no `POST /instance/create`). Reduz o escopo da Fase 3.

⚠️ **Cuidado na próxima sessão:** as 3 instâncias são de uso real. **Não repontar o webhook de nenhuma delas** — isso desviaria mensagens de negócio em produção para o CRM, ou quebraria o fluxo que já as consome. Criar uma instância dedicada de teste (`trinocrm-dev`) antes de mexer em webhook.
