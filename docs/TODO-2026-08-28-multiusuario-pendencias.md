# Pendências pós-individualização multiusuário

**Contexto para quem pega isto sem histórico:** a branch
`feat/multiusuario-individualizacao` alinhou a interface do CRM à RLS
multiusuário que o banco já tinha. Está **deployada em produção** e **não
mergeada na `main`** — produção roda a branch de propósito, para que um rollback
no Vercel não exija desfazer nada no git.

**Estado em 2026-08-28:** P0, P1, P2, P3 e P4 estão **fechados, provados e
commitados**, mas **não deployados** — produção ainda roda o código anterior a
eles. As migrations do P0, do P1 e do P4 **já estão aplicadas em produção**; o
**P2 e o P3 não precisaram de migration nenhuma**. Falta só o P5.

⚠️ **Uma migration do P4 muda comportamento antes do deploy.** A RLS de
`sequences` passou a respeitar o compartilhamento, e a única sequência de
produção (`teste`, tag `sharing:ONLY_ME`) virou "Só eu" do João — a Ana deixou
de vê-la na aba de atividades **já**, com o código antigo no ar. É o
comportamento pedido, e a sequência é de teste, mas está aqui para não
surpreender.

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

# ~~P3 — Features pedidas~~ FEITO (sem migration)

Placar do time e filtro por vendedor montados em "Meu Painel"
([src/app/page.tsx](../src/app/page.tsx)). O levantamento estava certo: **não
era só reuso**. A tela ganhou período, e os agregados que diziam "no Mês"
pararam de somar o histórico inteiro.

**Decisões de produto tomadas antes de codar:**

- **Seletor de período igual ao de Insights**, não mês corrente fixo. As mesmas
  seis opções, e a *chave* passada a `periodToRange` continua sem acento
  (`"Este mes"`) — o `PERIODS` do painel guarda chave e rótulo separados
  justamente porque a chave é contrato da função e o rótulo é tela.
- **Todos os agregados de fechamento passaram a respeitar o período.** Ganhos,
  Perdidos e o bloco que dizia "Este Mês" agora contam por *data de
  fechamento*. "Total em Pipeline" ficou de fora de propósito: negócio aberto
  não fechou, e filtrá-lo por data de fechamento zeraria o card.

**Uma definição mudou, e é a que mais surpreende:** a **taxa de conversão** era
`ganhos / todos os negócios de todo o tempo`. Com período, isso viraria
numerador recortado sobre denominador do sempre — uma taxa que só cai conforme
a base cresce. Agora é `ganhos / (ganhos + perdidos) no período`, e o rótulo
diz "dos fechados no período".

**Onde mora "quando o negócio fechou".** `dealClosedAt` era privado de
`src/app/insights/report-types/filters.ts`. Passou para
[src/lib/deal-scope.ts](../src/lib/deal-scope.ts) e o `filters.ts` importa de
lá — duas telas perguntando a mesma coisa com duas definições é exatamente o
defeito que aquele arquivo existe para evitar. O `DealScope` ganhou
`closedFrom`/`closedTo`, com limite superior **aberto** (`t < closedTo`), igual
ao que `periodToRange` devolve.

**Os 6 pontos de agregação, todos migrados** para `scopedDeals`/
`matchesDealScope`/`sumDealValues`: a base `deals`, `stats`,
`pipelineStageData`, `PipelineDrawerContent` (inclusive o sub-filtro por
etapa), `StageDrawerContent`, e os drawers de ganhos/perdidos que consomem
`stats`. Não sobrou nenhum `deals.filter(...)` inline na tela.

**Correção ao que estava escrito aqui:** o item mandava usar
`<OwnerFilterSelect>` "no padrão que `/negocios` já usa". `/negocios` usa
`<OwnerSelect allowUnassigned unassignedLabel="Todos os vendedores">` —
`<OwnerFilterSelect>` é o de Contatos/Empresas, com "Sem dono" e outro visual.
O painel seguiu o que `/negocios` faz de verdade.

**O placar não responde ao filtro por vendedor**, e é de propósito: a RPC
`team_scoreboard` é agregada e tem escopo próprio (mostra o time inteiro para
todo papel). Só o período é compartilhado com o resto da tela.

