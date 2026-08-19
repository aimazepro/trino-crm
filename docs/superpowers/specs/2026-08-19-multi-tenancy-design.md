# Fase 1 — Multi-tenancy: design

Data: 2026-08-19. Fonte do item: `docs/BACKLOG.md` § Fase 1. Detalhe de origem: `docs/AUDIT-2026-08-19-saas-deep-dive.md` §6.1, §S-3, §S-6.

## Problema

O CRM é single-tenant disfarçado. A identidade do tenant é o `auth.users.id` do dono,
espalhado como `user_id` em 37 tabelas. `team_members` existe mas está vazia, e como a
conta dona **não tem linha lá**, `is_workspace_member()` sempre retorna `false` — todas as
policies de workspace estão inertes. Papéis (`admin`/`gerente`/`vendedor`) existem na UI e
na coluna, mas nenhuma policy os referencia: são cosméticos.

Isso bloqueia o objetivo declarado de vender como produto.

## Estado medido (2026-08-19)

| | |
|---|---|
| Linhas no banco inteiro | ~600 (13 negócios, 6 contatos, 10 empresas, 134 notificações) |
| Tabelas | 46 |
| Policies | 94 |
| Colunas de posse | 37 (`user_id` × 36 + `team_members.member_user_id`) |
| Contas com dados | 2, ambas do dono, ambas de teste |
| Ocorrências de `user_id` no código | 291 em 60 arquivos (113 em `database.types.ts`, gerado) |
| Org Supabase | plano free, 2 projetos ativos (sem espaço pra staging grátis) |

`workspace_settings` já é a tabela `workspaces` em tudo menos no nome: PK `owner_user_id`,
mais `name`, `slug`, `plan`, `trial_ends_at`. Duas linhas, uma por conta.

## Decisões tomadas

| # | Questão | Decisão |
|---|---|---|
| 1 | As duas contas | **Dois workspaces separados.** Nenhuma fusão, nenhum descarte. |
| 2 | Modelo de permissão | **3 papéis fixos** (`admin`/`gerente`/`vendedor`) aplicados na RLS, mais uma coluna `permissions jsonb` reservada e ignorada, para que a matriz de toggles da UI não seja cara de retrofitar depois. |
| 3 | Convite | **Link copiável, sem email.** Não há infra transacional no projeto e o email nativo do Supabase no free tier é ~2/hora. Combina com a ativação manual que já é o plano até a Fase 6. |
| 4 | Segurança da migração | **`pg_dump` + migração única com asserts embutidos.** Sem staging: branch do Supabase custa ~$10/mês e exige Pro; um 3º projeto free não cabe. |
| 5 | S-1 antes? | **Não.** Segue aberto na Fase 0. Ressalva registrada abaixo. |

### Visibilidade (herdada do audit §6.1, não reaberta)

Vendedor vê só os próprios negócios; admin e gerente veem tudo. Contatos e empresas ficam
compartilhados no workspace. Atividades herdam a visibilidade do negócio pai. As colunas
que sustentam isso já existem: `deals.owner_id`, `whatsapp_conversations.owner_id`,
`goals.owner_user_id`.

### Ressalva registrada

O backlog marca **S-1 como CRÍTICO e anterior a qualquer feature**: a service-role key está
em texto puro dentro de `cron.job.command` e fura a RLS de todas as tabelas de todos os
tenants. Esta fase constrói isolamento por RLS enquanto essa chave existe. O dono optou por
seguir mesmo assim; S-1 permanece na Fase 0.

## Arquitetura

### A ideia central: rename, não backfill

`workspaces.id` recebe o uuid que já está em cada `user_id`. Logo a migração das colunas de
tenant é `ALTER TABLE ... RENAME COLUMN`, com o valor intocado. Nenhum `UPDATE` de linha,
nenhuma reassociação. É isto que rebaixa o "maior risco de perda de dados do projeto"
descrito no audit a uma operação de catálogo.

### Tabelas de identidade

```
workspace_settings          →  workspaces
  owner_user_id (PK)        →    id (PK)                    mesmo uuid
                            +    owner_user_id  FK auth.users   mesmo valor
  name, slug, plan, trial_ends_at, created_at, updated_at   inalterados

team_members                →  workspace_members
  owner_user_id             →    workspace_id   FK workspaces   mesmo valor
  role                      →    role  + CHECK ('admin'|'gerente'|'vendedor')
                            +    permissions jsonb NULL      reservado, ignorado
                            +    invite_token text UNIQUE
                            +    invite_expires_at timestamptz
  member_user_id, email, name, status, invited_at, accepted_at   inalterados
```

