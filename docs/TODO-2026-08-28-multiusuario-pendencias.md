# Pendências pós-individualização multiusuário

**Contexto para quem pega isto sem histórico:** a branch
`feat/multiusuario-individualizacao` (42 commits) alinhou a interface do CRM à
RLS multiusuário que o banco já tinha. Está **deployada em produção** e **não
mergeada na `main`** — produção roda a branch de propósito, para que um rollback
no Vercel não exija desfazer nada no git.

Leia antes de mexer:
- [docs/HANDOFF-2026-08-28-multiusuario.md](HANDOFF-2026-08-28-multiusuario.md) — o que foi feito, migrations aplicadas, backlog gerado
- [docs/superpowers/specs/2026-08-26-multiusuario-individualizacao-design.md](superpowers/specs/2026-08-26-multiusuario-individualizacao-design.md) — as decisões e o porquê
- Projeto Supabase: `etdkzpiehoivrviylemd`. Migrations vão direto para produção (org no plano gratuito, sem branch de banco). **Não existe framework de teste no repositório — não introduza um.** Verificação = asserção SQL em transação com rollback, `npx tsc --noEmit`, `npm run build`.
- Ids reais do workspace `5e0c7833-819c-4f39-8864-12ab0fb17093`: João Reis (admin) `5e0c7833-819c-4f39-8864-12ab0fb17093`; Ana Clara (vendedor) `0c68aa6d-be0c-468d-9a7d-fed10ace1887`.
- Kit pronto: `useTeam()` em `src/hooks/use-team.ts` → `{ members, map, avatars, self, isManager, loading }`; `<OwnerBadge>`, `<OwnerSelect>`, `<OwnerFilterSelect>`, `<ScopeToggle>` em `src/components/team/`.
- Padrão da casa: **comparar sempre por id, nunca por nome.**

---

# P0 — Segurança

## 1. Oito funções `SECURITY DEFINER` executáveis por `anon`

Verificado por execução, não por leitura. Sem login, pela chave anônima pública.

| Função | Risco |
|---|---|
| `telephony_reconcile_stale_calls(interval)` | **Sem filtro de workspace.** Marca como `failed` ligações em andamento de **todos** os workspaces de uma vez |
| `telephony_add_credit(...)` | Mexe em saldo e ledger de qualquer workspace |
| `telephony_start_call(...)` | Insere ligação real de saída e reserva saldo |
| `telephony_finalize_call`, `telephony_attach_provider_call`, `telephony_mark_recording_deleted` | Mesmo padrão |
| `claim_due_sequence_enrollments(p_limit)`, `claim_pending_automation_events(p_limit)` | `UPDATE ... RETURNING *` sem filtro de workspace: vazamento entre inquilinos e linhas presas em `processing` |

Menor: `telephony_current_rate` vaza preço. Inertes: funções de trigger (o Postgres
recusa invocação direta fora de contexto de trigger).

**Causa:** `revoke all ... from public` **não** cobre o `EXECUTE` que o Supabase
concede ao `anon` via `ALTER DEFAULT PRIVILEGES` no `CREATE FUNCTION`. Várias
dessas nunca tiveram revoke nenhum.

**Correção** — migration nova:
```sql
revoke all on function public.telephony_reconcile_stale_calls(interval) from public, anon;
-- idem para as demais, com a assinatura exata de cada uma
```

**Prove depois de aplicar:** `proacl` em `pg_proc` sem `anon`, execução como
`anon` retornando `permission denied`, e `authenticated` ainda funcionando. Esse
mesmo padrão já foi aplicado com sucesso em
`20260827100700_review_round1_rpc_hardening.sql` — use-o como referência.

**Isto também responde à pergunta "workspace novo é isolado?":** pelo app, sim —
toda RLS filtra por `workspace_id IN my_workspace_ids()`, e o isolamento entre
workspaces foi verificado na prática. Por chamada direta à API, estas funções são
o furo, porque recebem `workspace_id` como parâmetro forjável.

---

# P1 — Bugs reportados pelo usuário em produção

## 2. Somatório do pipeline ignora o filtro por vendedor

Filtrando o pipeline por Ana Clara, os cards filtram mas o **somatório do
cabeçalho continua mostrando o total de todos** ("2 negócios · R$ 4.650"), e os
totais por etapa também.

**Provável causa (confirmar):** a Task 13 aplicou `ownerFilter` como `.filter()`
dentro de `src/components/kanban/kanban-board.tsx` e
`kanban-list-view.tsx`, mas os agregados do cabeçalho e do seletor de pipeline são
calculados em `src/app/negocios/page.tsx`, que filtra só por `statusFilter`.

**Correção:** o mesmo `ownerFilter` precisa participar de **todos** os cálculos de
agregado da tela — cabeçalho, contadores por etapa e as contagens do dropdown de
pipeline. Se algum não concordar, a tela mente.

## 3. Contato criado por vendedor fica "sem dono"

Todo contato criado por alguém que não seja o dono do workspace aparece sem
proprietário.

**Quase certamente:** a migration `20260827100400_contact_company_owner.sql`
backfillou `contacts.owner_id` a partir do negócio vivo mais recente — contato sem
negócio ficou nulo. E o caminho de **criação** provavelmente não preenche
`owner_id`: a Task 15 e a leva final adicionaram o mapeamento em `updateContact` e
`updateCompany`, mas confira `addContact`/`addCompany` em
`src/hooks/use-crm-mutations.ts`.

**Correção:** criar contato ou empresa deve gravar `owner_id` = quem criou, do
mesmo jeito que `addDeal` já faz com `owner_id: deal.ownerId || userId`. Rodar um
backfill para os contatos órfãos existentes que tenham criador identificável.