**Atividades ficaram fora do período** — "Atividades Hoje" é hoje; trocar para
"Mês passado" não deveria mexer nelas. Fica registrado o que o levantamento
apontou e continua valendo: `todayPending`/`todayAll` saem de
`deals.flatMap(d => d.activities)`, então atividade herda o escopo do negócio
dono. Atividade atribuída a alguém num negócio de outro não aparece para ela
aqui — é o caso "atividade órfã" do P4, e não foi resolvido no P3.

**Provas** (`npx tsc --noEmit` limpo; `npm run build` compila — o único warning
é o do `next.config.ts`/NFT, que já existia antes da mudança, conferido com
`git stash`):

- `team_scoreboard` é `security definer` com ACL
  `{postgres=X,authenticated=X,service_role=X}` — **sem `anon`**, coerente com
  o P0. Assinatura `(period_start date, period_end date)`, igual ao que o
  componente passa.
- Como a Ana (`set local role authenticated` + `request.jwt.claims`, em
  transação com `rollback`): enxerga **2** negócios de **1** dono, e o placar
  responde **2 linhas** — ou seja, o vendedor vê o comparativo do time inteiro
  mesmo com a carteira estreita. É esse contraste que prova que montar o placar
  para todo papel funciona.
- Como o admin, na mesma prova: **4** negócios de **2** donos, dos quais **2**
  são da Ana. O 2 da Ana não era "tabela vazia".
- Números esperados na tela hoje (produção, 2026-08-28): admin com "Todos os
  vendedores" → Pipeline **R$ 10.650**, 4 abertos; admin filtrando a Ana →
  **R$ 5.500**, 2 abertos, **o mesmo que a Ana vê logada**. Ganhos **R$ 0** e
  conversão **0%** em qualquer período, porque **não existe negócio Ganho nem
  Perdido em produção** — o que também explica por que o card "Ganhos no Mês"
  mentia sem ninguém notar: ele somava um histórico vazio.

# ~~P4 — Backlog técnico herdado~~ FEITO (commit `686e5cc` + este)

Quatro migrations aplicadas em produção, todas com dry-run em transação com
`rollback` antes. Item a item:

## Metas do tipo "Atividades" — eram 4 pontos, não 1

O item dizia `goals-helpers.ts:62`. Eram **quatro** referências à coluna
`user_id`, e a varredura mostrou que **nem `activities` nem `deals`** têm essa
coluna: `42703 column "user_id" does not exist` nas duas, com `assignee_id` e
`owner_id` existindo no mesmo lote de prova. As metas de negócio estavam tão
quebradas quanto as de atividade — o item só tinha visto metade.

O agravante é o de sempre: `const { data: rows } = await q` descartava o erro,
então a meta ficava zerada. **Meta zerada parece meta não batida, não parece
defeito** — por isso ninguém reportou em meses. `fetchGoalProgress` agora
devolve `error` e os três chamadores registram.

## `/api/v1/activities` — o doc descrevia o sintoma errado

Dizia "grava string vazia em coluna uuid". Não grava: o Postgres recusa com
`22P02 invalid input syntax for type uuid: ""` (provado, com `null` e um uuid
real aceitos no mesmo lote). O efeito real era **500 numa entrada que merecia
400**.

`readOptionalUuid` em `src/lib/api-auth.ts` distingue os três estados que
importam, e o PATCH tirou `assigneeId` do laço genérico porque lá eles não são
equivalentes: **chave ausente** não mexe no responsável, **null** desatribui, e
**qualquer outra coisa fora do formato uuid** vira erro de validação — nunca um
silencioso "sem responsável".

## Compartilhamento de sequência — implementado de verdade

Decisão do usuário: implementar os três modos, não tirar o modal.

`sequences` ganhou `owner_id` e `sharing` como colunas, existe
`sequence_shares`, e a RLS de select passou a respeitar as duas. A tag
`sharing:` saiu da gravação e do backfill — manter as duas fontes seria repetir
o defeito com a chance extra de discordarem.

**Sem bypass de gerente, de propósito.** "Apenas você vê e usa este template"
tem que ser literal; um admin que enxergasse tudo faria a opção voltar a
mentir, que é o defeito de origem.