Duas correções embutidas:

- **Semeia a linha do dono** em cada workspace (`role='admin'`, `status='accepted'`,
  `member_user_id` = o próprio uuid). Sem isso as policies continuam inertes, como hoje.
- **Normaliza a caixa do papel.** A UI grava `"Vendedor"`; o default do banco é
  `'vendedor'`. Cosmético hoje, acesso quebrado silencioso depois do enforcement.

### Classificação das 37 colunas

**Balde A — tenant (28 tabelas): `user_id` → `workspace_id`, rename puro.**

`activities`, `activity_types`, `api_keys`, `automation_email_queue`, `automation_labels`,
`automation_whatsapp_queue`, `automations`, `companies`, `contacts`, `custom_field_groups`,
`custom_fields`, `deals`, `delete_reasons`, `email_templates`, `goals`, `labels`,
`loss_reasons`, `pipelines`, `products`, `scripts`, `sequence_enrollments`, `sequences`,
`webhook_deliveries`, `webhooks`, `whatsapp_connections`, `whatsapp_conversations`,
`whatsapp_messages`, `whatsapp_templates`

**Balde B — pessoal (5 tabelas): mantém `user_id`, ganha `workspace_id` (backfill = cópia).**

`notifications` (destinatário), `emails` (caixa de quem), `integrations` (token OAuth de
quem), `email_signatures` (assinatura pessoal), `saved_reports`.

Renomear estas seria o erro caro: `notifications.user_id` virando tenant faria toda
notificação do workspace aparecer para todo mundo. Invisível hoje porque não há convidados.

**Balde C — autoria (3 tabelas): `user_id` → `actor_user_id`, tenant vem do pai.**

`contact_history`, `company_history`, `activity_attachments`.

**Balde D — sem coluna de posse (8 tabelas): só reescrever policy.**

`deal_history`, `deal_notes`, `deal_products`, `deal_labels`, `deal_field_values`,
`appointments`, `pipeline_stages`, `sequence_steps`.

## RLS

### Funções auxiliares

Todas `STABLE SECURITY DEFINER SET search_path = 'public'`, chamadas nas policies como
`(select fn(...))` — o padrão de initplan que a migração `phase_a_rls_initplan` já
estabeleceu; sem isso a função roda uma vez por linha.

```
my_workspace_ids()          setof uuid   workspaces onde sou membro accepted
my_role(ws uuid)            text         'admin' | 'gerente' | 'vendedor'
is_ws_admin(ws uuid)        boolean      role = 'admin'
can_see_all_deals(ws uuid)  boolean      role in ('admin','gerente')
```

`EXECUTE` revogado de `anon` nas quatro e nas três antigas (`is_workspace_member`,
`replace_deal_labels`, `replace_deal_products`) — fecha **S-6**.

`is_workspace_member(uuid)` permanece, redefinida para ler `workspace_members`. Os valores
não mudam, então as policies de Storage (buckets `whatsapp-media` e `avatars`, que fazem
`is_workspace_member(foldername(name)[1]::uuid)`) seguem funcionando sem alteração.

### As formas de policy

**1. Negócios** — a única com filtro por dono:

```sql
USING      ( workspace_id in (select my_workspace_ids())
             and ( owner_id = (select auth.uid())
                   or (select can_see_all_deals(workspace_id)) ) )
WITH CHECK ( workspace_id in (select my_workspace_ids()) )
```

`DELETE` restrito a admin; o soft-delete (`deleted_at`) já cobre o caso do vendedor.

**2. Configuração** — leitura pra todo membro, escrita só admin. É o que torna
"Gerente — ver equipe, sem configurações" real:

```sql
SELECT       workspace_id in (select my_workspace_ids())
INS/UPD/DEL  workspace_id in (select my_workspace_ids())
             and (select is_ws_admin(workspace_id))
```

Aplica-se a `pipelines`, `pipeline_stages`, `custom_fields`, `custom_field_groups`,
`automations`, `automation_labels`, `labels`, `products`, `loss_reasons`, `delete_reasons`,
`activity_types`, `email_templates`, `scripts`, `sequences`, `sequence_steps`, `webhooks`,
`api_keys`, `whatsapp_connections`, `whatsapp_templates`.

**3. Compartilhado** — `contacts` e `companies`: todo membro lê, cria e edita; só
admin/gerente apaga.

**4. Pessoal** (balde B) — `workspace_id` casa **e** `user_id = (select auth.uid())`:

- `notifications`, `email_signatures`, `saved_reports` — estritamente do dono.
- `integrations` — **só `user_id = auth.uid()`, sem exceção para admin.** Token OAuth de
  Gmail é da pessoa; admin não lê token de vendedor.
- `emails` — do dono **ou** de quem enxerga o negócio pai.

**5. Herdado** (baldes C e D) — `EXISTS` no pai: `activities`, `deal_notes`, `deal_history`,
`deal_products`, `deal_labels`, `deal_field_values`, `appointments`, `contact_history`,
`company_history`, `activity_attachments`, `whatsapp_messages` (via `whatsapp_conversations`).

**Filas e logs** — `automation_email_queue`, `automation_whatsapp_queue`,
`webhook_deliveries`, `sequence_enrollments`: `SELECT` para membro (fila de automação só
admin), escrita apenas por service role.

### Duas correções que a reescrita carrega

**`WITH CHECK` fixa o `workspace_id`** em todo `UPDATE`. Fecha **S-6**: hoje o `with_check`
permite trocar `user_id` para outro workspace do qual o usuário seja membro — mover dado
entre tenants.

**Derrubar as 6 policies legadas** `"deals: user owns"`, `"contacts: user owns"`,
`"companies: user owns"`, `"activities: user owns"`, `"pipelines: user owns"`,
`"labels: user owns"`.

Isto é bloqueante, não limpeza. São policies `ALL`, e permissivas são OR'd. Pior: no rename
o Postgres reescreve a expressão sozinho, então `user_id = auth.uid()` vira
`workspace_id = auth.uid()` — verdadeiro para o dono, porque o id do workspace **é** o uuid
dele. Deixá-las de pé significa dono furando toda regra de papel, sem sintoma na tela.

### O que a RLS não cobre

Rotas de fila (`/api/whatsapp/queue`, crons, webhook de entrada) usam service role e passam
por cima da RLS por construção. Nelas o filtro por workspace é explícito no código. Entra
como item de verificação do plano, não como policy.

## Mudanças no código

178 pontos reais em 59 arquivos (291 ocorrências menos as 113 do `database.types.ts`).

### Fonte de verdade do workspace

Novo `src/lib/workspace.ts`:

```ts
useWorkspace(): { workspaceId: string; role: Role; userId: string }        // cliente
getWorkspaceContext(): Promise<{ workspaceId, role, userId } | null>       // servidor
```

`src/contexts/crm-context.tsx:68` já chama `auth.getUser()` no lugar certo; ganha o lookup
de `workspace_members` ao lado e passa a expor os três.

### Tradução por padrão

| Hoje | Vira | Onde |
|---|---|---|
| `.insert({ user_id: userId, … })` | `.insert({ workspace_id: workspaceId, … })` | balde A: `use-crm-mutations.ts`, `automacoes-context.tsx`, telas de config |
| `.eq("user_id", user.id)` em leitura de balde A | **apagado** — a RLS já filtra | `automacoes-context.tsx:55-56` e similares |
| `notifications.insert({ user_id })` | `{ workspace_id, user_id }` | balde B: os dois campos |
| `contact_history` / `company_history` / `activity_attachments` | `user_id` → `actor_user_id` | `use-crm-mutations.ts:450,456,777` |
| `ctx.userId` (9 pontos) | `ctx.workspaceId` | `run-automations.ts` |
| `resolveWorkspaceOwner()` | `resolveWorkspaceId()` | `src/lib/whatsapp/connection.ts` + 5 rotas |

`crm-loader.ts` não filtra nada: os 6 selects principais dependem só da RLS. A maior parte
da leitura não precisa ser traduzida — precisa continuar não fazendo nada.

`resolveWorkspaceOwner` faz `?? userId` quando não acha linha, fallback que existia
justamente porque o dono não tinha linha em `team_members`. Com o dono semeado, vira lookup
real e o fallback sai.

### Papéis na UI (S-3)

`/configuracoes/usuarios/page.tsx` tem a matriz de 17 permissões em `useState` local. Vira
read-only, alimentada por `role`, sem botão de salvar toggle. Ações de escrita nas telas de
configuração ficam atrás de `role === 'admin'`. A UI grava `'vendedor'` minúsculo.

Gating de UI é conveniência; a RLS é o enforcement. As duas coisas, não uma.

### Fluxo de convite

```
POST /api/convites          admin cria linha pending + invite_token,
                            devolve /convite/<token> para copiar
GET  /convite/[token]       página pública: nome do workspace + form de senha
POST /api/convites/aceitar  service role: valida token, cria/liga o auth user,
                            preenche member_user_id, status='accepted'
```

