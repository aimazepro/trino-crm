# Painel Admin de Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Painel interno (`/admin`) + API (`/api/admin/*`) pra criar/listar/suspender/apagar workspaces, criar a conta do dono na hora, ligar/desligar features por workspace, e ver uso real (membros, telefonia, WhatsApp, negócios) — sem Stripe.

**Architecture:** Allowlist fixa por e-mail (env var) + bearer token pra script, nenhuma tabela de admins nova. `workspaces` ganha `status` e `feature_flags`. `/api/admin/*` fica fora do matcher do proxy (mesmo tratamento de `api/v1`) e faz sua própria checagem. `proxy.ts` ganha um corte de acesso quando o workspace do membro não está `active`. Feature flags: registro estático em código, plano define default, `feature_flags` guarda só overrides.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), Supabase (Postgres + Auth Admin API), TypeScript. Sem framework de teste instalado no projeto — lógica pura ganha teste real via `node --test` (nativo do Node 24, roda `.test.ts` sem dependência nova); tudo que depende de banco/sessão é verificado manualmente (migração aplicada + `curl` contra o dev server), do jeito que o resto do projeto já é verificado hoje.

**Spec:** [docs/superpowers/specs/2026-08-29-admin-workspaces-design.md](../specs/2026-08-29-admin-workspaces-design.md)

## Global Constraints

- Plano é sempre um de: `trial`, `pro`, `business` (mesmos valores de `PLAN_LABELS` em `src/app/configuracoes/empresa/page.tsx`).
- Status de workspace é sempre um de: `active`, `suspended`, `deleted`.
- `FeatureKey` é sempre um de: `whatsapp`, `voip`, `automacoes`, `api_v1`, `custom_fields`.
- Sem hard-delete. `DELETE /api/admin/workspaces/:id` é sempre soft (`status = 'deleted'`).
- Sem Stripe/cobrança real nesta plan — só visibilidade de uso.
- Toda escrita em `/api/admin/*` loga `via` (session/token) + e-mail ou "token" + ação + workspace alvo.
- `SUPABASE_SERVICE_ROLE_KEY` só é usado server-side, nunca chega no client.
- `PLATFORM_ADMIN_API_TOKEN` é comparado com `crypto.timingSafeEqual`, nunca `===`.

---

## File Structure

Novo:
- `supabase/migrations/20260829120000_platform_admin_workspace_controls.sql` — colunas `status`/`feature_flags`.
- `src/lib/platform-admin.ts` — funções **puras** (allowlist, comparação de token). Zero import de Next/Supabase — é o que faz esse arquivo testável com `node --test` sem precisar de contexto de request.
- `src/lib/platform-admin-server.ts` — o que precisa de Next (`cookies()`) e Supabase: `getPlatformAdminFromSession`, `getPlatformAdmin`, `requirePlatformAdmin`, `adminClient`.
- `src/lib/feature-flags.ts` — **puro**: `FeatureKey`, `FEATURE_KEYS`, `effectiveFeatures`. Importado por `workspace-context.ts`, que é client+server — não pode carregar `next/server` de jeito nenhum (é exatamente o tipo de furo que o próprio cabeçalho de `workspace-context.ts` já documenta).
- `src/lib/feature-flags-server.ts` — `assertFeatureEnabled` (route handlers only).
- `src/components/auth/require-feature.tsx` — mirror de `require-capability.tsx`, gate por feature em vez de role.
- `src/app/api/admin/workspaces/route.ts` — `GET` (lista) / `POST` (cria workspace+dono).
- `src/app/api/admin/workspaces/[id]/route.ts` — `GET` (detalhe+uso) / `PATCH` / `DELETE` (soft).
- `src/app/admin/layout.tsx` — gate (404 se não-admin) + shell visual.
- `src/app/admin/page.tsx` — lista + modal de criação.
- `src/app/admin/[id]/page.tsx` — detalhe: status, plano, feature flags, uso.

Modificado:
- `src/lib/env.ts` — 2 vars novas em `REQUIRED_SERVER_VARS`.
- `.env.example` — mesmas 2 vars documentadas.
- `src/proxy.ts` — matcher exclui `api/admin`; corte de acesso quando `workspaces.status != 'active'`.
- `src/lib/workspace-context.ts` — `WorkspaceInfo` ganha `features`.
- `src/app/automacoes/page.tsx` — soma `RequireFeature` ao gate existente.
- `src/app/conversas/page.tsx` — gate `RequireFeature feature="whatsapp"`.
- `src/app/configuracoes/telefone/page.tsx` — gate `RequireFeature feature="voip"`.
- `src/app/api/whatsapp/send/route.ts` — `assertFeatureEnabled(..., "whatsapp")`.
- `src/app/api/telephony/calls/route.ts` — `assertFeatureEnabled(..., "voip")`.
- `src/app/api/telephony/token/route.ts` — `assertFeatureEnabled(..., "voip")`.
- `docs/BACKLOG.md` — marca o item como feito.

---

### Task 1: Migração — `status` e `feature_flags` em `workspaces`

**Files:**
- Create: `supabase/migrations/20260829120000_platform_admin_workspace_controls.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerado, não editado à mão)

**Interfaces:**
- Produces: colunas `workspaces.status text` (`active`/`suspended`/`deleted`, default `active`) e `workspaces.feature_flags jsonb` (default `{}`), usadas por toda tarefa daqui pra frente.

- [ ] **Step 1: Escrever a migração**

```sql
-- Painel admin da plataforma (super-admin): dá pra workspace um status
-- operável de fora (suspender/reativar/apagar sem tocar em dado) e um lugar
-- pra overrides de feature por cliente, sem tabela nova. Ausência de chave em
-- feature_flags = usa o default do plano (ver src/lib/feature-flags.ts).
alter table public.workspaces
  add column status text not null default 'active'
    check (status in ('active', 'suspended', 'deleted')),
  add column feature_flags jsonb not null default '{}'::jsonb;

create index workspaces_status_idx on public.workspaces (status);
```

- [ ] **Step 2: Aplicar no projeto Supabase (`etdkzpiehoivrviylemd`)**

Use a ferramenta `mcp__supabase__apply_migration` com `project_id: "etdkzpiehoivrviylemd"`, `name: "platform_admin_workspace_controls"`, `query` = o SQL acima. Se a ferramenta MCP não estiver disponível no ambiente de execução, aplique com `supabase db push` a partir da raiz do projeto (o arquivo já está no lugar certo em `supabase/migrations/`).

- [ ] **Step 3: Verificar que as colunas existem**

Use `mcp__supabase__execute_sql` com `project_id: "etdkzpiehoivrviylemd"`:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'workspaces'
  and column_name in ('status', 'feature_flags');
```

Esperado: 2 linhas — `status` (`text`, default `'active'::text`) e `feature_flags` (`jsonb`, default `'{}'::jsonb`).

- [ ] **Step 4: Regenerar `database.types.ts`**

Use `mcp__supabase__generate_typescript_types` com `project_id: "etdkzpiehoivrviylemd"` e salve o resultado inteiro em `src/lib/supabase/database.types.ts` (sobrescreve o arquivo — ele é gerado, não editado à mão).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo relacionado a `workspaces` (o arquivo só ganhou campos, nada quebra).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260829120000_platform_admin_workspace_controls.sql src/lib/supabase/database.types.ts
git commit -m "feat(admin): status e feature_flags em workspaces"
```

---

### Task 2: `src/lib/platform-admin.ts` — lógica pura de autenticação admin

**Files:**
- Create: `src/lib/platform-admin.ts`
- Test: `src/lib/platform-admin.test.ts`

**Interfaces:**
- Produces: `matchesAdminAllowlist(email, allowlistCsv): boolean`, `tokenMatches(provided, expected): boolean` — usados por `platform-admin-server.ts` (Task 3). Nenhum import de Next/Supabase neste arquivo, de propósito: precisa continuar importável por `node --test` puro.

- [ ] **Step 1: Escrever o teste (vai falhar — o módulo ainda não existe)**

```ts
// src/lib/platform-admin.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesAdminAllowlist, tokenMatches } from "./platform-admin";

