# Individualização multiusuário — handoff

**Branch:** `feat/multiusuario-individualizacao` (41 commits)
**Spec:** [docs/superpowers/specs/2026-08-26-multiusuario-individualizacao-design.md](superpowers/specs/2026-08-26-multiusuario-individualizacao-design.md)
**Plano:** [docs/superpowers/plans/2026-08-26-multiusuario-individualizacao.md](superpowers/plans/2026-08-26-multiusuario-individualizacao.md)
**Status:** implementado e revisado; **não deployado** (deploy neste projeto é manual)

## O que mudou

O banco e a RLS já eram multiusuário. A camada de interface não era — foi escrita
assumindo um usuário por workspace. Esta branch alinha as duas.

**WhatsApp.** Um número compartilhado por workspace, com dono por conversa. A
primeira resposta humana numa conversa sem dono a reivindica (trigger de
auto-claim; mensagem da fila de automação chega com `sent_by` nulo e nunca
reivindica). `/conversas` ganhou três escopos — Minhas, Fila e Time, este último
só para gerente e admin — e o balão passou a mostrar quem enviou. A assinatura
saiu do nível da conexão e virou por pessoa, com o nome derivado de
`workspace_members.name`: não existe campo para assinar como outra pessoa.
Vendedor vê o status da conexão em modo leitura e controla só a própria
assinatura.

**Negócios, Atividades, Contatos, Empresas.** O dono do negócio passou a ser
reatribuível pela tela de detalhe. Kanban e lista ganharam filtro por vendedor,
visível só para quem enxerga mais de uma carteira. O filtro de Atividades, que
era estado morto, passou a filtrar de verdade por responsável, e cada linha
mostra o responsável real em vez do usuário logado. Contatos e empresas ganharam
`owner_id` informativo — a base segue compartilhada por decisão de produto — com
coluna, filtro e edição em massa que grava.

**Relatórios.** Placar do time agregado, visível para todos os papéis, via a RPC
`team_scoreboard`. Insights, Metas, Forecast e Ligações passaram a esconder o
seletor de pessoa para vendedor, que fica no próprio escopo.

**Identidade.** O aceite de convite gravava `user_metadata.name` enquanto o app
lê `full_name` — corrigido na origem e por backfill. A tela de Perfil passou a
espelhar nome e avatar em `workspace_members`, que é de onde os colegas leem.

## Migrations aplicadas (produção)

| Arquivo | O que faz |
|---|---|
| `20260827100000_whatsapp_conversation_ownership` | auto-claim + `sync_whatsapp_conversation_links` para de sobrescrever o dono |
| `20260827100100_member_identity_and_signature` | `whatsapp_member_settings`, `workspace_members.avatar_url`, backfill de `full_name` |
| `20260827100200_activity_assignee_and_call_scope` | RLS de `activities` por `assignee_id`; `telephony_calls` por `user_id` |
| `20260827100300_activities_role_and_claim_status_fix` | `TO authenticated` nas policies de `activities`; claim só em mensagem entregue |
| `20260827100400_contact_company_owner` | `owner_id` em `contacts` e `companies` + backfill |
| `20260827100500_team_scoreboard` | RPC agregada do placar |
| `20260827100600_sync_my_member_identity` | RPC de identidade própria |
| `20260827100700_review_round1_rpc_hardening` | revoga as duas RPCs de `public` e `anon` |
| `20260827100800_review_round2_avatar_rejection` | avatar reprovado deixa de fingir sucesso |

Todas aditivas, backfills idempotentes.

## ⚠️ Pendente de verificação humana

Nenhuma sessão de navegador foi possível durante a execução. Estes pontos foram
provados por leitura de código e asserção SQL, **não** por clique real. Vale
percorrer com as duas contas antes de anunciar ao time:

**Como admin (João):** o dropdown de vendedores em `/conversas` lista os dois
nomes mesmo sem conversa atribuída; o balão mostra o autor certo; reatribuir
negócio persiste; o filtro de Atividades encolhe a lista; o Placar aparece em
Insights.

**Como vendedor (Ana):** sem QR nem botão de desconectar em Configurações ›
WhatsApp; o toggle da própria assinatura funciona; mensagem enviada por ela sai
com `*Ana Clara*:`; a aba Fila mostra as conversas órfãs e assumir tira da fila;
nenhum seletor de outra pessoa em Insights, Metas, Forecast e Ligações; o Placar
do time aparece.

## Achado de segurança FORA do escopo desta branch — não corrigido

Durante a auditoria, descobriu-se que **oito funções `SECURITY DEFINER` do schema
`public` são executáveis pelo papel `anon`**, sem login, pela chave anônima
pública. Verificado por execução, não por leitura.

Causa: `revoke all ... from public` não cobre o `EXECUTE` que o Supabase concede
ao `anon` por `ALTER DEFAULT PRIVILEGES` no `CREATE FUNCTION`; e várias dessas
funções nunca tiveram revoke nenhum.

| Função | Risco |
|---|---|
| `telephony_reconcile_stale_calls(interval)` | **Sem filtro de workspace.** Uma chamada anônima marca como `failed` ligações em andamento de todos os workspaces da plataforma |
| `telephony_add_credit(...)` | Mexe em saldo e ledger de qualquer workspace |
| `telephony_start_call(...)` | Insere ligação real de saída e reserva saldo |
| `telephony_finalize_call`, `telephony_attach_provider_call`, `telephony_mark_recording_deleted` | Mesmo padrão |
| `claim_due_sequence_enrollments(p_limit)`, `claim_pending_automation_events(p_limit)` | `UPDATE ... RETURNING *` sem filtro de workspace: vazamento entre inquilinos e linhas presas em `processing` |

Menores: `telephony_current_rate` vaza preço. Inertes: as funções de trigger — o
Postgres recusa invocação direta fora de contexto de trigger.

O remédio é o mesmo aplicado às RPCs desta branch:

```sql
revoke all on function public.telephony_reconcile_stale_calls(interval) from public, anon;
-- idem para as demais, ajustando a assinatura
```

Priorizar `reconcile_stale_calls` (alcance entre inquilinos), `start_call` e
`add_credit` (dinheiro e ligações reais).

**Nada disso foi introduzido por esta branch.** Ficou registrado e não corrigido
porque está fora do que foi pedido — é decisão de quem toca o produto.

## Backlog gerado

- **`goals-helpers.ts:62` seleciona `activities.user_id`, coluna que não existe** — metas do tipo "Atividades" estão quebradas em produção. Resquício do rename `user_id → workspace_id`. Confirmado ao vivo.
- **`deal_history` não tem coluna de autor** (`contact_history` e `company_history` têm `actor_user_id`). Por isso o histórico do negócio mostra só a data — não dava para atribuir sem inventar.
- **`/api/v1/activities` aceita `assigneeId: ""`** e grava string vazia em coluna `uuid`. Mesmo buraco que foi fechado no fluxo interno, ainda aberto na API pública.
- **Drift de migration**: a policy viva de `whatsapp_conversations` vem de `phase1_multitenancy`, que não tem `.sql` no repositório. Já causou uma conclusão errada durante esta própria execução — quem lê só o repositório tira conclusão errada sobre a RLS.
- **Atividade órfã** (atribuída a alguém num negócio de outro dono) tem cantos ásperos: anexo fica stale até reload, não dispara notificação de vencida, e a leitura direta não pagina.
- **`sync_my_member_identity` não valida `p_name` vazio** no servidor; hoje o cliente faz `trim` antes.
