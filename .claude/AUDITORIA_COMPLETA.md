# Auditoria Completa + Plano de Correções — Trino CRM
> Gerado em 2026-05-27. Stack: Next.js 16 + React 19 + Supabase (pg17) + Tailwind v4.
> 84 arquivos TS. Single-tenant via `user_id` RLS. Supabase project: `etdkzpiehoivrviylemd` (us-east-1).

---

## PARTE 1 — AUDITORIA DE CÓDIGO

### 1. Arquitetura e Estrutura — Score 3/10

🚨 `src/contexts/crm-context.tsx` (1014 linhas) — god-context: auth + fetch 6 entidades + seeding + 20+ mutações + realtime + notifications. Extrair: `lib/loaders/crm-loader.ts`, `hooks/use-deal-mutations.ts`, `hooks/use-notification-realtime.ts`, `lib/seeds/*`.
🚨 `src/app/insights/page.tsx` (1980 linhas) — 5 jobs distintos. Extrair: `DEFAULT_REPORTS` (L1-245), hook `useInsightsData` (L549-800), `<InsightsDashboard>` (L803-1079), `<ReportEditor>` (L1081-1980).
🚨 `BulkFieldSelect` duplicado 3x literalmente: `src/app/contatos/page.tsx:56`, `src/app/empresas/page.tsx:18`, `src/components/kanban/kanban-list-view.tsx:18`. Extrair para `components/ui/BulkFieldSelect.tsx`.
⚠️ Sem camada de serviços. Pages chamam `supabase.from(...)` direto.
⚠️ `src/components/` sem pasta `ui/` para primitivos.

### 2. Performance — Score 4/10

🚨 `src/contexts/crm-context.tsx:1001` — Provider `value={{...}}` novo objeto a cada render. Zero `useMemo`/`useCallback`. Todo consumer re-renderiza em qualquer write.
🚨 `src/contexts/crm-context.tsx:172` — contacts/companies com `select("*")` sem paginação.
🚨 `src/app/insights/page.tsx:1` — Recharts (~150kB gzip) importado no topo sem code-split.
⚠️ `src/components/layout/sidebar.tsx:49` — `<img>` puro sem `next/image`.
⚠️ `src/contexts/crm-context.tsx:480` — `updateDealFields` faz delete+insert sem transação. Falha de rede = labels/products perdidos.

### 3. Segurança — Score 4/10

🚨 `src/app/api/webhooks/trigger/route.ts:44-74` + `supabase/functions/dispatch-webhooks/index.ts:43` — **SSRF**. URL do user vai direto pro fetch. ✅ CORRIGIDO em 2026-05-27.
🚨 `src/components/deal/email-tab.tsx:491` — **Stored XSS**. `email.body_html` renderizado com `dangerouslySetInnerHTML` sem sanitização. Fix: DOMPurify.
🚨 `src/app/api/auth/gmail/route.ts` — **OAuth CSRF**. Sem parâmetro `state`. Fix: gerar state token, salvar em cookie signed, validar no callback.
🚨 `src/app/api/gmail/send/route.ts:106` — **HTML injection** em assinatura. `sig.name/role` concatenados raw no HTML do email.
⚠️ `src/app/api/track/[trackId]/route.ts` — pixel de tracking sem auth. Se `track_id` for UUID previsível, IDOR.
⚠️ `src/app/api/gmail/sync/route.ts:107-108` — `contactId`/`dealId` inseridos sem checar ownership.
⚠️ `src/app/api/gmail/emails/route.ts:28` — filtra só por `contact_id`, sem `.eq("user_id", user.id)`.
⚠️ `src/app/api/auth/gmail/callback/route.ts:90-102` — tokens OAuth em plaintext na tabela `integrations`.
⚠️ `src/middleware.ts:22` — matcher exclui todo `api/auth`, deveria excluir só `api/auth/callback`.
⚠️ `src/components/deal/email-tab.tsx:189` — `editorRef.current.innerHTML = t.body` sem sanitização no editor.

### 4. Lógica de Negócio — Score 5/10

🚨 `src/contexts/crm-context.tsx:235-358` — seed hardcoded com email pessoal `joaoreiscefet@gmail.com` + IDs reais de deals gravados em `notifications` para todo user novo.
🚨 `src/app/insights/page.tsx:304` — `saved_reports` só em localStorage. Perde ao trocar device/browser. Tabela Supabase existe, não usada.
⚠️ Multi-tenancy = só `user_id`. Sem workspace/org. `team_members` table existe, mas RLS de deals/contacts/companies não considera.
⚠️ `src/contexts/crm-context.tsx:480` — race: delete labels → insert labels sem rollback.
⚠️ `src/app/contatos/page.tsx:434` — "João Paulo Olivera" hardcoded como Proprietário. Mesmo em empresas.