test("matches exact email in single-entry allowlist", () => {
  assert.equal(matchesAdminAllowlist("tools@trinocompany.com.br", "tools@trinocompany.com.br"), true);
});

test("case and whitespace insensitive", () => {
  assert.equal(matchesAdminAllowlist(" Tools@TrinoCompany.com.br ", "tools@trinocompany.com.br"), true);
});

test("matches one entry among several, comma separated", () => {
  assert.equal(matchesAdminAllowlist("b@x.com", "a@x.com, b@x.com ,c@x.com"), true);
});

test("rejects email not in allowlist", () => {
  assert.equal(matchesAdminAllowlist("evil@x.com", "tools@trinocompany.com.br"), false);
});

test("rejects when email is null", () => {
  assert.equal(matchesAdminAllowlist(null, "tools@trinocompany.com.br"), false);
});

test("rejects when allowlist env var is unset", () => {
  assert.equal(matchesAdminAllowlist("tools@trinocompany.com.br", undefined), false);
});

test("tokenMatches accepts identical strings", () => {
  assert.equal(tokenMatches("abc123", "abc123"), true);
});

test("tokenMatches rejects different strings", () => {
  assert.equal(tokenMatches("abc123", "abc124"), false);
});

test("tokenMatches rejects different-length strings without throwing", () => {
  assert.equal(tokenMatches("short", "a-much-longer-token"), false);
});

