# Painel da Plataforma v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover o painel da plataforma para o subdomínio `admin.aimaze.com.br`, reorganizado por conta do cliente (workspace + membros aninhados), com operadores por papel, trilha de auditoria, impersonate, cadastro público fechado e remoção definitiva cercada.

**Architecture:** Mesmo projeto Vercel, mesma base de código. `src/proxy.ts` roteia por hostname: host do painel reescreve `/<path>` → `/painel/<path>` (URL visível fica limpa), host do CRM devolve 404 em `/painel/*`. O CRM inteiro passa para o route group `src/app/(crm)/` — é o que tira o `AppShell` (sidebar/Topbar/CrmProvider) de cima do painel sem depender de checagem por pathname, que o rewrite torna inviável. Autorização por tabela `platform_admins` com papéis (`owner`/`support`/`billing`), `PLATFORM_ADMIN_EMAILS` continua como chave-mestra com papel `owner`. Toda escrita grava em `platform_audit_log` **antes** de executar. Nenhum código de Stripe — só as colunas que ele vai preencher.

**Tech Stack:** Next.js 16.2.3 (App Router, `proxy.ts`, Route Handlers), React 19, Supabase (Postgres + Auth Admin API), TypeScript, Tailwind 4. Sem framework de teste instalado: lógica **pura** ganha teste real com `node --test` (nativo do Node 24, roda `.test.ts` direto); tudo que depende de banco/sessão/host é verificado com `curl` contra o dev server e `mcp__supabase__execute_sql`, do mesmo jeito que o resto do projeto já é verificado.

**Spec:** [docs/superpowers/specs/2026-08-30-painel-plataforma-design.md](../specs/2026-08-30-painel-plataforma-design.md)

## Global Constraints

- Projeto Supabase: `etdkzpiehoivrviylemd`. Projeto Vercel: `prj_kaWE035waorvnxOy9dqEl2chkuaa`, team `team_ZnMiXkS7qzZ8SOrEQHagyUR6`.
- Papel de operador é sempre um de: `owner`, `support`, `billing`.
- Status de operador é sempre um de: `active`, `suspended`.
- Plano de workspace é sempre um de: `trial`, `pro`, `business`.
- Status de workspace é sempre um de: `active`, `suspended`, `deleted`.
- `FeatureKey` é sempre um de: `whatsapp`, `voip`, `automacoes`, `api_v1`, `custom_fields`.
- Tabela nova = RLS ligada + **`revoke all on <tabela> from anon, authenticated`** (grant de tabela inteira não é subtraído por revoke de coluna — lição de `34b69eb`) + conferência em `information_schema.role_table_grants` depois de aplicar.
- Função nova = `security definer`, `set search_path = public`, `revoke all on function ... from anon, authenticated, public` + `grant execute ... to service_role`.
- Toda rota que **escreve** grava `platform_audit_log` antes de executar. Se a gravação falhar, a ação não acontece (500).
- A UI esconde o que o papel não pode fazer, mas **esconder não é autorizar**: cada Route Handler valida o papel por conta própria.
- Host do painel nunca é hardcoded — sempre `process.env.NEXT_PUBLIC_ADMIN_HOST`.
- `SUPABASE_SERVICE_ROLE_KEY` só server-side, nunca chega no client.
- Sem SDK de Stripe, sem webhook de Stripe, sem tela de cobrança real nesta plan.
- Português nas mensagens de erro e na UI; caminhos de API em inglês (`/api/admin/accounts`), caminhos de UI em português (`/contas`) — convenção que já existe no repo.

---

## Achados de verificação (feitos ao escrever este plano — não repetir a investigação)

Quatro coisas divergem do spec porque o código/banco real foi conferido em 2026-08-30. Onde diverge, **o plano manda**, e a razão está aqui:

1. **`/convite/[token]` não usa `supabase.auth.signUp`.** `src/app/api/convites/aceitar/route.ts` cria o usuário com `admin.createUser` (service-role). O único `signUp` do repo inteiro está em `src/app/login/page.tsx:65`. Ou seja: a "ordem obrigatória" do §16.2 do spec **não existe** — desligar sign-ups no Supabase não quebra convite. Continua valendo testar um convite de ponta a ponta depois de desligar (Task 12).
2. **`deal_history` e `contact_history` não têm `workspace_id`** (só `deal_id`/`contact_id` + `created_at`). O card "contas paradas" do §6.1 não pode ser computado a partir delas. Usa `max(deals.updated_at)` e `max(activities.created_at)` por workspace (as duas têm `workspace_id`), dentro da RPC da Task 9.
3. **O root layout embrulha tudo em `AppShell`** (`src/app/layout.tsx` → `src/components/layout/app-shell.tsx`), que hoje só escapa por `pathname.startsWith("/login")`. Com o rewrite de host, `usePathname()` devolve a URL **visível** (`/contas`), não `/painel/contas` — então checagem por pathname não distingue painel de CRM. Por isso a Task 4 move o CRM para o route group `(crm)`: é a única separação que não depende do path.
4. **Não há tela de gerenciar operadores nesta plan.** A habilidade `manage_operators` existe na matriz de papéis (§5 do spec), mas o próprio spec não lista uma tela para ela em §6 nem um passo em §13 — as telas do v1 são `entrar`, `dashboard`, `contas`, `contas/[id]` e `auditoria`. Até existir, operador novo entra por SQL:
   ```sql
   insert into public.platform_admins (user_id, email, role, created_by)
   select id, email, 'support', 'manual' from auth.users where lower(email) = '<email>';
   ```
   `PLATFORM_ADMIN_EMAILS` continua sendo a chave-mestra que evita tranca por fora.
5. **Dev não desliga o rewrite** (o spec §4 dizia que sim). Desligar quebraria todo `<Link href="/contas">` do painel em desenvolvimento. Em vez disso o dev usa `NEXT_PUBLIC_ADMIN_HOST=painel.localhost:3000` — mesma regra de host, URLs limpas iguais às de produção, zero condicional no código.

---

## File Structure

**Criado:**

- `supabase/migrations/20260830100000_platform_admins_audit_stripe.sql` — `platform_admins`, `platform_audit_log`, colunas de Stripe em `workspaces`, grants revogados, seed do `tools@`.
- `supabase/migrations/20260830100100_platform_dashboard_stats.sql` — RPC do dashboard.
- `supabase/migrations/20260830100200_platform_deletion_preview.sql` — RPC da contagem antes de apagar.
- `src/lib/platform-audit.ts` — escritor da trilha (`logPlatformAction`). Server-only.
- `src/app/(crm)/layout.tsx` — passa a ser o único lugar que monta `AppShell`.
- `src/app/painel/entrar/page.tsx` — login do painel (fora do gate, de propósito).
- `src/app/painel/(app)/layout.tsx` — gate (`getPlatformAdminFromSession`) + shell do painel.
- `src/app/painel/(app)/page.tsx` — dashboard.
- `src/app/painel/(app)/contas/page.tsx` — lista agrupada por workspace.
- `src/app/painel/(app)/contas/[id]/page.tsx` — detalhe da conta.
- `src/app/painel/(app)/auditoria/page.tsx` — log.
- `src/components/painel/panel-nav.tsx` — nav do painel (client, precisa de `usePathname`).
- `src/components/layout/impersonation-banner.tsx` — faixa de sessão de suporte, no CRM.
- `src/app/api/admin/whoami/route.ts` — quem sou eu / qual papel (usado pelo login do painel).
- `src/app/api/admin/audit/route.ts` — `GET` da trilha.
- `src/app/api/admin/dashboard/route.ts` — `GET` dos cartões.
- `src/app/api/admin/impersonate/route.ts` — `POST`, gera o link de acesso.
- `src/app/api/auth/impersonate/route.ts` — `GET` no host do CRM, troca token por sessão.
- `src/app/admin/[[...rest]]/page.tsx` — redirect do `/admin` antigo para o host novo.

**Modificado:**

- `src/lib/platform-admin.ts` — papéis e habilidades (puro, testável).
- `src/lib/platform-admin.test.ts` — testes dos papéis.
- `src/lib/platform-admin-server.ts` — lê `platform_admins`, resolve papel, `requirePlatformAbility`.
- `src/lib/env.ts` — `NEXT_PUBLIC_ADMIN_HOST` em `OPTIONAL_SERVER_VARS`.
- `.env.example` — mesma var documentada.
- `src/proxy.ts` — roteamento por hostname + exclusão de `api/auth/impersonate` no matcher.
- `src/app/layout.tsx` — vira casca (html/body/fonte), sem `AppShell`.
- `src/app/login/page.tsx` — perde o modo `signup`.
- `src/components/layout/app-shell.tsx` — passa a renderizar a faixa de impersonate.
- `src/app/api/admin/accounts/route.ts` — `?group=workspace` devolve a visão agrupada.
- `src/app/api/admin/accounts/[id]/route.ts` — auditoria + `DELETE` definitivo.
- `src/app/api/admin/workspaces/route.ts` — auditoria no `POST`.
- `src/app/api/admin/workspaces/[id]/route.ts` — auditoria no `PATCH`/`DELETE`, papéis, bloco de cobrança, membros, `?hard=1`.
- `docs/BACKLOG.md` — itens fechados.
- `docs/superpowers/specs/2026-08-30-painel-plataforma-design.md` — marca o que foi feito.

**Movido (Task 4, `git mv`, sem mudar URL nenhuma):** `src/app/{page.tsx,ajuda,atividades,automacoes,configuracoes,contatos,conversas,convite,empresas,forecast,insights,ligacoes,login,metas,negocios}` → `src/app/(crm)/…`

**Apagado (Task 14):** `src/app/admin/{layout.tsx,page.tsx,contas/page.tsx,[id]/page.tsx}`.

---

### Task 1: Migração — `platform_admins`, `platform_audit_log`, colunas de Stripe

**Files:**
- Create: `supabase/migrations/20260830100000_platform_admins_audit_stripe.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerado, não editado à mão)

**Interfaces:**
- Produces: tabelas `public.platform_admins` (colunas `id, user_id, email, role, status, created_at, created_by, last_seen_at`) e `public.platform_audit_log` (`id, actor_email, actor_role, actor_via, action, target_type, target_id, target_label, metadata, created_at`); colunas `workspaces.stripe_customer_id`, `workspaces.stripe_subscription_id`, `workspaces.subscription_status` (default `'manual'`), `workspaces.current_period_end`. Tudo consumido a partir da Task 3.

- [ ] **Step 1: Escrever a migração**

```sql
-- Painel da plataforma v2 (ver docs/superpowers/specs/2026-08-30-painel-plataforma-design.md).
--
-- Três coisas de uma vez porque nascem juntas e não fazem sentido separadas:
-- quem opera o painel (platform_admins), o que cada operação fez
-- (platform_audit_log) e onde o Stripe vai encostar quando existir
-- (colunas em workspaces, sem nenhum código de Stripe agora).

create table public.platform_admins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users(id) on delete cascade,
  email        text not null unique,
  role         text not null check (role in ('owner','support','billing')),
  status       text not null default 'active' check (status in ('active','suspended')),
  created_at   timestamptz not null default now(),
  created_by   text,
  last_seen_at timestamptz
);