**A recursão que quase passou batido:** a policy de `sequences` consulta
`sequence_shares`. Se as policies de `sequence_shares` consultassem `sequences`
de volta, o Postgres recusaria a query inteira com *"infinite recursion
detected in policy for relation"*. `is_sequence_owner()` (`security definer`)
quebra o ciclo — criada já com o `revoke` de `anon` que o P0 ensinou, e
conferida depois: ACL `{postgres=X, authenticated=X, service_role=X}`.

**Backfill:** dono = admin mais antigo do workspace (`workspace_members` não
tem `created_at`; usa `invited_at`). Modo = a tag quando existe, `WORKSPACE`
quando não — assumir `ONLY_ME` faria sumir sequência que a equipe já usa. Em
produção havia **1** sequência, `teste`, tag `ONLY_ME`, e o dono inferido é o
próprio João, então respeitar a tag não teve risco.

Provado ao vivo, cada linha com contraste:

| cenário | Ana enxerga |
|---|---|
| `ONLY_ME` | **0** (e o João, dono, **1**) |
| `WORKSPACE` | **1** |
| `SPECIFIC_USERS` sem share | **0** |
| `SPECIFIC_USERS` com share | **1** |

Os `sequence_steps` acompanham (**1**), porque a policy deles é um `EXISTS` na
sequência dona e passa pela RLS dela.

## `sequence_enrollments` — as duas causas confirmadas

A varredura confirmou: RLS ligada, **só** policy de `select`, nenhuma de
escrita. Ganhou as três, com o mesmo predicado de `deal_history`. Provado como
a Ana: inscrever negócio **dela** passa, negócio **do João** volta
`42501 new row violates row-level security policy`.

Do lado TS, `sequence-helpers.ts` inseria sem `workspace_id` dentro de um
`try/catch` que não pegava nada — o supabase-js devolve `{ error }` em vez de
lançar. Corrigidos os dois.

## `deal_history` ganhou autor

Coluna `actor_user_id`, **sem backfill**: o histórico velho não tem de onde
tirar o autor, e preencher com o admin inventaria justamente a informação que a
coluna existe para registrar. Nulo também nas entradas do motor de automações,
que não têm pessoa por trás.

Os 9 escritores com usuário passaram a carimbar: 6 em `use-crm-mutations.ts`,
`gmail/send`, `gmail/sync` e `import/csv` (autoria é quem apertou o botão, não
o `ownerId` escolhido no formulário). A tela mostra `data · autor` quando existe
e **só a data** quando não — nunca inventa autoria, que é o defeito que já
tinha aparecido quando se carimbava com `selfName`.

## `sync_my_member_identity` — nome vazio

`coalesce(p_name, name)` não protege de `''`: gravava nome em branco e devolvia
1, como se tivesse sincronizado. A regra ficou igual à do avatar, que a própria
função já aplicava: valor fornecido e reprovado devolve **0**. Provado: `""` e
`"   "` devolvem 0 com o nome intacto, `"Ana X"` devolve 1 e grava.

`create or replace`, nunca `drop` + `create` — **todo `drop function` desfaz o
revoke de `anon` do P0**. Conferido depois de aplicar: ACL sem `anon`.

## Drift de migration — resolvido por transcrição

`20260828100800` transcreve as policies vivas de `whatsapp_conversations` (as
de `phase1_multitenancy`, que não tem `.sql` aqui). **Provado no-op antes de
aplicar**: as quatro policies saem `IDENTICA` na comparação de `pg_get_expr`
antes/depois.

## Empresas sem dono — decisão tomada

Ficam sem dono. `owner_id` nulo é estado válido, o filtro já tem o caso "Sem
dono" e a RLS de `companies` não usa dono para escrita.

## Atividade órfã — os três cantos ásperos, fechados

Os três tinham a **mesma causa**: a órfã não mora em `state.deals`, mora na
lista à parte `orphanActivities` (e é assim de propósito — stub em `deals` já
foi tentado e vazou para KPI, forecast, export CSV e virou link morto em
`/negocios/[id]`). Cada lugar que varre atividade percorrendo `deals` a perde.

- **Anexo stale até reload.** `addActivityAttachment` e
  `deleteActivityAttachment` mexiam só em `prev.deals[].activities`. O anexo ia
  para o banco e a tela da órfã não mudava. O que confirma o diagnóstico é que
  `updateActivity` e `deleteActivity` **já tratavam** `orphanActivities` —
  alguém passou por ali e cobriu duas das quatro. Mesma família do defeito que
  o P1 corrigiu em Negócios: o vizinho coberto, este esquecido.