**Armadilha do `src/proxy.ts`:** o matcher exclui rotas de máquina, mas `/convite/*` é
página. A checagem de `isAuthPage` (linha 8) precisa incluir `/convite`, senão o convidado
toma 307 para `/login` e o convite nunca abre.

### Regeneração de tipos

`database.types.ts` regenerado via MCP do Supabase depois da migração. Resolve as 113
ocorrências e o compilador passa a apontar cada ponto esquecido — é o que substitui os
testes que o projeto não tem.

## Execução

| # | Etapa | Saída verificável |
|---|---|---|
| 0 | `pg_dump` completo (schema + dados + `auth`), local | contagem do dump bate com produção |
| 1 | Migração única com asserts | aborta sozinha se um assert falhar |
| 2 | Regenerar `database.types.ts` | `tsc` aponta cada ponto quebrado |
| 3 | Corrigir os 178 pontos, balde por balde | `next build` verde |
| 4 | Gating de papel na UI + caixa do `role` | — |
| 5 | Convite + `/convite` no `proxy.ts` | convite aceito numa 3ª conta |
| 6 | `vercel deploy --prod` | verificação manual em produção |

**Janela de quebra:** entre a etapa 1 e a 6 produção fica quebrada — o app deployado escreve
`user_id` numa coluna que não existe mais. Com 2 contas de teste e nenhum cliente, isso é
aceitável, e é a razão de fazer agora. Rodar 1→6 numa sentada.

### Asserts embutidos na migração

Não são `SELECT`s para leitura humana: são `DO $$ ... RAISE EXCEPTION ... $$` no corpo da
migração. Um falha, o Postgres desfaz tudo.

```
1. contagem de linhas por tabela == snapshot pré-migração
2. zero workspace_id NULL nos baldes A e B
3. toda tabela com RLS ligada tem >= 1 policy
   -> o assert que mais importa: RLS ligada com zero policies não dá erro,
      dá tabela vazia para o app inteiro
4. zero policies com nome '%: user owns'
5. workspace_members com 2 linhas de dono, role='admin',
   status='accepted', member_user_id preenchido
6. role contém apenas 'admin'|'gerente'|'vendedor'
7. EXECUTE revogado de anon nas 7 funções
```

E o teste que fecha o argumento — exercitar as policies antes do commit, na própria
transação. Ainda não existe conta de vendedor (o convite só chega na etapa 5), então a
migração fabrica uma linha de membro sintética, testa contra ela e a apaga antes do
`COMMIT`:

```sql
-- membro sintético, existe só dentro desta transação
insert into workspace_members (workspace_id, member_user_id, email, role, status)
values ('<ws principal>', '<uuid sintético>', 'assert@local', 'vendedor', 'accepted');

set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid sintético>"}';
-- assert: select em deals devolve 0 linhas (nenhum deal tem owner_id = sintético)
-- assert: insert em pipelines levanta insufficient_privilege (não é admin)
-- assert: update de um deal alheio afeta 0 linhas

set local request.jwt.claims = '{"sub":"29a555c8-…"}';   -- dono do workspace vizinho
-- assert: select em deals devolve exatamente os 5 dele, nenhum dos 8 do outro

reset role;
delete from workspace_members where member_user_id = '<uuid sintético>';
-- assert: a linha sintética sumiu
```

Valida papel e isolamento entre os dois tenants reais, com o rollback ainda na mão. Depois
que o convite existir (etapa 5), o mesmo roteiro se repete manualmente com uma 3ª conta de
verdade.

### Rollback

- **Antes do COMMIT** — assert falha, nada aconteceu. Caso normal.
- **Depois do COMMIT** — migração `down` escrita junto: renomeia de volta, recria as
  policies antigas. Só tem valor se o problema aparecer em minutos.
- **Último recurso** — restaurar o `pg_dump`.
- **Código** — tag git antes de começar, como `v0.1.0-pre-saas` fez.

## Escopo

**Fecha nesta fase:** os 6 itens da Fase 1 do backlog, mais **S-6** e **S-3** como efeito
colateral, mais a armadilha do `team_members` sem a linha do dono.

**Fora:** toggles de permissão por workspace (o `jsonb` fica reservado e ignorado), email de
convite, staging, S-1.

**Habilita depois:** credenciais de WhatsApp por workspace (Fase 3) e resolução de workspace
a partir da `x-api-key` na entrada de leads (Fase 2) — ambas dependiam de workspace existir.
