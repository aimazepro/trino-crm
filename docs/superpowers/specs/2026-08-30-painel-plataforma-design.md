# Painel da Plataforma (v2) — Design

**Data:** 2026-08-30
**Status:** Aprovado no brainstorming; falta revisão final do usuário → plano de implementação
**Substitui:** `2026-08-29-admin-workspaces-design.md` (v1, `/admin`, já em produção)

## 1. Por que existe

O v1 (`/admin`) entregou a operação básica — listar workspaces, criar, suspender,
feature flags, uso. Três limites apareceram no uso real:

1. **Vive dentro do app do cliente.** Mesma URL, mesmo login, mesmo layout. Não
   parece — nem é — uma superfície separada.
2. **É workspace-only.** Uma conta que se cadastrou e nunca criou/aceitou
   workspace não aparecia em lugar nenhum (corrigido parcialmente em
   `79f7114` com `/admin/contas`, mas sem agrupamento).
3. **Não tem para onde crescer.** Billing por Stripe, operadores com papéis
   distintos e trilha de auditoria não cabem no formato atual.

Este projeto move o painel para um subdomínio próprio, reorganiza a informação
em torno da **conta do cliente** (workspace + seus membros), e deixa os ganchos
para o Stripe entrar depois sem redesenho.

**Modelo mental do dono (registrado literalmente, porque guia toda a UI):**
> "Workspace é uma conta usuário. Cada usuário individual ou admin dono é um
> workspace, tirando a conta admin `tools@` do SaaS."

Logo: a unidade da tela é o workspace; os membros com seus cargos aparecem
aninhados abaixo dele.

## 2. Estado atual (verificado no banco em 2026-08-30)

| Workspace | Dono | Membros |
|---|---|---|
| `joao` (`joao-29a555c8`) | joao@pixeo.com.br | 1 — admin |
| `Joao Reis` (`joao-reis-5e0c7833`) | joaoreiscefet@gmail.com | 2 — admin + claraferrodrigui@gmail.com (`vendedor`) |

`auth.users`: 5 contas. Além dos 3 membros acima:
- `agenciapixeo@gmail.com` — confirmada, já logou, **0 vínculo** (conta órfã)
- `tools@trinocompany.com.br` — platform admin, 0 vínculo (por desenho)

Ambos os workspaces: `plan=trial`, `status=active`, `trial_ends_at=null`.

## 3. Não-objetivos

- **Sem Stripe funcionando.** Só as colunas que ele vai preencher (§7). Nenhum
  SDK, nenhum webhook, nenhuma tela de cobrança real.
- **Sem apagar contas.** Ver §8 — a decisão é desativar. Remoção definitiva
  fica documentada como procedimento manual de último caso, não como botão.
- **Sem gerenciar membros pelo painel.** Convidar, trocar cargo e remover
  continuam em `/configuracoes/usuarios`, dentro do CRM do cliente. O painel
  **mostra** os membros e pode **bloquear** uma conta; não edita cargo.
- **Sem app/repo separado.** Mesmo projeto Vercel, mesma base de código.

## 4. Arquitetura — roteamento por hostname

Domínio existente: `aimaze.com.br`. CRM do cliente hoje em
`api-crm.aimaze.com.br`. O painel ganha `admin.aimaze.com.br` (subdomínio novo,
apontado no DNS e adicionado ao mesmo projeto Vercel).

```
admin.aimaze.com.br/contas      → rewrite → src/app/painel/contas
admin.aimaze.com.br/api/*       → passa direto, SEM rewrite
api-crm.aimaze.com.br/*         → CRM do cliente, intocado
api-crm.aimaze.com.br/painel/*  → 404
```

Quatro regras em `src/proxy.ts`, nesta ordem:

1. Host é o do painel e path **não** começa com `/api` → `NextResponse.rewrite()`
   para `/painel<path>`. A URL visível fica limpa (`admin.aimaze.com.br/contas`);
   o arquivo mora em `src/app/painel/contas/page.tsx`.