### 5. Bugs Potenciais — Score 5/10

⚠️ `src/app/insights/page.tsx:678` — `eslint-disable-next-line react-hooks/preserve-manual-memoization` — regra inexistente, no-op.
⚠️ `src/contexts/crm-context.tsx:150` — `_pipelinesSeedDone` module-level singleton. HMR pode desincronizar com DB.
⚠️ `src/contexts/crm-context.tsx:716` — `parentCompanyId` comentado. Feature meio implementada.
⚠️ Race condition em automation queues — sem `FOR UPDATE SKIP LOCKED`. Worker duplicado = email enviado 2x.

### 6. Dependências — Score 6/10

⚠️ `package.json:19` — `lucide-react: "^1.8.0"`. Caret range pega breaking changes 1.x automático. Pinar exato.
✅ Stack enxuto. React 19 + Next 16 + @tanstack/react-table v8 + recharts v3.

### 7. Qualidade do Código — Score 4/10

⚠️ `(v: any)` em todas 3 cópias do BulkFieldSelect.
⚠️ Naming PT/EN misturado (rotas PT, DB EN) — OK por design mas deve ser consistente.
⚠️ Funções longas (insights render 200+ linhas).

---

## PARTE 2 — AUDITORIA DE BANCO DE DADOS

> Projeto Supabase: `etdkzpiehoivrviylemd`, pg 17.6, us-east-1. Score: **8/10**

### Security Advisors
| Lint | Nível | Target | Fix |
|------|-------|--------|-----|
| `anon_security_definer_function_executable` | WARN | `public.on_deal_change()` | Revogar EXECUTE de `anon` |
| `authenticated_security_definer_function_executable` | WARN | `public.on_deal_change()` | Revogar EXECUTE de `authenticated` |
| `auth_leaked_password_protection` | WARN | Auth (project-wide) | Ligar HIBP no Auth settings |

### Performance Advisors
- **Unindexed FKs:** `deal_field_values.field_id`, `notifications.user_id`
- **Auth RLS initplan:** `notifications` e `deal_field_values` usam `auth.uid()` direto (não `(select auth.uid())`)
- 28 índices não usados — normal em DB quase vazio, não deletar

### Status RLS
- ✅ Todas 36 tabelas públicas com `rowsecurity=true`
- ⚠️ `notifications` + `deal_field_values` — RLS initplan não otimizado (Phase A regrediu nessas 2)
- ✅ Phase A (2026-05-22) corrigiu: search_path, revogou anon EXECUTE em `enqueue_webhook_delivery`, índices cobertos para goals/webhooks, rewrote auth-uid RLS para saved_reports/emails/email_signatures

### Missing FK Indexes
- `public.notifications.notifications_user_id_fkey` → user_id
- `public.deal_field_values.deal_field_values_field_id_fkey` → field_id

---

## PARTE 3 — AUDITORIA DE PRODUTO

### Inventário de Features

**Pipeline & Deals** ✅ Shipped: kanban, list view, multi-pipeline, deal CRUD, won/lost, probabilidade, source, days_in_stage, labels, notes, history, produtos por deal, catálogo de produtos, custom fields, bulk edit/delete. 🔴 Export button existe mas `disabled`.

**Contacts & Companies** ✅ Shipped: CRUD, hierarquia contact→company, bulk edit/delete, WhatsApp/Call buttons. 🔴 Duplicate detection sem lógica. 🔴 Import CSV sem backend.

**Activities & Calendar** ✅ Shipped: activities (tasks/calls/meetings), appointments, dashboard widget. 🟡 Calendar view: tabela existe, sem rota UI.

**Email** ✅ Templates, queue, Gmail OAuth. 🟡 Gmail sync tokens salvos mas sem inbox UI. 🔴 Pixel endpoint `/api/track/[trackId]` existe.

**WhatsApp** ✅ Templates, queue, botão no contato. 🔴 Sem inbox/conversation view.

**Automations & Sequences** ✅ Automations com trigger+steps, labels, templates. ✅ Sequences + steps + enrollments + worker. 🟡 UI de sequences pode estar inacessível.

**Goals/Metas** ✅ 5 tipos de meta, UI completa.

**Reports/Insights** ✅ Bar+pie charts, saved reports (localStorage), KPI cards. 🔴 Sem forecast, sem lead scoring.

**API & Webhooks** ✅ API keys, webhooks CRUD + delivery log, edge function dispatch.