- **Sem notificação de vencida.** O laço de `checkDueActivities` era
  `for (deal of state.deals) for (activity of deal.activities)`. A pessoa nunca
  era avisada de uma tarefa **dela** vencer. Agora as duas fontes entram numa
  lista só. O `dealId` passou a sair da própria atividade para a chave de
  deduplicação continuar **idêntica** à que já está no `localStorage` — mudá-la
  re-notificaria todo o histórico de uma vez.
- **A leitura não paginava.** `crm-loader.ts` ganhou `.order` + `.range(0, 499)`
  explícitos. Continua sem paginar de verdade — é o mesmo teto de contatos e
  empresas — mas o corte virou determinístico (as mais recentes) em vez do
  limite default silencioso do PostgREST, onde *qual* atividade caía fora era
  imprevisível.

Achado no caminho, corrigido junto: o efeito de `checkDueActivities` dependia
só de `state.deals`, então o `setInterval` fechava sobre a lista do render em
que nasceu. Hoje as duas listas mudam no mesmo `setState` do `load()`, mas
depender disso é frágil — `state.orphanActivities` entrou nas dependências.

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

**Acrescentado pelo P3, ainda não clicado.** Em "Meu Painel":
- Como admin: trocar o período muda Ganhos, Perdidos e a taxa de conversão, e
  **não** muda "Total em Pipeline" nem "Atividades Hoje".
- Como admin, filtrando pela Ana: Pipeline **R$ 5.500 / 2 abertos**, e os
  mesmos 2 aparecem em "Negócios por Etapa" e nos drawers. Logar como Ana tem
  que dar **o mesmo número** — é o cruzamento que pega o defeito do P1.
- Como Ana: **não** existe seletor de vendedor, mas o **placar do time
  aparece** com as duas pessoas.
- O placar não muda ao trocar o vendedor no filtro (é agregado do time), mas
  **muda** ao trocar o período.

**Acrescentado pelo P4, ainda não clicado:**
- Uma meta do tipo "Atividades" com dono definido mostra progresso > 0 quando a
  pessoa tem atividade concluída no período (estava sempre em 0).
- Em Sequências, como João: marcar "Só eu" e conferir que a Ana não vê a
  sequência na aba de atividades de um negócio; marcar "Usuários específicos" +
  Ana e conferir que volta a aparecer; marcar "Todo o workspace" e conferir que
  aparece sem share nenhum.
- Aplicar uma sequência num negócio e conferir que `sequence_enrollments` passa
  a ter linha (antes era sempre zero).
- Histórico do negócio: uma ação nova mostra `data · nome`; as linhas antigas
  seguem só com a data.
- Em Perfil, tentar salvar o nome vazio — o servidor recusa mesmo se o `trim`
  do cliente for contornado.
- **Atividade órfã** (como Ana, numa atividade atribuída a ela dentro de um
  negócio do João): anexar arquivo e ver o anexo aparecer **sem recarregar**;
  remover e ver sumir na hora; e, com a data no passado, receber a notificação
  de vencida.

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

---

# P5 — executado no navegador em 2026-08-28

Primeira vez que estas telas foram clicadas. Duas passadas: **João (admin)** e
**Ana (vendedor)**, no Chrome real do usuário via extensão do Playwright MCP.
O gabarito do banco (4 negócios abertos, R$ 10.650 — Ana 2 / R$ 5.500, João 2 /
R$ 5.150, zero Ganho, zero Perdido) foi conferido antes e restaurado depois.

## O que passou

**João, leitura pura (14 itens):** todos os números da tela bateram com o
gabarito, incluindo os quatro pontos de `/negocios` que o P1 corrigiu.

**Ana, leitura pura (7 itens):** Painel R$ 5.500 / 2 abertos — **o mesmo número
que o admin vê filtrando por ela**, que é o cruzamento que o P1 pedia —, sem
seletor de vendedor e com o placar do time listando as 2 pessoas; `/automacoes`
e `/automacoes/nova` fora do menu e com "Sem acesso"; as seis URLs do P2 fora do
menu e com "Sem acesso" uma a uma; Produtos abre sem nenhum botão de escrita;
Configurações › WhatsApp sem QR e sem desconectar, dizendo "A conexão é
gerenciada pelo administrador"; e o menu Sequências da aba de atividades
mostrando **"Nenhuma sequência encontrada"** — o outro lado do `ONLY_ME`, que
o João vê.