## 4. Vendedor consegue criar automações

Ana Clara, papel `vendedor`, cria automações. Deveria ser só gerente e admin.

Automações nunca entraram no escopo do trabalho de individualização — não há gate
de papel em `/automacoes`. Precisa de gate **no cliente e no servidor** (esconder
o botão não basta; a rota tem que recusar).

## 5. Script de ligação não é editável depois de criado

`/configuracoes/scripts-ligacao` — cria mas não edita. Falta a tela/rota de edição.
Não investigado.

---

# P2 — Matriz de permissões por papel

Hoje o sistema só distingue papel em algumas telas. A coluna
`workspace_members.permissions` **existe e é inteiramente ignorada** — decisão
registrada como fora de escopo no spec original.

O usuário quer que **vendedor não tenha acesso** a:

| Tela | Regra pedida |
|---|---|
| Campos de dados (`/configuracoes/campos`) | sem acesso |
| Produtos (`/configuracoes/produtos`) | **só leitura** — vê, não adiciona |
| Motivos de perda (`/configuracoes/motivos-perda`) | sem acesso |
| Motivos de exclusão (`/configuracoes/motivos-exclusao`) | sem acesso |
| Tipos de atividade (`/configuracoes/tipos-atividade`) | sem acesso |
| Duplicatas (`/configuracoes/duplicatas`) | sem acesso |
| Automações (`/automacoes`) | sem acesso — ver item 4 |
| Sequências (`/configuracoes/sequencias`) | admin/gerente cria e **compartilha**; **verificar se o compartilhamento funciona de fato** |

**Faça em duas camadas, não só uma:** esconder no cliente E recusar no servidor
(RLS ou gate de rota). Um gate só de UI é contornável pelo devtools — foi
exatamente esse o padrão do vazamento de QR que precisou ser corrigido nesta
branch.

Vale considerar fazer isto como um sistema (um helper de permissão por papel
consumido por todas as telas) em vez de oito gates soltos — são oito telas hoje e
vão virar mais.

---

# P3 — Features pedidas

## 6. Placar do time em "Meu Painel"

O componente já existe e está montado em Insights:
`src/app/insights/team-scoreboard.tsx`, alimentado pela RPC `team_scoreboard`
(agregada, visível para todos os papéis).

Montar em `src/app/page.tsx`, **logo abaixo de "Ações rápidas"**. É reuso, não
código novo — cuidar só de passar `periodStart`/`periodEnd` coerentes com o
período da tela.

## 7. Filtro por vendedor em "Meu Painel"

Para **admin e gerente**: poder ver "todos" ou cada vendedor individualmente.
Vendedor não vê o seletor (já enxerga só a própria carteira pela RLS).

Use `<OwnerFilterSelect>` gateado por `isManager`, no padrão que
`src/app/negocios/page.tsx` já usa. Comparar por id. E cuidado com o mesmo defeito
do item 2: **todos** os KPIs do painel precisam respeitar o filtro, não só alguns.

---

# P4 — Backlog técnico herdado

- **`src/lib/goals-helpers.ts:62`** seleciona `activities.user_id`, coluna que **não existe** (é `assignee_id`). Metas do tipo "Atividades" estão quebradas em produção agora. Resquício do rename `user_id → workspace_id`. Confirmado ao vivo.
- **`deal_history` não tem coluna de autor** (`contact_history` e `company_history` têm `actor_user_id`). Por isso o histórico do negócio mostra só a data — não dava para atribuir sem inventar. Precisa migration + passar o autor em quem escreve na tabela. O histórico velho fica sem autor para sempre.
- **`/api/v1/activities`** (POST e PATCH) aceita `assigneeId: ""` e grava string vazia em coluna `uuid`. `if (body.assigneeId)` é falso para `""`, então pula a checagem de membership. Mesmo buraco já fechado no fluxo interno.
- **Drift de migration:** a policy viva de `whatsapp_conversations` vem de `phase1_multitenancy`, que **não tem `.sql` no repositório**. Já fez um revisor tirar conclusão errada sobre a RLS durante este próprio trabalho. Vale uma migration puramente documental com o `CREATE POLICY` vivo.
- **Atividade órfã** (atribuída a alguém num negócio de outro dono) tem cantos ásperos: anexo fica stale até reload; não dispara notificação de vencida; a leitura direta em `crm-loader.ts` não pagina.
- **`sync_my_member_identity`** não valida `p_name` vazio no servidor (hoje o cliente faz `trim` antes).

---

# P5 — Verificação e integração

## Percorrer as telas com as duas contas

**Nada foi clicado em navegador durante a construção** — tudo foi provado por
leitura de código e asserção SQL. Este roteiro nunca foi executado:

**Como admin:** dropdown de vendedores em `/conversas` lista os dois nomes mesmo
sem conversa atribuída; balão mostra o autor certo; reatribuir negócio persiste;
filtro de Atividades encolhe a lista; Placar aparece em Insights.

**Como vendedor:** sem QR nem botão de desconectar em Configurações › WhatsApp;
toggle da própria assinatura funciona; mensagem enviada sai com `*Ana Clara*:`;
aba Fila mostra as conversas órfãs e assumir tira da fila; nenhum seletor de outra
pessoa em Insights, Metas, Forecast e Ligações; Placar do time aparece.

## Merge na `main`

`main` está 42 commits atrás e **produção roda a branch**. Depois de validar,
mergear. Se algo estiver quebrado antes disso, o rollback é promover o deploy
anterior no Vercel — as migrations não voltam, mas são aditivas, então o código
antigo funciona com o banco novo.

**Deploy neste projeto é manual:** `vercel deploy --prod`. `git push` não deploya.