2. Host é o do painel e path **começa** com `/api` → segue sem rewrite.
   **Sem esta exceção, `/api/admin/workspaces` viraria
   `/painel/api/admin/workspaces` e toda chamada do painel quebraria.**
3. Host **não** é o do painel e path começa com `/painel` → `notFound()`. O
   painel não é alcançável pelo domínio do cliente.
4. Platform admin segue isento do bloco de revoke por membership (fix `79a19dd`,
   ver §12).

O host do painel vem de env var (`NEXT_PUBLIC_ADMIN_HOST`), não hardcoded — em
`localhost` o rewrite é desligado e `/painel/*` responde direto, senão não há
como desenvolver.

**Next 16.2.3:** o arquivo é `proxy.ts`, não `middleware.ts` (renomeado no Next
16; ver `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). A
própria doc avisa que autorização não deve depender só do proxy — o gate real
fica no `layout.tsx` e em cada Route Handler, como já é hoje.

### Isolamento de sessão

Verificado em [`src/lib/supabase/server.ts:18`](../../../src/lib/supabase/server.ts#L18):
o `@supabase/ssr` grava o cookie **sem `domain`**, portanto host-only. A sessão
de `admin.aimaze.com.br` e a de `api-crm.aimaze.com.br` não se enxergam — a
separação que o projeto quer sai de graça, sem código.

**Isto é frágil por omissão:** se alguém um dia passar
`domain: '.aimaze.com.br'` nas opções de cookie, a separação cai em silêncio,
sem erro. Vai um comentário explícito no arquivo dizendo isso.

### Aposentadoria do `/admin`

`/admin/*` passa a redirecionar para o host novo. As rotas `/api/admin/*`
**ficam onde estão** — já funcionam, já têm auth por token, já estão excluídas
do matcher do proxy. Sem churn desnecessário.

## 5. Autenticação e autorização

**Login:** Supabase Auth normal (`signInWithPassword`), na tela própria do
painel (`/entrar` no host do painel). Sem OAuth Google, sem link de cadastro.

**Autorização:** tabela nova.

```sql
create table public.platform_admins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  email       text not null unique,
  role        text not null check (role in ('owner','support','billing')),
  status      text not null default 'active' check (status in ('active','suspended')),
  created_at  timestamptz not null default now(),
  created_by  text,
  last_seen_at timestamptz
);
```

**RLS + grants:** `enable row level security`, nenhuma policy para `anon`/
`authenticated`, e `revoke all on public.platform_admins from anon, authenticated`.
Acesso só via service-role.

> **Lição de `34b69eb`, aplicar aqui:** revoke por coluna **não** subtrai de um
> grant de tabela inteira. Revogar a tabela toda, explicitamente, e conferir em
> `information_schema.role_table_grants` depois de aplicar — não presumir.

**Chave-mestra:** `PLATFORM_ADMIN_EMAILS` (env, já existe) continua valendo e
concede `owner` implícito mesmo sem linha na tabela. Existe para você nunca
ficar trancado de fora — se a última linha da tabela for apagada ou suspensa por
engano, o e-mail da env ainda entra.

**Papéis:**

| Papel | Vê dados | Bloqueia conta/workspace | Plano, trial, features | Impersonate | Gerencia operadores | Apaga em definitivo (§8.3) |
|---|---|---|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `support` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `billing` | ❌ (só agregados) | ❌ | ✅ | ❌ | ❌ | ❌ |

O cliente (qualquer papel dentro do CRM, inclusive dono do workspace) não tem
acesso a nenhuma dessas colunas — não existe autoatendimento de exclusão.

A checagem de papel vive no servidor, por rota. A UI esconde o que o papel não
pode fazer, mas esconder não é autorizar — cada Route Handler valida por conta
própria.

## 6. Telas

```
src/app/painel/
  entrar/page.tsx        login próprio
  layout.tsx             gate (getPlatformAdmin) + shell/nav
  page.tsx               dashboard
  contas/page.tsx        lista agrupada
  contas/[id]/page.tsx   detalhe da conta
  auditoria/page.tsx     log
```

### 6.1 Dashboard (`/`)

Cartões, todos derivados de queries que já são possíveis hoje:

- Contas por status: ativas / suspensas / em trial
- Trials vencendo em ≤7 dias (lista clicável)
- Contas paradas: sem linha em `deal_history`/`contact_history` há ≥14 dias
- Contas órfãs: `auth.users` sem `workspace_members` — sinal de cadastro que não
  converteu (hoje: `agenciapixeo@gmail.com`)
- Telefonia: soma de `telephony_balances` e gasto do mês em `telephony_ledger`

### 6.2 Contas (`/contas`) — a tela central

Agrupamento pedido explicitamente: **workspace no topo, membros com cargo
aninhados abaixo.**

```
┌────────────────────────────────────────────────────────────┐
│ ▾ Joao Reis                    Pro · ativo · 2 membros     │
│   joao-reis-5e0c7833 · criado 21/05/2026                   │
│   ├ joaoreiscefet@gmail.com    admin      ativo   último…  │
│   └ claraferrodrigui@gmail.com vendedor   ativo   último…  │
├────────────────────────────────────────────────────────────┤
│ ▸ joao                         Trial · ativo · 1 membro    │
├────────────────────────────────────────────────────────────┤
│ SEM WORKSPACE                                              │
│   agenciapixeo@gmail.com       —  cadastrou 28/08, nunca…  │
└────────────────────────────────────────────────────────────┘
```

Busca cobre nome do workspace, slug **e e-mail de membro** (procurar pela pessoa
é o caso real de suporte). Filtros: status, plano, "só órfãs".

### 6.3 Detalhe (`/contas/[id]`)

Blocos: identificação · membros (com bloquear por membro) · features · uso ·
cobrança (§7) · ações · últimas linhas de auditoria daquela conta.

## 7. Ganchos de Stripe

```sql
alter table public.workspaces
  add column stripe_customer_id     text,
  add column stripe_subscription_id text,
  add column subscription_status    text not null default 'manual',
  add column current_period_end     timestamptz;
```

O painel exibe um bloco "Cobrança" que lê essas colunas. Hoje mostra
`Plano: X (definido manualmente) · Stripe: não conectado`. Quando o Stripe
entrar, preenche as colunas e a tela passa a mostrar o real — sem migração
dolorosa nem redesenho. **Nenhum código de Stripe agora.**

## 8. Desativar, não apagar

**Decisão do dono, 2026-08-30, depois de ver o achado de §8.1:** o painel
desativa contas. Não apaga.

**Princípio que a decisão protege — autoria:** desativar preserva a linha em
`workspace_members` e a linha em `auth.users`. Tudo que a pessoa fez continua
assinado com o nome dela: negócios que ela ganhou, atividades que registrou,
mensagens que enviou. Ela perde o acesso; o histórico do cliente não perde nada.

### 8.1 Achado que motivou a decisão (não perder isto)

Verificado em `pg_constraint` no banco de produção, 2026-08-30:

```
delete em auth.users (dono do workspace)
  └─CASCADE→ workspaces          (workspaces_owner_user_id_fkey)
       └─CASCADE→ 43 tabelas:
          deals, contacts, companies, activities, pipelines, goals,
          emails, whatsapp_messages, whatsapp_conversations,
          telephony_calls, telephony_ledger, automations, webhooks,
          api_keys, dashboards, saved_reports, ...
```

Apagar a conta de um **dono** destrói em cascata o CRM inteiro daquele cliente —
irreversível, num clique. Apagar a conta de um **membro** é menos grave, mas
leva junto e-mails, assinaturas, dashboards e ramal, e transforma
`deals.owner_id` em `null` (`SET NULL`) — ou seja, **apaga a autoria**, que é
justamente o que se quer preservar.

Isto não é bug introduzido: é como o schema está desde o início. Só passa a
importar quando existe um botão que dispara esse caminho.

### 8.2 Os três níveis de bloqueio (todos reversíveis)

| Nível | Mecanismo | Efeito | Já existe? |
|---|---|---|---|
| Workspace | `workspaces.status` = `suspended`/`deleted` | corta todos os membros e as chaves de API | ✅ v1 |
| Conta | `auth.users.banned_until` (GoTrue) | corta uma pessoa, em todos os workspaces | ✅ `79f7114` |
| Funcionalidade | `workspaces.feature_flags` | desliga um recurso do workspace | ✅ v1 |

O painel v2 expõe os três de forma coerente na mesma tela. É reorganização, não
construção nova.

### 8.3 Remoção definitiva — existe, mas só como último caso

Decisão refinada pelo dono na mesma sessão: o botão existe no painel, cercado.

**Quem pode:** só o papel `owner` (o admin do SaaS). `support` e `billing` não
veem o botão e recebem 403 na rota, mesmo chamando direto.

**O cliente nunca pode.** Não existe "apagar minha conta" em nenhum lugar do
CRM — nem para o dono do workspace. Decisão explícita ("não por hora"): a única
saída de dado é passar pelo operador da plataforma.

**Travas obrigatórias, todas as quatro:**

1. **Contagem real antes de perguntar.** O diálogo mostra o que será destruído,
   contado no banco naquele instante — não um texto genérico:
   > "Isso apaga permanentemente: 412 negócios, 1.203 contatos, 340 empresas,
   > 8.940 mensagens de WhatsApp, 87 chamadas, R$ 34,20 de saldo de telefonia."
2. **Confirmação por digitação.** Digitar o slug do workspace (ou o e-mail da
   conta) para liberar o botão. Sem "tem certeza? [OK]".
3. **Auditoria antes de executar**, com a contagem junto — para que o log diga o
   que foi perdido mesmo depois de não existir mais.
4. **Dono com workspace ativo não é removível como conta.** Primeiro apaga o
   workspace conscientemente, ou transfere a posse; só então a conta sai. Isso
   impede que "remover um usuário" destrua uma empresa inteira por engano, que é
   exatamente o caminho de cascata do §8.1.

**Ordem de implementação:** este botão entra **por último**, depois da auditoria
estar gravando (§13). Sem trilha, não se apaga nada.

## 9. Cadastro público fechado

Pedido do dono nesta sessão. O `BACKLOG.md` (linha ~199) já registrava o gap:
_"qualquer um cria conta própria sem passar pelo convite. Avaliar se fecha ou
não."_ Fica fechado.

- `src/app/login/page.tsx` perde o modo `signup`: sem alternância
  "Cadastre-se", sem `supabase.auth.signUp`, sem os campos de nome.
- Criar conta passa a existir em dois lugares só: **o painel** (workspace + dono,
  rota que já existe) e **o convite** (`/convite/[token]`, membro entrando num
  workspace existente — não pode quebrar).
- **A trava real é no servidor, não na UI.** Some o botão *e* desliga o signup
  no projeto Supabase (Auth → Providers → Email → "Enable sign-ups"). Só tirar o
  formulário deixa a API `/auth/v1/signup` aberta para quem souber chamá-la.
- Verificar que o fluxo de convite continua funcionando com signup desligado —
  se o convite depender de `signUp`, a rota precisa passar a criar o usuário via
  service-role (`admin.createUser`).

## 10. Auditoria

```sql
create table public.platform_audit_log (
  id          bigserial primary key,
  actor_email text,
  actor_role  text,
  actor_via   text check (actor_via in ('session','token')),
  action      text not null,   -- 'workspace.suspend', 'account.block', 'impersonate.start', ...
  target_type text,            -- 'workspace' | 'account'
  target_id   text,
  target_label text,           -- nome/e-mail no momento da ação, para o log sobreviver a renomeações
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
```

Mesmo tratamento de RLS/grants de `platform_admins` (§5). Toda escrita do painel
grava aqui **antes** de executar a ação. Hoje isso só vai para `console.log` da
Vercel, que expira — vira obrigatório quando houver dinheiro e mais de um
operador.

## 11. Impersonate ("entrar como cliente")

Papéis `owner` e `support`.

**Fluxo:**
1. Painel: botão no detalhe da conta → `POST /api/admin/impersonate`.
2. Servidor: valida papel → **grava auditoria** → gera link de acesso pelo
   Supabase Admin API (`generateLink`, uso único, validade curta).
3. Abre em nova aba no host do CRM, numa rota de callback que troca o token por
   sessão, marca um cookie `impersonated_by` e redireciona para `/`.
4. O CRM mostra faixa fixa no topo: **"SESSÃO DE SUPORTE — você está como
   fulano@… [sair]"**. Sair limpa a sessão e o cookie.

**Riscos a tratar explicitamente na implementação:**
- A sessão emprestada **sobrescreve** a sessão que o operador tivesse no CRM
  naquele navegador. Hoje é inofensivo (`tools@` não usa o CRM), mas precisa
  estar escrito.
- A faixa é a única pista visual de que os dados na tela não são seus. Se ela
  falhar em renderizar, alguém pode agir achando que está na própria conta.
  Renderizar no layout do CRM, não numa página específica.
- Toda sessão de suporte fica no log com início e alvo.
- `api/auth/impersonate` é chamada de máquina sem cookie: **precisa entrar na
  lista de exclusões do matcher do proxy** — senão leva 307 para `/login`
  (armadilha que já custou 3 incidentes neste projeto, documentada no cabeçalho
  do `proxy.ts`).

## 12. Já entregue nesta sessão (em produção, não refazer)

- **`79a19dd`** — platform admin ficava preso em loop no `/login`. O `handleLogin`
  manda para `/` depois de autenticar, e `/` não estava excluído do proxy: admin
  sem `workspace_members` batia no bloco de revoke e voltava para
  `/login?revoked=1`. Agora `proxy.ts` isenta quem está em
  `PLATFORM_ADMIN_EMAILS` e o manda para `/admin`.
- **`79f7114`** — `/admin/contas` + `/api/admin/accounts` + `/api/admin/accounts/[id]`:
  primeira visão por conta (inclui órfãs) e bloqueio via `banned_until`. **Esta
  tela é a base do §6.2** — o v2 a move para o host novo e adiciona o
  agrupamento por workspace.

## 13. Ordem de implementação

1. Migração: `platform_admins`, `platform_audit_log`, colunas de Stripe em
   `workspaces`. Grants revogados e **conferidos** (§5).
2. `src/lib/platform-admin.ts` / `-server.ts`: ler a tabela, resolver papel,
   manter o fallback da env como `owner`.
3. `proxy.ts`: as 4 regras de host (§4) + exclusão de `api/auth/impersonate`.
4. Shell do painel: `layout.tsx`, `/entrar`, nav.
5. `/contas` com agrupamento (porta o que existe em `/admin/contas`).
6. `/contas/[id]`: blocos, ações, bloco de cobrança lendo as colunas novas.
7. Dashboard.
8. Auditoria: gravação em toda escrita + tela.
9. Impersonate (por último — depende da auditoria estar gravando).
10. Fechar cadastro público (§9), incluindo o toggle no Supabase e o teste do
    fluxo de convite.
11. Remoção definitiva (§8.3) — depois da auditoria, nunca antes.
12. Aposentar `/admin` (redirect) e atualizar `BACKLOG.md`.

## 14. Testes

- Roteamento: host do painel serve o painel; host do CRM devolve 404 em
  `/painel/*`; `/api/*` no host do painel **não** é reescrito.
- Cookie: logar no painel não cria sessão no CRM, e vice-versa.
- Papéis: `support` recebe 403 ao mudar plano; `billing` recebe 403 ao
  impersonar. Testar no servidor, não pela UI.
- Chave-mestra: e-mail da env entra mesmo com a tabela vazia.
- Bloqueio de conta: pessoa bloqueada perde acesso no próximo request; ao
  desbloquear, volta — **e o histórico dela continua assinado** (verificar que
  `deals.owner_id` e o nome nas atividades não mudaram).
- Cadastro fechado: `POST /auth/v1/signup` direto na API do Supabase é recusado;
  o fluxo de convite continua criando membro.
- Auditoria: toda ação de escrita gera linha, inclusive quando a ação falha
  depois.
- Impersonate: a faixa aparece; sair restaura; o log registra início e alvo.
- Remoção definitiva: `support` e `billing` recebem 403 na rota (não só botão
  escondido); a contagem exibida bate com o banco; sem a digitação correta a
  rota recusa; dono de workspace ativo é recusado; a linha de auditoria com a
  contagem existe **antes** do delete.

## 15. Decisões registradas (para não relitigar)

| Tema | Decisão | Alternativas descartadas |
|---|---|---|
| Separação | Subdomínio, mesmo projeto Vercel | rota `/painel` no mesmo domínio; app/repo separado |
| Auth do painel | Supabase Auth no host do painel | sessão própria com senha hasheada; projeto Supabase separado |
| Operadores | Tabela `platform_admins` + papéis, env como chave-mestra | só allowlist em env |
| Escopo v1 | + dashboard, auditoria, impersonate | gerenciar membros pelo painel (fora) |
| Stripe | Só colunas | nada; modelo de assinatura completo |
| Apagar conta | Padrão é desativar. Definitivo existe, mas só `owner`, com contagem real + digitação + auditoria; cliente nunca apaga a própria | apagar como ação comum; procedimento só manual fora do painel |
| Cadastro público | Fechado (UI + servidor) | manter aberto |

## 16. Pendências operacionais (fora do código)

Duas coisas que só o dono da conta pode fazer. A #1 bloqueia o passo 3 da §13;
a #2 bloqueia o passo 10 e **tem uma ordem obrigatória**.

### 16.1 DNS + domínio na Vercel — bloqueia o roteamento

1. Apontar `admin.aimaze.com.br` (CNAME para `cname.vercel-dns.com`, ou o alvo
   que a Vercel indicar na hora).
2. Adicionar o domínio ao projeto `trino-crm` (`prj_kaWE035waorvnxOy9dqEl2chkuaa`,
   team `team_ZnMiXkS7qzZ8SOrEQHagyUR6`) — `vercel domains add` ou pelo painel.
3. Definir `NEXT_PUBLIC_ADMIN_HOST=admin.aimaze.com.br` nas env vars de
   Production (§4 — o host não é hardcoded).

Enquanto isso não existir, dá para desenvolver: em `localhost` o rewrite é
desligado por desenho e `/painel/*` responde direto.

### 16.2 Desligar sign-ups no Supabase — **verificar o convite ANTES**

Supabase → Auth → Providers → Email → desmarcar "Enable sign-ups". Isso fecha
`POST /auth/v1/signup` no servidor; tirar o botão da UI sozinho não fecha nada.

**A ordem importa.** Se o fluxo de `/convite/[token]` criar o membro chamando
`supabase.auth.signUp`, desligar o toggle **quebra todo convite novo, em
silêncio** — o convidado recebe o link e não consegue entrar. Então:

1. Primeiro conferir como `/convite/[token]` cria o usuário.
2. Se usar `signUp`, migrar a rota para `admin.createUser` (service-role) antes
   de mexer no toggle.
3. Só então desligar, e testar um convite de ponta a ponta.

Essa verificação é o primeiro item do passo 10 da §13 — não um pré-requisito do
dono, e sim trabalho de implementação. O toggle é o único passo manual.

## 17. Como retomar

```
Retomar o painel da plataforma v2 do trino-crm.

Leia docs/superpowers/specs/2026-08-30-painel-plataforma-design.md — o
design está aprovado, com todas as decisões já fechadas (não relitigar).

Quero revisar o spec e, se estiver tudo certo, partir para o plano de
implementação com a skill writing-plans.

Já feito e em produção: 79a19dd e 79f7114 (§12). Ordem: §13.
Pendências operacionais: §16.
```