test("tokenMatches rejects when either side is missing", () => {
  assert.equal(tokenMatches(null, "abc123"), false);
  assert.equal(tokenMatches("abc123", undefined), false);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test src/lib/platform-admin.test.ts`
Expected: FAIL — `Cannot find module './platform-admin'`.

- [ ] **Step 3: Implementar**

```ts
// src/lib/platform-admin.ts
//
// Lógica pura de "isso é um admin da plataforma" — sem tocar em cookie,
// banco ou Next. Fica separado de platform-admin-server.ts de propósito:
// esse outro arquivo importa next/headers, e qualquer coisa que o importe
// vira server-only. Aqui não, então dá pra testar com `node --test` puro e
// reusar (se um dia precisar) em contexto nenhum específico do Next.

import { timingSafeEqual } from "crypto";

/**
 * True se `email` está na allowlist separada por vírgula, sem diferenciar
 * maiúscula/minúscula nem espaço em volta.
 */
export function matchesAdminAllowlist(
  email: string | null | undefined,
  allowlistCsv: string | undefined
): boolean {
  if (!email || !allowlistCsv) return false;
  const normalized = email.trim().toLowerCase();
  return allowlistCsv
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

/** Comparação em tempo constante -- um Bearer errado não deve vazar quanto do
 * token acertou por diferença de tempo de resposta. */
export function tokenMatches(
  provided: string | null | undefined,
  expected: string | undefined
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Rodar de novo, confirmar que passa**

Run: `node --test src/lib/platform-admin.test.ts`
Expected: PASS, 10 testes.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/platform-admin.ts src/lib/platform-admin.test.ts
git commit -m "feat(admin): allowlist e comparação de token puras, testadas"
```

---

### Task 3: `src/lib/platform-admin-server.ts` + env vars

**Files:**
- Create: `src/lib/platform-admin-server.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `matchesAdminAllowlist`, `tokenMatches` (Task 2).
- Produces: `adminClient(): SupabaseClient<Database>`, `getPlatformAdminFromSession(): Promise<PlatformAdminContext | null>` (uso em Server Component, sem `Request`), `getPlatformAdmin(request): Promise<PlatformAdminContext | null>`, `requirePlatformAdmin(request): Promise<{ok:true,ctx}|{ok:false,response}>` — usados por todas as rotas `/api/admin/*` (Tasks 9, 10) e por `/admin/layout.tsx` (Task 11).

- [ ] **Step 1: Implementar**

```ts
// src/lib/platform-admin-server.ts
//
// Metade "impura" de platform-admin.ts: cookie, sessão, service-role client.
// getPlatformAdminFromSession() não recebe Request de propósito -- Server
// Components (src/app/admin/layout.tsx) não têm um Request de entrada pra
// ler header nenhum, só cookies via next/headers.

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { matchesAdminAllowlist, tokenMatches } from "@/lib/platform-admin";

export interface PlatformAdminContext {
  via: "session" | "token";
  email: string | null;
}

/** Service-role client. Factory local, mesmo padrão já usado por módulo em
 * src/lib/whatsapp/connection.ts e src/lib/telephony/db.ts -- não um helper
 * compartilhado entre domínios. */
export function adminClient(): SupabaseClient<Database> {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

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
  if (!matchesAdminAllowlist(email, process.env.PLATFORM_ADMIN_EMAILS)) return null;
  return { via: "session", email };
}

/** Bearer token primeiro (sem round-trip de cookie/DB), sessão depois. Uso
 * em Route Handlers de /api/admin/*, que têm um Request de verdade. */
export async function getPlatformAdmin(request: Request): Promise<PlatformAdminContext | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match && tokenMatches(match[1].trim(), process.env.PLATFORM_ADMIN_API_TOKEN)) {
    return { via: "token", email: null };
  }
  return getPlatformAdminFromSession();
}

/** Wrapper de conveniência pras rotas: um `if (!auth.ok) return auth.response`
 * por handler, igual o padrão de authenticateApiRequest em src/lib/api-auth.ts. */
export async function requirePlatformAdmin(
  request: Request
): Promise<{ ok: true; ctx: PlatformAdminContext } | { ok: false; response: NextResponse }> {
  const ctx = await getPlatformAdmin(request);
  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Não autenticado como admin da plataforma" } },
        { status: 401 }
      ),
    };
  }
  return { ok: true, ctx };
}
```

- [ ] **Step 2: Adicionar as env vars em `src/lib/env.ts`**

Modify `src/lib/env.ts` — adicione ao array `REQUIRED_SERVER_VARS` (depois de `"AUTOMATION_DISPATCH_SECRET",`):

```ts
  // Painel admin da plataforma (super-admin): allowlist de e-mail e o bearer
  // token que scripts/curl usam pra chamar /api/admin/* sem sessão de navegador.
  "PLATFORM_ADMIN_EMAILS",
  "PLATFORM_ADMIN_API_TOKEN",
```

- [ ] **Step 3: Documentar em `.env.example`**

Modify `.env.example` — adicione ao final do arquivo:

```
# --- Painel admin da plataforma (super-admin) -----------------------------
# OBRIGATÓRIA para acessar /admin. Lista de e-mails separados por vírgula.
PLATFORM_ADMIN_EMAILS=
# OBRIGATÓRIA para chamar /api/admin/* via script/curl (Authorization: Bearer).
# Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PLATFORM_ADMIN_API_TOKEN=
```

- [ ] **Step 4: Configurar localmente pra poder testar as próximas tasks**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Adicione ao `.env.local` (não commitado):
```
PLATFORM_ADMIN_EMAILS=tools@trinocompany.com.br
PLATFORM_ADMIN_API_TOKEN=<o valor gerado acima>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/platform-admin-server.ts src/lib/env.ts .env.example
git commit -m "feat(admin): auth de sessão+bearer pra /api/admin, env vars"
```

(Não commite `.env.local` — já está no `.gitignore` do projeto como todo `.env.local`.)

---

### Task 4: `proxy.ts` — excluir `/api/admin` do matcher + cortar acesso de workspace suspenso

**Files:**
- Modify: `src/proxy.ts:12-44,93` (conteúdo lido em detalhe durante o design — ver spec §4/§6)

**Interfaces:**
- Consumes: `workspaces.status` (Task 1).

- [ ] **Step 1: Excluir `api/admin` do matcher**

No `matcher`, adicione `api/admin` à lista de exclusões, no mesmo grupo de `api/v1` (mesma razão: rota que autentica sozinha via `getPlatformAdmin`, um 307 pro `/login` seria lido como sucesso por um script chamando com Bearer token).

Old:
```ts
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/gmail/callback|api/auth/google-calendar/callback|api/track|api/whatsapp/webhook|api/whatsapp/queue|api/telephony/webhook|api/convites|api/automations|api/v1|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

New:
```ts
// api/admin is the platform-admin API (/api/admin/*): Bearer-token or
// session auth inside the route (src/lib/platform-admin-server.ts). Same
// reasoning as api/v1 above -- a script calling with
// PLATFORM_ADMIN_API_TOKEN has no session cookie, so without this exclusion
// it hits the blanket /login redirect and reads the 307 as success.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/gmail/callback|api/auth/google-calendar/callback|api/track|api/whatsapp/webhook|api/whatsapp/queue|api/telephony/webhook|api/convites|api/automations|api/v1|api/admin|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 2: Cortar acesso quando o workspace não está `active`**

Old:
```ts
  if (user) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("member_user_id", user.id)
      .limit(1);

    if (!membership || membership.length === 0) {
```

New:
```ts
  if (user) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id, workspaces(status)")
      .eq("member_user_id", user.id)
      .limit(1);

    // workspaces(status) volta como objeto num embed to-one, mas o gerador
    // de tipos do Supabase às vezes tipa embeds como array -- normaliza os
    // dois formatos em vez de assumir um.
    const rawWorkspace = membership?.[0]?.workspaces as { status: string } | { status: string }[] | null | undefined;
    const workspaceStatus = Array.isArray(rawWorkspace) ? rawWorkspace[0]?.status : rawWorkspace?.status;
    const workspaceShutOff = workspaceStatus === "suspended" || workspaceStatus === "deleted";

    if (!membership || membership.length === 0 || workspaceShutOff) {
```

Atualize também o comentário logo acima desse bloco (linhas 12-18 do arquivo original), acrescentando ao final:

```ts
  // O mesmo corte agora também acontece quando o *workspace* (não só o
  // membro) está suspended/deleted -- painel admin muda workspaces.status,
  // e precisa valer imediatamente, não só na próxima vez que a RLS for
  // consultada por outra rota.
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. Se o embed vier tipado de um jeito que a normalização acima não cobre, ajuste o cast pra bater com o que `database.types.ts` realmente gerou pra essa relação (Task 1, Step 4) — mas o normalizador já cobre objeto único e array, os dois formatos que o gerador do Supabase usa.

- [ ] **Step 4: Verificar manualmente**

Com o servidor local rodando (`npm run dev`) e logado com um usuário que é membro de um workspace de teste:

```sql
-- via mcp__supabase__execute_sql, project_id etdkzpiehoivrviylemd
update workspaces set status = 'suspended' where id = '<workspace de teste>';
```

Dê um refresh na página logada — espera-se redirect pra `/login?revoked=1` e os cookies `sb-*` limpos. Depois:

```sql
update workspaces set status = 'active' where id = '<workspace de teste>';
```

Login de novo deve funcionar normalmente.

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts
git commit -m "fix(proxy): corta acesso quando o workspace está suspenso/apagado"
```

---

### Task 5: `src/lib/feature-flags.ts` — registro e cálculo de features (puro)

**Files:**
- Create: `src/lib/feature-flags.ts`
- Test: `src/lib/feature-flags.test.ts`

**Interfaces:**
- Produces: `FeatureKey`, `FEATURE_KEYS`, `effectiveFeatures(plan, overrides): Record<FeatureKey, boolean>` — consumido por `workspace-context.ts` (Task 6), `feature-flags-server.ts` (Task 7), `require-feature.tsx` (Task 8), e as rotas admin (Tasks 9-10). **Puro** -- zero import de Next/Supabase, pelo mesmo motivo de `platform-admin.ts`.

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/feature-flags.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveFeatures } from "./feature-flags";

test("trial plan defaults voip to false", () => {
  assert.equal(effectiveFeatures("trial", null).voip, false);
});

test("pro plan defaults voip to true", () => {
  assert.equal(effectiveFeatures("pro", null).voip, true);
});

test("business plan defaults voip to true", () => {
  assert.equal(effectiveFeatures("business", null).voip, true);
});

test("override turns a feature off even on a plan that includes it", () => {
  assert.equal(effectiveFeatures("pro", { voip: false }).voip, false);
});

test("override turns a feature on even on a plan that excludes it", () => {
  assert.equal(effectiveFeatures("trial", { voip: true }).voip, true);
});

test("unknown plan falls back to trial defaults", () => {
  assert.deepEqual(effectiveFeatures("nonexistent-plan", null), effectiveFeatures("trial", null));
});

test("undefined overrides behave like no overrides", () => {
  assert.deepEqual(effectiveFeatures("pro", undefined), effectiveFeatures("pro", {}));
});

test("every known plan sets a value for every FeatureKey", () => {
  for (const plan of ["trial", "pro", "business"]) {
    const features = effectiveFeatures(plan, null);
    for (const key of ["whatsapp", "voip", "automacoes", "api_v1", "custom_fields"] as const) {
      assert.equal(typeof features[key], "boolean", `${plan}.${key} deveria ser boolean`);
    }
  }
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test src/lib/feature-flags.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/feature-flags.ts
//
// Puro de propósito: workspace-context.ts importa daqui e é compartilhado
// entre server E client (WorkspaceProvider). Qualquer import de next/server
// aqui vazaria pro bundle do client -- é a mesma armadilha que o cabeçalho
// de workspace-context.ts já documenta pra "use client". A metade que
// precisa de Supabase/Next mora em feature-flags-server.ts.

export type FeatureKey = "whatsapp" | "voip" | "automacoes" | "api_v1" | "custom_fields";

export const FEATURE_KEYS: readonly FeatureKey[] = [
  "whatsapp",
  "voip",
  "automacoes",
  "api_v1",
  "custom_fields",
];

const PLAN_DEFAULTS: Record<string, Record<FeatureKey, boolean>> = {
  trial: { whatsapp: true, voip: false, automacoes: true, api_v1: true, custom_fields: true },
  pro: { whatsapp: true, voip: true, automacoes: true, api_v1: true, custom_fields: true },
  business: { whatsapp: true, voip: true, automacoes: true, api_v1: true, custom_fields: true },
};

/**
 * Default do plano mesclado com overrides por workspace. Plano desconhecido
 * cai no default de `trial` -- o mais restritivo, nunca abre mais do que
 * deveria por um valor de plano que o registro ainda não conhece.
 */
export function effectiveFeatures(
  plan: string,
  overrides: Partial<Record<FeatureKey, boolean>> | null | undefined
): Record<FeatureKey, boolean> {
  const base = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.trial;
  return { ...base, ...(overrides ?? {}) };
}
```

- [ ] **Step 4: Rodar de novo, confirmar que passa**

Run: `node --test src/lib/feature-flags.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/lib/feature-flags.ts src/lib/feature-flags.test.ts
git commit -m "feat(admin): registro de feature flags por plano, testado"
```

---

### Task 6: `src/lib/feature-flags-server.ts` — gate de rota

**Files:**
- Create: `src/lib/feature-flags-server.ts`

**Interfaces:**
- Consumes: `effectiveFeatures`, `FeatureKey` (Task 5); `apiError` (`src/lib/api-auth.ts`, já existe).
- Produces: `assertFeatureEnabled(supabase, workspaceId, key): Promise<{ok:true}|{ok:false,response}>` — consumido pelas 3 rotas da Task 13.

- [ ] **Step 1: Implementar**

```ts
// src/lib/feature-flags-server.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { apiError } from "@/lib/api-auth";
import { effectiveFeatures, type FeatureKey } from "@/lib/feature-flags";

/**
 * Gate de servidor pras rotas de API: carrega plan+feature_flags do próprio
 * workspace (a rota chamadora não tem isso pré-carregado) e devolve um 403
 * pronto pra retornar quando a feature está desligada.
 */
export async function assertFeatureEnabled(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  key: FeatureKey
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("plan, feature_flags")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) {
    return { ok: false, response: apiError("NOT_FOUND", "Workspace não encontrado", 404) };
  }

  const features = effectiveFeatures(
    workspace.plan,
    workspace.feature_flags as Partial<Record<FeatureKey, boolean>>
  );

  if (!features[key]) {
    return {
      ok: false,
      response: apiError("FEATURE_DISABLED", `Recurso '${key}' não está habilitado neste workspace`, 403),
    };
  }

  return { ok: true };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. (Sem teste unitário aqui — depende de um `SupabaseClient` de verdade; a correção é verificada na integração, quando a Task 13 liga isso numa rota real.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/feature-flags-server.ts
git commit -m "feat(admin): assertFeatureEnabled para gate de rota"
```

---

### Task 7: `workspace-context.ts` — `WorkspaceInfo` ganha `features`

**Files:**
- Modify: `src/lib/workspace-context.ts` (arquivo inteiro, 45 linhas — conteúdo já lido durante o design)

**Interfaces:**
- Consumes: `effectiveFeatures`, `FeatureKey` (Task 5).
- Produces: `WorkspaceInfo.features: Record<FeatureKey, boolean>` — consumido por `require-feature.tsx` (Task 8) via `useWorkspaceInfo()`/`useWorkspace()` (`src/lib/workspace.tsx`, que re-exporta `WorkspaceInfo` sem mudança nenhuma).

- [ ] **Step 1: Editar**

Old (arquivo inteiro):
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// No "use client" here on purpose — this file is imported from both server
// route handlers and the client WorkspaceProvider (src/lib/workspace.tsx). A
// "use client" directive tags the whole module as client-only, which breaks
// any server import of getWorkspaceContext (this is exactly what happened:
// POST /api/convites 500'd with "getWorkspaceContext is on the client").

export type Role = "admin" | "gerente" | "vendedor";

export interface WorkspaceInfo {
  workspaceId: string;
  role: Role;
  userId: string;
}

/**
 * Who is this request, and which workspace/role do they have. Pass the
 * request's own Supabase client (route handler, server component,
 * middleware — whichever cookie context is live there).
 */
export async function getWorkspaceContext(
  supabase: SupabaseClient<Database>
): Promise<WorkspaceInfo | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("member_user_id", user.id)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  return {
    workspaceId: member.workspace_id,
    role: member.role as Role,
    userId: user.id,
  };
}
```

New:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { effectiveFeatures, type FeatureKey } from "@/lib/feature-flags";

// No "use client" here on purpose — this file is imported from both server
// route handlers and the client WorkspaceProvider (src/lib/workspace.tsx). A
// "use client" directive tags the whole module as client-only, which breaks
// any server import of getWorkspaceContext (this is exactly what happened:
// POST /api/convites 500'd with "getWorkspaceContext is on the client").
//
// feature-flags.ts (not feature-flags-server.ts) is imported here for the
// same reason: this file is client-bundled too, so it can never pull in
// next/server transitively.

export type Role = "admin" | "gerente" | "vendedor";

export interface WorkspaceInfo {
  workspaceId: string;
  role: Role;
  userId: string;
  features: Record<FeatureKey, boolean>;
}

/**
 * Who is this request, and which workspace/role do they have. Pass the
 * request's own Supabase client (route handler, server component,
 * middleware — whichever cookie context is live there).
 */
export async function getWorkspaceContext(
  supabase: SupabaseClient<Database>
): Promise<WorkspaceInfo | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(plan, feature_flags)")
    .eq("member_user_id", user.id)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  // Mesma normalização de embed to-one da Task 4: objeto único ou array de
  // um item, dependendo de como o gerador de tipos do Supabase tipou a
  // relação -- não assume um formato só.
  const rawWorkspace = member.workspaces as
    | { plan: string; feature_flags: unknown }
    | { plan: string; feature_flags: unknown }[]
    | null;
  const workspace = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace;

  return {
    workspaceId: member.workspace_id,
    role: member.role as Role,
    userId: user.id,
    features: effectiveFeatures(
      workspace?.plan ?? "trial",
      (workspace?.feature_flags as Partial<Record<FeatureKey, boolean>>) ?? null
    ),
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. Preste atenção especial em qualquer erro apontando pra `src/lib/workspace.tsx` ou outro consumidor de `WorkspaceInfo` — a mudança é aditiva (novo campo obrigatório), então qualquer lugar que hoje constrói um `WorkspaceInfo` à mão (não via `getWorkspaceContext`) vai acusar campo faltando. Não deveria haver nenhum — a única fábrica de `WorkspaceInfo` no projeto é essa função.

- [ ] **Step 3: Verificar manualmente**

Com `npm run dev` rodando e logado, abra o DevTools e confirme que nenhuma tela existente quebrou (a mudança não altera nada visível ainda — `features` só passa a existir no contexto, ninguém lê ainda até a Task 8+13). Verificação real: adicione temporariamente `console.log(useWorkspace().features)` em qualquer client component, confirme que aparece um objeto com as 5 chaves, remova o log antes de commitar.

- [ ] **Step 4: Commit**

```bash
git add src/lib/workspace-context.ts
git commit -m "feat(admin): WorkspaceInfo carrega as features efetivas do workspace"
```

---

### Task 8: `RequireFeature` — gate de UI por feature

**Files:**
- Create: `src/components/auth/require-feature.tsx`

**Interfaces:**
- Consumes: `FeatureKey` (Task 5); `useWorkspaceInfo`, `useWorkspaceLoading` (`src/lib/workspace.tsx`, já existe, ganhou `features` na Task 7).
- Produces: `<RequireFeature feature="whatsapp">...</RequireFeature>` — consumido pela Task 13.

- [ ] **Step 1: Implementar**

```tsx
"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useWorkspaceInfo, useWorkspaceLoading } from "@/lib/workspace";
import type { FeatureKey } from "@/lib/feature-flags";

/**
 * Esconde uma tela de um workspace que não tem a feature habilitada. Mirror
 * de RequireCapability (src/components/auth/require-capability.tsx), mas o
 * eixo é feature/plano, não role -- as duas coisas podem estar juntas na
 * mesma página (automacoes/page.tsx faz isso: RequireFeature por fora,
 * RequireCapability por dentro).
 *
 * Assim como RequireCapability, isto é só a metade de cliente do gate --
 * esconder a tela não é a proteção real. A proteção real é
 * assertFeatureEnabled nas rotas de API (src/lib/feature-flags-server.ts).
 */
export function RequireFeature({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: ReactNode;
}) {
  const info = useWorkspaceInfo();
  const loading = useWorkspaceLoading();

  if (loading) return null;

  if (!info?.features[feature]) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
          <Lock size={20} className="text-zinc-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">Recurso não incluído</h2>
        <p className="max-w-sm text-sm text-zinc-500">
          Este recurso não está habilitado no seu plano atual. Fale com quem
          administra sua conta para habilitá-lo.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/require-feature.tsx
git commit -m "feat(admin): componente RequireFeature, mirror de RequireCapability"
```

---

### Task 9: API admin — `GET`/`POST /api/admin/workspaces`

**Files:**
- Create: `src/app/api/admin/workspaces/route.ts`

**Interfaces:**
- Consumes: `requirePlatformAdmin`, `adminClient` (Task 3); `apiError`, `apiSuccess` (`src/lib/api-auth.ts`, já existe).
- Produces: `GET` → `{ data: { workspaces: [{ id, name, slug, plan, status, memberCount, createdAt, trialEndsAt }] } }`. `POST` → `{ data: { workspaceId, ownerUserId } }` (201) ou erro `SLUG_TAKEN`/`EMAIL_EXISTS` (409). Consumido por `/admin/page.tsx` (Task 11).

- [ ] **Step 1: Implementar**

```ts
// src/app/api/admin/workspaces/route.ts
import { requirePlatformAdmin, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const VALID_PLANS = ["trial", "pro", "business"] as const;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mesmo escaping usado em src/lib/api-lead-helpers.ts para ilike. */
function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const plan = url.searchParams.get("plan");
  const q = url.searchParams.get("q");

  const admin = adminClient();
  let query = admin
    .from("workspaces")
    .select("id, name, slug, plan, status, created_at, trial_ends_at")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (plan) query = query.eq("plan", plan);
  if (q) query = query.or(`name.ilike.%${escapeIlike(q)}%,slug.ilike.%${escapeIlike(q)}%`);

  const { data: workspaces, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  const ids = (workspaces ?? []).map((w) => w.id);
  const { data: members } = ids.length
    ? await admin.from("workspace_members").select("workspace_id").in("workspace_id", ids)
    : { data: [] as { workspace_id: string }[] };

  const memberCounts = new Map<string, number>();
  for (const m of members ?? []) {
    memberCounts.set(m.workspace_id, (memberCounts.get(m.workspace_id) ?? 0) + 1);
  }

  return apiSuccess({
    workspaces: (workspaces ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      plan: w.plan,
      status: w.status,
      memberCount: memberCounts.get(w.id) ?? 0,
      createdAt: w.created_at,
      trialEndsAt: w.trial_ends_at,
    })),
  });
}

interface CreateWorkspaceBody {
  name?: string;
  slug?: string;
  plan?: string;
  ownerEmail?: string;
  ownerPassword?: string;
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;

  let body: CreateWorkspaceBody;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
  }

  const name = (body.name ?? "").trim();
  const slug = (body.slug ?? "").trim().toLowerCase();
  const plan = body.plan ?? "trial";
  const ownerEmail = (body.ownerEmail ?? "").trim().toLowerCase();
  const ownerPassword = body.ownerPassword ?? "";

  if (!name) return apiError("VALIDATION_ERROR", "name é obrigatório", 400);
  if (!SLUG_RE.test(slug)) {
    return apiError("VALIDATION_ERROR", "slug precisa ser minúsculo, alfanumérico, separado por hífen", 400);
  }
  if (!VALID_PLANS.includes(plan as (typeof VALID_PLANS)[number])) {
    return apiError("VALIDATION_ERROR", `plan precisa ser um de: ${VALID_PLANS.join(", ")}`, 400);
  }
  if (!EMAIL_RE.test(ownerEmail)) return apiError("VALIDATION_ERROR", "ownerEmail inválido", 400);
  if (ownerPassword.length < 8) return apiError("VALIDATION_ERROR", "ownerPassword precisa ter 8+ caracteres", 400);

  const admin = adminClient();

  const { data: slugTaken } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (slugTaken) return apiError("SLUG_TAKEN", "Já existe um workspace com esse slug", 409);

  // Mesmo padrão de checar e-mail existente do POST /api/convites/aceitar:
  // listUsers() + find, não há um getUserByEmail direto na Admin API.
  const { data: existingList } = await admin.auth.admin.listUsers();
  const existingUser = existingList?.users.find((u) => u.email?.toLowerCase() === ownerEmail);
  if (existingUser) {
    return apiError(
      "EMAIL_EXISTS",
      "Já existe uma conta com esse e-mail — adicionar um usuário existente a um workspace novo não é suportado aqui",
      409
    );
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    return apiError("INTERNAL_ERROR", createErr?.message ?? "Falha ao criar usuário", 500);
  }
  const ownerUserId = created.user.id;

  const { data: workspace, error: wsErr } = await admin
    .from("workspaces")
    .insert({ name, slug, plan, owner_user_id: ownerUserId, status: "active" })
    .select("id")
    .single();

  if (wsErr || !workspace) {
    // Não deixa o auth.users órfão sem workspace.
    await admin.auth.admin.deleteUser(ownerUserId);
    return apiError("INTERNAL_ERROR", wsErr?.message ?? "Falha ao criar workspace", 500);
  }

  const { error: memberErr } = await admin.from("workspace_members").insert({
    workspace_id: workspace.id,
    member_user_id: ownerUserId,
    email: ownerEmail,
    role: "admin",
    status: "accepted",
    accepted_at: new Date().toISOString(),
  });

  if (memberErr) {
    await admin.from("workspaces").delete().eq("id", workspace.id);
    await admin.auth.admin.deleteUser(ownerUserId);
    return apiError("INTERNAL_ERROR", memberErr.message, 500);
  }

  console.log(
    `[admin] workspace criado: ${workspace.id} (${slug}) por ${auth.ctx.via === "session" ? auth.ctx.email : "token"}`
  );

  return apiSuccess({ workspaceId: workspace.id, ownerUserId }, undefined, 201);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificar manualmente (caminho feliz)**

Com `npm run dev` rodando e `PLATFORM_ADMIN_API_TOKEN` no `.env.local` (Task 3, Step 4):

```bash
curl -s -X POST http://localhost:3000/api/admin/workspaces \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cliente Teste","slug":"cliente-teste","ownerEmail":"cliente-teste@example.com","ownerPassword":"senha-temporaria-123"}'
```

Expected: `201`, corpo com `data.workspaceId` e `data.ownerUserId`.

```bash
curl -s http://localhost:3000/api/admin/workspaces \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN"
```

Expected: `200`, `data.workspaces` inclui o "Cliente Teste" recém-criado com `memberCount: 1`.

- [ ] **Step 4: Verificar os casos de erro**

```bash
# slug duplicado
curl -s -X POST http://localhost:3000/api/admin/workspaces \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Outro","slug":"cliente-teste","ownerEmail":"outro@example.com","ownerPassword":"senha-temporaria-123"}'
# Expected: 409 SLUG_TAKEN

# e-mail duplicado
curl -s -X POST http://localhost:3000/api/admin/workspaces \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Outro2","slug":"outro-2","ownerEmail":"cliente-teste@example.com","ownerPassword":"senha-temporaria-123"}'
# Expected: 409 EMAIL_EXISTS

# sem token
curl -s http://localhost:3000/api/admin/workspaces
# Expected: 401 UNAUTHORIZED
```

- [ ] **Step 5: Limpar os dados de teste**

Via `mcp__supabase__execute_sql` (`project_id: "etdkzpiehoivrviylemd"`), apague o workspace e o usuário criados nos steps acima (`delete from workspaces where slug = 'cliente-teste'` cascateia `workspace_members` se houver FK `on delete cascade` — confira antes; senão apague `workspace_members` primeiro. Para o `auth.users`, use `mcp__supabase__execute_sql` com `delete from auth.users where email = 'cliente-teste@example.com'` ou a Admin API).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/workspaces/route.ts
git commit -m "feat(admin): GET/POST /api/admin/workspaces"
```

---

### Task 10: API admin — `GET`/`PATCH`/`DELETE /api/admin/workspaces/[id]`

**Files:**
- Create: `src/app/api/admin/workspaces/[id]/route.ts`

**Interfaces:**
- Consumes: `requirePlatformAdmin`, `adminClient` (Task 3); `effectiveFeatures`, `FeatureKey` (Task 5); `apiError`, `apiSuccess` (existe).
- Produces: `GET` → `{ data: { workspace, usage, features } }`. `PATCH`/`DELETE` → `{ data: { workspace } }`. Consumido por `/admin/[id]/page.tsx` (Task 12).

- [ ] **Step 1: Implementar**

```ts
// src/app/api/admin/workspaces/[id]/route.ts
import { requirePlatformAdmin, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";
import { effectiveFeatures, type FeatureKey } from "@/lib/feature-flags";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const VALID_PLANS = ["trial", "pro", "business"] as const;
const VALID_STATUSES = ["active", "suspended", "deleted"] as const;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  feature_flags: unknown;
  created_at: string;
  trial_ends_at: string | null;
};

function serializeWorkspace(w: WorkspaceRow) {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    plan: w.plan,
    status: w.status,
    featureFlags: (w.feature_flags ?? {}) as Partial<Record<FeatureKey, boolean>>,
    createdAt: w.created_at,
    trialEndsAt: w.trial_ends_at,
  };
}

async function loadWorkspace(admin: SupabaseClient<Database>, id: string): Promise<WorkspaceRow | null> {
  const { data } = await admin
    .from("workspaces")
    .select("id, name, slug, plan, status, feature_flags, created_at, trial_ends_at")
    .eq("id", id)
    .maybeSingle();
  return data as WorkspaceRow | null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const admin = adminClient();
  const workspace = await loadWorkspace(admin, id);
  if (!workspace) return apiError("NOT_FOUND", "Workspace não encontrado", 404);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: members }, { data: balance }, { data: ledger }, { count: waCount }, { data: dealsRows, count: dealsCount }] =
    await Promise.all([
      admin.from("workspace_members").select("status").eq("workspace_id", id),
      admin.from("telephony_balances").select("balance_cents, reserved_cents").eq("workspace_id", id).maybeSingle(),
      admin
        .from("telephony_ledger")
        .select("id, kind, amount_cents, balance_after_cents, description, created_at")
        .eq("workspace_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", id)
        .gte("timestamp", thirtyDaysAgo),
      admin
        .from("deals")
        .select("updated_at", { count: "exact" })
        .eq("workspace_id", id)
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

  const memberCounts = { accepted: 0, pending: 0, suspended: 0 };
  for (const m of members ?? []) {
    if (m.status === "accepted") memberCounts.accepted++;
    else if (m.status === "pending") memberCounts.pending++;
    else if (m.status === "suspended") memberCounts.suspended++;
  }

  return apiSuccess({
    workspace: serializeWorkspace(workspace),
    usage: {
      members: memberCounts,
      telephony: balance
        ? {
            balanceCents: balance.balance_cents,
            reservedCents: balance.reserved_cents,
            recentLedger: (ledger ?? []).map((l) => ({
              id: l.id,
              kind: l.kind,
              amountCents: l.amount_cents,
              balanceAfterCents: l.balance_after_cents,
              description: l.description,
              createdAt: l.created_at,
            })),
          }
        : null,
      whatsappMessages30d: waCount ?? 0,
      deals: {
        count: dealsCount ?? 0,
        lastActivityAt: dealsRows?.[0]?.updated_at ?? null,
      },
    },
    features: effectiveFeatures(workspace.plan, workspace.feature_flags as Partial<Record<FeatureKey, boolean>>),
  });
}

interface PatchWorkspaceBody {
  name?: string;
  slug?: string;
  plan?: string;
  status?: string;
  featureFlags?: Partial<Record<FeatureKey, boolean>>;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: PatchWorkspaceBody;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
  }

  const admin = adminClient();
  const current = await loadWorkspace(admin, id);
  if (!current) return apiError("NOT_FOUND", "Workspace não encontrado", 404);

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return apiError("VALIDATION_ERROR", "name não pode ser vazio", 400);
    update.name = name;
  }
  if (body.slug !== undefined) {
    const slug = body.slug.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      return apiError("VALIDATION_ERROR", "slug precisa ser minúsculo, alfanumérico, separado por hífen", 400);
    }
    if (slug !== current.slug) {
      const { data: taken } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
      if (taken) return apiError("SLUG_TAKEN", "Já existe um workspace com esse slug", 409);
    }
    update.slug = slug;
  }
  if (body.plan !== undefined) {
    if (!VALID_PLANS.includes(body.plan as (typeof VALID_PLANS)[number])) {
      return apiError("VALIDATION_ERROR", `plan precisa ser um de: ${VALID_PLANS.join(", ")}`, 400);
    }
    update.plan = body.plan;
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
      return apiError("VALIDATION_ERROR", `status precisa ser um de: ${VALID_STATUSES.join(", ")}`, 400);
    }
    update.status = body.status;
  }
  if (body.featureFlags !== undefined) {
    // Merge raso: manda só o que muda, o resto do objeto guardado continua.
    const currentFlags = (current.feature_flags ?? {}) as Partial<Record<FeatureKey, boolean>>;
    update.feature_flags = { ...currentFlags, ...body.featureFlags };
  }

  if (Object.keys(update).length === 0) {
    return apiSuccess({ workspace: serializeWorkspace(current) });
  }

  const { data: updated, error } = await admin
    .from("workspaces")
    .update(update)
    .eq("id", id)
    .select("id, name, slug, plan, status, feature_flags, created_at, trial_ends_at")
    .single();

  if (error || !updated) return apiError("INTERNAL_ERROR", error?.message ?? "Falha ao atualizar workspace", 500);

  console.log(
    `[admin] workspace atualizado: ${id} (${Object.keys(update).join(", ")}) por ${auth.ctx.via === "session" ? auth.ctx.email : "token"}`
  );

  return apiSuccess({ workspace: serializeWorkspace(updated as WorkspaceRow) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const admin = adminClient();
  const current = await loadWorkspace(admin, id);
  if (!current) return apiError("NOT_FOUND", "Workspace não encontrado", 404);

  const { data: updated, error } = await admin
    .from("workspaces")
    .update({ status: "deleted" })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error || !updated) return apiError("INTERNAL_ERROR", error?.message ?? "Falha ao apagar workspace", 500);

  console.log(`[admin] workspace apagado (soft): ${id} por ${auth.ctx.via === "session" ? auth.ctx.email : "token"}`);

  return apiSuccess({ workspace: { id: updated.id, status: updated.status } });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `feature_flags`/`balance_cents`/etc. não baterem com o tipo gerado, confira se a Task 1 Step 4 (regenerar `database.types.ts`) realmente rodou antes desta task.

- [ ] **Step 3: Verificar manualmente**

Reusando o workspace criado na Task 9 (ou criando um novo):

```bash
WS_ID="<id do workspace de teste>"

curl -s http://localhost:3000/api/admin/workspaces/$WS_ID \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" | python3 -m json.tool
# Expected: 200, data.workspace + data.usage + data.features (5 chaves, trial => voip:false)

curl -s -X PATCH http://localhost:3000/api/admin/workspaces/$WS_ID \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"featureFlags":{"voip":true}}'
# Expected: 200, data.workspace.featureFlags = {"voip":true}

curl -s http://localhost:3000/api/admin/workspaces/$WS_ID \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['features']['voip'])"
# Expected: True (override venceu o default de trial)

curl -s -X PATCH http://localhost:3000/api/admin/workspaces/$WS_ID \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"suspended"}'
# Expected: 200, data.workspace.status = "suspended"

curl -s -X DELETE http://localhost:3000/api/admin/workspaces/$WS_ID \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN"
# Expected: 200, data.workspace.status = "deleted"

# idempotente: chamar DELETE de novo não deve dar erro
curl -s -X DELETE http://localhost:3000/api/admin/workspaces/$WS_ID \
  -H "Authorization: Bearer $PLATFORM_ADMIN_API_TOKEN"
# Expected: 200, data.workspace.status = "deleted"
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/admin/workspaces/[id]/route.ts"
git commit -m "feat(admin): GET/PATCH/DELETE /api/admin/workspaces/:id"
```

---

### Task 11: UI admin — `/admin` (layout + lista + criar)

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `getPlatformAdminFromSession` (Task 3); `GET`/`POST /api/admin/workspaces` (Task 9).

- [ ] **Step 1: Layout com o gate de acesso**

```tsx
// src/app/admin/layout.tsx
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getPlatformAdminFromSession } from "@/lib/platform-admin-server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getPlatformAdminFromSession();
  // 404, não 403: quem não é admin da plataforma nem fica sabendo que essa
  // rota existe.
  if (!admin) notFound();

  return (
    <div className="min-h-screen bg-zinc-50/30">
      <div className="border-b border-zinc-200 bg-white px-8 py-4">
        <h1 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Painel Admin — TrinoCRM</h1>
      </div>
      <div className="p-8">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Lista + modal de criação**

```tsx
// src/app/admin/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  memberCount: number;
  createdAt: string;
  trialEndsAt: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  suspended: "bg-red-50 text-red-700 border-red-200/60",
  deleted: "bg-zinc-100 text-zinc-500 border-zinc-200/60",
};

const PLAN_LABELS: Record<string, string> = { trial: "Trial", pro: "Pro", business: "Business" };

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/admin/workspaces?${params.toString()}`);
    const json = await res.json();
    setWorkspaces(res.ok ? json.data.workspaces : []);
    setLoading(false);
  }, [q, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Workspaces</h2>
          <p className="text-sm text-zinc-500 mt-1">{workspaces.length} workspace(s)</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-[13px] font-bold rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <Plus size={16} /> Criar workspace
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou slug"
            className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-zinc-200 rounded-lg px-2.5 py-2 outline-none"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="suspended">Suspenso</option>
          <option value="deleted">Apagado</option>
        </select>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Membros</th>
              <th className="px-4 py-3">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && workspaces.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  Nenhum workspace encontrado
                </td>
              </tr>
            )}
            {workspaces.map((w) => (
              <tr key={w.id} className="border-t border-zinc-50 hover:bg-zinc-50/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/${w.id}`} className="font-semibold text-zinc-900 hover:text-amber-600">
                    {w.name}
                  </Link>
                  <div className="text-xs text-zinc-400">{w.slug}</div>
                </td>
                <td className="px-4 py-3 text-zinc-600">{PLAN_LABELS[w.plan] ?? w.plan}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                      STATUS_BADGE[w.status] ?? STATUS_BADGE.deleted
                    )}
                  >
                    {w.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600">{w.memberCount}</td>
                <td className="px-4 py-3 text-zinc-500">{new Date(w.createdAt).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateWorkspaceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateWorkspaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("trial");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, plan, ownerEmail, ownerPassword }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Falha ao criar workspace");
      return;
    }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-900">Criar workspace</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug-do-workspace"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
          />
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none"
          >
            <option value="trial">Trial</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
          <input
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="E-mail do dono"
            type="email"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
          />
          <input
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            placeholder="Senha temporária (8+ caracteres)"
            type="text"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-amber-500"
          />
        </div>

        {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-bold text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !name || !slug || !ownerEmail || ownerPassword.length < 8}
            className="px-4 py-2 bg-zinc-900 text-white text-[13px] font-bold rounded-lg hover:bg-zinc-800 disabled:opacity-40"
          >
            {saving ? "Criando…" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Verificar manualmente**

Com `npm run dev` rodando, logado com o e-mail em `PLATFORM_ADMIN_EMAILS`, abra `http://localhost:3000/admin`. Espera-se ver a tabela (pode estar vazia ou com workspaces reais), o botão "Criar workspace" abrindo o modal, e criar um workspace de teste pela UI funcionando (mesmo caminho já testado via curl na Task 9). Depois, faça logout e tente acessar `/admin` de novo (ou abra numa aba anônima) — espera-se **404**, não uma tela de "sem acesso".

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat(admin): UI /admin — lista de workspaces e criação"
```

---

### Task 12: UI admin — `/admin/[id]` (detalhe: status, plano, features, uso)

**Files:**
- Create: `src/app/admin/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET`/`PATCH /api/admin/workspaces/:id` (Task 10); `FEATURE_KEYS`, `FeatureKey` (Task 5).

- [ ] **Step 1: Implementar**

```tsx
// src/app/admin/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/feature-flags";

type WorkspaceDetail = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  featureFlags: Partial<Record<FeatureKey, boolean>>;
  createdAt: string;
  trialEndsAt: string | null;
};

type Usage = {
  members: { accepted: number; pending: number; suspended: number };
  telephony: {
    balanceCents: number;
    reservedCents: number;
    recentLedger: { id: string; kind: string; amountCents: number; description: string | null; createdAt: string }[];
  } | null;
  whatsappMessages30d: number;
  deals: { count: number; lastActivityAt: string | null };
};

const FEATURE_LABELS: Record<FeatureKey, string> = {
  whatsapp: "WhatsApp",
  voip: "VoIP / Telefonia",
  automacoes: "Automações",
  api_v1: "API pública (v1)",
  custom_fields: "Campos customizados",
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminWorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [features, setFeatures] = useState<Record<FeatureKey, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/workspaces/${id}`);
    if (res.ok) {
      const json = await res.json();
      setWorkspace(json.data.workspace);
      setUsage(json.data.usage);
      setFeatures(json.data.features);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch(`/api/admin/workspaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) load();
  };

  const toggleFeature = (key: FeatureKey, value: boolean) => {
    patch({ featureFlags: { [key]: value } });
  };

  const setStatus = (status: string) => {
    const question =
      status === "suspended"
        ? "Suspender este workspace? Todos os membros perdem acesso imediatamente."
        : status === "deleted"
          ? "Apagar este workspace? Corta acesso na hora (reversível reativando o status)."
          : "Reativar este workspace?";
    if (!confirm(question)) return;
    patch({ status });
  };

  if (loading) return <div className="max-w-3xl mx-auto text-center text-zinc-400 py-20">Carregando…</div>;
  if (!workspace || !usage || !features) {
    return <div className="max-w-3xl mx-auto text-center text-zinc-400 py-20">Workspace não encontrado</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => router.push("/admin")} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">{workspace.name}</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              {workspace.slug} · criado em {new Date(workspace.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
              workspace.status === "active" && "bg-emerald-50 text-emerald-700 border-emerald-200/60",
              workspace.status === "suspended" && "bg-red-50 text-red-700 border-red-200/60",
              workspace.status === "deleted" && "bg-zinc-100 text-zinc-500 border-zinc-200/60"
            )}
          >
            {workspace.status}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <select
            value={workspace.plan}
            onChange={(e) => patch({ plan: e.target.value })}
            disabled={saving}
            className="text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-none"
          >
            <option value="trial">Trial</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>

          {workspace.status !== "active" && (
            <button
              onClick={() => setStatus("active")}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100"
            >
              <CheckCircle2 size={14} /> Ativar
            </button>
          )}
          {workspace.status === "active" && (
            <button
              onClick={() => setStatus("suspended")}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 border border-zinc-200 rounded-lg hover:border-red-200 hover:bg-red-50"
            >
              <Ban size={14} /> Suspender
            </button>
          )}
          {workspace.status !== "deleted" && (
            <button
              onClick={() => setStatus("deleted")}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-500 border border-zinc-200 rounded-lg hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={14} /> Apagar
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Features</h3>
        <div className="grid grid-cols-2 gap-3">
          {FEATURE_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between px-3 py-2.5 border border-zinc-100 rounded-lg">
              <span className="text-sm font-medium text-zinc-700">{FEATURE_LABELS[key]}</span>
              <input
                type="checkbox"
                checked={features[key]}
                disabled={saving}
                onChange={(e) => toggleFeature(key, e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Uso</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase">Membros</p>
            <p className="text-sm font-bold text-zinc-800 mt-0.5">
              {usage.members.accepted} ativos · {usage.members.pending} pendentes · {usage.members.suspended} suspensos
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase">Mensagens WhatsApp (30d)</p>
            <p className="text-sm font-bold text-zinc-800 mt-0.5">{usage.whatsappMessages30d}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase">Negócios</p>
            <p className="text-sm font-bold text-zinc-800 mt-0.5">
              {usage.deals.count} · última atividade{" "}
              {usage.deals.lastActivityAt ? new Date(usage.deals.lastActivityAt).toLocaleDateString("pt-BR") : "—"}
            </p>
          </div>
        </div>

        {usage.telephony && (
          <div className="pt-4 border-t border-zinc-100">
            <p className="text-[11px] font-bold text-zinc-400 uppercase mb-2">
              Telefonia — saldo {centsToBRL(usage.telephony.balanceCents)} ({centsToBRL(usage.telephony.reservedCents)} reservado)
            </p>
            <div className="space-y-1">
              {usage.telephony.recentLedger.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{entry.description ?? entry.kind}</span>
                  <span className={cn("font-semibold", entry.amountCents < 0 ? "text-red-600" : "text-emerald-600")}>
                    {centsToBRL(entry.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Verificar manualmente**

Crie um workspace de teste pela UI (Task 11) ou reuse um existente, clique nele na lista, confirme em `/admin/[id]`:
- Trocar o plano reflete na tela depois de salvar.
- Toggle de uma feature (ex.: VoIP) muda, recarrega e o estado persiste.
- "Suspender" pede confirmação, muda o badge pra vermelho; "Ativar" volta pra verde.
- Bloco de uso mostra números reais (mesmo que zerados pra um workspace novo).

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/[id]/page.tsx"
git commit -m "feat(admin): UI /admin/[id] — status, plano, features, uso"
```

---

### Task 13: Enforcement — WhatsApp, VoIP, Automações + fechar o backlog

**Files:**
- Modify: `src/app/api/whatsapp/send/route.ts`
- Modify: `src/app/api/telephony/calls/route.ts`
- Modify: `src/app/api/telephony/token/route.ts`
- Modify: `src/app/conversas/page.tsx`
- Modify: `src/app/configuracoes/telefone/page.tsx`
- Modify: `src/app/automacoes/page.tsx`
- Modify: `docs/BACKLOG.md`

**Interfaces:**
- Consumes: `assertFeatureEnabled` (Task 6), `RequireFeature` (Task 8).

- [ ] **Step 1: Gate de rota — `src/app/api/whatsapp/send/route.ts`**

Adicione depois de `import type { OutboundMedia } from "@/lib/whatsapp/types";`:
```ts
import { assertFeatureEnabled } from "@/lib/feature-flags-server";
```

Old:
```ts
  const admin = createAdmin();
  const ownerId = await resolveWorkspaceId(admin, user.id);
  const connection = await loadConnection(admin, ownerId);
```

New:
```ts
  const admin = createAdmin();
  const ownerId = await resolveWorkspaceId(admin, user.id);

  const featureCheck = await assertFeatureEnabled(admin, ownerId, "whatsapp");
  if (!featureCheck.ok) return featureCheck.response;

  const connection = await loadConnection(admin, ownerId);
```

- [ ] **Step 2: Gate de rota — `src/app/api/telephony/calls/route.ts`**

Adicione depois de `} from "@/lib/telephony/server";`:
```ts
import { assertFeatureEnabled } from "@/lib/feature-flags-server";
```

Old:
```ts
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    const account = await loadAccount(admin, workspaceId);
```

New:
```ts
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    const featureCheck = await assertFeatureEnabled(admin, workspaceId, "voip");
    if (!featureCheck.ok) return featureCheck.response;

    const account = await loadAccount(admin, workspaceId);
```

- [ ] **Step 3: Gate de rota — `src/app/api/telephony/token/route.ts`**

Adicione depois de `} from "@/lib/telephony/server";` (mesmo import da Step 2 — este arquivo termina o bloco de imports com a mesma linha):
```ts
import { assertFeatureEnabled } from "@/lib/feature-flags-server";
```

Mesmo old/new da Step 2 pro corpo da função (o arquivo tem a mesma estrutura `workspaceId` → `loadAccount`).

- [ ] **Step 4: Type-check depois dos 3 gates de rota**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `admin` (de `createTelephonyAdmin()`/`createAdmin()`) não bater com o tipo `SupabaseClient<Database>` esperado por `assertFeatureEnabled`, confira o retorno dessas factories em `src/lib/telephony/server.ts`/`src/lib/whatsapp/connection.ts` — ambas devem estar tipadas com o mesmo `Database` genérico.

- [ ] **Step 5: Verificar manualmente os 3 gates de rota**

```sql
-- via mcp__supabase__execute_sql, project_id etdkzpiehoivrviylemd
update workspaces set feature_flags = '{"whatsapp": false}'::jsonb where id = '<workspace de teste com WhatsApp conectado>';
```

Tente enviar uma mensagem por esse workspace — espera-se `403 FEATURE_DISABLED`. Reverta (`feature_flags = '{}'`) e confirme que volta a funcionar. Repita o mesmo teste pra `voip` numa chamada.

- [ ] **Step 6: Gate de UI — `src/app/conversas/page.tsx`**

Adicione ao final do bloco de imports (depois de `import { NewDealModal } from "@/components/pipeline/new-deal-modal";`):
```ts
import { RequireFeature } from "@/components/auth/require-feature";
```

Old (abertura do return):
```tsx
  return (
    <div className="h-full flex bg-background">
```

New:
```tsx
  return (
    <RequireFeature feature="whatsapp">
    <div className="h-full flex bg-background">
```

Old (fim do arquivo):
```tsx
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

New:
```tsx
            )}
          </>
        )}
      </div>
    </div>
    </RequireFeature>
  );
}
```

- [ ] **Step 7: Gate de UI — `src/app/configuracoes/telefone/page.tsx`**

Adicione depois do bloco de imports existente (depois de `} from "@/hooks/use-telephony";`, antes de `const CREDIT_PACKS = ...`):
```ts
import { RequireFeature } from "@/components/auth/require-feature";
```

Old (abertura do return):
```tsx
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
```

New:
```tsx
  return (
    <RequireFeature feature="voip">
    <div className="mx-auto max-w-3xl px-6 py-10">
```

Old (fim do arquivo):
```tsx
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

New:
```tsx
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </RequireFeature>
  );
}
```

- [ ] **Step 8: Gate de UI — `src/app/automacoes/page.tsx`**

Adicione ao lado do import existente:
```ts
import { RequireCapability } from "@/components/auth/require-capability";
import { RequireFeature } from "@/components/auth/require-feature";
```

Old:
```tsx
export default function AutomacoesPage() {
  return (
    <RequireCapability capability="gerenciar_automacoes">
      <AutomacoesPageContent />
    </RequireCapability>
  );
}
```

New:
```tsx
export default function AutomacoesPage() {
  return (
    <RequireFeature feature="automacoes">
      <RequireCapability capability="gerenciar_automacoes">
        <AutomacoesPageContent />
      </RequireCapability>
    </RequireFeature>
  );
}
```

- [ ] **Step 9: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros. Lint pode reclamar de indentação nos 2 wraps de retorno (Steps 6-7) já que o `<div>` interno não foi reindentado — se reclamar, rode o fix automático do eslint (`npm run lint -- --fix`) só nesses 2 arquivos, ou ajuste a indentação manualmente; não é um erro de lógica.

- [ ] **Step 10: Verificar manualmente os 3 gates de UI**

Com um workspace de teste e `feature_flags` desligando cada feature (mesmo comando SQL do Step 5, trocando a chave), visite `/conversas`, `/configuracoes/telefone` e `/automacoes` logado nesse workspace — espera-se a tela "Recurso não incluído" em cada uma. Reverta `feature_flags` pra `{}` entre um teste e outro.

- [ ] **Step 11: Fechar o item no backlog**

Read `docs/BACKLOG.md` (as primeiras ~70 linhas, onde ficam os itens `[x]` concluídos mais recentes) e adicione uma linha nova nesse mesmo formato, datada de hoje:

```markdown
- [x] **Painel admin de workspaces (2026-08-29)** — `/admin` + `/api/admin/*`:
  criar workspace+dono, suspender/ativar/apagar (soft), feature flags por
  workspace (WhatsApp/VoIP/Automações com enforcement real), uso/gasto sem
  Stripe (telefonia é o único gasto em R$ real hoje). Ver
  `docs/superpowers/specs/2026-08-29-admin-workspaces-design.md`.
```

- [ ] **Step 12: Commit**

```bash
git add src/app/api/whatsapp/send/route.ts src/app/api/telephony/calls/route.ts \
  src/app/api/telephony/token/route.ts src/app/conversas/page.tsx \
  src/app/configuracoes/telefone/page.tsx src/app/automacoes/page.tsx docs/BACKLOG.md
git commit -m "feat(admin): liga o enforcement de feature flags (whatsapp/voip/automacoes)"
```

- [ ] **Step 13: Limpar o(s) workspace(s) de teste restantes**

Via `mcp__supabase__execute_sql`, remova qualquer workspace/usuário de teste criado durante a verificação manual das Tasks 9-13 que não deva ficar em produção.