Extras do roteiro do vendedor, também limpos: `/insights` com placar e **sem** o
seletor de usuário que o admin tem; `/forecast` só com seletor de pipeline;
`/ligacoes` com "Ana Clara" fixo e zero das 35 ligações do João; `/metas` com o
Responsável travado num `<span>`; `/conversas` sem aba Time e sem dropdown de
vendedores.

**Escrita, provada em produção:** nome vazio no Perfil recusado pelo servidor
com o `trim` do cliente contornado por `fetch` (`""` e `"   "` devolvem **0**,
nome intacto); contato criado nasce com `owner_id`; assumir conversa da fila
grava (Fila 2 → 0); import de CSV cria **2 contatos** com dono e e-mail — a rota
que o P1 consertou funciona; meta de Atividades mostra **34 de 40 · 85%**, o
mesmo 34 do placar, onde antes do P4 era 0 em silêncio;
`sequence_enrollments` sai de zero (1 inscrição + 1 atividade gerada);
`deal_history` mostra `data · Joao Reis` nas três linhas novas; reatribuição
persiste; perda com motivo grava `loss_reason="Preço"`; e o modal de
compartilhamento grava `SPECIFIC_USERS` + share da Ana, com ela passando a
enxergar **1** sequência (os outros dois modos conferidos por SQL: `WORKSPACE`
sem share → 1, `SPECIFIC_USERS` sem share → 0).

## Cinco defeitos achados, todos **anteriores a esta branch**, todos corrigidos

1. **Metas não tinha gate de UI.** A RLS de `goals` já exigia `is_ws_manager()`
   para insert/update/delete — a varredura do P2 cobriu oito tabelas e passou
   por esta. O vendedor preenchia o assistente inteiro e o insert voltava
   **403**, com `if (!error && data)` sem `else`: modal aberto, nenhuma
   mensagem. É o `automations` do P1 repetido. Agora existe a capacidade
   `gerenciar_metas` (gate nos botões, como `products`, porque o vendedor
   precisa **ver** a meta dele), e tanto criar quanto excluir dizem o que houve.
   O excluir ganhou `.select()`: a RLS recusa devolvendo "0 linhas", e sem isso
   a meta sumia da tela e continuava no banco.
2. **Seletor de responsável da meta sempre vazio.** A consulta filtrava
   `status = "active"`, valor que `workspace_members` nunca teve — o real é
   `accepted`, usado em outros 12 lugares. Gerente nenhum conseguia criar meta
   para outra pessoa. A consulta manual saiu; a lista vem de `useTeam()`.
3. **Criar contato levava a "Contato não encontrado".** `handleCreate` navegava
   com um id local `cont_<timestamp>` e descartava o uuid que `addContact`
   devolve. Os outros quatro chamadores já usavam o retorno.
4. **Import travava com CSV que não fosse o modelo.** A guarda procurava a
   chave literal `"Nome do contato"` num mapa indexado pelo *cabeçalho do
   arquivo*. Agora pergunta o que importa (`algum destino é personName`), e o
   tooltip parou de falar de etapas quando o problema é outro.
5. **Três telas "stale até reload"**, mesma família do anexo da atividade órfã
   do P4: assumir conversa não mexia no estado do inbox (a conversa ficava na
   Fila com o botão ainda oferecido) e o log otimista do histórico nascia sem
   `actorUserId` (a linha só ganhava autor depois de recarregar). Os dois
   corrigidos; o do anexo já tinha sido no P4.

Cosméticos, deixados de fora de propósito: o prefetch de `/dashboard` que volta
404 (rewrite não serve o payload RSC) e os rótulos sem acento em `/insights`.

## O que ficou pendente

- **Excluir negócio com motivo** — o menu ⋯ do negócio fecha entre uma chamada
  e outra do MCP; é um clique manual.
- **Enviar WhatsApp de verdade** — depende de um número seguro combinado.
- **Anexo e notificação em atividade órfã** — exige criar a atividade como João
  e depois **logar como Ana** para ver o anexo aparecer sem recarregar.
