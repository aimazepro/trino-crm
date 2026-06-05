# Plano de Correções — Trino CRM
> Gerado em 2026-05-27. Aprovar por fase antes de implementar.

## FASE 1 — SEGURANÇA CRÍTICA
| # | Status | Item | Arquivo(s) |
|---|--------|------|-----------|
| 1.1 | ✅ DONE | Fix SSRF em webhooks — validar scheme https + bloquear IPs privados | `src/app/api/webhooks/trigger/route.ts`, `supabase/functions/dispatch-webhooks/index.ts` |
| 1.2 | ✅ DONE | Sanitizar XSS email body — DOMPurify no `dangerouslySetInnerHTML` | `src/components/deal/email-tab.tsx:491` |
| 1.3 | ✅ DONE | OAuth CSRF Gmail — gerar `state` token, salvar em cookie signed, validar no callback | `src/app/api/auth/gmail/route.ts`, `src/app/api/auth/gmail/callback/route.ts` |
| 1.4 | ✅ DONE | HTML-escape signature fields — escapar `sig.name/role/company` antes de interpolar no HTML | `src/app/api/gmail/send/route.ts:106` |
| 1.5 | ✅ DONE | IDOR Gmail sync — verificar ownership de `contactId`/`dealId` antes de inserir | `src/app/api/gmail/sync/route.ts:107-108` |
| 1.6 | ✅ DONE | XSS em template editor — sanitizar `t.body` antes de `innerHTML` no contentEditable | `src/components/deal/email-tab.tsx:189` |
| 1.7 | ✅ DONE | Tighten middleware matcher — excluir só `api/auth/callback` + `api/track`, não todo `api/auth` | `src/middleware.ts:22` |
| 1.8 | ✅ DONE | Defense-in-depth Gmail emails — adicionar `.eq("user_id", user.id)` na query | `src/app/api/gmail/emails/route.ts:28` |
| 1.9 | ✅ DONE | Verificar tracking pixel IDOR — `track_id` confirmado UUID `gen_random_uuid()`, já unguessable | `src/app/api/track/[trackId]/route.ts` |

## FASE 2 — DB E RLS
| # | Status | Item | Arquivo(s) |
|---|--------|------|-----------|
| 2.1 | ✅ DONE | Corrigir RLS initplan em `notifications` e `deal_field_values` — usar `(select auth.uid())` | migration: fase2_rls_indexes_revoke |
| 2.2 | ✅ DONE | Indexar FKs faltando — `notifications.user_id`, `deal_field_values.field_id` | migration: fase2_rls_indexes_revoke |
| 2.3 | ✅ DONE | Revogar EXECUTE de `on_deal_change()` para `anon`/`authenticated`/`PUBLIC` | migrations: fase2_rls_indexes_revoke + fase2_revoke_on_deal_change_public |
| 2.4 | ❌ NÃO FEITO | Ligar HIBP — ativar manualmente: Dashboard → Auth → Settings → Password Security → "Check against HaveIBeenPwned database". Sem API disponível, ação manual obrigatória. | Dashboard Supabase |
| 2.5 | ✅ DONE | Encriptar tokens OAuth AES-256-GCM — `src/lib/token-crypto.ts` + `src/lib/gmail-token.ts` | backward-compat: legacy tokens sem prefixo `enc:` continuam funcionando |
| 2.6 | ✅ DONE | FOR UPDATE SKIP LOCKED nas queues via `claim_pending_*` RPCs | migration: fase2_claim_queue_functions |

## FASE 3 — DADOS E PRIVACIDADE
| # | Status | Item | Arquivo(s) |
|---|--------|------|-----------|
| 3.1 | ✅ DONE | Remover seed hardcoded com email pessoal + IDs reais de deals | `src/contexts/crm-context.tsx` |
| 3.2 | ✅ DONE | Remover "João Paulo Olivera" hardcoded — dinâmico via `auth.getUser()` | `src/app/contatos/page.tsx`, `src/app/empresas/page.tsx` |
| 3.3 | ✅ DONE | Migrar `saved_reports` de localStorage → Supabase (migration: fase3_saved_reports) com migração automática de dados existentes | `src/app/insights/page.tsx` |

