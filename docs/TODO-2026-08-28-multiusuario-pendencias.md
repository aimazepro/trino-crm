# Pendências pós-individualização multiusuário

**Contexto para quem pega isto sem histórico:** a branch
`feat/multiusuario-individualizacao` alinhou a interface do CRM à RLS
multiusuário que o banco já tinha. Está **deployada em produção** e **não
mergeada na `main`** — produção roda a branch de propósito, para que um rollback
no Vercel não exija desfazer nada no git.

**Estado em 2026-08-28:** P0 e P1 estão **fechados, provados e commitados**
(`f5f00f7` e `74117bd`), mas **não deployados** — produção ainda roda o código
anterior a esses dois commits. As migrations desses commits **já estão
aplicadas em produção** (são aditivas e de permissão; o código antigo funciona
com o banco novo). Falta P2, P3, P4 e P5.

Leia antes de mexer:
- [docs/HANDOFF-2026-08-28-multiusuario.md](HANDOFF-2026-08-28-multiusuario.md) — o que foi feito, migrations aplicadas, backlog gerado
- [docs/superpowers/specs/2026-08-26-multiusuario-individualizacao-design.md](superpowers/specs/2026-08-26-multiusuario-individualizacao-design.md) — as decisões e o porquê
- Projeto Supabase: `etdkzpiehoivrviylemd`. Migrations vão direto para produção (org no plano gratuito, sem branch de banco). **Não existe framework de teste no repositório — não introduza um.** Verificação = asserção SQL em transação com rollback, `npx tsc --noEmit`, `npm run build`.
- Ids reais do workspace `5e0c7833-819c-4f39-8864-12ab0fb17093`: João Reis (admin) `5e0c7833-819c-4f39-8864-12ab0fb17093`; joao@pixeo.com.br (admin) `29a555c8-dad7-4d77-ab5e-cc2f59ba8261`; Ana Clara (vendedor) `0c68aa6d-be0c-468d-9a7d-fed10ace1887`.
- Kit pronto: `useTeam()` em `src/hooks/use-team.ts` → `{ members, map, avatars, self, isManager, loading }`; `<OwnerBadge>`, `<OwnerSelect>`, `<OwnerFilterSelect>`, `<ScopeToggle>` em `src/components/team/`.
- Padrão da casa: **comparar sempre por id, nunca por nome.**
- Padrão da casa 2: **gate em duas camadas.** Esconder no cliente E recusar no servidor (RLS ou rota). Gate só de UI é contornável pelo devtools — foi assim que o QR do WhatsApp vazou nesta branch.

---

# ~~P0 — Segurança~~ FEITO (commit `f5f00f7`)

Fechadas **10** funções `security definer` executáveis pela chave anônima
(o levantamento original dizia 8). Não repita este trabalho; o registro fica
aqui só para quem precisar entender o padrão.

O que a varredura ensinou, e vale para qualquer função nova:

- Havia **duas** causas, e é por isso que `revoke all ... from public` sozinho
  nunca resolveu. (a) grant explícito `anon=X/postgres`, que o Supabase concede
  via `ALTER DEFAULT PRIVILEGES` no `CREATE FUNCTION` e sobrevive ao revoke de
  PUBLIC, que é outro papel. (b) grant ao pseudo-papel PUBLIC (`=X/postgres`),
  herdado pelo `anon`.
- **Varra o `proacl`, não a lista.** `find_contact_by_phone` estava aberta e não
  estava em lista nenhuma.
- **Confira a assinatura antes**: `select to_regprocedure('public.f(uuid, text)')`.
  Assinatura errada é revoke que não pega.
- As 6 funções de gatilho com `anon=X` ficaram de propósito: são `returns
  trigger`, o Postgres recusa invocação direta, e o EXECUTE delas é cobrado no
  `CREATE TRIGGER` — revogar não protegeria nada e quebraria quem recriasse um
  gatilho.
- **Todo `drop function` desfaz o revoke.** Refaça na mesma migration (ver
  `20260828100200`, que teve que refazer o de `find_contact_by_phone`).

---

# ~~P1 — Bugs reportados em produção~~ FEITO (commit `74117bd`)

Os quatro bugs, mais três da mesma família achados no caminho. Duas correções
mudaram a premissa do que estava escrito aqui — vale ler antes do P2:

- **Automações: o banco nunca deixou.** A RLS de `automations` já exigia
  `is_ws_manager()`; um insert como a Ana volta `42501 new row violates
  row-level security policy`. O buraco era só de UI (tela abria inteira) e o
  contexto **descartava o erro**, então salvar não fazia nada e não dizia nada.
  **Consequência direta para o P2: confira a RLS de cada tabela ANTES de
  escrever migration.** Metade do trabalho pode já estar feita.
- **Os totais por etapa do kanban já estavam certos** — só o cabeçalho e as
  contagens do dropdown ignoravam o filtro. O predicado virou
  `src/lib/deal-scope.ts` e os três consomem ele.
- **Contato órfão não era do papel vendedor.** `addContact`/`addCompany` nunca
  gravaram `owner_id`, para ninguém. Corrigido + backfill (contatos sem dono
  4 → 0; empresas 3 → 2, as duas restantes sem candidato válido).

Achados no caminho, já corrigidos: `find_contact_by_phone` quebrada desde o
rename (`42703`, invisível porque `linking.ts` descartava o erro — o vínculo de
conversa do WhatsApp com contato/negócio nunca funcionou); `/api/import/csv`
gravava `user_id` nas três inserções (import de CSV falhava linha a linha);
`recordOwner` da importação era forjável.

---

# P2 — Matriz de permissões por papel  ← COMECE POR AQUI

A base já existe, criada no P1. **Estenda, não invente um segundo mecanismo:**

- `src/lib/permissions.ts` — mapa `Capability → Role[]` e `can(role, cap)`.
  Sem `"use client"` de propósito, igual a `src/lib/workspace-context.ts`: serve
  cliente e servidor. Hoje tem uma capacidade só (`gerenciar_automacoes`).
- `src/components/auth/require-capability.tsx` — `<RequireCapability>`, o gate
  de cliente. Usa `useWorkspaceInfo()` (não estoura durante o carregamento) e
  não pisca "sem acesso" para quem tem acesso.
- Exemplo aplicado de ponta a ponta em `/automacoes`: lista, construtor
  (`/automacoes/nova` seguia aberta por URL direta sem isso) e item do menu em
  `src/components/layout/sidebar.tsx`.

A coluna `workspace_members.permissions` **existe e continua ignorada**. Quando
for usada, este mapa vira o padrão por papel e ela vira a exceção por pessoa —
não o contrário.

O usuário quer que **vendedor não tenha acesso** a:

| Tela | Regra pedida |
|---|---|
| Campos de dados (`/configuracoes/campos`) | sem acesso |
| Produtos (`/configuracoes/produtos`) | **só leitura** — vê, não adiciona |
| Motivos de perda (`/configuracoes/motivos-perda`) | sem acesso |
| Motivos de exclusão (`/configuracoes/motivos-exclusao`) | sem acesso |
| Tipos de atividade (`/configuracoes/tipos-atividade`) | sem acesso |
| Duplicatas (`/configuracoes/duplicatas`) | sem acesso |
| ~~Automações (`/automacoes`)~~ | feito no P1 |
| Sequências (`/configuracoes/sequencias`) | admin/gerente cria e **compartilha**; **verificar se o compartilhamento funciona de fato** |

**Ordem que economiza trabalho:** primeiro rode uma query só, para todas as
tabelas de uma vez, vendo `relrowsecurity` e as policies de insert/update/delete
(`pg_policy`, `pg_get_expr(polqual/polwithcheck)`). O que já exigir
`is_ws_manager()` não precisa de migration — precisa só do gate de cliente.
`automations`, `automation_labels` e `sequences` já exigiam. `custom_fields`,
`products`, `loss_reasons` e `activity_types` têm 4 policies cada, mas o
conteúdo delas não foi conferido.

Note que "só leitura" (produtos) não é o mesmo gate de "sem acesso": ali o
`<RequireCapability>` não serve na tela inteira, tem que gatear os botões de
escrita.

---

# P3 — Features pedidas

## Placar do time em "Meu Painel"

O componente já existe e está montado em Insights:
`src/app/insights/team-scoreboard.tsx`, alimentado pela RPC `team_scoreboard`
(agregada, visível para todos os papéis).