create table public.platform_audit_log (
  id           bigserial primary key,
  actor_email  text,
  actor_role   text,
  actor_via    text check (actor_via in ('session','token')),
  action       text not null,
  target_type  text,
  target_id    text,
  -- nome/e-mail no momento da ação: o log precisa continuar legível depois
  -- que o alvo for renomeado ou deixar de existir.
  target_label text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index platform_audit_log_created_at_idx on public.platform_audit_log (created_at desc);
create index platform_audit_log_target_idx on public.platform_audit_log (target_type, target_id);

-- Acesso só via service-role. RLS ligada sem policy nenhuma já barra
-- anon/authenticated, mas RLS não desfaz GRANT: sem o revoke abaixo, um
-- grant de tabela inteira herdado do schema continuaria valendo.
-- Lição de 34b69eb: revoke por coluna NÃO subtrai de grant de tabela.
alter table public.platform_admins enable row level security;
alter table public.platform_audit_log enable row level security;
revoke all on public.platform_admins from anon, authenticated;
revoke all on public.platform_audit_log from anon, authenticated;

-- Ganchos de Stripe. subscription_status = 'manual' significa "o plano foi
-- definido à mão no painel"; quando o Stripe entrar, ele passa a escrever
-- 'active'/'past_due'/'canceled' aqui sem migração nova.
alter table public.workspaces
  add column stripe_customer_id     text,
  add column stripe_subscription_id text,
  add column subscription_status    text not null default 'manual',
  add column current_period_end     timestamptz;

-- Semeia o operador que já existe hoje pela env var. Sem isso, ele aparece
-- como "conta órfã" no dashboard (auth.users sem workspace_members) e a
-- tabela nasce vazia, deixando toda autorização dependente da env.
-- Por e-mail, não por uuid hardcoded.
insert into public.platform_admins (user_id, email, role, created_by)
select id, email, 'owner', 'migration:20260830100000'
from auth.users
where lower(email) = 'tools@trinocompany.com.br'
on conflict (email) do nothing;
```

- [ ] **Step 2: Aplicar no projeto Supabase**

Use `mcp__supabase__apply_migration` com `project_id: "etdkzpiehoivrviylemd"`, `name: "platform_admins_audit_stripe"`, `query` = o SQL acima. Se o MCP não estiver disponível, `supabase db push` da raiz do projeto (o arquivo já está em `supabase/migrations/`).

- [ ] **Step 3: Conferir os grants (não presumir)**

Use `mcp__supabase__execute_sql` com `project_id: "etdkzpiehoivrviylemd"`:

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('platform_admins','platform_audit_log')
  and grantee in ('anon','authenticated');
```

Esperado: **0 linhas**. Qualquer linha aqui é o bug de `34b69eb` se repetindo — revogue de novo e confira de novo antes de seguir.

- [ ] **Step 4: Conferir o seed e as colunas novas**

```sql
select email, role, status from public.platform_admins;
select column_name, column_default
from information_schema.columns
where table_schema='public' and table_name='workspaces'
  and column_name in ('stripe_customer_id','stripe_subscription_id','subscription_status','current_period_end');
```

Esperado: 1 linha em `platform_admins` (`tools@trinocompany.com.br`, `owner`, `active`) e 4 colunas em `workspaces`, com `subscription_status` default `'manual'::text`.

- [ ] **Step 5: Regenerar `database.types.ts`**

Use `mcp__supabase__generate_typescript_types` com `project_id: "etdkzpiehoivrviylemd"` e salve o resultado inteiro em `src/lib/supabase/database.types.ts` (arquivo gerado, sobrescreve).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo (o schema só ganhou tabelas e colunas).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260830100000_platform_admins_audit_stripe.sql src/lib/supabase/database.types.ts
git commit -m "feat(painel): tabelas de operadores e auditoria + colunas de Stripe"
```

---

### Task 2: Papéis e habilidades (lógica pura + testes)

**Files:**
- Modify: `src/lib/platform-admin.ts`
- Test: `src/lib/platform-admin.test.ts`

**Interfaces:**
- Consumes: nada (arquivo puro, sem import de Next/Supabase — é o que o mantém rodável em `node --test`).
- Produces: `type PlatformRole = "owner" | "support" | "billing"`; `const PLATFORM_ROLES: readonly PlatformRole[]`; `type PlatformAbility = "read_aggregates" | "read_customer_data" | "block" | "billing" | "impersonate" | "manage_operators" | "hard_delete"`; `function can(role: PlatformRole, ability: PlatformAbility): boolean`; `function isPlatformRole(value: unknown): value is PlatformRole`. Consumido por `platform-admin-server.ts` (Task 3) e pelas páginas do painel.

- [ ] **Step 1: Escrever os testes que falham**

Adicione ao final de `src/lib/platform-admin.test.ts`:

```ts
import { can, isPlatformRole, PLATFORM_ROLES } from "./platform-admin.ts";

test("owner pode tudo", () => {
  for (const ability of ["read_aggregates", "read_customer_data", "block", "billing", "impersonate", "manage_operators", "hard_delete"] as const) {
    assert.equal(can("owner", ability), true, `owner deveria poder ${ability}`);
  }
});

test("support vê dado de cliente, bloqueia e impersona", () => {
  assert.equal(can("support", "read_customer_data"), true);
  assert.equal(can("support", "block"), true);
  assert.equal(can("support", "impersonate"), true);
});

test("support não mexe em plano, operador nem apaga em definitivo", () => {
  assert.equal(can("support", "billing"), false);
  assert.equal(can("support", "manage_operators"), false);
  assert.equal(can("support", "hard_delete"), false);
});

test("billing só vê agregado e mexe em plano", () => {
  assert.equal(can("billing", "read_aggregates"), true);
  assert.equal(can("billing", "billing"), true);
  assert.equal(can("billing", "read_customer_data"), false);
  assert.equal(can("billing", "block"), false);
  assert.equal(can("billing", "impersonate"), false);
  assert.equal(can("billing", "hard_delete"), false);
});

test("todo papel enxerga agregados do dashboard", () => {
  for (const role of PLATFORM_ROLES) {
    assert.equal(can(role, "read_aggregates"), true);
  }
});

test("isPlatformRole rejeita string desconhecida e não-string", () => {
  assert.equal(isPlatformRole("owner"), true);
  assert.equal(isPlatformRole("admin"), false);
  assert.equal(isPlatformRole(null), false);
  assert.equal(isPlatformRole(3), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/lib/platform-admin.test.ts`
Expected: FAIL — `SyntaxError: The requested module './platform-admin.ts' does not provide an export named 'can'`.

- [ ] **Step 3: Implementar**

Adicione ao final de `src/lib/platform-admin.ts`:

```ts
/** Papel do operador da plataforma. Espelha o check da coluna
 * platform_admins.role -- mudou aqui, muda a migração junto. */
export type PlatformRole = "owner" | "support" | "billing";

export const PLATFORM_ROLES: readonly PlatformRole[] = ["owner", "support", "billing"];

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === "string" && (PLATFORM_ROLES as readonly string[]).includes(value);
}

/**
 * O que cada papel pode fazer. Habilidade, não rota: a mesma habilidade é
 * checada no servidor (Route Handler) e usada pela UI pra esconder botão --
 * mas esconder não autoriza nada, a checagem do servidor é a de verdade.
 *
 * read_aggregates  -> dashboard, números somados, sem dado de cliente
 * read_customer_data -> lista de contas, membros, detalhe, auditoria
 * block            -> suspender workspace, bloquear conta, feature flags
 * billing          -> plano, trial, colunas de cobrança
 * impersonate      -> entrar como cliente
 * manage_operators -> mexer em platform_admins
 * hard_delete      -> remoção definitiva (§8.3 do spec)
 */
export type PlatformAbility =
  | "read_aggregates"
  | "read_customer_data"
  | "block"
  | "billing"
  | "impersonate"
  | "manage_operators"
  | "hard_delete";

const ROLE_ABILITIES: Record<PlatformRole, readonly PlatformAbility[]> = {
  owner: [
    "read_aggregates",
    "read_customer_data",
    "block",
    "billing",
    "impersonate",
    "manage_operators",
    "hard_delete",
  ],
  support: ["read_aggregates", "read_customer_data", "block", "impersonate"],
  // billing enxerga agregado (dashboard), não dado de cliente.
  billing: ["read_aggregates", "billing"],
};

export function can(role: PlatformRole, ability: PlatformAbility): boolean {
  return ROLE_ABILITIES[role].includes(ability);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/lib/platform-admin.test.ts`
Expected: PASS em todos os testes (os antigos de allowlist/token inclusive).

- [ ] **Step 5: Commit**

```bash
git add src/lib/platform-admin.ts src/lib/platform-admin.test.ts
git commit -m "feat(painel): papéis de operador e matriz de habilidades"
```

---

### Task 3: `platform-admin-server.ts` — resolver papel a partir da tabela

**Files:**
- Modify: `src/lib/platform-admin-server.ts`

**Interfaces:**
- Consumes: `can`, `isPlatformRole`, `PlatformRole`, `PlatformAbility`, `matchesAdminAllowlist`, `tokenMatches` (Task 2); tabela `platform_admins` (Task 1).
- Produces: `interface PlatformAdminContext { via: "session" | "token"; email: string | null; userId: string | null; role: PlatformRole }`; `getPlatformAdminFromSession(): Promise<PlatformAdminContext | null>`; `getPlatformAdmin(request): Promise<PlatformAdminContext | null>`; `requirePlatformAdmin(request)` (inalterada em assinatura); `requirePlatformAbility(request, ability): Promise<{ok:true; ctx:PlatformAdminContext} | {ok:false; response:NextResponse}>`; `adminClient()`. Consumido por toda rota `/api/admin/*` e pelo gate do painel.

- [ ] **Step 1: Substituir a resolução de identidade**

Em `src/lib/platform-admin-server.ts`, troque o `import` de `@/lib/platform-admin` e o bloco `PlatformAdminContext` + `getPlatformAdminFromSession` por:

```ts
import {
  matchesAdminAllowlist,
  tokenMatches,
  can,
  isPlatformRole,
  type PlatformRole,
  type PlatformAbility,
} from "@/lib/platform-admin";

export interface PlatformAdminContext {
  via: "session" | "token";
  email: string | null;
  /** null quando via = "token" (chamada de máquina não tem usuário). */
  userId: string | null;
  role: PlatformRole;
}

/**
 * Duas fontes de verdade, nesta ordem:
 *
 * 1. PLATFORM_ADMIN_EMAILS (env) -- chave-mestra, papel `owner` implícito.
 *    Existe pra que apagar ou suspender a última linha da tabela por engano
 *    não tranque o dono de fora do próprio painel. Por isso vem primeiro:
 *    uma linha `suspended` na tabela não pode derrubar o e-mail da env.
 * 2. platform_admins -- operadores de verdade, com papel próprio. Só linha
 *    com status 'active' entra.
 */
export async function getPlatformAdminFromSession(): Promise<PlatformAdminContext | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Só leitura de sessão aqui -- refresh de token é responsabilidade
        // do proxy, não há nada pra persistir de volta.
        setAll: () => {},
      },
    }
  );
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;
  const userId = data.user?.id ?? null;
  if (!email || !userId) return null;

  if (matchesAdminAllowlist(email, process.env.PLATFORM_ADMIN_EMAILS)) {
    return { via: "session", email, userId, role: "owner" };
  }

  const { data: row } = await adminClient()
    .from("platform_admins")
    .select("role, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row || row.status !== "active" || !isPlatformRole(row.role)) return null;
  return { via: "session", email, userId, role: row.role };
}
```

- [ ] **Step 2: Dar papel à chamada por token e adicionar o gate por habilidade**

No mesmo arquivo, troque o retorno do ramo Bearer em `getPlatformAdmin` e acrescente `requirePlatformAbility` depois de `requirePlatformAdmin`:

```ts
    if (match && tokenMatches(match[1].trim(), process.env.PLATFORM_ADMIN_API_TOKEN)) {
      // O token é a chave da máquina: mesmo alcance do owner, sem usuário
      // associado. Quem tiver o token já pode tudo por outros caminhos.
      return { via: "token", email: null, userId: null, role: "owner" };
    }
```

```ts
/** Gate por habilidade (ver ROLE_ABILITIES em src/lib/platform-admin.ts).
 * 401 = não é operador; 403 = é operador, mas o papel não alcança a ação.
 * Distinguir os dois importa: 403 é o que prova, em teste, que o papel está
 * sendo checado no servidor e não só escondido na UI. */
export async function requirePlatformAbility(
  request: Request,
  ability: PlatformAbility
): Promise<{ ok: true; ctx: PlatformAdminContext } | { ok: false; response: NextResponse }> {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth;
  if (!can(auth.ctx.role, ability)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `Papel '${auth.ctx.role}' não pode executar esta ação`,
          },
        },
        { status: 403 }
      ),
    };
  }
  return auth;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erro. `src/app/admin/layout.tsx` e as rotas atuais continuam compilando — `PlatformAdminContext` só ganhou campos.

- [ ] **Step 4: Verificar contra o banco que o papel sai da tabela**

Suba o dev server (`npm run dev`) e, em outro terminal:

```bash
curl -s -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" \
  http://localhost:3000/api/admin/workspaces | head -c 200
```

Expected: JSON com `{"data":{"workspaces":[...]}}` — prova que o ramo `token` continua funcionando com o campo `role` novo.

Depois, sem token:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/admin/workspaces
```

Expected: `401`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/platform-admin-server.ts
git commit -m "feat(painel): papel do operador vem de platform_admins, com env como chave-mestra"
```

---

### Task 4: Route group `(crm)` — tirar o `AppShell` de cima do painel

**Files:**
- Create: `src/app/(crm)/layout.tsx`
- Modify: `src/app/layout.tsx`
- Move: `src/app/{page.tsx,ajuda,atividades,automacoes,configuracoes,contatos,conversas,convite,empresas,forecast,insights,ligacoes,login,metas,negocios}` → `src/app/(crm)/…`

**Interfaces:**
- Produces: `src/app/(crm)/layout.tsx` — único lugar que monta `AppShell`. Tudo que ficar **fora** de `src/app/(crm)/` (o painel, na Task 6; o redirect de `/admin`, na Task 14) renderiza sem sidebar, sem Topbar e sem `CrmProvider`. Nenhuma URL muda: route group entre parênteses não entra no caminho.

- [ ] **Step 1: Mover o CRM para o grupo**

```bash
mkdir -p "src/app/(crm)"
git mv src/app/page.tsx "src/app/(crm)/page.tsx"
for d in ajuda atividades automacoes configuracoes contatos conversas convite empresas forecast insights ligacoes login metas negocios; do
  git mv "src/app/$d" "src/app/(crm)/$d"
done
```

- [ ] **Step 2: Conferir o que ficou fora do grupo**

Run: `ls src/app`
Expected: exatamente `(crm)`, `admin`, `api`, `favicon.ico`, `globals.css`, `layout.tsx`. Nada mais. (`admin` sai na Task 14; `painel` entra na Task 6.)

- [ ] **Step 3: Criar o layout do grupo**