## FASE 4 — PERFORMANCE
| # | Status | Item | Arquivo(s) |
|---|--------|------|-----------|
| 4.1 | ✅ DONE | `useMemo` no value do CrmContext.Provider | `src/contexts/crm-context.tsx` |
| 4.2 | ✅ DONE | `.range(0, 499)` em contacts e companies | `src/contexts/crm-context.tsx` |
| 4.3 | ❌ NÃO FEITO | Code-split Recharts com `next/dynamic` — requer extrair 5 tipos de chart em wrapper components separados dentro de `insights/page.tsx` (1980 linhas). Adiado: complexidade alta, ganho baixo em relação ao esforço. | `src/app/insights/page.tsx` |
| 4.4 | ✅ DONE | BulkFieldSelect extraído → `src/components/ui/BulkFieldSelect.tsx` | 3 arquivos atualizados |
| 4.5 | ✅ DONE | `<img>` → `<Image>` next/image no sidebar | `src/components/layout/sidebar.tsx` |
| 4.6 | ✅ DONE | `replace_deal_labels` + `replace_deal_products` RPCs atômicos | migration: fase4_atomic_deal_labels_products |

## FASE 5 — REFACTOR
| # | Status | Item | Arquivo(s) |
|---|--------|------|-----------|
| 5.1 | ✅ DONE | Quebrar crm-context.tsx (883→85 linhas) — transforms, loader, seeds, mutations, realtime em arquivos separados | `src/lib/crm-transforms.ts`, `src/lib/crm-loader.ts`, `src/lib/crm-seeds.ts`, `src/hooks/use-crm-mutations.ts`, `src/hooks/use-realtime-notifications.ts` |
| 5.2 | ✅ DONE | Quebrar insights/page.tsx (2034→1294 linhas) — constants, 2 hooks, 2 sub-components | `insights-constants.ts`, `use-owner-name-map.ts`, `use-saved-reports.ts`, `dashboard-grid.tsx`, `insights-sidebar.tsx` |
| 5.3 | ✅ DONE | Tipar BulkFieldSelect — generic `T extends string` em vez de `(v: any)` | `src/components/ui/BulkFieldSelect.tsx` |
| 5.4 | ✅ DONE | Remover dead code — `parentCompanyId`, eslint-disable inválido `react-hooks/preserve-manual-memoization`, singleton `_pipelinesSeedDone` | `src/contexts/crm-context.tsx`, `src/app/insights/page.tsx` |
| 5.5 | ✅ DONE | Pinar lucide-react versão exata, removido `^` | `package.json` |

## FASE 6 — MULTI-TENANT / TIMES
| # | Status | Item | Esforço |
|---|--------|------|---------|
| 6.1 | ✅ DONE | Refatorar RLS para workspace — `is_workspace_member()` helper + policies workspace-aware em deals/contacts/companies/pipelines/labels/activities | migration: fase6_workspace_rls |
| 6.2 | ✅ DONE | Ligar team members à UI — `ownerNameMap` em kanban-list-view, `owner_id` persistido no addDeal | `kanban-list-view.tsx`, `use-crm-mutations.ts` |

## FASE 7 — PRODUTO (features)
| # | Status | Item | Esforço |
|---|--------|------|---------|
| 7.1 | ✅ DONE | Import CSV contatos/empresas/deals | 1 dia |
| 7.2 | ⬜ TODO | Inbox de email — ligar Gmail sync à UI | 2-3 dias |
| 7.3 | ⬜ TODO | Inbox WhatsApp — ligar queue à UI de conversas | 2-3 dias |
| 7.4 | ⬜ TODO | Web forms / lead capture | 2 dias |
| 7.5 | ✅ DONE | Forecast de receita — tela usando probability + expected_close_date | 1 dia |
| 7.6 | ⬜ TODO | Calendar view — ligar appointments table à UI | 1 dia |
| 7.7 | ⬜ TODO | Duplicate detection — ligar lógica à rota /configuracoes/duplicatas | 1 dia |
| 7.8 | ⬜ TODO | Lead scoring — campo + regras configuráveis | 2 dias |
| 7.9 | ⬜ TODO | Billing/Stripe — ligar /configuracoes/billing scaffold | 2-3 dias |
| 7.10 | ⬜ TODO | Audit log global — tabela audit_log + trigger genérico | 1 dia |
| 7.11 | ⬜ TODO | Export CSV/PDF — deals, contatos, relatórios | 1 dia |
| 7.12 | ⬜ TODO | PWA / offline — manifest + service worker básico | 1 dia |

---
## Progresso
- Fase 1: 9/9 concluído ✅ COMPLETA
- Fase 2: 5/6 (2.4 manual — ativar HIBP no dashboard)
- Fase 3: 3/3 ✅ COMPLETA
- Fase 4: 5/6 ✅ (4.3 skip — complexidade alta)
- Fase 5: 5/5 ✅ COMPLETA
- Fase 6: 2/2 ✅ COMPLETA
- Fase 7: 0/12