Montar em `src/app/page.tsx`, **logo abaixo de "Ações rápidas"**. É reuso, não
código novo — cuidar só de passar `periodStart`/`periodEnd` coerentes com o
período da tela.

## Filtro por vendedor em "Meu Painel"

Para **admin e gerente**: poder ver "todos" ou cada vendedor individualmente.
Vendedor não vê o seletor (já enxerga só a própria carteira pela RLS).

Use `<OwnerFilterSelect>` gateado por `isManager`, no padrão que
`src/app/negocios/page.tsx` já usa. Comparar por id. E cuidado com o defeito que
o P1 corrigiu em Negócios: **todos** os KPIs do painel precisam respeitar o
filtro, não só alguns. Se der para reusar `src/lib/deal-scope.ts`, reuse — o
ponto daquele arquivo é não haver dois predicados.

---

# P4 — Backlog técnico herdado

- **`src/lib/goals-helpers.ts:62`** seleciona `activities.user_id`, coluna que **não existe** (é `assignee_id`). Metas do tipo "Atividades" estão quebradas em produção agora. Resquício do rename `user_id → workspace_id`. Confirmado ao vivo. **É o último caso conhecido desse rename** — os outros dois (`find_contact_by_phone` e `/api/import/csv`) caíram no P1. Uma varredura de `pg_proc` por corpo citando `user_id` não achou mais nada no banco; o que sobra é código TypeScript.
- **`deal_history` não tem coluna de autor** (`contact_history` e `company_history` têm `actor_user_id`). Por isso o histórico do negócio mostra só a data. Precisa migration + passar o autor em quem escreve na tabela. O histórico velho fica sem autor para sempre. (O backfill de dono do P1 usou justamente `contact_history.actor_user_id`; sem o equivalente em `deal_history`, negócio órfão não teria como ser resolvido do mesmo jeito.)
- **`/api/v1/activities`** (POST e PATCH) aceita `assigneeId: ""` e grava string vazia em coluna `uuid`. `if (body.assigneeId)` é falso para `""`, então pula a checagem de membership. Mesmo buraco já fechado no fluxo interno e, no P1, no `recordOwner` de `/api/import/csv`.
- **Drift de migration:** a policy viva de `whatsapp_conversations` vem de `phase1_multitenancy`, que **não tem `.sql` no repositório**. Já fez um revisor tirar conclusão errada sobre a RLS. Vale uma migration puramente documental com o `CREATE POLICY` vivo. (Vale notar que os nomes de arquivo em `supabase/migrations/` **não batem** com as versões em `supabase_migrations.schema_migrations` — o MCP gera o próprio timestamp ao aplicar. O drift é antigo e cosmético, mas confunde quem procura.)
- **Atividade órfã** (atribuída a alguém num negócio de outro dono) tem cantos ásperos: anexo fica stale até reload; não dispara notificação de vencida; a leitura direta em `crm-loader.ts` não pagina.
- **`sync_my_member_identity`** não valida `p_name` vazio no servidor (hoje o cliente faz `trim` antes).
- **Empresas sem dono:** 2 sobraram após o backfill do P1, por não terem histórico nem negócio. Se aparecerem na tela como órfãs e incomodar, a decisão é de produto (atribuir ao admin? deixar?), não técnica.

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

**Acrescentado pelo P1, ainda não clicado:**
- Filtrando `/negocios` por um vendedor, o cabeçalho, os cards, os totais por etapa e as contagens do dropdown de pipeline têm que mostrar **o mesmo número**.
- Contato criado agora nasce com dono — conferir na tela, com as duas contas.
- Como Ana: `/automacoes` mostra "Sem acesso", o item some do menu, e `/automacoes/nova` digitada na barra também recusa.
- Editar um script em `/configuracoes/scripts-ligacao` e recarregar a página.
- Importar um CSV de ponta a ponta (estava quebrado em produção, nunca foi testado depois da correção).

## Deploy e merge na `main`

**Produção ainda não tem P0 nem P1.** Deploy neste projeto é manual:
`vercel deploy --prod`. `git push` não deploya.

`main` está atrás e **produção roda a branch**. Depois de validar, mergear. Se
algo estiver quebrado, o rollback é promover o deploy anterior no Vercel — as
migrations não voltam, mas são aditivas, então o código antigo funciona com o
banco novo.
