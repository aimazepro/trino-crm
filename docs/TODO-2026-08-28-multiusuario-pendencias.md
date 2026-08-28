# Pendências pós-individualização multiusuário

**Contexto para quem pega isto sem histórico:** a branch
`feat/multiusuario-individualizacao` alinhou a interface do CRM à RLS
multiusuário que o banco já tinha. Está **deployada em produção** e **não
mergeada na `main`** — produção roda a branch de propósito, para que um rollback
no Vercel não exija desfazer nada no git.

**Estado em 2026-08-28:** P0, P1 e P2 estão **fechados, provados e commitados**,
mas **não deployados** — produção ainda roda o código anterior a eles. As
migrations do P0 e do P1 **já estão aplicadas em produção** (são aditivas e de
permissão; o código antigo funciona com o banco novo) e o **P2 não precisou de
migration nenhuma**. Falta P3, P4 e P5.

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

# ~~P2 — Matriz de permissões por papel~~ FEITO (sem migration)

A matriz está em `src/lib/permissions.ts`, aplicada com `<RequireCapability>`
nas telas e com filtro por capacidade nos dois menus. **Nenhuma migration foi
necessária** — e é esse o registro que vale para o P3 em diante.

**A varredura primeiro, do jeito que o P1 mandou.** Uma query só em
`pg_class`/`pg_policy` com `relrowsecurity` e o `pg_get_expr` de
insert/update/delete das 13 tabelas por trás dessas telas. Resultado: **todas**
já exigiam `is_ws_manager()` para escrever — `custom_fields`,
`custom_field_groups`, `products`, `loss_reasons`, `delete_reasons`,
`activity_types`, `sequences` e `sequence_steps` (esta via `EXISTS` na sequência
dona). Não havia meio caminho: era o caso de `automations` repetido oito vezes.

Provado ao vivo como a Ana (`set local role authenticated` +
`request.jwt.claims`, tudo em transação com `rollback`): os oito inserts voltam
`sqlstate=42501 new row violates row-level security policy`, e o mesmo insert
como admin passa — o contraste é o que garante que não era payload inválido.

Capacidades criadas, todas `["admin", "gerente"]`: `gerenciar_campos`,
`gerenciar_produtos`, `gerenciar_motivos_perda`, `gerenciar_motivos_exclusao`,
`gerenciar_tipos_atividade`, `mesclar_duplicatas`, `gerenciar_sequencias`.

Duas coisas que a tabela original não previa:

- **Duplicatas não tem tabela própria.** A tela lê contatos/empresas e a mescla
  termina em `deleteContact`/`deleteCompany`. O `delete` de `contacts` e
  `companies` exige `is_ws_manager()`, mas o `update` **não** (de propósito —
  vendedor edita contato em outras telas). Sem gate o vendedor mesclava pela
  metade: os dados se juntavam e a duplicata continuava lá.
- **Recusa de `update`/`delete` não levanta erro.** A RLS filtra as linhas pelo
  `USING`, então volta "0 linhas afetadas", não `42501` — só o `insert` estoura.
  Vale para quem for provar gate novo: com a tabela vazia, "0 linhas" não
  distingue recusa de nada-para-recusar. A prova de produtos teve que semear uma
  linha como admin dentro da própria transação (o catálogo está vazio em
  produção): a Ana **vê 1**, atualiza **0**, apaga **0**, e o admin atualiza
  **1**.

**Compartilhamento de sequência não funciona** — era o que o item pedia para
verificar. A tabela `sequences` não tem coluna `sharing` nem `user_id`: a opção
é gravada como uma string `sharing:WORKSPACE` dentro do array `tags`, e **nada
lê isso para decidir visibilidade**. A RLS de select é do workspace inteiro e
nenhum leitor filtra pela tag (nem `src/components/deal/activity-tab.tsx`, que é
quem aplica sequência num negócio). Ou seja: toda sequência é visível para todo
mundo do workspace, escolha o que escolher no modal. "Usuários específicos" é
pior ainda — não existe lugar nenhum guardando *quais* usuários. O modal está
fechado para vendedor agora, mas continua mentindo para admin e gerente; a
correção está no P4.

---

# P3 — Features pedidas  ← COMECE POR AQUI

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
- **Compartilhamento de sequência é decoração** (achado no P2). O modal grava
  `sharing:ONLY_ME|SPECIFIC_USERS|WORKSPACE` como string no array `tags` de
  `sequences` e nenhum leitor filtra por isso — toda sequência é visível para
  todo o workspace independentemente da escolha, e "Usuários específicos" não
  guarda *quais* usuários em lugar nenhum. Fechado para vendedor no P2; para
  admin e gerente o controle continua prometendo o que não entrega. Consertar é
  feature, não gate: precisa de coluna de dono em `sequences`, uma tabela de
  compartilhamento para o caso "específicos", e a RLS de select passar a
  respeitar as duas. Enquanto isso não existir, o honesto é tirar o modal.
- **`sequence_enrollments` nunca grava** (achado no P2; a tabela tem 0 linhas em
  produção). Duas causas somadas: a RLS tem policy de `select` e **nenhuma** de
  insert/update/delete, e `src/lib/sequence-helpers.ts:215` insere sem
  `workspace_id`. O `try/catch` em volta não pega nada — o supabase-js devolve
  `{ error }` em vez de lançar, então é mais um erro descartado da mesma família
  do P1. Só a fila do motor (`/api/automations/sequences`, com service role)
  escreve ali, e ela só drena o que nunca foi inserido.
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

**Acrescentado pelo P2, ainda não clicado.** Como Ana, em Configurações:
- Campos de dados, Motivos de Perda, Motivos de Exclusão, Tipos de Atividade,
  Duplicatas e Sequências **somem do menu da esquerda**, e cada uma dessas URLs
  digitada na barra mostra "Sem acesso".
- **Produtos continua no menu e abre** — a lista aparece, mas sem "Novo
  Produto", sem "Criar primeiro produto" e sem os ícones de editar/excluir na
  linha.
- O que a Ana ainda tem que conseguir fazer, porque só lê essas tabelas: marcar
  motivo ao perder um negócio, escolher motivo ao excluir, criar atividade
  escolhendo o tipo, ver os campos personalizados no negócio e **aplicar** uma
  sequência pela aba de atividades.
- Importar um CSV de ponta a ponta (estava quebrado em produção, nunca foi testado depois da correção).

## Deploy e merge na `main`

**Produção ainda não tem P0 nem P1.** Deploy neste projeto é manual:
`vercel deploy --prod`. `git push` não deploya.

`main` está atrás e **produção roda a branch**. Depois de validar, mergear. Se
algo estiver quebrado, o rollback é promover o deploy anterior no Vercel — as
migrations não voltam, mas são aditivas, então o código antigo funciona com o
banco novo.