**Team/Config** ✅ Team members, scripts de ligação, perfil. 🔴 Billing scaffold. 🔴 Sem audit log global.

### O que falta vs. concorrentes (Pipedrive/HubSpot/RD Station/Agendor/Ploomes)
- Email inbox integrado (Gmail sync pronto, falta UI)
- WhatsApp conversation inbox
- Import CSV (rota scaffold, sem parser)
- Web forms / lead capture
- Forecast de receita (dados existem, falta tela)
- Lead scoring
- Duplicate detection (rota existe, sem lógica)
- Billing/Stripe
- Audit log global
- Mobile app / PWA
- Calendar view UI
- Export CSV/PDF de relatórios

### Score Produto: 5/10

---

## SUMÁRIO DE SCORES

| Categoria | Score |
|-----------|-------|
| Arquitetura | 3/10 |
| Performance | 4/10 |
| Segurança | 4/10 |
| Lógica de Negócio | 5/10 |
| Bugs | 5/10 |
| Dependências | 6/10 |
| Qualidade Código | 4/10 |
| DB Posture | 8/10 |
| Completude Produto | 5/10 |
| UX | 6/10 |
| Mobile | 3/10 |
| Integrações | 5/10 |
| Escalabilidade | 5/10 |
| **Nota Geral** | **4.8/10** |

---

## PLANO DE CORREÇÕES

### FASE 1 — SEGURANÇA CRÍTICA (~5h)
| # | Status | Item | Arquivo(s) |
|---|--------|------|-----------|
| 1.1 | ✅ DONE | Fix SSRF em webhooks — scheme https + bloquear IPs privados | `src/app/api/webhooks/trigger/route.ts`, `supabase/functions/dispatch-webhooks/index.ts` |
| 1.2 | ⬜ TODO | Sanitizar XSS email body — DOMPurify no `dangerouslySetInnerHTML` | `src/components/deal/email-tab.tsx:491` |
| 1.3 | ⬜ TODO | OAuth CSRF Gmail — `state` token em cookie signed + validar callback | `src/app/api/auth/gmail/route.ts`, `src/app/api/auth/gmail/callback/route.ts` |
| 1.4 | ⬜ TODO | HTML-escape signature fields antes de interpolar no HTML | `src/app/api/gmail/send/route.ts:106` |
| 1.5 | ⬜ TODO | IDOR Gmail sync — verificar ownership `contactId`/`dealId` | `src/app/api/gmail/sync/route.ts:107-108` |
| 1.6 | ⬜ TODO | XSS template editor — DOMPurify antes de `innerHTML` no contentEditable | `src/components/deal/email-tab.tsx:189` |
| 1.7 | ⬜ TODO | Tighten middleware matcher — excluir só `api/auth/callback`, não `api/auth` inteiro | `src/middleware.ts:22` |
| 1.8 | ⬜ TODO | Defense-in-depth Gmail emails — `.eq("user_id", user.id)` na query | `src/app/api/gmail/emails/route.ts:28` |
| 1.9 | ⬜ TODO | Verificar tracking pixel IDOR — `track_id` deve ser UUID v4 random, não sequencial | `src/app/api/track/[trackId]/route.ts` |

### FASE 2 — DB E RLS (~4h)
| # | Status | Item | Arquivo(s) |
|---|--------|------|-----------|
| 2.1 | ⬜ TODO | RLS initplan — trocar `auth.uid()` por `(select auth.uid())` em `notifications` e `deal_field_values` | Nova migration |
| 2.2 | ⬜ TODO | Indexar FKs — `notifications.user_id`, `deal_field_values.field_id` | Nova migration |
| 2.3 | ⬜ TODO | Revogar EXECUTE de `on_deal_change()` para `anon`/`authenticated` | Nova migration |
| 2.4 | ⬜ TODO | Ligar HIBP no Supabase Auth settings | Dashboard Supabase |
| 2.5 | ⬜ TODO | Encriptar tokens OAuth na tabela `integrations` | `src/app/api/auth/gmail/callback/route.ts:90` |
| 2.6 | ⬜ TODO | FOR UPDATE SKIP LOCKED nas queues de email/WhatsApp | `supabase/functions/process-email-queue/index.ts`, `supabase/functions/process-whatsapp-queue/index.ts` |

### FASE 3 — DADOS E PRIVACIDADE (~3h)
| # | Status | Item | Arquivo(s) |
|---|--------|------|-----------|
| 3.1 | ⬜ TODO | Remover seed com email pessoal `joaoreiscefet@gmail.com` + IDs reais | `src/contexts/crm-context.tsx:235-358` |
| 3.2 | ⬜ TODO | Remover "João Paulo Olivera" hardcoded como Proprietário | `src/app/contatos/page.tsx:434`, `src/app/empresas/page.tsx` |
| 3.3 | ⬜ TODO | Migrar `saved_reports` de localStorage para Supabase | `src/app/insights/page.tsx:304` |