```tsx
// src/app/(crm)/layout.tsx
//
// O AppShell (sidebar, Topbar, CrmProvider) vale para o CRM do cliente e só
// para ele. Ficava no root layout, o que embrulhava TODA rota do projeto --
// inclusive o painel da plataforma, que é outro produto em outro host.
//
// A separação é por route group, não por pathname: o proxy reescreve
// admin.aimaze.com.br/contas -> /painel/contas, e usePathname() devolve a URL
// *visível* ("/contas"), então nenhuma checagem de caminho dentro do AppShell
// conseguiria distinguir painel de CRM.
import { AppShell } from "@/components/layout/app-shell";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 4: Enxugar o root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'TrinoDeal | Marketing Hub',
  description: 'CRM e Automações para sua Agência',
};

// Só html/body/fonte. Quem monta o shell do CRM é src/app/(crm)/layout.tsx --
// ver o comentário de lá antes de mover qualquer coisa de volta pra cá.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build verde. Na lista de rotas, `/`, `/negocios`, `/login`, `/configuracoes/*` etc. continuam nos mesmos caminhos (o `(crm)` não aparece na URL). Nenhum "You cannot have two parallel pages that resolve to the same path".

- [ ] **Step 6: Conferir no navegador que nada mudou**

Run: `npm run dev`, abra `http://localhost:3000/negocios`
Expected: sidebar, Topbar e pipeline exatamente como antes. Abra `http://localhost:3000/login`: tela de login sem sidebar (o `AppShell` já tratava isso por pathname e continua tratando).

- [ ] **Step 7: Commit**

```bash
git add -A src/app
git commit -m "refactor(app): CRM passa para o route group (crm), root layout vira casca"
```

---

### Task 5: `proxy.ts` — roteamento por hostname

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`
- Modify: `.env.local` (local, não versionado)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_ADMIN_HOST`.
- Produces: no host do painel, `/<path>` serve `src/app/painel/<path>` com a URL visível limpa, e `/api/*` passa sem rewrite; no host do CRM, `/painel/*` responde 404. `api/auth/impersonate` sai do matcher (usado na Task 11).

- [ ] **Step 1: Documentar a env var**

Em `src/lib/env.ts`, dentro de `OPTIONAL_SERVER_VARS`, depois de `"PLATFORM_ADMIN_API_TOKEN"`:

```ts
  // Host do painel da plataforma (ex.: admin.aimaze.com.br). Sem ela o
  // roteamento por host fica desligado e /painel/* responde 404 em todo
  // lugar -- falha fechado, mas o CRM sobe normalmente.
  "NEXT_PUBLIC_ADMIN_HOST",
```

E no fim de `.env.example`:

```bash
# Host do painel da plataforma. Sem ela o painel simplesmente não existe
# (todo /painel/* vira 404) -- o CRM continua funcionando.
# Produção: admin.aimaze.com.br
# Dev: painel.localhost:3000 (o rewrite é o MESMO em dev e em produção, senão
# todo <Link href="/contas"> do painel quebraria localmente). Se o navegador
# não resolver *.localhost, acrescente "127.0.0.1 painel.localhost" em /etc/hosts.
NEXT_PUBLIC_ADMIN_HOST=
```

- [ ] **Step 2: Configurar o dev local**

Acrescente ao `.env.local` (arquivo local, fora do git):

```bash
NEXT_PUBLIC_ADMIN_HOST=painel.localhost:3000
PLATFORM_ADMIN_EMAILS=tools@trinocompany.com.br
```

(`PLATFORM_ADMIN_EMAILS` não está no `.env.local` hoje — sem ela o painel fica inacessível em dev mesmo com a tabela populada, porque a sessão local não bate em nenhuma das duas fontes.)

- [ ] **Step 3: Reescrever o topo do `proxy()`**

Em `src/proxy.ts`, logo depois dos imports e antes de `export async function proxy`:

```ts
// Host do painel da plataforma. NEXT_PUBLIC_ é inlined no build, então dá
// pra ler no escopo do módulo -- e o mesmo valor vale para dev
// (painel.localhost:3000) e produção (admin.aimaze.com.br). O rewrite NÃO é
// desligado em dev de propósito: se fosse, todo link do painel ("/contas")
// resolveria contra o CRM localmente e o painel só seria testável em prod.
const ADMIN_HOST = (process.env.NEXT_PUBLIC_ADMIN_HOST ?? "").toLowerCase();
```

E substitua as duas primeiras linhas do corpo de `proxy()` por:

```ts
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // x-forwarded-host primeiro: atrás do proxy da Vercel é ele que carrega o
  // host que o navegador realmente pediu.
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  const isPanelHost = !!ADMIN_HOST && host === ADMIN_HOST;

  // Regra 3 (§4 do spec): o painel não é alcançável pelo domínio do cliente.
  // notFound() é API de Server Component e não existe aqui -- 404 na mão.
  // Também 404 no host do painel: lá a URL canônica é limpa ("/contas"), e
  // deixar /painel/contas passar reescreveria pra /painel/painel/contas.
  if (path.startsWith("/painel")) {
    return new NextResponse(null, { status: 404 });
  }

  const { supabase, response } = createMiddlewareClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  // Regras 1 e 2 (§4): host do painel serve src/app/painel/*, e /api/* passa
  // direto. Sem a exceção do /api, uma chamada do painel pra
  // /api/admin/workspaces viraria /painel/api/admin/workspaces e o painel
  // inteiro quebraria. O getUser() acima roda antes de propósito: é ele que
  // renova o cookie de sessão, e sem renovação a sessão do painel morreria na
  // primeira expiração de token.
  //
  // Nada da lógica de membership do CRM (abaixo) roda no host do painel: um
  // operador não é membro de workspace nenhum, e o gate de verdade é
  // src/app/painel/(app)/layout.tsx.
  if (isPanelHost) {
    if (path.startsWith("/api")) return response;
    const url = request.nextUrl.clone();
    url.pathname = path === "/" ? "/painel" : `/painel${path}`;
    const rewritten = NextResponse.rewrite(url);
    for (const cookie of response.cookies.getAll()) rewritten.cookies.set(cookie);
    return rewritten;
  }
```

O resto da função (isenção de platform admin, corte por membership, redirects) segue igual, começando de `const isAuthPage = ...`. Mova a declaração de `isAuthPage` para depois do bloco acima e troque `request.nextUrl.pathname` por `path` nas comparações que já existiam.

- [ ] **Step 4: Excluir `api/auth/impersonate` do matcher**

No comentário grande acima de `export const config`, acrescente ao final:

```
// api/auth/impersonate é o callback de "entrar como cliente": chega SEM
// cookie de sessão (é exatamente ele que vai criar a sessão, trocando um
// token de uso único). Sem esta exclusão levava 307 pro /login e o
// impersonate nunca funcionava -- mesma armadilha de api/cron e
// api/telephony/webhook, que já custou 3 incidentes neste projeto.
```

E no `matcher`, acrescente `api/auth/impersonate|` logo depois de `api/auth/google-calendar/callback|`:

```ts
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/gmail/callback|api/auth/google-calendar/callback|api/auth/impersonate|api/track|api/whatsapp/webhook|api/whatsapp/queue|api/telephony/webhook|api/convites|api/automations|api/v1|api/admin|admin|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 5: Verificar as 4 regras com `curl`**

Com `npm run dev` rodando (e o `.env.local` do Step 2):

```bash
# Regra 3: /painel/* no host do CRM -> 404
curl -s -o /dev/null -w 'crm /painel: %{http_code}\n' http://localhost:3000/painel/contas
# Regra 1: host do painel, path limpo -> ainda 404 (a página só nasce na Task 6),
# mas NÃO 307 pro /login -- é isso que se está testando aqui.
curl -s -o /dev/null -w 'painel /contas: %{http_code}\n' -H 'Host: painel.localhost:3000' http://localhost:3000/contas
# Regra 2: /api no host do painel passa sem rewrite
curl -s -o /dev/null -w 'painel /api/admin/workspaces: %{http_code}\n' -H 'Host: painel.localhost:3000' http://localhost:3000/api/admin/workspaces
# CRM segue intocado
curl -s -o /dev/null -w 'crm /negocios: %{http_code}\n' http://localhost:3000/negocios
```

Expected: `crm /painel: 404`, `painel /contas: 404` (sem `location:` de login), `painel /api/admin/workspaces: 401` (a rota respondeu, logo não houve rewrite), `crm /negocios: 307` (redirect pro login, comportamento atual sem sessão).

- [ ] **Step 6: Type-check e build**

Run: `npx tsc --noEmit && npm run build`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add src/proxy.ts src/lib/env.ts .env.example
git commit -m "feat(painel): roteamento por hostname no proxy + exclusão de api/auth/impersonate"
```

---

### Task 6: Shell do painel — gate, login e navegação

**Files:**
- Create: `src/app/painel/(app)/layout.tsx`
- Create: `src/app/painel/(app)/page.tsx` (provisório; vira o dashboard na Task 9)
- Create: `src/app/painel/entrar/page.tsx`
- Create: `src/components/painel/panel-nav.tsx`
- Create: `src/app/api/admin/whoami/route.ts`

**Interfaces:**
- Consumes: `getPlatformAdminFromSession`, `requirePlatformAdmin` (Task 3); roteamento por host (Task 5).
- Produces: `GET /api/admin/whoami` → `{ data: { email, role, via } }` ou 401; gate do painel em `src/app/painel/(app)/layout.tsx` (tudo dentro de `(app)` é área logada; `entrar` fica fora de propósito); `PanelNav` com os links `/`, `/contas`, `/auditoria`.

- [ ] **Step 1: Rota `whoami`**

```ts
// src/app/api/admin/whoami/route.ts
//
// Existe por causa do loop de 79a19dd: uma conta que autentica mas não é
// operador precisa ouvir "essa conta não tem acesso" na hora do login, e não
// ser mandada pro painel pra ser expulsa pelo gate de volta pro login.
import { requirePlatformAdmin } from "@/lib/platform-admin-server";
import { apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;
  return apiSuccess({ email: auth.ctx.email, role: auth.ctx.role, via: auth.ctx.via });
}
```

- [ ] **Step 2: Nav do painel**

```tsx
// src/components/painel/panel-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Caminhos limpos, sem "/painel": no host do painel o proxy reescreve
// /contas -> /painel/contas e usePathname() devolve a URL visível.
const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/contas", label: "Contas" },
  { href: "/auditoria", label: "Auditoria" },
] as const;

export function PanelNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm font-semibold">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-colors",
              active ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Gate + shell**

```tsx
// src/app/painel/(app)/layout.tsx
//
// Tudo dentro de (app) é área logada do painel. /painel/entrar fica FORA do
// grupo de propósito: se o login estivesse aqui dentro, o gate abaixo o
// redirecionaria pra ele mesmo, em loop.
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getPlatformAdminFromSession } from "@/lib/platform-admin-server";
import { PanelNav } from "@/components/painel/panel-nav";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "dono",
  support: "suporte",
  billing: "cobrança",
};

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const admin = await getPlatformAdminFromSession();
  // "/entrar" e não "/painel/entrar": o Location é resolvido pelo navegador
  // contra o host do painel, e lá o proxy reescreve.
  if (!admin) redirect("/entrar");

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-sm font-black tracking-tight text-zinc-900">
            Painel da Plataforma
          </span>
          <PanelNav />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-500">{admin.email}</span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-bold text-zinc-600">
            {ROLE_LABEL[admin.role] ?? admin.role}
          </span>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Página provisória (vira o dashboard na Task 9)**

```tsx
// src/app/painel/(app)/page.tsx
export default function PainelHome() {
  return <p className="text-sm text-zinc-500">Dashboard entra na Task 9.</p>;
}
```

- [ ] **Step 5: Login do painel**

```tsx
// src/app/painel/entrar/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function PainelEntrarPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    // Autenticar não é ser operador. Sem esta checagem, uma conta comum
    // logaria com sucesso e seria expulsa pelo gate de volta pra cá, sem
    // explicação nenhuma -- o loop silencioso de 79a19dd, de novo.
    const res = await fetch("/api/admin/whoami");
    if (!res.ok) {
      await supabase.auth.signOut();
      setError("Esta conta não tem acesso ao painel da plataforma.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-8 space-y-4"
      >
        <div>
          <h1 className="text-lg font-black text-zinc-900">Painel da Plataforma</h1>
          <p className="text-xs text-zinc-500 mt-1">Acesso restrito a operadores.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1" htmlFor="painel-email">
            E-mail
          </label>
          <input
            id="painel-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 focus:border-zinc-900 text-sm outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1" htmlFor="painel-senha">
            Senha
          </label>
          <input
            id="painel-senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 focus:border-zinc-900 text-sm outline-none"
          />
        </div>

        {error && (
          <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Entrar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Verificar o gate e o isolamento de sessão**

Com `npm run dev`, no navegador:

1. `http://painel.localhost:3000/` → redireciona para `/entrar` (URL visível limpa, sem `/painel`).
2. Entre com `tools@trinocompany.com.br` → cai no `/` do painel, com o cabeçalho mostrando o e-mail e o papel `dono`.
3. `http://painel.localhost:3000/contas` → 404 (a página nasce na Task 7), **não** redirect pro login.
4. Abra `http://localhost:3000/negocios` na mesma janela → continua deslogado do CRM. É o isolamento de cookie host-only do §4 do spec: a sessão do painel não vale no CRM.
5. Entre com uma conta de cliente em `http://painel.localhost:3000/entrar` → mensagem "Esta conta não tem acesso ao painel da plataforma.", sem loop.

- [ ] **Step 7: Comentário de proteção no client do Supabase**

Em `src/lib/supabase/server.ts`, acima de `createMiddlewareClient`:

```ts
// NÃO passe `domain` nas opções de cookie aqui. O @supabase/ssr grava o
// cookie host-only, e é só isso que mantém a sessão do painel
// (admin.aimaze.com.br) separada da sessão do CRM (api-crm.aimaze.com.br).
// Um `domain: ".aimaze.com.br"` faria as duas se enxergarem -- em silêncio,
// sem erro nenhum, com o operador logado no CRM de todo cliente.
```

- [ ] **Step 8: Commit**

```bash
git add src/app/painel src/components/painel src/app/api/admin/whoami src/lib/supabase/server.ts
git commit -m "feat(painel): shell, gate por papel e login próprio no host do painel"
```

---

### Task 7: `/contas` — lista agrupada por workspace

**Files:**
- Modify: `src/app/api/admin/accounts/route.ts`
- Create: `src/app/painel/(app)/contas/page.tsx`

**Interfaces:**
- Consumes: `requirePlatformAbility` (Task 3), shell do painel (Task 6).
- Produces: `GET /api/admin/accounts?group=workspace` → `{ data: { workspaces: GroupedWorkspace[], orphans: OrphanAccount[] } }`, onde
  `GroupedWorkspace = { id, name, slug, plan, status, subscriptionStatus, createdAt, trialEndsAt, members: { userId, email, role, memberStatus, blocked, lastSignInAt }[] }`
  e `OrphanAccount = { id, email, createdAt, emailConfirmedAt, lastSignInAt, blocked }`.
  Consumido pela tela `/contas` e, no `[id]`, pela Task 8. **Sem o parâmetro `group` a resposta antiga (`{ accounts: [...] }`) fica intacta** — `/admin/contas` ainda depende dela até a Task 14.

- [ ] **Step 1: Acrescentar a visão agrupada**

Em `src/app/api/admin/accounts/route.ts`, troque o import de auth e acrescente o ramo agrupado no início do `GET` (depois de `const admin = adminClient();` não — antes de montar a resposta atual):

```ts
import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
```

```ts
export async function GET(request: Request) {
  const auth = await requirePlatformAbility(request, "read_customer_data");
  if (!auth.ok) return auth.response;

  const admin = adminClient();
  const url = new URL(request.url);

  // ?group=workspace é a visão do painel v2: workspace no topo, membros
  // aninhados, contas sem workspace num balde à parte. Sem o parâmetro, a
  // resposta antiga (lista plana de contas) continua igual -- /admin/contas
  // ainda consome ela até ser aposentada.
  if (url.searchParams.get("group") === "workspace") {
    return groupedResponse(admin);
  }
```

E acrescente, no fim do arquivo:

```ts
type AdminDb = ReturnType<typeof adminClient>;

async function groupedResponse(admin: AdminDb) {
  const [usersRes, workspacesRes, membersRes] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin
      .from("workspaces")
      .select("id, name, slug, plan, status, subscription_status, created_at, trial_ends_at")
      .order("created_at", { ascending: false }),
    admin.from("workspace_members").select("workspace_id, member_user_id, email, role, status"),
  ]);

  if (usersRes.error) return apiError("INTERNAL_ERROR", usersRes.error.message, 500);
  if (workspacesRes.error) return apiError("INTERNAL_ERROR", workspacesRes.error.message, 500);
  if (membersRes.error) return apiError("INTERNAL_ERROR", membersRes.error.message, 500);

  const now = Date.now();
  const userById = new Map(
    (usersRes.data?.users ?? []).map((u) => [
      u.id,
      {
        email: u.email ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        emailConfirmedAt: u.email_confirmed_at ?? null,
        createdAt: u.created_at,
        blocked: !!u.banned_until && new Date(u.banned_until).getTime() > now,
      },
    ])
  );

  const linkedUserIds = new Set<string>();
  const membersByWorkspace = new Map<
    string,
    { userId: string | null; email: string; role: string; memberStatus: string; blocked: boolean; lastSignInAt: string | null }[]
  >();

  for (const m of membersRes.data ?? []) {
    if (m.member_user_id) linkedUserIds.add(m.member_user_id);
    const account = m.member_user_id ? userById.get(m.member_user_id) : undefined;
    const list = membersByWorkspace.get(m.workspace_id) ?? [];
    list.push({
      userId: m.member_user_id,
      email: m.email,
      role: m.role,
      memberStatus: m.status,
      blocked: account?.blocked ?? false,
      lastSignInAt: account?.lastSignInAt ?? null,
    });
    membersByWorkspace.set(m.workspace_id, list);
  }

  const workspaces = (workspacesRes.data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    plan: w.plan,
    status: w.status,
    subscriptionStatus: w.subscription_status,
    createdAt: w.created_at,
    trialEndsAt: w.trial_ends_at,
    members: (membersByWorkspace.get(w.id) ?? []).sort((a, b) => a.email.localeCompare(b.email)),
  }));

  // Órfã = tem linha em auth.users e zero vínculo em workspace_members. É o
  // buraco que o v1 não mostrava e que 79f7114 abriu: cadastro que nunca
  // virou cliente.
  const orphans = (usersRes.data?.users ?? [])
    .filter((u) => !linkedUserIds.has(u.id))
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      createdAt: u.created_at,
      emailConfirmedAt: u.email_confirmed_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      blocked: !!u.banned_until && new Date(u.banned_until).getTime() > now,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return apiSuccess({ workspaces, orphans });
}
```

- [ ] **Step 2: Verificar as duas formas de resposta**

```bash
curl -s -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" \
  'http://localhost:3000/api/admin/accounts?group=workspace' | npx json 2>/dev/null || \
curl -s -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" \
  'http://localhost:3000/api/admin/accounts?group=workspace'
```

Expected: 2 workspaces (`Joao Reis` com 2 membros, `joao` com 1) e pelo menos 1 órfã (`agenciapixeo@gmail.com`). `tools@trinocompany.com.br` também aparece em `orphans` (é órfã por desenho).

```bash
curl -s -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" \
  'http://localhost:3000/api/admin/accounts' | head -c 120
```

Expected: começa com `{"data":{"accounts":[` — a forma antiga intacta.

- [ ] **Step 3: A tela**

```tsx
// src/app/painel/(app)/contas/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Member = {
  userId: string | null;
  email: string;
  role: string;
  memberStatus: string;
  blocked: boolean;
  lastSignInAt: string | null;
};

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  subscriptionStatus: string;
  createdAt: string;
  trialEndsAt: string | null;
  members: Member[];
};

type OrphanRow = {
  id: string;
  email: string | null;
  createdAt: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  blocked: boolean;
};

const PLAN_LABEL: Record<string, string> = { trial: "Trial", pro: "Pro", business: "Business" };

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

export default function PainelContasPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [orphans, setOrphans] = useState<OrphanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [onlyOrphans, setOnlyOrphans] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounts?group=workspace");
    const json = await res.json();
    setWorkspaces(res.ok ? json.data.workspaces : []);
    setOrphans(res.ok ? json.data.orphans : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const needle = q.trim().toLowerCase();
  // A busca cobre e-mail de membro além de nome e slug: procurar pela pessoa
  // é o caso real de suporte ("fulano ligou reclamando").
  const visibleWorkspaces = onlyOrphans
    ? []
    : workspaces.filter((w) => {
        if (status && w.status !== status) return false;
        if (plan && w.plan !== plan) return false;
        if (!needle) return true;
        return (
          w.name.toLowerCase().includes(needle) ||
          (w.slug ?? "").toLowerCase().includes(needle) ||
          w.members.some((m) => m.email.toLowerCase().includes(needle))
        );
      });

  const visibleOrphans = orphans.filter(
    (o) => !needle || (o.email ?? "").toLowerCase().includes(needle)
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-black text-zinc-900">Contas</h2>
        <p className="text-sm text-zinc-500 mt-1">
          {workspaces.length} workspace(s) · {orphans.length} conta(s) sem workspace
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, slug ou e-mail de membro"
            className="w-72 pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-900"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none"
        >
          <option value="">Todo status</option>
          <option value="active">Ativo</option>
          <option value="suspended">Suspenso</option>
          <option value="deleted">Apagado</option>
        </select>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none"
        >
          <option value="">Todo plano</option>
          <option value="trial">Trial</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={onlyOrphans}
            onChange={(e) => setOnlyOrphans(e.target.checked)}
          />
          Só órfãs
        </label>
      </div>

      {loading && <p className="text-sm text-zinc-400">Carregando…</p>}

      {!loading && (
        <div className="space-y-3">
          {visibleWorkspaces.map((w) => {
            const isCollapsed = collapsed[w.id] ?? false;
            return (
              <div key={w.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => setCollapsed((prev) => ({ ...prev, [w.id]: !isCollapsed }))}
                      className="text-zinc-400 hover:text-zinc-900"
                      aria-label={isCollapsed ? "Expandir" : "Recolher"}
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <div className="min-w-0">
                      <Link
                        href={`/contas/${w.id}`}
                        className="font-bold text-zinc-900 hover:text-amber-600"
                      >
                        {w.name}
                      </Link>
                      <p className="text-xs text-zinc-400 truncate">
                        {w.slug ?? "sem slug"} · criado {fmtDate(w.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs shrink-0">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-bold text-zinc-600">
                      {PLAN_LABEL[w.plan] ?? w.plan}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 font-bold",
                        w.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : "bg-red-50 text-red-700 border-red-200/60"
                      )}
                    >
                      {w.status}
                    </span>
                    <span className="text-zinc-400">
                      {w.members.length} membro{w.members.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="border-t border-zinc-100 divide-y divide-zinc-50">
                    {w.members.length === 0 && (
                      <p className="px-11 py-2.5 text-xs text-zinc-400 italic">Sem membros</p>
                    )}
                    {w.members.map((m) => (
                      <div
                        key={m.email}
                        className="flex items-center justify-between px-11 py-2.5 text-sm"
                      >
                        <span className="text-zinc-800">{m.email}</span>
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span>{m.role}</span>
                          <span>{m.memberStatus}</span>
                          <span className={m.blocked ? "font-bold text-red-600" : "text-zinc-400"}>
                            {m.blocked ? "bloqueada" : "ativa"}
                          </span>
                          <span className="text-zinc-400">
                            último acesso {fmtDate(m.lastSignInAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {visibleOrphans.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <p className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-100 bg-zinc-50/80">
                Sem workspace
              </p>
              <div className="divide-y divide-zinc-50">
                {visibleOrphans.map((o) => (
                  <div key={o.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-zinc-800">{o.email ?? "—"}</span>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>cadastrou {fmtDate(o.createdAt)}</span>
                      <span>{o.emailConfirmedAt ? "confirmada" : "não confirmada"}</span>
                      <span>
                        {o.lastSignInAt ? `último acesso ${fmtDate(o.lastSignInAt)}` : "nunca entrou"}
                      </span>
                      <span className={o.blocked ? "font-bold text-red-600" : "text-zinc-400"}>
                        {o.blocked ? "bloqueada" : "ativa"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleWorkspaces.length === 0 && visibleOrphans.length === 0 && (
            <p className="text-sm text-zinc-400 py-8 text-center">Nada encontrado</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar no navegador**

`http://painel.localhost:3000/contas`
Expected: dois blocos de workspace com os membros aninhados e o balde "Sem workspace". Buscar por `claraferro` filtra e mantém o workspace `Joao Reis` visível (busca por e-mail de membro). Marcar "Só órfãs" esconde os workspaces.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/accounts/route.ts "src/app/painel/(app)/contas/page.tsx"
git commit -m "feat(painel): lista de contas agrupada por workspace"
```

---

### Task 8: `/contas/[id]` — detalhe, cobrança e ações

**Files:**
- Modify: `src/app/api/admin/workspaces/[id]/route.ts`
- Create: `src/app/painel/(app)/contas/[id]/page.tsx`

**Interfaces:**
- Consumes: `requirePlatformAbility` (Task 3); `effectiveFeatures`, `FEATURE_KEYS` (já existentes).
- Produces: `GET /api/admin/workspaces/[id]` ganha três campos no envelope: `members: { userId, email, role, memberStatus, blocked }[]`, `billing: { plan, subscriptionStatus, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd }` e `audit: { id, actorEmail, action, createdAt, targetLabel }[]` (10 últimas — passa a vir preenchido depois da Task 10). `PATCH` passa a exigir a habilidade `billing` para `plan`/`trial` e `block` para `status`/`featureFlags`.

- [ ] **Step 1: Papéis e campos novos no `GET`**

Em `src/app/api/admin/workspaces/[id]/route.ts`:

```ts
import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
```

Troque a primeira linha do `GET`:

```ts
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAbility(request, "read_customer_data");
  if (!auth.ok) return auth.response;
```

Troque o `select` de membros dentro do `Promise.all` (era `select("status")`):

```ts
      admin.from("workspace_members").select("member_user_id, email, role, status").eq("workspace_id", id),
```

E, depois do `for` que conta `memberCounts`, acrescente a resolução de bloqueio por membro e monte a resposta nova:

```ts
  // banned_until mora em auth.users, não em workspace_members -- sem isto a
  // tela mostraria "ativo" para quem já está bloqueado na conta.
  const memberList = await Promise.all(
    (members ?? []).map(async (m) => {
      let blocked = false;
      if (m.member_user_id) {
        const { data: target } = await admin.auth.admin.getUserById(m.member_user_id);
        const bannedUntil = target?.user?.banned_until;
        blocked = !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();
      }
      return {
        userId: m.member_user_id,
        email: m.email,
        role: m.role,
        memberStatus: m.status,
        blocked,
      };
    })
  );

  const { data: auditRows } = await admin
    .from("platform_audit_log")
    .select("id, actor_email, action, target_label, created_at")
    .eq("target_type", "workspace")
    .eq("target_id", id)
    .order("created_at", { ascending: false })
    .limit(10);
```

No `return apiSuccess({...})` do `GET`, acrescente aos campos existentes:

```ts
    members: memberList,
    billing: {
      plan: workspace.plan,
      subscriptionStatus: (workspace as unknown as { subscription_status: string }).subscription_status,
      stripeCustomerId: (workspace as unknown as { stripe_customer_id: string | null }).stripe_customer_id,
      stripeSubscriptionId: (workspace as unknown as { stripe_subscription_id: string | null }).stripe_subscription_id,
      currentPeriodEnd: (workspace as unknown as { current_period_end: string | null }).current_period_end,
    },
    audit: (auditRows ?? []).map((a) => ({
      id: a.id,
      actorEmail: a.actor_email,
      action: a.action,
      targetLabel: a.target_label,
      createdAt: a.created_at,
    })),
```

E acrescente as 4 colunas novas ao `select` de `loadWorkspace` e ao tipo `WorkspaceRow`:

```ts
type WorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  feature_flags: unknown;
  created_at: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  current_period_end: string | null;
};
```

```ts
    .select(
      "id, name, slug, plan, status, feature_flags, created_at, trial_ends_at, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end"
    )
```

(o mesmo `select` no `.update(...).select(...)` do `PATCH`).

- [ ] **Step 2: Papel por campo no `PATCH` e no `DELETE`**

No `PATCH`, troque o gate de entrada e valide por campo:

```ts
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Gate mínimo aqui; cada campo tem a sua própria exigência logo abaixo,
  // porque plano e suspensão não são a mesma permissão (§5 do spec).
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
```

E, logo depois do parse do body:

```ts
  const touchesBilling = body.plan !== undefined;
  const touchesControls =
    body.status !== undefined || body.featureFlags !== undefined || body.name !== undefined || body.slug !== undefined;

  if (touchesBilling && !can(auth.ctx.role, "billing")) {
    return apiError("FORBIDDEN", `Papel '${auth.ctx.role}' não pode mudar plano`, 403);
  }
  if (touchesControls && !can(auth.ctx.role, "block")) {
    return apiError("FORBIDDEN", `Papel '${auth.ctx.role}' não pode mudar status ou features`, 403);
  }
```

com `import { can } from "@/lib/platform-admin";` no topo e `requirePlatformAdmin` mantido no import de `platform-admin-server`.

No `DELETE` (soft), troque o gate para:

```ts
  const auth = await requirePlatformAbility(request, "block");
  if (!auth.ok) return auth.response;
```

- [ ] **Step 3: Verificar o 403 no servidor (não pela UI)**

Insira um operador `support` de teste e chame a rota com a sessão dele. Sem uma segunda conta à mão, dá para provar o caminho com SQL + `whoami`:

```sql
-- via mcp__supabase__execute_sql
update public.platform_admins set role = 'support' where email = 'tools@trinocompany.com.br';
```

Com a sessão do painel aberta no navegador, no console do navegador (host do painel):

```js
await (await fetch('/api/admin/workspaces/<WORKSPACE_ID>', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan: 'pro' }),
})).status
```

Expected: `403`. Repita com `{ status: 'suspended' }` → `200` (support pode bloquear). Depois devolva:

```sql
update public.platform_admins set role = 'owner' where email = 'tools@trinocompany.com.br';
```

**Atenção:** `PLATFORM_ADMIN_EMAILS` tem precedência e devolve `owner`. Para este teste, comente a var no `.env.local` e reinicie o dev server — senão o papel da tabela nunca é consultado e o teste passa por engano.

- [ ] **Step 4: A tela de detalhe**

```tsx
// src/app/painel/(app)/contas/[id]/page.tsx
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Detail = {
  workspace: {
    id: string;
    name: string;
    slug: string | null;
    plan: string;
    status: string;
    featureFlags: Record<string, boolean>;
    createdAt: string;
    trialEndsAt: string | null;
  };
  usage: {
    members: { accepted: number; pending: number; suspended: number };
    telephony: { balanceCents: number; reservedCents: number } | null;
    whatsappMessages30d: number;
    deals: { count: number; lastActivityAt: string | null };
  };
  features: Record<string, boolean>;
  members: { userId: string | null; email: string; role: string; memberStatus: string; blocked: boolean }[];
  billing: {
    plan: string;
    subscriptionStatus: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: string | null;
  };
  audit: { id: number; actorEmail: string | null; action: string; targetLabel: string | null; createdAt: string }[];
};

const PLANS = ["trial", "pro", "business"] as const;
const STATUSES = ["active", "suspended", "deleted"] as const;

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

export default function PainelContaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/workspaces/${id}`);
    const json = await res.json();
    setDetail(res.ok ? json.data : null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/workspaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? "Falha ao atualizar");
      return;
    }
    load();
  }

  async function toggleMemberBlock(userId: string, email: string, blocked: boolean) {
    if (!confirm(blocked ? `Desbloquear ${email}?` : `Bloquear ${email}? O acesso é cortado na próxima ação dela — o histórico dela continua assinado.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: !blocked }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? "Falha ao atualizar conta");
      return;
    }
    load();
  }

  if (loading) return <p className="text-sm text-zinc-400">Carregando…</p>;
  if (!detail) return <p className="text-sm text-red-600">Conta não encontrada.</p>;

  const { workspace, usage, features, members, billing, audit } = detail;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Link href="/contas" className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900">
        <ArrowLeft size={14} /> Contas
      </Link>

      {error && (
        <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <section className="bg-white border border-zinc-200 rounded-xl p-4">
        <h2 className="text-lg font-black text-zinc-900">{workspace.name}</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {workspace.slug ?? "sem slug"} · {workspace.id} · criado {fmt(workspace.createdAt)}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select
            value={workspace.plan}
            disabled={busy}
            onChange={(e) => patch({ plan: e.target.value })}
            className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none"
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={workspace.status}
            disabled={busy}
            onChange={(e) => patch({ status: e.target.value })}
            className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">Membros</h3>
        <div className="divide-y divide-zinc-50">
          {members.map((m) => (
            <div key={m.email} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="text-zinc-800">{m.email}</p>
                <p className="text-xs text-zinc-400">{m.role} · {m.memberStatus}</p>
              </div>
              {m.userId && (
                <button
                  disabled={busy}
                  onClick={() => toggleMemberBlock(m.userId!, m.email, m.blocked)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg border disabled:opacity-40",
                    m.blocked
                      ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                      : "text-red-600 border-zinc-200 hover:border-red-200 hover:bg-red-50"
                  )}
                >
                  {m.blocked ? "Desbloquear" : "Bloquear"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">Features</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(features).map(([key, enabled]) => (
            <button
              key={key}
              disabled={busy}
              onClick={() => patch({ featureFlags: { [key]: !enabled } })}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg border disabled:opacity-40",
                enabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                  : "bg-zinc-50 text-zinc-500 border-zinc-200"
              )}
            >
              {key}: {enabled ? "on" : "off"}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">Uso</h3>
          <p className="text-zinc-600">Membros aceitos: {usage.members.accepted}</p>
          <p className="text-zinc-600">Negócios: {usage.deals.count}</p>
          <p className="text-zinc-600">WhatsApp (30d): {usage.whatsappMessages30d}</p>
          <p className="text-zinc-600">
            Telefonia: {usage.telephony ? money(usage.telephony.balanceCents) : "sem conta"}
          </p>
          <p className="text-zinc-400 text-xs mt-1">
            Última atividade em negócios: {fmt(usage.deals.lastActivityAt)}
          </p>
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">Cobrança</h3>
          <p className="text-zinc-600">Plano: {billing.plan}</p>
          <p className="text-zinc-600">
            Stripe:{" "}
            {billing.stripeCustomerId
              ? `${billing.stripeCustomerId} (${billing.subscriptionStatus})`
              : "não conectado"}
          </p>
          <p className="text-zinc-400 text-xs mt-1">
            {billing.subscriptionStatus === "manual"
              ? "Plano definido manualmente no painel."
              : `Período atual até ${fmt(billing.currentPeriodEnd)}`}
          </p>
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">
          Últimas ações nesta conta
        </h3>
        {audit.length === 0 && <p className="text-xs text-zinc-400">Nenhuma ação registrada.</p>}
        <div className="divide-y divide-zinc-50">
          {audit.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2 text-xs">
              <span className="font-semibold text-zinc-700">{a.action}</span>
              <span className="text-zinc-400">
                {a.actorEmail ?? "token"} · {fmt(a.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Verificar no navegador**

`http://painel.localhost:3000/contas` → clique num workspace.
Expected: blocos de identificação, membros (com Bloquear/Desbloquear), features, uso, cobrança ("Stripe: não conectado", "Plano definido manualmente no painel") e "Últimas ações" vazio (a auditoria começa a gravar na Task 10). Mudar plano e status recarrega e persiste — confira no banco:

```sql
select plan, status from public.workspaces where id = '<WORKSPACE_ID>';
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/workspaces "src/app/painel/(app)/contas"
git commit -m "feat(painel): detalhe da conta com membros, features, uso e cobrança"
```

---

### Task 9: Dashboard

**Files:**
- Create: `supabase/migrations/20260830100100_platform_dashboard_stats.sql`
- Create: `src/app/api/admin/dashboard/route.ts`
- Modify: `src/app/painel/(app)/page.tsx`

**Interfaces:**
- Consumes: `requirePlatformAbility(request, "read_aggregates")`.
- Produces: RPC `public.platform_dashboard_stats() returns json`; `GET /api/admin/dashboard` → `{ data: { workspaces: {total,active,suspended,deleted,trial}, trialsExpiring: [{id,name,slug,trialEndsAt}], stalled: [{id,name,slug,lastActivityAt}], orphanAccounts: [{id,email,createdAt}], telephony: {balanceCents,reservedCents}, telephonySpentMonthCents } }`.

- [ ] **Step 1: A RPC**

```sql
-- supabase/migrations/20260830100100_platform_dashboard_stats.sql
--
-- Cartões do dashboard do painel numa chamada só. Existe como função porque
-- dois dos números não saem do supabase-js: "contas paradas" precisa de
-- greatest() sobre agregados de duas tabelas, e "contas órfãs" precisa ler
-- auth.users -- e porque puxar deals inteiro pro Node só pra tirar um max()
-- é desperdício que cresce com o cliente.
--
-- ATENÇÃO: deal_history e contact_history NÃO têm workspace_id (só deal_id /
-- contact_id). Por isso "parada" é medida por deals.updated_at e
-- activities.created_at, que têm.
create or replace function public.platform_dashboard_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'workspaces', (
      select json_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'suspended', count(*) filter (where status = 'suspended'),
        'deleted', count(*) filter (where status = 'deleted'),
        'trial', count(*) filter (where plan = 'trial')
      )
      from public.workspaces
    ),
    'trialsExpiring', (
      select coalesce(json_agg(json_build_object(
        'id', id, 'name', name, 'slug', slug, 'trialEndsAt', trial_ends_at
      ) order by trial_ends_at), '[]'::json)
      from public.workspaces
      where status = 'active'
        and trial_ends_at is not null
        and trial_ends_at between now() and now() + interval '7 days'
    ),
    'stalled', (
      select coalesce(json_agg(json_build_object(
        'id', x.id, 'name', x.name, 'slug', x.slug, 'lastActivityAt', x.last_activity_at
      ) order by x.last_activity_at), '[]'::json)
      from (
        select w.id, w.name, w.slug,
          greatest(
            coalesce((select max(d.updated_at) from public.deals d where d.workspace_id = w.id), 'epoch'::timestamptz),
            coalesce((select max(a.created_at) from public.activities a where a.workspace_id = w.id), 'epoch'::timestamptz)
          ) as last_activity_at
        from public.workspaces w
        where w.status = 'active'
      ) x
      where x.last_activity_at < now() - interval '14 days'
    ),
    'orphanAccounts', (
      -- Operador da plataforma é órfão por desenho (não é membro de
      -- workspace nenhum): não conta como cadastro que não converteu.
      select coalesce(json_agg(json_build_object(
        'id', u.id, 'email', u.email, 'createdAt', u.created_at
      ) order by u.created_at desc), '[]'::json)
      from auth.users u
      where not exists (select 1 from public.workspace_members m where m.member_user_id = u.id)
        and not exists (select 1 from public.platform_admins pa where pa.user_id = u.id)
    ),
    'telephony', (
      select json_build_object(
        'balanceCents', coalesce(sum(balance_cents), 0),
        'reservedCents', coalesce(sum(reserved_cents), 0)
      )
      from public.telephony_balances
    ),
    -- Débito é negativo no ledger (kind = 'call_debit', amount_cents < 0);
    -- o sinal é invertido aqui pra "gasto do mês" ser um número positivo.
    'telephonySpentMonthCents', (
      select coalesce(-sum(amount_cents) filter (where amount_cents < 0), 0)
      from public.telephony_ledger
      where created_at >= date_trunc('month', now())
    )
  );
$$;

revoke all on function public.platform_dashboard_stats() from anon, authenticated, public;
grant execute on function public.platform_dashboard_stats() to service_role;
```

- [ ] **Step 2: Aplicar e conferir**

Use `mcp__supabase__apply_migration` com `project_id: "etdkzpiehoivrviylemd"`, `name: "platform_dashboard_stats"`, `query` = o SQL acima. Depois, com `mcp__supabase__execute_sql`:

```sql
select public.platform_dashboard_stats();
```

Expected: JSON com `workspaces.total = 2`, `orphanAccounts` contendo `agenciapixeo@gmail.com` e **não** contendo `tools@trinocompany.com.br` (semeado como operador na Task 1).

E que o grant não vazou:

```sql
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'platform_dashboard_stats'
  and grantee in ('anon','authenticated','PUBLIC');
```

Expected: 0 linhas.

- [ ] **Step 3: A rota**

```ts
// src/app/api/admin/dashboard/route.ts
//
// read_aggregates, não read_customer_data: o papel `billing` enxerga os
// números somados do dashboard sem enxergar dado de cliente (§5 do spec).
import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformAbility(request, "read_aggregates");
  if (!auth.ok) return auth.response;

  const { data, error } = await adminClient().rpc("platform_dashboard_stats");
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess(data);
}
```

- [ ] **Step 4: A tela**

```tsx
// src/app/painel/(app)/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  workspaces: { total: number; active: number; suspended: number; deleted: number; trial: number };
  trialsExpiring: { id: string; name: string; slug: string | null; trialEndsAt: string }[];
  stalled: { id: string; name: string; slug: string | null; lastActivityAt: string }[];
  orphanAccounts: { id: string; email: string | null; createdAt: string }[];
  telephony: { balanceCents: number; reservedCents: number };
  telephonySpentMonthCents: number;
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function PainelDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/dashboard");
      const json = await res.json();
      setStats(res.ok ? json.data : null);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-zinc-400">Carregando…</p>;
  if (!stats) return <p className="text-sm text-red-600">Falha ao carregar os números.</p>;

  return (
    <div className="max-w-5xl mx-auto grid gap-4 md:grid-cols-2">
      <Card title="Contas">
        <div className="flex items-baseline gap-4">
          <span className="text-3xl font-black text-zinc-900">{stats.workspaces.total}</span>
          <span className="text-sm text-zinc-500">
            {stats.workspaces.active} ativas · {stats.workspaces.suspended} suspensas ·{" "}
            {stats.workspaces.trial} em trial
          </span>
        </div>
      </Card>

      <Card title="Telefonia">
        <p className="text-sm text-zinc-700">Saldo somado: {money(stats.telephony.balanceCents)}</p>
        <p className="text-sm text-zinc-500">Gasto no mês: {money(stats.telephonySpentMonthCents)}</p>
      </Card>

      <Card title="Trials vencendo em 7 dias">
        {stats.trialsExpiring.length === 0 && <p className="text-xs text-zinc-400">Nenhum.</p>}
        {stats.trialsExpiring.map((w) => (
          <Link
            key={w.id}
            href={`/contas/${w.id}`}
            className="flex items-center justify-between py-1.5 text-sm hover:text-amber-600"
          >
            <span>{w.name}</span>
            <span className="text-xs text-zinc-400">vence {fmtDate(w.trialEndsAt)}</span>
          </Link>
        ))}
      </Card>

      <Card title="Contas paradas (14+ dias)">
        {stats.stalled.length === 0 && <p className="text-xs text-zinc-400">Nenhuma.</p>}
        {stats.stalled.map((w) => (
          <Link
            key={w.id}
            href={`/contas/${w.id}`}
            className="flex items-center justify-between py-1.5 text-sm hover:text-amber-600"
          >
            <span>{w.name}</span>
            <span className="text-xs text-zinc-400">último sinal {fmtDate(w.lastActivityAt)}</span>
          </Link>
        ))}
      </Card>

      <Card title="Contas órfãs (cadastro que não converteu)">
        {stats.orphanAccounts.length === 0 && <p className="text-xs text-zinc-400">Nenhuma.</p>}
        {stats.orphanAccounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-zinc-700">{a.email ?? "—"}</span>
            <span className="text-xs text-zinc-400">cadastrou {fmtDate(a.createdAt)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Verificar**

`http://painel.localhost:3000/` → cartões preenchidos. `agenciapixeo@gmail.com` aparece em "Contas órfãs"; `tools@` não.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: verde. Se a RPC não aparecer nos tipos gerados, regenere `database.types.ts` (`mcp__supabase__generate_typescript_types`) — funções entram no tipo `Database["public"]["Functions"]`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260830100100_platform_dashboard_stats.sql src/app/api/admin/dashboard "src/app/painel/(app)/page.tsx" src/lib/supabase/database.types.ts
git commit -m "feat(painel): dashboard com trials, contas paradas, órfãs e telefonia"
```

---

### Task 10: Auditoria — gravar em toda escrita e mostrar

**Files:**
- Create: `src/lib/platform-audit.ts`
- Create: `src/app/api/admin/audit/route.ts`
- Create: `src/app/painel/(app)/auditoria/page.tsx`
- Modify: `src/app/api/admin/workspaces/route.ts`
- Modify: `src/app/api/admin/workspaces/[id]/route.ts`
- Modify: `src/app/api/admin/accounts/[id]/route.ts`

**Interfaces:**
- Consumes: `PlatformAdminContext` (Task 3), tabela `platform_audit_log` (Task 1).
- Produces: `logPlatformAction(ctx: PlatformAdminContext, entry: AuditEntry): Promise<{ ok: true } | { ok: false; message: string }>` com
  `AuditEntry = { action: string; targetType?: "workspace" | "account" | "operator" | null; targetId?: string | null; targetLabel?: string | null; metadata?: Record<string, unknown> | null }`;
  `GET /api/admin/audit?limit=&action=&targetId=` → `{ data: { entries: [{ id, actorEmail, actorRole, actorVia, action, targetType, targetId, targetLabel, metadata, createdAt }] } }`.
  Ações usadas por este plano: `workspace.create`, `workspace.update`, `workspace.suspend`, `workspace.delete_soft`, `workspace.delete_hard`, `account.block`, `account.unblock`, `account.delete_hard`, `impersonate.start`.

- [ ] **Step 1: O escritor**

```ts
// src/lib/platform-audit.ts
//
// Toda escrita do painel passa por aqui ANTES de executar a ação. Se a
// gravação falhar, a ação não acontece -- uma operação sem rastro é pior do
// que uma operação que não aconteceu, e o console.log da Vercel (que era o
// "log" até agora) expira.
//
// Server-only: usa service-role.
import { adminClient, type PlatformAdminContext } from "@/lib/platform-admin-server";

export interface AuditEntry {
  /** Verbo pontuado: 'workspace.suspend', 'account.block', 'impersonate.start'. */
  action: string;
  targetType?: "workspace" | "account" | "operator" | null;
  targetId?: string | null;
  /** Nome/e-mail no momento da ação -- o log tem que sobreviver a rename e
   * a delete do alvo. */
  targetLabel?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logPlatformAction(
  ctx: PlatformAdminContext,
  entry: AuditEntry
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = adminClient();
  const { error } = await admin.from("platform_audit_log").insert({
    actor_email: ctx.email,
    actor_role: ctx.role,
    actor_via: ctx.via,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    target_label: entry.targetLabel ?? null,
    metadata: entry.metadata ?? null,
  });

  if (error) return { ok: false, message: `Falha ao gravar auditoria: ${error.message}` };

  // last_seen_at = última AÇÃO registrada, não última visita: atualizar a
  // cada page view custaria um write por navegação sem contar nada útil.
  if (ctx.userId) {
    await admin
      .from("platform_admins")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", ctx.userId);
  }

  return { ok: true };
}
```

- [ ] **Step 2: Gravar nas escritas que já existem**

Em `src/app/api/admin/workspaces/[id]/route.ts`, no `PATCH`, **antes** do `.update(...)`:

```ts
  const logged = await logPlatformAction(auth.ctx, {
    action: body.status !== undefined ? "workspace.suspend" : "workspace.update",
    targetType: "workspace",
    targetId: id,
    targetLabel: current.name,
    metadata: { fields: Object.keys(update), from: { plan: current.plan, status: current.status }, to: update },
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);
```

No `DELETE` (soft), antes do `.update({ status: "deleted" })`:

```ts
  const logged = await logPlatformAction(auth.ctx, {
    action: "workspace.delete_soft",
    targetType: "workspace",
    targetId: id,
    targetLabel: current.name,
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);
```

Em `src/app/api/admin/workspaces/route.ts`, no `POST`, depois de o workspace e o membro existirem (a criação não é destrutiva; logar depois evita linha de auditoria de um workspace que o rollback apagou):

```ts
  const logged = await logPlatformAction(auth.ctx, {
    action: "workspace.create",
    targetType: "workspace",
    targetId: workspace.id,
    targetLabel: name,
    metadata: { slug, plan, ownerEmail },
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);
```

Em `src/app/api/admin/accounts/[id]/route.ts`, no `PATCH`, antes do `updateUserById`:

```ts
  const { data: targetUser } = await admin.auth.admin.getUserById(id);
  const logged = await logPlatformAction(auth.ctx, {
    action: body.blocked ? "account.block" : "account.unblock",
    targetType: "account",
    targetId: id,
    targetLabel: targetUser?.user?.email ?? null,
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);
```

(troque também o gate desse `PATCH` para `requirePlatformAbility(request, "block")`.)

Adicione `import { logPlatformAction } from "@/lib/platform-audit";` nos três arquivos.

- [ ] **Step 3: A rota de leitura**

```ts
// src/app/api/admin/audit/route.ts
import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformAbility(request, "read_customer_data");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
  const action = url.searchParams.get("action");
  const targetId = url.searchParams.get("targetId");

  let query = adminClient()
    .from("platform_audit_log")
    .select("id, actor_email, actor_role, actor_via, action, target_type, target_id, target_label, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) query = query.eq("action", action);
  if (targetId) query = query.eq("target_id", targetId);

  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess({
    entries: (data ?? []).map((e) => ({
      id: e.id,
      actorEmail: e.actor_email,
      actorRole: e.actor_role,
      actorVia: e.actor_via,
      action: e.action,
      targetType: e.target_type,
      targetId: e.target_id,
      targetLabel: e.target_label,
      metadata: e.metadata,
      createdAt: e.created_at,
    })),
  });
}
```

- [ ] **Step 4: A tela**

```tsx
// src/app/painel/(app)/auditoria/page.tsx
"use client";

import { useEffect, useState } from "react";

type Entry = {
  id: number;
  actorEmail: string | null;
  actorRole: string | null;
  actorVia: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  metadata: unknown;
  createdAt: string;
};

export default function PainelAuditoriaPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/audit?limit=200");
      const json = await res.json();
      setEntries(res.ok ? json.data.entries : []);
      setLoading(false);
    })();
  }, []);

  const needle = q.trim().toLowerCase();
  const visible = needle
    ? entries.filter(
        (e) =>
          e.action.toLowerCase().includes(needle) ||
          (e.actorEmail ?? "").toLowerCase().includes(needle) ||
          (e.targetLabel ?? "").toLowerCase().includes(needle)
      )
    : entries;

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-xl font-black text-zinc-900 mb-1">Auditoria</h2>
      <p className="text-sm text-zinc-500 mb-4">{entries.length} ação(ões) registrada(s)</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filtrar por ação, operador ou alvo"
        className="w-80 px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-900 mb-4"
      />

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Operador</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Alvo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">Carregando…</td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">Nada registrado</td>
              </tr>
            )}
            {visible.map((e) => (
              <tr key={e.id} className="border-t border-zinc-50">
                <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-2.5 text-zinc-700">
                  {e.actorEmail ?? "token"}
                  <span className="text-xs text-zinc-400"> · {e.actorRole}</span>
                </td>
                <td className="px-4 py-2.5 font-semibold text-zinc-900">{e.action}</td>
                <td className="px-4 py-2.5 text-zinc-600">
                  {e.targetLabel ?? e.targetId ?? "—"}
                  {e.targetType && <span className="text-xs text-zinc-400"> ({e.targetType})</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar que toda escrita grava — inclusive quando falha depois**

1. No painel, mude o plano de um workspace e depois suspenda-o.
2. `http://painel.localhost:3000/auditoria` → duas linhas (`workspace.update`, `workspace.suspend`) com operador e alvo.
3. Prove que o log vem **antes** da ação: chame o `PATCH` com um slug já usado (a rota falha com 409 depois de logar):

```bash
curl -s -X PATCH -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"slug":"joao"}' \
  http://localhost:3000/api/admin/workspaces/<OUTRO_WORKSPACE_ID>
```

Expected: resposta `409 SLUG_TAKEN` **e** nenhuma linha nova (o 409 acontece antes do log, na validação). Agora o caso que importa:

```sql
select action, actor_email, target_label, created_at
from public.platform_audit_log order by created_at desc limit 5;
```

Expected: as ações reais aparecem, e a tentativa recusada por validação não aparece — o que o §14 do spec pede é que **ação executada** nunca fique sem linha, e que a linha exista mesmo quando o `update` falha no banco depois (esse caminho está coberto porque `logPlatformAction` roda antes do `.update`).

4. Abra o detalhe de uma conta → o bloco "Últimas ações nesta conta" agora tem linhas.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add src/lib/platform-audit.ts src/app/api/admin "src/app/painel/(app)/auditoria"
git commit -m "feat(painel): trilha de auditoria gravada antes de toda escrita, com tela"
```

---

### Task 11: Impersonate — "entrar como cliente"

**Files:**
- Create: `src/app/api/admin/impersonate/route.ts`
- Create: `src/app/api/auth/impersonate/route.ts`
- Create: `src/components/layout/impersonation-banner.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/app/painel/(app)/contas/[id]/page.tsx`

**Interfaces:**
- Consumes: `requirePlatformAbility(request, "impersonate")`, `logPlatformAction` (Task 10), exclusão de `api/auth/impersonate` no matcher (Task 5).
- Produces: `POST /api/admin/impersonate` com body `{ userId: string }` → `{ data: { url: string } }` (URL no host do CRM, uso único); `GET /api/auth/impersonate?token_hash=&email=` → cria a sessão, marca o cookie `impersonated_by` e redireciona para `/`; `<ImpersonationBanner />` renderizado pelo `AppShell`.

- [ ] **Step 1: A rota que gera o link**

```ts
// src/app/api/admin/impersonate/route.ts
//
// Gera um magic link de uso único pro usuário alvo e devolve a URL de
// callback NO HOST DO CRM. O painel abre em aba nova.
//
// RISCO DOCUMENTADO (§11 do spec): a sessão emprestada SOBRESCREVE a sessão
// que o operador tivesse no CRM naquele navegador. Hoje é inofensivo
// (tools@ não usa o CRM), mas continua verdade.
import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { logPlatformAction } from "@/lib/platform-audit";
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requirePlatformAbility(request, "impersonate");
  if (!auth.ok) return auth.response;

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
  }
  if (!body.userId) return apiError("VALIDATION_ERROR", "userId é obrigatório", 400);

  const admin = adminClient();
  const { data: target } = await admin.auth.admin.getUserById(body.userId);
  const email = target?.user?.email;
  if (!email) return apiError("NOT_FOUND", "Conta não encontrada", 404);

  // Auditoria ANTES de gerar o link: um link gerado é acesso concedido,
  // mesmo que o operador nunca clique nele.
  const logged = await logPlatformAction(auth.ctx, {
    action: "impersonate.start",
    targetType: "account",
    targetId: body.userId,
    targetLabel: email,
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);

  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !link?.properties?.hashed_token) {
    return apiError("INTERNAL_ERROR", error?.message ?? "Falha ao gerar link de acesso", 500);
  }

  // O callback mora no host do CRM: é lá que a sessão precisa nascer. O host
  // do painel não pode ser usado aqui -- o cookie é host-only e a sessão
  // ficaria do lado errado.
  const crmBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL("/api/auth/impersonate", crmBase);
  url.searchParams.set("token_hash", link.properties.hashed_token);
  url.searchParams.set("email", email);

  return apiSuccess({ url: url.toString() });
}
```

- [ ] **Step 2: O callback no host do CRM**

```ts
// src/app/api/auth/impersonate/route.ts
//
// Chamada de máquina sem cookie: está na lista de exclusões do matcher em
// src/proxy.ts de propósito. Sem isso levaria 307 pro /login e o
// impersonate nunca aconteceria (a mesma armadilha de api/cron).
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const email = searchParams.get("email");

  if (!tokenHash || !email) {
    return NextResponse.redirect(`${origin}/login?error=impersonate`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=impersonate`);
  }

  const response = NextResponse.redirect(`${origin}/`);
  // NÃO httpOnly de propósito: a faixa é um componente de cliente e o valor
  // é só um e-mail -- não é credencial, não é fronteira de segurança. A
  // fronteira é o cookie de sessão do Supabase, que continua httpOnly.
  response.cookies.set("impersonated_by", email, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
```

- [ ] **Step 3: A faixa**

```tsx
// src/components/layout/impersonation-banner.tsx
"use client";

import { useEffect, useState } from "react";

/**
 * Única pista visual de que os dados na tela não são seus. Renderizada pelo
 * AppShell (layout), nunca por uma página específica: se ela sumisse numa
 * rota, alguém agiria achando que está na própria conta.
 */
export function ImpersonationBanner() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)impersonated_by=([^;]*)/);
    setEmail(match ? decodeURIComponent(match[1]) : null);
  }, []);

  if (!email) return null;

  async function sair() {
    document.cookie = "impersonated_by=; path=/; max-age=0";
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="bg-amber-500 text-white text-xs font-bold px-4 py-2 flex items-center justify-between">
      <span>SESSÃO DE SUPORTE — você está como {email}</span>
      <button onClick={sair} className="underline underline-offset-2">
        sair
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Montar a faixa no `AppShell`**

Em `src/components/layout/app-shell.tsx`, importe e embrulhe os dois retornos de `AppShell`:

```tsx
import { ImpersonationBanner } from "./impersonation-banner";
```

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/login") || pathname.startsWith("/convite")) {
    return (
      <>
        <ImpersonationBanner />
        {children}
      </>
    );
  }
  return (
    <>
      <ImpersonationBanner />
      <WorkspaceProvider>
        <CrmProvider>
          <AutomacoesProvider>
            <AppContent>{children}</AppContent>
          </AutomacoesProvider>
        </CrmProvider>
      </WorkspaceProvider>
    </>
  );
}
```

- [ ] **Step 5: O botão no detalhe da conta**

Em `src/app/painel/(app)/contas/[id]/page.tsx`, dentro da seção "Membros", ao lado do botão de bloquear:

```tsx
                {m.userId && (
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      const res = await fetch("/api/admin/impersonate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: m.userId }),
                      });
                      setBusy(false);
                      const json = await res.json().catch(() => null);
                      if (!res.ok) {
                        setError(json?.error?.message ?? "Falha ao entrar como cliente");
                        return;
                      }
                      window.open(json.data.url, "_blank", "noopener");
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    Entrar como
                  </button>
                )}
```

(coloque-o num `<div className="flex items-center gap-2">` junto do botão de bloquear).

- [ ] **Step 6: Verificar ponta a ponta**

1. No painel, detalhe de `Joao Reis` → "Entrar como" em `claraferrodrigui@gmail.com`.
2. Abre aba nova em `localhost:3000` já logado como ela, com a **faixa âmbar** no topo em toda tela (`/`, `/negocios`, `/contatos`).
3. "sair" na faixa → volta pro `/login`, faixa some.
4. Auditoria: `http://painel.localhost:3000/auditoria` tem `impersonate.start` com o alvo.
5. Prove a exclusão do matcher:

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'http://localhost:3000/api/auth/impersonate'
```

Expected: `307` para `/login?error=impersonate` (a **rota** respondeu). Se vier `307` para `/login` puro, a exclusão do matcher não está valendo — volte na Task 5.

6. Papel: com o operador em `billing` (ver Step 3 da Task 8 para trocar), `POST /api/admin/impersonate` responde `403`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/impersonate src/app/api/auth/impersonate src/components/layout "src/app/painel/(app)/contas"
git commit -m "feat(painel): impersonate com faixa fixa no CRM e auditoria"
```

---

### Task 12: Fechar o cadastro público

**Files:**
- Modify: `src/app/(crm)/login/page.tsx`

**Interfaces:**
- Produces: `/login` sem modo `signup`. Criar conta passa a existir em dois lugares: o painel (`POST /api/admin/workspaces`) e o convite (`/convite/[token]` → `POST /api/convites/aceitar`, que já usa `admin.createUser` com service-role).

- [ ] **Step 1: Tirar o signup da página**

Em `src/app/(crm)/login/page.tsx`:

1. Apague o estado `mode`, `firstName`, `lastName`, `success` e a função inteira `handleSignup` (linhas ~53-82 do arquivo atual).
2. `<form onSubmit={mode === "login" ? handleLogin : handleSignup}` → `<form onSubmit={handleLogin}`.
3. Apague o bloco `{mode === "signup" && ( ... )}` com os campos Nome/Sobrenome.
4. `placeholder={mode === "signup" ? "Crie uma senha" : "Digite sua senha"}` → `placeholder="Digite sua senha"`.
5. `{mode === "login" ? "Entrar na sua conta" : "Criar sua conta"}` → `"Entrar na sua conta"`.
6. Substitua o bloco de toggle no rodapé por:

```tsx
          {/* Cadastro público fechado (§9 do design v2): conta nova nasce no
              painel da plataforma ou por convite. A trava de verdade é o
              "Enable sign-ups" desligado no Supabase -- tirar o botão daqui
              sozinho deixaria POST /auth/v1/signup aberto. */}
          <div className="mt-6 text-center text-xs text-zinc-400 space-y-2">
            <p>
              Não tem uma conta? Fale com quem administra o seu workspace para
              receber um convite.
            </p>
            <p className="pt-2">
              <a href="/" className="hover:text-zinc-500 transition-colors">
                Voltar ao site
              </a>
            </p>
          </div>
```

7. Ajuste o texto da coluna da esquerda: `Crie sua conta grátis e tenha acesso completo por 21 dias. Sem cartão de crédito.` → `Acesse sua conta para continuar.`

- [ ] **Step 2: Confirmar que sobrou zero `signUp` no repo**

Run: `grep -rn "signUp" src`
Expected: nenhuma linha (o único uso era `src/app/login/page.tsx:65`; `/api/convites/aceitar` usa `admin.createUser`).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: verde. Nenhuma variável órfã (`firstName`, `success`, `CheckCircle2`) — se o lint reclamar de import não usado, remova o import.

- [ ] **Step 4: Desligar sign-ups no Supabase (passo manual do dono)**

Supabase → projeto `etdkzpiehoivrviylemd` → Authentication → Providers → Email → desmarque **"Enable sign-ups"** → Save.

Isso vale para todos os provedores, Google OAuth incluído: depois de desligado, um Google login de e-mail **desconhecido** é recusado, e só contas já existentes entram. É o comportamento desejado, mas anote: quem tentar "entrar com Google" sem conta vai ver um erro, não um cadastro.

- [ ] **Step 5: Provar que a API fechou**

```bash
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"teste-cadastro-fechado@example.com","password":"senha-de-teste-123"}'
```

Expected: erro do GoTrue (`"Signups not allowed for this instance"`), **não** um usuário criado. Se vier usuário criado, o toggle não salvou.

- [ ] **Step 6: Provar que o convite continua funcionando**

1. No CRM, como admin de um workspace: `/configuracoes/usuarios` → convide um e-mail novo.
2. Abra o link `/convite/<token>` numa janela anônima, defina nome e senha.
3. Expected: entra no CRM normalmente. É a prova de que `admin.createUser` (service-role) não é afetado pelo toggle — o único caminho que seria afetado é `signUp`, que não existe mais.
4. Limpe o convidado de teste depois (`/configuracoes/usuarios` → remover).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(crm)/login/page.tsx"
git commit -m "feat(auth): fecha cadastro público -- conta nasce no painel ou por convite"
```

---

### Task 13: Remoção definitiva — cercada pelas quatro travas

**Files:**
- Create: `supabase/migrations/20260830100200_platform_deletion_preview.sql`
- Modify: `src/app/api/admin/workspaces/[id]/route.ts`
- Modify: `src/app/api/admin/accounts/[id]/route.ts`
- Modify: `src/app/painel/(app)/contas/[id]/page.tsx`

**Interfaces:**
- Consumes: `requirePlatformAbility(request, "hard_delete")`, `logPlatformAction` (Task 10).
- Produces: RPC `public.platform_deletion_preview(p_workspace_id uuid) returns json` → `{ deals, contacts, companies, activities, whatsappMessages, telephonyCalls, telephonyBalanceCents, members }`; `GET /api/admin/workspaces/[id]?preview=delete` → a mesma contagem; `DELETE /api/admin/workspaces/[id]?hard=1&confirm=<slug>`; `DELETE /api/admin/accounts/[id]?confirm=<email>`.

- [ ] **Step 1: A RPC de contagem**

```sql
-- supabase/migrations/20260830100200_platform_deletion_preview.sql
--
-- Contagem real do que a remoção definitiva destrói, medida no instante da
-- pergunta. O diálogo do painel mostra ESTES números -- texto genérico
-- ("isso apaga tudo") não é confirmação informada.
--
-- Contexto (§8.1 do spec, verificado em pg_constraint em 2026-08-30): apagar
-- a linha do DONO em auth.users cascateia para workspaces e de lá para 43
-- tabelas. Um clique destrói o CRM inteiro do cliente, sem volta.
create or replace function public.platform_deletion_preview(p_workspace_id uuid)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'deals', (select count(*) from public.deals where workspace_id = p_workspace_id),
    'contacts', (select count(*) from public.contacts where workspace_id = p_workspace_id),
    'companies', (select count(*) from public.companies where workspace_id = p_workspace_id),
    'activities', (select count(*) from public.activities where workspace_id = p_workspace_id),
    'whatsappMessages', (select count(*) from public.whatsapp_messages where workspace_id = p_workspace_id),
    'telephonyCalls', (select count(*) from public.telephony_calls where workspace_id = p_workspace_id),
    'telephonyBalanceCents', (
      select coalesce((select balance_cents from public.telephony_balances where workspace_id = p_workspace_id), 0)
    ),
    'members', (select count(*) from public.workspace_members where workspace_id = p_workspace_id)
  );
$$;

revoke all on function public.platform_deletion_preview(uuid) from anon, authenticated, public;
grant execute on function public.platform_deletion_preview(uuid) to service_role;
```

- [ ] **Step 2: Aplicar e conferir**

`mcp__supabase__apply_migration` com `project_id: "etdkzpiehoivrviylemd"`, `name: "platform_deletion_preview"`. Depois:

```sql
select public.platform_deletion_preview('<WORKSPACE_ID_REAL>');
```

Expected: JSON com contagens que batem com o que a conta tem. Confira uma delas à mão:

```sql
select count(*) from public.deals where workspace_id = '<WORKSPACE_ID_REAL>';
```

- [ ] **Step 3: `preview` e `hard` na rota de workspace**

Em `src/app/api/admin/workspaces/[id]/route.ts`, no `GET`, logo depois de carregar `workspace`:

```ts
  // ?preview=delete: contagem real do que a remoção definitiva destrói.
  // Mesma habilidade da remoção -- ninguém que não pode apagar precisa ver
  // o inventário do que seria apagado.
  if (new URL(request.url).searchParams.get("preview") === "delete") {
    if (!can(auth.ctx.role, "hard_delete")) {
      return apiError("FORBIDDEN", `Papel '${auth.ctx.role}' não pode apagar em definitivo`, 403);
    }
    const { data: preview, error: previewErr } = await admin.rpc("platform_deletion_preview", {
      p_workspace_id: id,
    });
    if (previewErr) return apiError("INTERNAL_ERROR", previewErr.message, 500);
    return apiSuccess({ preview, slug: workspace.slug });
  }
```

E no `DELETE`, antes do soft-delete atual:

```ts
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const hard = url.searchParams.get("hard") === "1";

  const auth = hard
    ? await requirePlatformAbility(request, "hard_delete")
    : await requirePlatformAbility(request, "block");
  if (!auth.ok) return auth.response;

  const admin = adminClient();
  const current = await loadWorkspace(admin, id);
  if (!current) return apiError("NOT_FOUND", "Workspace não encontrado", 404);

  if (hard) {
    // Trava 2: digitação. Sem "tem certeza? [OK]".
    const confirm = url.searchParams.get("confirm");
    if (!confirm || confirm !== current.slug) {
      return apiError(
        "CONFIRMATION_REQUIRED",
        "confirm precisa ser exatamente o slug do workspace",
        400
      );
    }

    // Trava 1: contagem real, medida agora.
    const { data: preview, error: previewErr } = await admin.rpc("platform_deletion_preview", {
      p_workspace_id: id,
    });
    if (previewErr) return apiError("INTERNAL_ERROR", previewErr.message, 500);

    // Trava 3: auditoria com a contagem junto, ANTES de executar -- é o
    // único jeito de o log dizer o que foi perdido depois que não existe mais.
    const logged = await logPlatformAction(auth.ctx, {
      action: "workspace.delete_hard",
      targetType: "workspace",
      targetId: id,
      targetLabel: `${current.name} (${current.slug})`,
      metadata: { preview },
    });
    if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);

    // Apagar o dono em auth.users cascateia para workspaces e para as 43
    // tabelas abaixo dele (§8.1). É intencional aqui, e só aqui.
    const { data: ws } = await admin
      .from("workspaces")
      .select("owner_user_id")
      .eq("id", id)
      .maybeSingle();
    if (!ws?.owner_user_id) {
      return apiError("INTERNAL_ERROR", "Workspace sem dono — remoção manual necessária", 500);
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(ws.owner_user_id);
    if (delErr) return apiError("INTERNAL_ERROR", delErr.message, 500);

    return apiSuccess({ id, deleted: "hard", preview });
  }
```

(o soft-delete existente segue depois, inalterado a partir do `logPlatformAction` da Task 10).

- [ ] **Step 4: `DELETE` de conta, com a trava do dono**

Em `src/app/api/admin/accounts/[id]/route.ts`, acrescente:

```ts
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAbility(request, "hard_delete");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = adminClient();

  const { data: target } = await admin.auth.admin.getUserById(id);
  const email = target?.user?.email;
  if (!email) return apiError("NOT_FOUND", "Conta não encontrada", 404);

  // Trava 2: digitação (o e-mail, aqui).
  const confirm = new URL(request.url).searchParams.get("confirm");
  if (!confirm || confirm.toLowerCase() !== email.toLowerCase()) {
    return apiError("CONFIRMATION_REQUIRED", "confirm precisa ser exatamente o e-mail da conta", 400);
  }

  // Trava 4: dono de workspace ativo não sai como "conta". Apagar essa
  // linha cascatearia o workspace inteiro sem que ninguém tivesse decidido
  // apagar o workspace -- que é exatamente o acidente de §8.1.
  const { data: owned } = await admin
    .from("workspaces")
    .select("id, name, slug, status")
    .eq("owner_user_id", id)
    .neq("status", "deleted");

  if (owned && owned.length > 0) {
    return apiError(
      "OWNS_ACTIVE_WORKSPACE",
      `Esta conta é dona de ${owned.length} workspace(s) ativo(s) (${owned
        .map((w) => w.slug ?? w.name)
        .join(", ")}). Apague o workspace conscientemente ou transfira a posse antes.`,
      409
    );
  }

  // Trava 1 + 3: o que a conta assina, contado agora, e auditado antes.
  const [{ count: deals }, { count: contacts }, { count: companies }, { data: memberships }] =
    await Promise.all([
      admin.from("deals").select("id", { count: "exact", head: true }).eq("owner_id", id),
      admin.from("contacts").select("id", { count: "exact", head: true }).eq("owner_id", id),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("owner_id", id),
      admin.from("workspace_members").select("workspace_id, role").eq("member_user_id", id),
    ]);

  const preview = {
    dealsPerdemAutoria: deals ?? 0,
    contactsPerdemAutoria: contacts ?? 0,
    companiesPerdemAutoria: companies ?? 0,
    memberships: memberships?.length ?? 0,
  };

  const logged = await logPlatformAction(auth.ctx, {
    action: "account.delete_hard",
    targetType: "account",
    targetId: id,
    targetLabel: email,
    metadata: { preview },
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess({ id, deleted: "hard", preview });
}
```

- [ ] **Step 5: O diálogo no painel**

Em `src/app/painel/(app)/contas/[id]/page.tsx`, acrescente ao estado e uma seção "Zona de risco" no fim (antes do bloco de auditoria):

```tsx
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [confirmText, setConfirmText] = useState("");
```

```tsx
      <section className="bg-white border border-red-200 rounded-xl p-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-red-500 mb-2">
          Zona de risco
        </h3>
        <p className="text-xs text-zinc-500 mb-3">
          Desativar (status <code>suspended</code>) corta o acesso e preserva tudo — é o caminho
          normal. A remoção definitiva abaixo é irreversível e apaga o CRM inteiro deste cliente.
        </p>

        {!preview && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await fetch(`/api/admin/workspaces/${id}?preview=delete`);
              setBusy(false);
              const json = await res.json().catch(() => null);
              if (!res.ok) {
                setError(json?.error?.message ?? "Falha ao contar o que seria apagado");
                return;
              }
              setPreview(json.data.preview);
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            Apagar em definitivo…
          </button>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="font-bold mb-1">Isso apaga permanentemente:</p>
              <ul className="text-xs space-y-0.5">
                <li>{preview.deals} negócios</li>
                <li>{preview.contacts} contatos</li>
                <li>{preview.companies} empresas</li>
                <li>{preview.activities} atividades</li>
                <li>{preview.whatsappMessages} mensagens de WhatsApp</li>
                <li>{preview.telephonyCalls} chamadas</li>
                <li>{money(preview.telephonyBalanceCents)} de saldo de telefonia</li>
                <li>{preview.members} vínculo(s) de membro</li>
              </ul>
            </div>
            <p className="text-xs text-zinc-600">
              Digite <code className="font-bold">{workspace.slug}</code> para liberar o botão:
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-64 px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-red-400"
            />
            <div className="flex items-center gap-2">
              <button
                disabled={busy || confirmText !== workspace.slug}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  const res = await fetch(
                    `/api/admin/workspaces/${id}?hard=1&confirm=${encodeURIComponent(confirmText)}`,
                    { method: "DELETE" }
                  );
                  setBusy(false);
                  if (!res.ok) {
                    const json = await res.json().catch(() => null);
                    setError(json?.error?.message ?? "Falha ao apagar");
                    return;
                  }
                  window.location.href = "/contas";
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white disabled:opacity-30"
              >
                Apagar em definitivo
              </button>
              <button
                onClick={() => {
                  setPreview(null);
                  setConfirmText("");
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-200 text-zinc-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
```

- [ ] **Step 6: Verificar as quatro travas — no servidor, não pela UI**

Crie um workspace descartável pelo painel (`POST /api/admin/workspaces`), com slug `zz-teste-delete`, e:

```bash
WS=<ID_DO_WORKSPACE_DESCARTAVEL>
# Trava 2: sem confirm -> 400
curl -s -o /dev/null -w 'sem confirm: %{http_code}\n' -X DELETE \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" \
  "http://localhost:3000/api/admin/workspaces/$WS?hard=1"
# Trava 2: confirm errado -> 400
curl -s -o /dev/null -w 'confirm errado: %{http_code}\n' -X DELETE \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" \
  "http://localhost:3000/api/admin/workspaces/$WS?hard=1&confirm=errado"
```

Expected: `400` nos dois.

Papel (trava de autorização), com `PLATFORM_ADMIN_EMAILS` comentado no `.env.local` e o operador em `support` (ver Task 8, Step 3), pelo console do navegador no host do painel:

```js
(await fetch(`/api/admin/workspaces/${WS}?hard=1&confirm=zz-teste-delete`, { method: 'DELETE' })).status
```

Expected: `403` — e `403` também em `GET /api/admin/workspaces/<id>?preview=delete`.

Trava 4 (dono de workspace ativo):

```bash
curl -s -X DELETE -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" \
  "http://localhost:3000/api/admin/accounts/<USER_ID_DO_DONO>?confirm=<EMAIL_DO_DONO>"
```

Expected: `409 OWNS_ACTIVE_WORKSPACE`.

Agora o caminho feliz, no workspace descartável, pela UI: contagem exibida → digitar o slug → apagar. Depois:

```sql
select count(*) from public.workspaces where id = '<WS>';
select action, target_label, metadata from public.platform_audit_log
where action = 'workspace.delete_hard' order by created_at desc limit 1;
```

Expected: `0` workspaces, e a linha de auditoria existe **com a contagem no `metadata`** — gravada antes do delete, que é o ponto inteiro da trava 3.

- [ ] **Step 7: Type-check e build**

Run: `npx tsc --noEmit && npm run build`
Expected: verde.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260830100200_platform_deletion_preview.sql src/app/api/admin "src/app/painel/(app)/contas"
git commit -m "feat(painel): remoção definitiva com contagem real, digitação e auditoria prévia"
```

---

### Task 14: Aposentar `/admin` e fechar a documentação

**Files:**
- Create: `src/app/admin/[[...rest]]/page.tsx`
- Delete: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/contas/page.tsx`, `src/app/admin/[id]/page.tsx`
- Modify: `src/proxy.ts`
- Modify: `src/app/api/admin/accounts/route.ts`
- Modify: `docs/BACKLOG.md`
- Modify: `docs/superpowers/specs/2026-08-30-painel-plataforma-design.md`

**Interfaces:**
- Produces: `/admin/*` no host do CRM redireciona para o host do painel. As rotas `/api/admin/*` **ficam onde estão** (já têm auth própria e já estão fora do matcher) — §4 do spec.

- [ ] **Step 1: Apagar a UI antiga**

```bash
git rm -r src/app/admin/layout.tsx src/app/admin/page.tsx src/app/admin/contas "src/app/admin/[id]"
```

- [ ] **Step 2: O redirect**

```tsx
// src/app/admin/[[...rest]]/page.tsx
//
// O painel mudou de endereço: /admin (dentro do app do cliente) virou
// admin.aimaze.com.br. Este catch-all existe só pra não deixar link antigo
// e bookmark morrerem em 404. Fica FORA de src/app/(crm)/ de propósito --
// não deve carregar o AppShell só pra redirecionar.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminRedirect({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const { rest } = await params;
  const adminHost = process.env.NEXT_PUBLIC_ADMIN_HOST;
  // Sem host configurado não há pra onde mandar: 404 é mais honesto do que
  // um redirect pra "https://undefined/".
  if (!adminHost) redirect("/");
  const path = rest?.length ? `/${rest.join("/")}` : "/";
  const scheme = adminHost.startsWith("localhost") || adminHost.includes(".localhost") ? "http" : "https";
  redirect(`${scheme}://${adminHost}${path}`);
}
```

- [ ] **Step 3: Apontar o proxy pro host novo**

Em `src/proxy.ts`, troque as duas linhas que mandavam platform admin para `/admin`:

```ts
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL(isPlatformAdmin ? "/admin" : "/", request.url));
  }
```

por

```ts
  // Platform admin que caiu no login do CRM é mandado pro /admin, que hoje
  // só existe pra redirecionar pro host do painel (src/app/admin/[[...rest]]).
  // Manter o pulo em dois passos, e não a URL absoluta aqui, deixa um lugar
  // só sabendo montar o endereço do painel.
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL(isPlatformAdmin ? "/admin" : "/", request.url));
  }
```

(ou seja: o código fica igual, só ganha o comentário — o `/admin` agora é o redirecionador). Faça o mesmo no bloco de `pathname === "/"`.

- [ ] **Step 4: Tirar o `GET` plano de `/api/admin/accounts`**

Agora que `/admin/contas` não existe mais, o único consumidor da forma antiga sumiu. Em `src/app/api/admin/accounts/route.ts`, apague o corpo que monta `{ accounts }` e faça o `GET` sempre responder agrupado:

```ts
export async function GET(request: Request) {
  const auth = await requirePlatformAbility(request, "read_customer_data");
  if (!auth.ok) return auth.response;
  // A visão do painel v2 é sempre agrupada por workspace. A lista plana
  // existia só para /admin/contas, aposentada junto com o host antigo.
  return groupedResponse(adminClient());
}
```

E em `src/app/painel/(app)/contas/page.tsx`, troque o fetch para `/api/admin/accounts` (sem o `?group=workspace`, que deixou de existir).

- [ ] **Step 5: Verificar**

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/admin
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/admin/contas
```

Expected: `307` para `http://painel.localhost:3000/` e `http://painel.localhost:3000/contas`.

E o painel inteiro continua de pé: `http://painel.localhost:3000/contas` lista igual.

- [ ] **Step 6: Fechar a documentação**

Em `docs/BACKLOG.md`, marque como feitos: o item de cadastro público aberto (linha ~199) e o item do painel admin. Acrescente uma linha remetendo ao spec e a este plano.

No spec `docs/superpowers/specs/2026-08-30-painel-plataforma-design.md`:

1. No cabeçalho, `**Status:**` → `Implementado (plano: docs/superpowers/plans/2026-08-30-painel-plataforma-v2.md)`.
2. Em §16.2, substitua o aviso de ordem obrigatória por: `VERIFICADO 2026-08-30: /api/convites/aceitar já usa admin.createUser (service-role), não signUp. Desligar sign-ups não quebra convite. O único signUp do repo estava em src/app/login/page.tsx e foi removido.`
3. Em §4, acrescente: `Dev não desliga o rewrite (ver Task 5 do plano): usa NEXT_PUBLIC_ADMIN_HOST=painel.localhost:3000, mesma regra de host da produção.`
4. Em §6.1, acrescente: `deal_history/contact_history não têm workspace_id — "contas paradas" sai de deals.updated_at + activities.created_at (RPC platform_dashboard_stats).`

- [ ] **Step 7: Build final**

Run: `npm run build && npx tsc --noEmit && node --test src/lib/platform-admin.test.ts src/lib/feature-flags.test.ts`
Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add -A src/app docs
git commit -m "feat(painel): aposenta /admin com redirect e fecha a documentação do v2"
```

---

## Pendências operacionais (fora do código, só o dono faz)

Estas continuam valendo e **bloqueiam a produção** — nenhuma task acima depende delas para rodar em dev (`painel.localhost:3000`).

1. **DNS + domínio na Vercel.** Apontar `admin.aimaze.com.br` (CNAME para o alvo que a Vercel indicar), adicionar o domínio ao projeto `prj_kaWE035waorvnxOy9dqEl2chkuaa` (team `team_ZnMiXkS7qzZ8SOrEQHagyUR6`), e definir `NEXT_PUBLIC_ADMIN_HOST=admin.aimaze.com.br` nas env vars de **Production**. Sem isso, em produção o painel simplesmente não existe (`/painel/*` = 404 em todo host) e `/admin` redireciona para `/`.
2. **Desligar "Enable sign-ups" no Supabase** — Task 12, Step 4. O pré-requisito que o spec temia (convite dependendo de `signUp`) não existe; a ordem deixou de importar.
3. **`PLATFORM_ADMIN_EMAILS` em Production** já existe. Confirme que continua contendo `tools@trinocompany.com.br` — é a chave-mestra que impede tranca por fora se a tabela `platform_admins` for esvaziada por engano.

---

## Verificação final (§14 do spec, ponta a ponta)

Rode depois da Task 14, com o domínio de produção já apontado:

- [ ] Host do painel serve o painel; `api-crm.aimaze.com.br/painel/contas` devolve 404; `admin.aimaze.com.br/api/admin/workspaces` responde 401/200 (não foi reescrito).
- [ ] Logar no painel não cria sessão no CRM, e vice-versa (duas abas, dois hosts).
- [ ] `support` recebe 403 ao mudar plano; `billing` recebe 403 ao impersonar — testado por `curl`/console, não pela UI.
- [ ] Chave-mestra: com a tabela `platform_admins` vazia, o e-mail de `PLATFORM_ADMIN_EMAILS` ainda entra como `owner`.
- [ ] Bloqueio de conta: bloquear corta no próximo request; desbloquear devolve; `deals.owner_id` e o nome nas atividades **não** mudaram.
- [ ] Cadastro fechado: `POST /auth/v1/signup` direto na API do Supabase é recusado; convite continua criando membro.
- [ ] Auditoria: toda ação de escrita executada tem linha, com ator, papel e alvo.
- [ ] Impersonate: faixa aparece em toda tela do CRM; "sair" restaura; log registra início e alvo.
- [ ] Remoção definitiva: 403 para `support`/`billing` na rota; contagem exibida bate com o banco; sem a digitação correta a rota recusa; dono de workspace ativo é recusado; a linha de auditoria com a contagem existe **antes** do delete.