### FASE 4 — PERFORMANCE (~6h)
| # | Status | Item | Arquivo(s) |
|---|--------|------|-----------|
| 4.1 | ⬜ TODO | Memoizar CRM context — `useMemo` no value + `useCallback` em handlers | `src/contexts/crm-context.tsx:1001` |
| 4.2 | ⬜ TODO | Paginação — `.range(0,499)` em contacts/companies | `src/contexts/crm-context.tsx:172` |
| 4.3 | ⬜ TODO | Code-split Recharts — `dynamic(() => import(...))` por chart | `src/app/insights/page.tsx:1` |
| 4.4 | ⬜ TODO | Extrair BulkFieldSelect 3x duplicado → `src/components/ui/BulkFieldSelect.tsx` | `src/app/contatos/page.tsx:56`, `src/app/empresas/page.tsx:18`, `src/components/kanban/kanban-list-view.tsx:18` |
| 4.5 | ⬜ TODO | Substituir `<img>` por `next/image` no sidebar | `src/components/layout/sidebar.tsx:49` |
| 4.6 | ⬜ TODO | Transação atômica em `updateDealFields` — RPC ou rollback | `src/contexts/crm-context.tsx:480` |

### FASE 5 — REFACTOR (~8h)
| # | Status | Item | Arquivo(s) |
|---|--------|------|-----------|
| 5.1 | ⬜ TODO | Quebrar crm-context.tsx (1014L) — loader, seeds, mutations, realtime | `src/contexts/crm-context.tsx` |
| 5.2 | ⬜ TODO | Quebrar insights/page.tsx (1980L) — constants, 2 hooks, 2 sub-components | `src/app/insights/page.tsx` |
| 5.3 | ⬜ TODO | Tipar BulkFieldSelect — remover `(v: any)`, usar `(v: string) => void` | junto com 4.4 |
| 5.4 | ⬜ TODO | Dead code — `parentCompanyId` L716, eslint-disable inválido L678 | `src/contexts/crm-context.tsx:716`, `src/app/insights/page.tsx:678` |
| 5.5 | ⬜ TODO | Pinar lucide-react versão exata, remover `^` | `package.json:19` |

### FASE 6 — MULTI-TENANT / TIMES (~1.5 dias)
| # | Status | Item |
|---|--------|------|
| 6.1 | ⬜ TODO | Refatorar RLS — deals/contacts/companies checar `team_members` da org, não só `user_id` |
| 6.2 | ⬜ TODO | Ligar team members à UI — Proprietário dinâmico vindo de `team_members` |

### FASE 7 — PRODUTO (~3-4 semanas)
| # | Status | Item |
|---|--------|------|
| 7.1 | ⬜ TODO | Import CSV contatos/empresas/deals |
| 7.2 | ⬜ TODO | Inbox de email — ligar Gmail sync à UI de thread |
| 7.3 | ⬜ TODO | Inbox WhatsApp — ligar queue à UI de conversas |
| 7.4 | ⬜ TODO | Web forms / lead capture |
| 7.5 | ⬜ TODO | Forecast de receita (probability + expected_close_date já existem) |
| 7.6 | ⬜ TODO | Calendar view — ligar `appointments` table à UI |
| 7.7 | ⬜ TODO | Duplicate detection — implementar lógica em `/configuracoes/duplicatas` |
| 7.8 | ⬜ TODO | Lead scoring — campo + regras |
| 7.9 | ⬜ TODO | Billing/Stripe |
| 7.10 | ⬜ TODO | Audit log global |
| 7.11 | ⬜ TODO | Export CSV/PDF — deals, contatos, relatórios |
| 7.12 | ⬜ TODO | PWA / offline — manifest + service worker |

---

## PROGRESSO
- **Fase 1:** 1/9 (1.1 ✅ SSRF corrigido em 2026-05-27)
- **Fase 2:** 0/6
- **Fase 3:** 0/3
- **Fase 4:** 0/6
- **Fase 5:** 0/5
- **Fase 6:** 0/2
- **Fase 7:** 0/12

---

## INSTRUÇÃO PARA PRÓXIMA SESSÃO
Leia este arquivo antes de qualquer ação. Continue pela Fase 1, item 1.2.
Quando completar um item, atualize `⬜ TODO` → `✅ DONE` neste arquivo e faça commit.
