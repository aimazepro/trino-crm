# Entrada de Leads + API Pública Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a real public API (`/api/v1/*`) for TrinoCRM — Bearer-key auth with enforced permissions, full CRUD on deals/contacts/companies/activities/notes, read-only pipelines/custom-fields/users, a public lead-capture form endpoint, the `lead_recebido` automation trigger, attribution fields, a dedicated Cloudflare-fronted subdomain, and public docs — closing both the "API pública" promise the `/configuracoes/api` screen already makes and the "Entrada de leads" half of Fase 2.

**Architecture:** Every `/api/v1/*` route resolves a Bearer API key against `api_keys` (SHA-256 hash, already stored), loads workspace/permissions/default-owner from it, rate-limits and checks idempotency, then reads/writes through `createAdmin()` (service role) with `workspace_id` filtered explicitly in application code — same trust model as the Motor's worker routes, not RLS-mediated because there's no user session. `POST /api/v1/deals` is the lead-intake endpoint; a new public (keyless) `POST /api/v1/leads/form/:formId` covers embeddable HTML forms. A `origin` column on `deals` lets the existing `emit_deal_automation_event()` trigger (from the Motor) pick `lead_recebido` instead of `deal_created` for API/form-sourced deals, without adding a second trigger mechanism.

**Tech Stack:** Next.js 16 App Router route handlers (Node runtime), Supabase Postgres (migrations, triggers, RLS), `@supabase/supabase-js` admin client, Cloudflare (DNS + WAF/rate-limit) via its REST API.

**Spec:** `docs/superpowers/specs/2026-08-20-entrada-de-leads-api-publica-design.md`

## Global Constraints

- **No test framework in this repo** (`package.json` has no test script — confirmed, same as the Motor plan). Every task's verification step is `npm run build` (type-check, via `next build`) + `npm run lint` + a manual check (SQL query via MCP or `curl`) — never a fabricated test file.
- Every `/api/v1/*` route uses `createAdmin()` from `@/lib/whatsapp/connection` (already exported, already reused by two other routes — do not create a second copy) and filters every query by `workspace_id` from the resolved `ApiKeyContext` explicitly. RLS is not the trust boundary here; the application code is.
- Dynamic route params in this Next.js version are `Promise`-wrapped: `{ params }: { params: Promise<{ id: string }> }`, then `const { id } = await params;` — confirmed from `src/app/api/track/[trackId]/route.ts` and `src/app/api/convites/[token]/route.ts`.
- All API request/response bodies use `camelCase` keys; all DB columns stay `snake_case`. Every route maps explicitly — no key-casing library.
- Success envelope: `{ data: ... }` (add `warnings: [...]` alongside `data` only when custom-field warnings exist). List endpoints: `{ data: [...], nextCursor: string | null }`. Error envelope: `{ error: { code, message } }`.
- `deal_field_values(deal_id, field_id, value)` is the **only** custom-field value table that exists (confirmed against `database.types.ts` — no `contact_field_values`/`company_field_values`). `customFields` is therefore only accepted on deal endpoints (`POST`/`PATCH /api/v1/deals`) in this plan; contacts/companies endpoints don't take a `customFields` body key.
- `pipelines` has no `is_default` flag — "pipeline padrão" = lowest `sort_order` row for the workspace. `pipeline_stages` has no `is_default` flag either — "primeira etapa" = lowest `order` row for the resolved pipeline (column is literally named `order`).
- `deal_notes(id, deal_id, content, created_at)` has **no `workspace_id` column** — every note route must resolve/validate `deal_id` against `deals.workspace_id = ctx.workspaceId` before reading or writing, there is no shortcut filter.
- Supabase project id for all MCP calls: `etdkzpiehoivrviylemd` (same project as the Motor plan).
- After every migration that adds/changes tables, regenerate `src/lib/supabase/database.types.ts` via `mcp__supabase__generate_typescript_types` before writing TypeScript against the new schema.
- `proxy.ts`'s matcher must include `/api/v1` in its exclusion regex (machine callers, no session cookie) — same reasoning already documented there for `api/whatsapp/webhook` and `api/automations`.
- Cloudflare work (Task 17) needs `CLOUDFLARE_API_TOKEN` (Zone:DNS Edit + Zone:Firewall Services Edit on the `aimaze.com.br` zone) in `.env.local` — a hard prerequisite for that task only; every earlier task is independent of it.

---

### Task 1: Schema migration — API keys, attribution fields, lead forms, idempotency, rate limiting

**Files:**
- Create: `supabase/migrations/20260820120000_leads_api_publica_schema.sql`

**Interfaces:**
- Produces: `api_keys.default_owner_id`, `api_keys.permissions`, `api_keys.rate_limit_per_min`; `deals.utm_source/utm_medium/utm_campaign/utm_content/utm_term/campaign_id/origin`; tables `lead_forms`, `api_idempotency_keys`, `api_rate_limit_windows`.

- [ ] **Step 1: Write the migration**

```sql
-- api_keys: the "Proprietário padrão" and "Permissões" fields the
-- /configuracoes/api screen already renders but never persisted (dead UI —
-- see the design doc's Contexto section). This makes them real.
ALTER TABLE public.api_keys
  ADD COLUMN default_owner_id uuid REFERENCES auth.users(id),
  ADD COLUMN permissions jsonb NOT NULL DEFAULT '["all"]'::jsonb,
  ADD COLUMN rate_limit_per_min int NOT NULL DEFAULT 60;

-- Attribution + creation-mechanism marker. origin drives which automation
-- trigger the Motor's emit_deal_automation_event() fires (Task 6):
-- 'app'/'import' -> deal_created (unchanged), 'api'/'form' -> lead_recebido.
ALTER TABLE public.deals
  ADD COLUMN utm_source text,
  ADD COLUMN utm_medium text,
  ADD COLUMN utm_campaign text,
  ADD COLUMN utm_content text,
  ADD COLUMN utm_term text,
  ADD COLUMN campaign_id text,
  ADD COLUMN origin text NOT NULL DEFAULT 'app';

ALTER TABLE public.deals
  ADD CONSTRAINT deals_origin_check CHECK (origin IN ('app', 'import', 'api', 'form'));

-- Public lead-capture form config. The public endpoint (Task 15) authenticates
-- by knowing this row's id, not a secret -- id is safe to embed in client HTML.
CREATE TABLE public.lead_forms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id),
  name             text NOT NULL,
  pipeline_id      uuid REFERENCES public.pipelines(id),
  stage_id         uuid REFERENCES public.pipeline_stages(id),
  default_owner_id uuid REFERENCES auth.users(id),
  source_label     text NOT NULL DEFAULT 'Formulário',
  honeypot_field   text NOT NULL DEFAULT '_hp',
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;

-- Same shape as the existing "webhooks: select/insert/update/delete" policies
-- (workspace_members membership via my_workspace_ids()) -- the public form
-- endpoint itself uses the admin client and bypasses RLS entirely.
CREATE POLICY "lead_forms: select" ON public.lead_forms FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
CREATE POLICY "lead_forms: insert" ON public.lead_forms FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()) AND is_ws_admin(workspace_id));
CREATE POLICY "lead_forms: update" ON public.lead_forms FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()) AND is_ws_admin(workspace_id))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()) AND is_ws_admin(workspace_id));
CREATE POLICY "lead_forms: delete" ON public.lead_forms FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()) AND is_ws_admin(workspace_id));

-- Generic per-POST idempotency, Stripe-style. Any /api/v1 POST can pass an
-- Idempotency-Key header; a repeat within 24h replays the stored response
-- instead of reprocessing (Task 2 reads/writes this).
CREATE TABLE public.api_idempotency_keys (
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id),
  idempotency_key text NOT NULL,
  method          text NOT NULL,
  path            text NOT NULL,
  response_status int NOT NULL,
  response_body   jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, idempotency_key, method, path)
);

-- Fixed-window rate limiting per key, one row per (key, minute). Task 2
-- upserts + increments on every request; old windows are swept by the
-- existing daily purge-cron-logs job (Task 1 Step 2 below).
CREATE TABLE public.api_rate_limit_windows (
  api_key_id    uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_start  timestamptz NOT NULL,
  request_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, window_start)
);

-- Service role only (Task 2's admin client) ever touches these three tables
-- directly; no end-user session does. RLS stays off for idempotency/rate-limit
-- (pure internal bookkeeping, never read through a user-facing screen).
```

- [ ] **Step 2: Extend the existing daily purge job to sweep rate-limit windows**

Find the `purge-cron-logs` job's SQL body (it's a `pg_cron` job — query it, don't guess):

```sql
select jobname, command from cron.job where jobname = 'purge-cron-logs';
```

Add one `DELETE` statement to that job's command for `api_rate_limit_windows` older than 1 hour (windows are per-minute; nothing needs them past 60 minutes) and for `api_idempotency_keys` older than 48h (spec says 24h relevance window; keep a day of slack before deleting):

```sql
DELETE FROM public.api_rate_limit_windows WHERE window_start < now() - interval '1 hour';
DELETE FROM public.api_idempotency_keys WHERE created_at < now() - interval '48 hours';
```

Apply via `mcp__supabase__execute_sql` (`cron.alter_job` or a full `cron.schedule` re-registration matching whatever the existing job's registration pattern is — read it first, don't reinvent).

- [ ] **Step 3: Apply the migration**

Use `mcp__supabase__apply_migration` with project id `etdkzpiehoivrviylemd`, name `leads_api_publica_schema`, the SQL from Step 1.

- [ ] **Step 4: Verify**

```sql
select column_name from information_schema.columns where table_name = 'api_keys' and column_name in ('default_owner_id', 'permissions', 'rate_limit_per_min');
select column_name from information_schema.columns where table_name = 'deals' and column_name like 'utm_%' or column_name in ('campaign_id', 'origin');
select table_name from information_schema.tables where table_name in ('lead_forms', 'api_idempotency_keys', 'api_rate_limit_windows');
```

Expected: all listed columns/tables present.

- [ ] **Step 5: Regenerate types**

Run `mcp__supabase__generate_typescript_types` for project `etdkzpiehoivrviylemd`, overwrite `src/lib/supabase/database.types.ts`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260820120000_leads_api_publica_schema.sql src/lib/supabase/database.types.ts
git commit -m "feat: schema for public API — key permissions, attribution fields, lead_forms, idempotency, rate limiting"
```

---

### Task 2: `src/lib/api-auth.ts` — Bearer key resolution, permissions, rate limit, idempotency

**Files:**
- Create: `src/lib/api-auth.ts`

**Interfaces:**
- Consumes: `createAdmin()` from `@/lib/whatsapp/connection`; `Database` from `@/lib/supabase/database.types`.
- Produces: `ApiKeyContext`, `authenticateApiRequest(request, requiredPermission)`, `withIdempotency(admin, workspaceId, request, method, path, handler)`, `apiError(code, message, status)`, `apiSuccess(data, warnings?, status?)`. Every later `/api/v1` route imports these three functions and this one type.

- [ ] **Step 1: Write `src/lib/api-auth.ts`**

```typescript
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface ApiKeyContext {
  workspaceId: string;
  apiKeyId: string;
  defaultOwnerId: string | null;
  permissions: string[];
  rateLimitPerMin: number;
}

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function apiSuccess(data: unknown, warnings?: { field: string; message: string }[], status = 200) {
  const body: Record<string, unknown> = { data };
  if (warnings && warnings.length > 0) body.warnings = warnings;
  return NextResponse.json(body, { status });
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function hasPermission(permissions: string[], needed: string): boolean {
  return permissions.includes("all") || permissions.includes(needed);
}

/**
 * Resolves the Bearer key, checks the rate limit, checks the permission.
 * One call per route -- returns either a ready-to-use admin client + context,
 * or a NextResponse the route should return as-is.
 */
export async function authenticateApiRequest(
  request: Request,
  admin: SupabaseClient<Database>,
  requiredPermission: string | null
): Promise<{ ok: true; ctx: ApiKeyContext } | { ok: false; response: NextResponse }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, response: apiError("AUTH_REQUIRED", "Missing Authorization: Bearer header", 401) };
  }
  const raw = match[1].trim();
  const keyHash = hashKey(raw);

  const { data: key } = await admin
    .from("api_keys")
    .select("id, workspace_id, default_owner_id, permissions, rate_limit_per_min, revoked")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!key || key.revoked) {
    return { ok: false, response: apiError("INVALID_API_KEY", "API key inválida ou revogada", 401) };
  }

  const permissions = (key.permissions as string[] | null) ?? ["all"];
  const ctx: ApiKeyContext = {
    workspaceId: key.workspace_id,
    apiKeyId: key.id,
    defaultOwnerId: key.default_owner_id,
    permissions,
    rateLimitPerMin: key.rate_limit_per_min,
  };

  const rate = await checkAndIncrementRateLimit(admin, ctx.apiKeyId, ctx.rateLimitPerMin);
  if (!rate.ok) {
    const response = apiError("RATE_LIMIT_EXCEEDED", "Limite de requisições excedido", 429);
    response.headers.set("Retry-After", String(rate.retryAfterSeconds));
    response.headers.set("X-RateLimit-Limit", String(ctx.rateLimitPerMin));
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set("X-RateLimit-Reset", String(rate.resetAt));
    return { ok: false, response };
  }

  if (requiredPermission && !hasPermission(permissions, requiredPermission)) {
    return { ok: false, response: apiError("INSUFFICIENT_SCOPE", `API key sem permissão '${requiredPermission}'`, 403) };
  }

  // Best-effort; a failed update here must never block the request.
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", ctx.apiKeyId).then(() => {});

  return { ok: true, ctx };
}

async function checkAndIncrementRateLimit(
  admin: SupabaseClient<Database>,
  apiKeyId: string,
  limitPerMin: number
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number; resetAt: number }> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000);

  const { data } = await admin.rpc("increment_api_rate_limit", {
    p_api_key_id: apiKeyId,
    p_window_start: windowStart.toISOString(),
  });

  const count = (data as number | null) ?? 1;
  if (count > limitPerMin) {
    const resetAt = Math.floor((windowStart.getTime() + 60000) / 1000);
    return { ok: false, retryAfterSeconds: Math.max(1, resetAt - Math.floor(now.getTime() / 1000)), resetAt };
  }
  return { ok: true };
}

/**
 * Wraps a POST handler with generic Idempotency-Key support. If the header is
 * present and (workspaceId, key, method, path) was seen within the retention
 * window, replays the stored response instead of calling handler().
 */
export async function withIdempotency(
  admin: SupabaseClient<Database>,
  workspaceId: string,
  request: Request,
  method: string,
  path: string,
  handler: () => Promise<{ status: number; body: unknown }>
): Promise<NextResponse> {
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    const result = await handler();
    return NextResponse.json(result.body, { status: result.status });
  }

  const { data: existing } = await admin
    .from("api_idempotency_keys")
    .select("response_status, response_body")
    .eq("workspace_id", workspaceId)
    .eq("idempotency_key", idempotencyKey)
    .eq("method", method)
    .eq("path", path)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(existing.response_body, { status: existing.response_status });
  }

  const result = await handler();
  await admin.from("api_idempotency_keys").insert({
    workspace_id: workspaceId,
    idempotency_key: idempotencyKey,
    method,
    path,
    response_status: result.status,
    response_body: result.body as never,
  });
  return NextResponse.json(result.body, { status: result.status });
}
```

- [ ] **Step 2: Add the rate-limit increment RPC** (atomic upsert-and-return-count; a plain `INSERT ... ON CONFLICT` round-tripped through supabase-js can't return the updated count in one call without `.select()`, and two concurrent requests would race on the read-then-write otherwise)

```sql
CREATE OR REPLACE FUNCTION public.increment_api_rate_limit(p_api_key_id uuid, p_window_start timestamptz)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count int;
BEGIN
  INSERT INTO public.api_rate_limit_windows (api_key_id, window_start, request_count)
  VALUES (p_api_key_id, p_window_start, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET request_count = api_rate_limit_windows.request_count + 1
  RETURNING request_count INTO v_count;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.increment_api_rate_limit(uuid, timestamptz) FROM anon, authenticated;
```

Apply via `mcp__supabase__apply_migration`, name `increment_api_rate_limit_rpc`. Regenerate types afterward (Task 1 Step 5's command, rerun).

- [ ] **Step 3: Verify with `npm run build`**

Run: `npm run build`
Expected: compiles clean (this file has no route yet to exercise it at runtime — Task 3 does that).

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-auth.ts supabase/migrations/*_increment_api_rate_limit_rpc.sql src/lib/supabase/database.types.ts
git commit -m "feat: add api-auth helper — Bearer key resolution, rate limit, idempotency"
```

---

### Task 3: `GET /api/v1/me` + proxy exclusion

**Files:**
- Create: `src/app/api/v1/me/route.ts`
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `authenticateApiRequest`, `apiSuccess`, `apiError` from `@/lib/api-auth`; `createAdmin` from `@/lib/whatsapp/connection`.

- [ ] **Step 1: Write the route**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, null);
  if (!auth.ok) return auth.response;

  const { data: workspace } = await admin
    .from("workspaces")
    .select("name, slug")
    .eq("id", auth.ctx.workspaceId)
    .maybeSingle();

  return apiSuccess({
    workspace: { id: auth.ctx.workspaceId, name: workspace?.name ?? null },
    defaultOwnerId: auth.ctx.defaultOwnerId,
    permissions: auth.ctx.permissions,
    rateLimitPerMin: auth.ctx.rateLimitPerMin,
  });
}
```

- [ ] **Step 2: Update `src/proxy.ts`'s matcher**

Modify the `config.matcher` regex to add `/api/v1` to the negative-lookahead exclusion list, right next to the existing `api/automations` entry:

```typescript
// api/v1 is the public API: Bearer-key auth inside the route (see
// src/lib/api-auth.ts), no session cookie -- same reasoning as
// api/whatsapp/webhook and api/automations above.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/callback|api/track|api/whatsapp/webhook|api/whatsapp/queue|api/convites/aceitar|api/automations|api/v1|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 3: Create a test API key and verify**

```sql
-- pick any existing workspace_id for this test
insert into api_keys (workspace_id, name, key_hash, key_prefix)
values ('<workspace_id>', 'plan-verify', encode(digest('trn_test123', 'sha256'), 'hex'), 'trn_test123')
returning id;
```

Run: `npm run dev` (separate terminal), then:

```bash
curl -s http://localhost:3000/api/v1/me -H "Authorization: Bearer trn_test123" | jq
curl -s http://localhost:3000/api/v1/me | jq   # no header
curl -s http://localhost:3000/api/v1/me -H "Authorization: Bearer wrong" | jq
```

Expected: first call `200` with `data.workspace.id` matching; second `401 AUTH_REQUIRED`; third `401 INVALID_API_KEY`.

- [ ] **Step 4: Verify the rate limit**

```sql
update api_keys set rate_limit_per_min = 5 where key_prefix = 'trn_test123';
```

```bash
for i in $(seq 1 7); do curl -s -o /dev/null -w "%{http_code} " http://localhost:3000/api/v1/me -H "Authorization: Bearer trn_test123"; done; echo
```

Expected: `200 200 200 200 200 429 429` — the 6th and 7th calls inside the same minute are rejected. Then:

```sql
update api_keys set rate_limit_per_min = 60 where key_prefix = 'trn_test123';
```

(restore the default before continuing to the next task — every later task's verification assumes the un-throttled 60/min default).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/me/route.ts src/proxy.ts
git commit -m "feat: add GET /api/v1/me + exclude /api/v1 from session middleware"
```

---

### Task 4: `src/lib/api-lead-helpers.ts` — contact/company dedupe, pipeline/stage resolution, custom-field values

**Files:**
- Create: `src/lib/api-lead-helpers.ts`

**Interfaces:**
- Consumes: `Database` from `@/lib/supabase/database.types`.
- Produces: `findOrCreateContact`, `findOrCreateCompany`, `resolvePipelineStage`, `applyDealCustomFields` — consumed by Task 5 (`POST /deals`), Task 7 (`PATCH /deals/:id`), Task 15 (public form).

- [ ] **Step 1: Write the helpers**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Dedupes by email or phone within the workspace; creates if no match. Never merges/updates an existing contact's fields. */
export async function findOrCreateContact(
  admin: Admin,
  workspaceId: string,
  input: { name: string; email?: string; phone?: string; companyId?: string | null }
): Promise<{ id: string; created: boolean }> {
  const { data: candidates } = await admin
    .from("contacts")
    .select("id, emails, phones")
    .eq("workspace_id", workspaceId);

  const emailLower = input.email?.toLowerCase().trim();
  const phoneDigits = input.phone ? digitsOnly(input.phone) : undefined;

  const match = (candidates ?? []).find((c) => {
    const emails = ((c.emails as string[] | null) ?? []).map((e) => e.toLowerCase().trim());
    const phones = ((c.phones as string[] | null) ?? []).map((p) => digitsOnly(p));
    return (emailLower && emails.includes(emailLower)) || (phoneDigits && phones.includes(phoneDigits));
  });

  if (match) return { id: match.id, created: false };

  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      emails: input.email ? [input.email] : [],
      phones: input.phone ? [input.phone] : [],
      company_id: input.companyId ?? null,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(`falha ao criar contact: ${error?.message}`);
  return { id: created.id, created: true };
}

/** Dedupes by cnpj (digits-only) if provided, else by exact case-insensitive name. */
export async function findOrCreateCompany(
  admin: Admin,
  workspaceId: string,
  input: { name: string; cnpj?: string }
): Promise<{ id: string; created: boolean }> {
  if (input.cnpj) {
    const cnpjDigits = digitsOnly(input.cnpj);
    const { data: byCnpj } = await admin
      .from("companies")
      .select("id, cnpj")
      .eq("workspace_id", workspaceId);
    const match = (byCnpj ?? []).find((c) => c.cnpj && digitsOnly(c.cnpj) === cnpjDigits);
    if (match) return { id: match.id, created: false };
  } else {
    const { data: byName } = await admin
      .from("companies")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", input.name)
      .maybeSingle();
    if (byName) return { id: byName.id, created: false };
  }

  const { data: created, error } = await admin
    .from("companies")
    .insert({ workspace_id: workspaceId, name: input.name, cnpj: input.cnpj ?? null })
    .select("id")
    .single();

  if (error || !created) throw new Error(`falha ao criar company: ${error?.message}`);
  return { id: created.id, created: true };
}

/**
 * pipelineInput/stageInput accept either a uuid or an exact (case-insensitive)
 * name. Missing/unmatched pipeline -> lowest sort_order pipeline in the
 * workspace. Missing/unmatched stage -> lowest `order` stage in the resolved
 * pipeline. Returns null only if the workspace has zero pipelines.
 */
export async function resolvePipelineStage(
  admin: Admin,
  workspaceId: string,
  pipelineInput?: string,
  stageInput?: string
): Promise<{ pipelineId: string; stageId: string } | null> {
  const { data: pipelines } = await admin
    .from("pipelines")
    .select("id, name, sort_order")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true });

  if (!pipelines || pipelines.length === 0) return null;

  const pipeline =
    (pipelineInput &&
      pipelines.find((p) => p.id === pipelineInput || p.name.toLowerCase() === pipelineInput.toLowerCase())) ||
    pipelines[0];

  const { data: stages } = await admin
    .from("pipeline_stages")
    .select("id, name, order")
    .eq("pipeline_id", pipeline.id)
    .order("order", { ascending: true });

  if (!stages || stages.length === 0) throw new Error(`pipeline '${pipeline.name}' não tem etapas`);

  const stage =
    (stageInput &&
      stages.find((s) => s.id === stageInput || s.name.toLowerCase() === stageInput.toLowerCase())) ||
    stages[0];

  return { pipelineId: pipeline.id, stageId: stage.id };
}

/**
 * Writes/updates deal_field_values for the given deal. Unknown field ids
 * (not present in custom_fields for entity='deal' in this workspace) are
 * skipped and returned as warnings instead of erroring the whole request —
 * same behavior as the reference API doc.
 */
export async function applyDealCustomFields(
  admin: Admin,
  workspaceId: string,
  dealId: string,
  customFields: Record<string, string> | undefined
): Promise<{ field: string; message: string }[]> {
  if (!customFields) return [];
  const warnings: { field: string; message: string }[] = [];

  const { data: validFields } = await admin
    .from("custom_fields")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("entity", "deal");
  const validIds = new Set((validFields ?? []).map((f) => f.id));

  for (const [fieldId, value] of Object.entries(customFields)) {
    if (!validIds.has(fieldId)) {
      warnings.push({ field: fieldId, message: "Custom field not found" });
      continue;
    }
    await admin
      .from("deal_field_values")
      .upsert({ deal_id: dealId, field_id: fieldId, value }, { onConflict: "deal_id,field_id" });
  }
  return warnings;
}
```

- [ ] **Step 2: `deal_field_values` needs a unique constraint for the upsert to target**

```sql
ALTER TABLE public.deal_field_values
  ADD CONSTRAINT deal_field_values_deal_field_unique UNIQUE (deal_id, field_id);
```

Apply via `mcp__supabase__apply_migration`, name `deal_field_values_unique_constraint`. If it fails on existing duplicate rows, run `select deal_id, field_id, count(*) from deal_field_values group by 1,2 having count(*) > 1;` first and resolve duplicates (keep the most recent by `updated_at`) before retrying — do not silently drop the constraint.

- [ ] **Step 3: Verify with `npm run build`**

Run: `npm run build`
Expected: compiles clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-lead-helpers.ts supabase/migrations/*_deal_field_values_unique_constraint.sql src/lib/supabase/database.types.ts
git commit -m "feat: add lead-intake helpers — contact/company dedupe, pipeline resolution, custom fields"
```

---

### Task 5: `POST /api/v1/deals` — the lead-intake endpoint

**Files:**
- Create: `src/app/api/v1/deals/route.ts`

**Interfaces:**
- Consumes: `authenticateApiRequest`, `withIdempotency`, `apiSuccess`, `apiError`, `ApiKeyContext` from `@/lib/api-auth`; `findOrCreateContact`, `resolvePipelineStage`, `applyDealCustomFields` from `@/lib/api-lead-helpers`; `createAdmin` from `@/lib/whatsapp/connection`.
- Produces: `POST /api/v1/deals` — this is what Task 6's trigger and Task 15's form route build on top of.

- [ ] **Step 1: Write the route**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";
import { findOrCreateContact, resolvePipelineStage, applyDealCustomFields } from "@/lib/api-lead-helpers";

export const dynamic = "force-dynamic";

interface CreateDealBody {
  title?: string;
  value?: number;
  pipeline?: string;
  stage?: string;
  ownerId?: string;
  contactId?: string;
  contact?: { name: string; email?: string; phone?: string };
  note?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  campaignId?: string;
  customFields?: Record<string, string>;
}

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_deals");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  let body: CreateDealBody;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
  }

  if (!body.contactId && !body.contact) {
    return apiError("VALIDATION_ERROR", "Informe contactId ou contact", 400);
  }
  if (body.contact && !body.contact.name) {
    return apiError("VALIDATION_ERROR", "contact.name é obrigatório", 400);
  }
  if (body.contact && !body.contact.email && !body.contact.phone) {
    return apiError("VALIDATION_ERROR", "contact precisa de email ou phone", 400);
  }

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/deals", async () => {
    let contactId = body.contactId;
    if (!contactId && body.contact) {
      const result = await findOrCreateContact(admin, ctx.workspaceId, body.contact);
      contactId = result.id;
    } else if (contactId) {
      const { data: owned } = await admin
        .from("contacts")
        .select("id")
        .eq("id", contactId)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (!owned) return { status: 400, body: { error: { code: "VALIDATION_ERROR", message: "contactId não encontrado neste workspace" } } };
    }

    const resolved = await resolvePipelineStage(admin, ctx.workspaceId, body.pipeline, body.stage);
    if (!resolved) {
      return { status: 400, body: { error: { code: "VALIDATION_ERROR", message: "Workspace não tem nenhum pipeline configurado" } } };
    }

    const { data: contactRow } = await admin.from("contacts").select("name").eq("id", contactId!).maybeSingle();
    const title = body.title || `Lead — ${contactRow?.name ?? "Sem nome"}`;

    const { data: deal, error } = await admin
      .from("deals")
      .insert({
        workspace_id: ctx.workspaceId,
        title,
        value: body.value ?? 0,
        pipeline_id: resolved.pipelineId,
        stage_id: resolved.stageId,
        contact_id: contactId,
        owner_id: body.ownerId ?? ctx.defaultOwnerId,
        source: body.source ?? null,
        utm_source: body.utmSource ?? null,
        utm_medium: body.utmMedium ?? null,
        utm_campaign: body.utmCampaign ?? null,
        utm_content: body.utmContent ?? null,
        utm_term: body.utmTerm ?? null,
        campaign_id: body.campaignId ?? null,
        origin: "api",
        status: "Ativo",
      })
      .select("id")
      .single();

    if (error || !deal) {
      return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message ?? "falha ao criar negócio" } } };
    }

    if (body.note) {
      await admin.from("deal_notes").insert({ deal_id: deal.id, content: body.note });
    }

    const warnings = await applyDealCustomFields(admin, ctx.workspaceId, deal.id, body.customFields);

    return { status: 201, body: { data: { id: deal.id, contactId, created: true }, ...(warnings.length ? { warnings } : {}) } };
  });
}
```

- [ ] **Step 2: Verify with `npm run build`**

Run: `npm run build`
Expected: compiles clean.

- [ ] **Step 3: Verify end-to-end**

```bash
curl -s -X POST http://localhost:3000/api/v1/deals \
  -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" \
  -d '{"contact":{"name":"João Teste","email":"joao@teste.com"},"value":5000,"note":"veio do curl","utmSource":"facebook"}' | jq

# repeat with the SAME contact email — must reuse the contact, still create a new deal
curl -s -X POST http://localhost:3000/api/v1/deals \
  -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" \
  -d '{"contact":{"name":"João Teste","email":"joao@teste.com"},"value":3000}' | jq

# idempotency: same key twice must return the identical deal id both times
curl -s -X POST http://localhost:3000/api/v1/deals \
  -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -H "Idempotency-Key: test-1" \
  -d '{"contact":{"name":"Idem Teste","email":"idem@teste.com"}}' | jq
curl -s -X POST http://localhost:3000/api/v1/deals \
  -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -H "Idempotency-Key: test-1" \
  -d '{"contact":{"name":"Idem Teste","email":"idem@teste.com"}}' | jq
```

Expected: first two calls each `201` with a different `id`, same `contactId` on both; the two idempotent calls return the exact same `id`. Then in the SQL editor: `select id, title, value, contact_id, origin, source, utm_source from deals order by created_at desc limit 4;` — confirm 3 distinct deals (not 4 — idempotency blocked the duplicate), all `origin='api'`.

- [ ] **Step 4: Verify permission enforcement**

```sql
insert into api_keys (workspace_id, name, key_hash, key_prefix, permissions)
values ('<workspace_id>', 'plan-verify-readonly', encode(digest('trn_readonly', 'sha256'), 'hex'), 'trn_readonly', '["read_deals"]'::jsonb);
```

```bash
curl -s -o /tmp/scope.json -w "%{http_code}\n" -X POST http://localhost:3000/api/v1/deals \
  -H "Authorization: Bearer trn_readonly" -H "Content-Type: application/json" \
  -d '{"contact":{"name":"Não Deveria Criar","email":"scope@teste.com"}}'
cat /tmp/scope.json | jq
```

Expected: `403`, body `{"error":{"code":"INSUFFICIENT_SCOPE", ...}}`. Confirm no deal was created: `select count(*) from deals where title = 'Lead — Não Deveria Criar';` returns `0`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/deals/route.ts
git commit -m "feat: add POST /api/v1/deals — the lead-intake endpoint"
```

---

### Task 6: `lead_recebido` trigger

**Files:**
- Modify: `src/lib/crm-types.ts:154-160` (`TriggerType`)
- Modify: `src/contexts/automacoes-context.tsx:167-183` (`TRIGGER_LABELS`, `TRIGGER_DESCRIPTIONS`)
- Create: `supabase/migrations/20260820130000_lead_recebido_trigger.sql`

**Interfaces:**
- Consumes: `deals.origin` (Task 1).
- Produces: `TriggerType` now includes `'lead_recebido'`; `automations.trigger` accepts it in the UI's trigger picker.

- [ ] **Step 1: Add the type**

In `src/lib/crm-types.ts`, extend `TriggerType`:

```typescript
export type TriggerType =
  | 'deal_created'
  | 'stage_changed'
  | 'deal_won'
  | 'deal_lost'
  | 'deal_updated'
  | 'activity_created'
  | 'lead_recebido';
```

- [ ] **Step 2: Add the labels**

In `src/contexts/automacoes-context.tsx`, add to both maps:

```typescript
export const TRIGGER_LABELS: Record<string, string> = {
  deal_created: "Negócio criado",
  stage_changed: "Etapa alterada",
  deal_won: "Negócio ganho",
  deal_lost: "Negócio perdido",
  deal_updated: "Negócio atualizado",
  activity_created: "Atividade criada",
  lead_recebido: "Lead recebido (API/formulário)",
};

export const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  deal_created: "Quando um novo negócio for criado",
  stage_changed: "Quando a etapa de um negócio mudar",
  deal_won: "Quando um negócio for marcado como ganho",
  deal_lost: "Quando um negócio for marcado como perdido",
  deal_updated: "Quando qualquer campo do negócio for alterado",
  activity_created: "Quando uma nova atividade for registrada",
  lead_recebido: "Quando um lead entrar pela API pública ou por um formulário externo",
};
```

- [ ] **Step 3: Write the trigger migration**

```sql
-- Replaces the Motor's emit_deal_automation_event() INSERT branch only (the
-- UPDATE branch, unchanged, is copied verbatim below so the function body
-- stays complete — CREATE OR REPLACE requires the whole function).
CREATE OR REPLACE FUNCTION public.emit_deal_automation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NULL THEN
      INSERT INTO automation_events (workspace_id, deal_id, trigger)
      VALUES (
        NEW.workspace_id, NEW.id,
        CASE WHEN NEW.origin IN ('api', 'form') THEN 'lead_recebido' ELSE 'deal_created' END
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO automation_events (workspace_id, deal_id, trigger)
    VALUES (NEW.workspace_id, NEW.id, 'stage_changed');
  ELSIF NEW.status = 'Ganho' AND OLD.status IS DISTINCT FROM 'Ganho' THEN
    INSERT INTO automation_events (workspace_id, deal_id, trigger)
    VALUES (NEW.workspace_id, NEW.id, 'deal_won');
  ELSIF NEW.status = 'Perdido' AND OLD.status IS DISTINCT FROM 'Perdido' THEN
    INSERT INTO automation_events (workspace_id, deal_id, trigger)
    VALUES (NEW.workspace_id, NEW.id, 'deal_lost');
  ELSIF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.value IS DISTINCT FROM OLD.value
     OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id
     OR NEW.loss_reason IS DISTINCT FROM OLD.loss_reason
     OR NEW.expected_close_date IS DISTINCT FROM OLD.expected_close_date
     OR NEW.probability IS DISTINCT FROM OLD.probability
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
  THEN
    INSERT INTO automation_events (workspace_id, deal_id, trigger)
    VALUES (NEW.workspace_id, NEW.id, 'deal_updated');
  END IF;

  RETURN NEW;
END;
$function$;
```

- [ ] **Step 4: Apply and verify**

Apply via `mcp__supabase__apply_migration`, name `lead_recebido_trigger`.

```sql
-- confirm the branch: insert one deal with origin='api', one with origin='app'
insert into deals (workspace_id, title, pipeline_id, stage_id, status, origin)
  select workspace_id, 'trigger test api', pipeline_id, id, 'Ativo', 'api' from pipeline_stages limit 1;
insert into deals (workspace_id, title, pipeline_id, stage_id, status, origin)
  select workspace_id, 'trigger test app', pipeline_id, id, 'Ativo', 'app' from pipeline_stages limit 1;

select trigger, count(*) from automation_events
  where deal_id in (select id from deals where title in ('trigger test api', 'trigger test app'))
  group by trigger;
```

Expected: one row `lead_recebido` count 1, one row `deal_created` count 1. Clean up the two test deals afterward (`delete from deals where title in ('trigger test api', 'trigger test app');`).

- [ ] **Step 5: `npm run build`**

Run: `npm run build`
Expected: compiles clean (verifies `TriggerType`/label map edits didn't break any exhaustive switch elsewhere — if it fails on a missing case in a `switch (trigger)`, add `lead_recebido` there too before moving on).

- [ ] **Step 6: Commit**

```bash
git add src/lib/crm-types.ts src/contexts/automacoes-context.tsx supabase/migrations/20260820130000_lead_recebido_trigger.sql
git commit -m "feat: add lead_recebido automation trigger for API/form-sourced deals"
```

---

### Task 7: Rest of the Deals API — list, detail, update, delete, stage, reopen, duplicate

**Files:**
- Modify: `src/app/api/v1/deals/route.ts` (add `GET`)
- Create: `src/app/api/v1/deals/[id]/route.ts` (`GET`, `PATCH`, `DELETE`)
- Create: `src/app/api/v1/deals/[id]/stage/route.ts` (`PATCH`)
- Create: `src/app/api/v1/deals/[id]/reopen/route.ts` (`PATCH`)
- Create: `src/app/api/v1/deals/[id]/duplicate/route.ts` (`POST`)

**Interfaces:**
- Consumes: everything Task 5 imports, plus a new shared `encodeCursor`/`decodeCursor` pair defined inline here (only list endpoints need it — first one to need it defines it).

- [ ] **Step 1: Add `GET` (list) to `src/app/api/v1/deals/route.ts`**

Append to the existing file (keep the `POST` above untouched):

```typescript
export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_deals");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const cursor = url.searchParams.get("cursor");
  const status = url.searchParams.get("status");
  const pipeline = url.searchParams.get("pipeline");
  const stage = url.searchParams.get("stage");
  const owner = url.searchParams.get("owner");
  const updatedSince = url.searchParams.get("updatedSince");

  let query = admin
    .from("deals")
    .select("id, title, value, status, pipeline_id, stage_id, owner_id, contact_id, source, origin, created_at, updated_at")
    .eq("workspace_id", ctx.workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (status) query = query.eq("status", status);
  if (pipeline) query = query.eq("pipeline_id", pipeline);
  if (stage) query = query.eq("stage_id", stage);
  if (owner) query = query.eq("owner_id", owner);
  if (updatedSince) query = query.gte("updated_at", updatedSince);
  if (cursor) {
    const [cCreatedAt, cId] = Buffer.from(cursor, "base64").toString("utf8").split("|");
    query = query.or(`created_at.lt.${cCreatedAt},and(created_at.eq.${cCreatedAt},id.lt.${cId})`);
  }

  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? Buffer.from(`${last.created_at}|${last.id}`).toString("base64") : null;

  return new Response(JSON.stringify({ data: page, nextCursor }), { headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 2: `src/app/api/v1/deals/[id]/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";
import { applyDealCustomFields } from "@/lib/api-lead-helpers";

export const dynamic = "force-dynamic";

async function loadOwnedDeal(admin: ReturnType<typeof createAdmin>, workspaceId: string, id: string) {
  const { data } = await admin.from("deals").select("*").eq("id", id).eq("workspace_id", workspaceId).is("deleted_at", null).maybeSingle();
  return data;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_deals");
  if (!auth.ok) return auth.response;

  const deal = await loadOwnedDeal(admin, auth.ctx.workspaceId, id);
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);
  return apiSuccess(deal);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_deals");
  if (!auth.ok) return auth.response;

  const deal = await loadOwnedDeal(admin, auth.ctx.workspaceId, id);
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  for (const [apiKey, dbKey] of [
    ["title", "title"], ["value", "value"], ["ownerId", "owner_id"], ["contactId", "contact_id"],
    ["source", "source"], ["utmSource", "utm_source"], ["utmMedium", "utm_medium"],
    ["utmCampaign", "utm_campaign"], ["utmContent", "utm_content"], ["utmTerm", "utm_term"],
    ["campaignId", "campaign_id"], ["expectedCloseDate", "expected_close_date"],
  ] as const) {
    if (apiKey in body) patch[dbKey] = body[apiKey];
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from("deals").update(patch).eq("id", id);
    if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  }

  const warnings = await applyDealCustomFields(admin, auth.ctx.workspaceId, id, body.customFields);
  const updated = await loadOwnedDeal(admin, auth.ctx.workspaceId, id);
  return apiSuccess(updated, warnings);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "delete_deals");
  if (!auth.ok) return auth.response;

  const deal = await loadOwnedDeal(admin, auth.ctx.workspaceId, id);
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("deals")
    .update({ deleted_at: nowIso, delete_reason: "Excluído via API" })
    .eq("id", id);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess({ id, deletedAt: nowIso });
}
```

- [ ] **Step 3: `src/app/api/v1/deals/[id]/stage/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_deals");
  if (!auth.ok) return auth.response;

  const { stageId } = await request.json();
  if (!stageId) return apiError("VALIDATION_ERROR", "stageId é obrigatório", 400);

  const { data: deal } = await admin.from("deals").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).is("deleted_at", null).maybeSingle();
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const { error } = await admin.from("deals").update({ stage_id: stageId, days_in_stage: 0, stage_entered_at: new Date().toISOString() }).eq("id", id);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess({ id, stageId });
}
```

- [ ] **Step 4: `src/app/api/v1/deals/[id]/reopen/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_deals");
  if (!auth.ok) return auth.response;

  const { data: deal } = await admin.from("deals").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).is("deleted_at", null).maybeSingle();
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const { error } = await admin.from("deals").update({ status: "Ativo", loss_reason: null }).eq("id", id);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess({ id, status: "Ativo" });
}
```

- [ ] **Step 5: `src/app/api/v1/deals/[id]/duplicate/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_deals");
  if (!auth.ok) return auth.response;

  const { data: original } = await admin.from("deals").select("*").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).is("deleted_at", null).maybeSingle();
  if (!original) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const { data: copy, error } = await admin
    .from("deals")
    .insert({
      workspace_id: original.workspace_id, title: `${original.title} (cópia)`, value: original.value,
      pipeline_id: original.pipeline_id, stage_id: original.stage_id, contact_id: original.contact_id,
      company_id: original.company_id, owner_id: original.owner_id, source: original.source,
      status: "Ativo", origin: "app",
    })
    .select("id")
    .single();

  if (error || !copy) return apiError("INTERNAL_ERROR", error?.message ?? "falha ao duplicar", 500);
  return apiSuccess({ id: copy.id }, undefined, 201);
}
```

- [ ] **Step 6: `npm run build`**

Run: `npm run build`
Expected: compiles clean.

- [ ] **Step 7: Verify**

```bash
DEAL_ID=$(curl -s -X POST http://localhost:3000/api/v1/deals -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -d '{"contact":{"name":"CRUD Teste","email":"crud@teste.com"}}' | jq -r .data.id)
curl -s http://localhost:3000/api/v1/deals -H "Authorization: Bearer trn_test123" | jq '.data | length'
curl -s http://localhost:3000/api/v1/deals/$DEAL_ID -H "Authorization: Bearer trn_test123" | jq .data.title
curl -s -X PATCH http://localhost:3000/api/v1/deals/$DEAL_ID -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -d '{"title":"Editado via curl"}' | jq .data.title
curl -s -X POST http://localhost:3000/api/v1/deals/$DEAL_ID/duplicate -H "Authorization: Bearer trn_test123" | jq
curl -s -X DELETE http://localhost:3000/api/v1/deals/$DEAL_ID -H "Authorization: Bearer trn_test123" | jq
curl -s http://localhost:3000/api/v1/deals/$DEAL_ID -H "Authorization: Bearer trn_test123" | jq   # expect 404 now
```

Expected: list returns an array; detail shows the right title; PATCH echoes the new title; duplicate returns a new id (`201`); delete returns `deletedAt`; the final GET is `404 NOT_FOUND`.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/v1/deals
git commit -m "feat: add list/detail/update/delete/stage/reopen/duplicate to deals API"
```

---

### Task 8: Contacts API

**Files:**
- Create: `src/app/api/v1/contacts/route.ts` (`POST`, `GET`)
- Create: `src/app/api/v1/contacts/[id]/route.ts` (`GET`, `PATCH`, `DELETE`)

**Interfaces:**
- Consumes: `authenticateApiRequest`, `withIdempotency`, `apiError`, `apiSuccess` from `@/lib/api-auth`.

- [ ] **Step 1: `src/app/api/v1/contacts/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_contacts");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json();
  if (!body.name) return apiError("VALIDATION_ERROR", "name é obrigatório", 400);

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/contacts", async () => {
    const { data, error } = await admin
      .from("contacts")
      .insert({
        workspace_id: ctx.workspaceId, name: body.name,
        emails: body.email ? [body.email] : [], phones: body.phone ? [body.phone] : [],
        company_id: body.companyId ?? null, role: body.role ?? null,
      })
      .select("*")
      .single();
    if (error || !data) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message } } };
    return { status: 201, body: { data } };
  });
}

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_contacts");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const updatedSince = url.searchParams.get("updatedSince");

  let query = admin.from("contacts").select("*").eq("workspace_id", auth.ctx.workspaceId).order("created_at", { ascending: false }).limit(limit);
  if (updatedSince) query = query.gte("created_at", updatedSince); // contacts has no updated_at column — created_at is the closest available filter
  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return new Response(JSON.stringify({ data: data ?? [] }), { headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 2: `src/app/api/v1/contacts/[id]/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_contacts");
  if (!auth.ok) return auth.response;

  const { data } = await admin.from("contacts").select("*").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!data) return apiError("NOT_FOUND", "Contato não encontrado", 404);
  return apiSuccess(data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_contacts");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("contacts").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Contato não encontrado", 404);

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if ("name" in body) patch.name = body.name;
  if ("email" in body) patch.emails = body.email ? [body.email] : [];
  if ("phone" in body) patch.phones = body.phone ? [body.phone] : [];
  if ("companyId" in body) patch.company_id = body.companyId;
  if ("role" in body) patch.role = body.role;

  const { data, error } = await admin.from("contacts").update(patch).eq("id", id).select("*").single();
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_contacts");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("contacts").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Contato não encontrado", 404);

  const { error } = await admin.from("contacts").delete().eq("id", id);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess({ id, deleted: true });
}
```

- [ ] **Step 3: `npm run build`, then verify**

```bash
CID=$(curl -s -X POST http://localhost:3000/api/v1/contacts -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -d '{"name":"Contato API","email":"contato@api.com"}' | jq -r .data.id)
curl -s http://localhost:3000/api/v1/contacts/$CID -H "Authorization: Bearer trn_test123" | jq .data.name
curl -s -X PATCH http://localhost:3000/api/v1/contacts/$CID -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -d '{"role":"Decisor"}' | jq .data.role
curl -s -X DELETE http://localhost:3000/api/v1/contacts/$CID -H "Authorization: Bearer trn_test123" | jq
```

Expected: create `201`, name matches, role updates, delete confirms `{deleted:true}`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/contacts
git commit -m "feat: add contacts CRUD to public API"
```

---

### Task 9: Companies API

**Files:**
- Create: `src/app/api/v1/companies/route.ts` (`POST`, `GET`)
- Create: `src/app/api/v1/companies/[id]/route.ts` (`GET`, `PATCH`, `DELETE`)

**Interfaces:**
- Consumes: `findOrCreateCompany` from `@/lib/api-lead-helpers` (Task 4) — the spec requires `POST /api/v1/companies` itself to dedupe by `cnpj`/`name`, not just protect against literal retries.
- Otherwise same shape as Task 8, resource `companies`, permissions `edit_companies`/`read_companies`.

- [ ] **Step 1: `src/app/api/v1/companies/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";
import { findOrCreateCompany } from "@/lib/api-lead-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_companies");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json();
  if (!body.name) return apiError("VALIDATION_ERROR", "name é obrigatório", 400);

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/companies", async () => {
    const { id, created } = await findOrCreateCompany(admin, ctx.workspaceId, { name: body.name, cnpj: body.cnpj });

    // findOrCreateCompany only sets name/cnpj on insert -- apply the rest of
    // the fields (website/segment/size/city/state) as a follow-up update,
    // whether the row is new or an existing match (both cases: the caller's
    // data wins for these secondary fields).
    const patch: Record<string, unknown> = {};
    for (const key of ["website", "segment", "size", "city", "state"] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (Object.keys(patch).length > 0) {
      await admin.from("companies").update(patch).eq("id", id);
    }

    const { data, error } = await admin.from("companies").select("*").eq("id", id).single();
    if (error || !data) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message } } };
    return { status: created ? 201 : 200, body: { data } };
  });
}

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_companies");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const { data, error } = await admin.from("companies").select("*").eq("workspace_id", auth.ctx.workspaceId).order("created_at", { ascending: false }).limit(limit);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return new Response(JSON.stringify({ data: data ?? [] }), { headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 2: `src/app/api/v1/companies/[id]/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_companies");
  if (!auth.ok) return auth.response;
  const { data } = await admin.from("companies").select("*").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!data) return apiError("NOT_FOUND", "Empresa não encontrada", 404);
  return apiSuccess(data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_companies");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("companies").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Empresa não encontrada", 404);

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "cnpj", "website", "segment", "size", "city", "state"] as const) {
    if (key in body) patch[key] = body[key];
  }
  const { data, error } = await admin.from("companies").update(patch).eq("id", id).select("*").single();
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_companies");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("companies").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Empresa não encontrada", 404);

  const { error } = await admin.from("companies").delete().eq("id", id);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess({ id, deleted: true });
}
```

- [ ] **Step 3: `npm run build`, then verify**

```bash
COID=$(curl -s -X POST http://localhost:3000/api/v1/companies -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -d '{"name":"Empresa API Ltda","cnpj":"11.222.333/0001-44"}' | jq -r .data.id)
curl -s http://localhost:3000/api/v1/companies/$COID -H "Authorization: Bearer trn_test123" | jq .data.name

# same cnpj again -- must dedupe: 200 (not 201), same id
curl -s -o /tmp/dup.json -w "%{http_code}\n" -X POST http://localhost:3000/api/v1/companies -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -d '{"name":"Empresa API Ltda (nome diferente)","cnpj":"11.222.333/0001-44"}'
jq -r .data.id /tmp/dup.json   # must equal $COID

curl -s -X DELETE http://localhost:3000/api/v1/companies/$COID -H "Authorization: Bearer trn_test123" | jq
```

Expected: first create `201`, GET shows correct name; second call with the same `cnpj` (digits match despite formatting) returns `200` with the **same** `id` as `$COID` — proves the dedupe fires even on `POST`, not just on retried idempotency keys; delete confirms.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/companies
git commit -m "feat: add companies CRUD to public API"
```

---

### Task 10: Activities API

**Files:**
- Create: `src/app/api/v1/activities/route.ts` (`POST`, `GET`)
- Create: `src/app/api/v1/activities/[id]/route.ts` (`PATCH`, `DELETE`)
- Create: `src/app/api/v1/activities/[id]/done/route.ts` (`PATCH`)

**Interfaces:**
- Consumes: `authenticateApiRequest`, `withIdempotency`, `apiError`, `apiSuccess`.

- [ ] **Step 1: `src/app/api/v1/activities/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_activities");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json();
  if (!body.dealId || !body.title || !body.type || !body.date) {
    return apiError("VALIDATION_ERROR", "dealId, title, type e date são obrigatórios", 400);
  }
  const { data: deal } = await admin.from("deals").select("id").eq("id", body.dealId).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!deal) return apiError("VALIDATION_ERROR", "dealId não encontrado neste workspace", 400);

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/activities", async () => {
    const { data, error } = await admin
      .from("activities")
      .insert({
        workspace_id: ctx.workspaceId, deal_id: body.dealId, title: body.title, type: body.type,
        date: body.date, description: body.description ?? null, assignee_id: body.assigneeId ?? null,
      })
      .select("*")
      .single();
    if (error || !data) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message } } };
    return { status: 201, body: { data } };
  });
}

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_activities");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const dealId = url.searchParams.get("dealId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  let query = admin.from("activities").select("*").eq("workspace_id", auth.ctx.workspaceId).order("date", { ascending: false }).limit(limit);
  if (dealId) query = query.eq("deal_id", dealId);
  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return new Response(JSON.stringify({ data: data ?? [] }), { headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 2: `src/app/api/v1/activities/[id]/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_activities");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("activities").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Atividade não encontrada", 404);

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  for (const [apiKey, dbKey] of [["title", "title"], ["description", "description"], ["date", "date"], ["assigneeId", "assignee_id"], ["type", "type"]] as const) {
    if (apiKey in body) patch[dbKey] = body[apiKey];
  }
  const { data, error } = await admin.from("activities").update(patch).eq("id", id).select("*").single();
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_activities");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("activities").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Atividade não encontrada", 404);

  const { error } = await admin.from("activities").delete().eq("id", id);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess({ id, deleted: true });
}
```

- [ ] **Step 3: `src/app/api/v1/activities/[id]/done/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_activities");
  if (!auth.ok) return auth.response;

  const { data: existing } = await admin.from("activities").select("id").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "Atividade não encontrada", 404);

  const { error } = await admin.from("activities").update({ completed: true }).eq("id", id);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess({ id, completed: true });
}
```

- [ ] **Step 4: `npm run build`, then verify**

```bash
AID=$(curl -s -X POST http://localhost:3000/api/v1/activities -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -d "{\"dealId\":\"$DEAL_ID\",\"title\":\"Ligar\",\"type\":\"call\",\"date\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" | jq -r .data.id)
curl -s -X PATCH http://localhost:3000/api/v1/activities/$AID/done -H "Authorization: Bearer trn_test123" | jq
curl -s "http://localhost:3000/api/v1/activities?dealId=$DEAL_ID" -H "Authorization: Bearer trn_test123" | jq '.data | length'
```

If `$DEAL_ID` isn't set (previous task's shell exited), first re-run Task 5's create-deal curl to get one. Expected: create `201`, done returns `{completed:true}`, list returns at least 1.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/activities
git commit -m "feat: add activities CRUD to public API"
```

---

### Task 11: Notes API

**Files:**
- Create: `src/app/api/v1/notes/route.ts` (`POST`, `GET`)

**Interfaces:**
- Consumes: `authenticateApiRequest`, `withIdempotency`, `apiError`, `apiSuccess`. Table: `deal_notes` (no `workspace_id` column — validate via `deals`).

- [ ] **Step 1: Write the route**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "edit_notes");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json();
  if (!body.dealId || !body.content) return apiError("VALIDATION_ERROR", "dealId e content são obrigatórios", 400);

  const { data: deal } = await admin.from("deals").select("id").eq("id", body.dealId).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!deal) return apiError("VALIDATION_ERROR", "dealId não encontrado neste workspace", 400);

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/notes", async () => {
    const { data, error } = await admin.from("deal_notes").insert({ deal_id: body.dealId, content: body.content }).select("*").single();
    if (error || !data) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message } } };
    return { status: 201, body: { data } };
  });
}

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_notes");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const dealId = url.searchParams.get("dealId");
  if (!dealId) return apiError("VALIDATION_ERROR", "dealId é obrigatório", 400);

  const { data: deal } = await admin.from("deals").select("id").eq("id", dealId).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!deal) return apiError("NOT_FOUND", "Negócio não encontrado", 404);

  const { data, error } = await admin.from("deal_notes").select("*").eq("deal_id", dealId).order("created_at", { ascending: false });
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return new Response(JSON.stringify({ data: data ?? [] }), { headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 2: `npm run build`, then verify**

```bash
curl -s -X POST http://localhost:3000/api/v1/notes -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -d "{\"dealId\":\"$DEAL_ID\",\"content\":\"Nota via API\"}" | jq
curl -s "http://localhost:3000/api/v1/notes?dealId=$DEAL_ID" -H "Authorization: Bearer trn_test123" | jq '.data | length'
curl -s "http://localhost:3000/api/v1/notes" -H "Authorization: Bearer trn_test123" | jq   # missing dealId
```

Expected: create `201`; list returns ≥1; missing `dealId` → `400 VALIDATION_ERROR`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/notes
git commit -m "feat: add notes API (deal_notes)"
```

---

### Task 12: Pipelines (read-only)

**Files:**
- Create: `src/app/api/v1/pipelines/route.ts` (`GET`)
- Create: `src/app/api/v1/pipelines/[id]/route.ts` (`GET`)

- [ ] **Step 1: `src/app/api/v1/pipelines/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_pipelines");
  if (!auth.ok) return auth.response;

  const { data: pipelines, error } = await admin.from("pipelines").select("id, name, sort_order").eq("workspace_id", auth.ctx.workspaceId).order("sort_order");
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  const { data: stages } = await admin.from("pipeline_stages").select("id, name, order, pipeline_id").in("pipeline_id", (pipelines ?? []).map((p) => p.id)).order("order");

  const data = (pipelines ?? []).map((p) => ({
    id: p.id, name: p.name,
    stages: (stages ?? []).filter((s) => s.pipeline_id === p.id).map((s) => ({ id: s.id, name: s.name })),
  }));

  return new Response(JSON.stringify({ data }), { headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 2: `src/app/api/v1/pipelines/[id]/route.ts`**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_pipelines");
  if (!auth.ok) return auth.response;

  const { data: pipeline } = await admin.from("pipelines").select("id, name").eq("id", id).eq("workspace_id", auth.ctx.workspaceId).maybeSingle();
  if (!pipeline) return apiError("NOT_FOUND", "Pipeline não encontrado", 404);

  const { data: stages } = await admin.from("pipeline_stages").select("id, name, order").eq("pipeline_id", id).order("order");
  return apiSuccess({ ...pipeline, stages: (stages ?? []).map((s) => ({ id: s.id, name: s.name })) });
}
```

- [ ] **Step 3: `npm run build`, then verify**

```bash
curl -s http://localhost:3000/api/v1/pipelines -H "Authorization: Bearer trn_test123" | jq
```

Expected: array of pipelines, each with nested `stages`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/pipelines
git commit -m "feat: add read-only pipelines API"
```

---

### Task 13: Custom fields

**Files:**
- Create: `src/app/api/v1/custom-fields/route.ts` (`GET`, `POST`)

- [ ] **Step 1: Write the route**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, withIdempotency, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_custom_fields");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const entity = url.searchParams.get("entity");
  let query = admin.from("custom_fields").select("*").eq("workspace_id", auth.ctx.workspaceId).order("sort_order");
  if (entity) query = query.eq("entity", entity);
  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return new Response(JSON.stringify({ data: data ?? [] }), { headers: { "Content-Type": "application/json" } });
}

export async function POST(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "create_custom_fields");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json();
  if (!body.label || !body.entity) return apiError("VALIDATION_ERROR", "label e entity são obrigatórios", 400);

  return withIdempotency(admin, ctx.workspaceId, request, "POST", "/api/v1/custom-fields", async () => {
    const { data, error } = await admin
      .from("custom_fields")
      .insert({
        workspace_id: ctx.workspaceId, label: body.label, entity: body.entity,
        field_type: body.fieldType ?? "text", field_group: body.fieldGroup ?? "Geral",
        required: body.required ?? false, options: body.options ?? [],
      })
      .select("*")
      .single();
    if (error || !data) return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: error?.message } } };
    return { status: 201, body: { data } };
  });
}
```

- [ ] **Step 2: `npm run build`, then verify**

```bash
curl -s -X POST http://localhost:3000/api/v1/custom-fields -H "Authorization: Bearer trn_test123" -H "Content-Type: application/json" -d '{"label":"Orçamento estimado","entity":"deal","fieldType":"text"}' | jq
curl -s "http://localhost:3000/api/v1/custom-fields?entity=deal" -H "Authorization: Bearer trn_test123" | jq
```

Expected: create `201` with a new `id`; list includes it. That `id` is what `POST /api/v1/deals`'s `customFields` object keys by (Task 5) — confirm by re-running Task 5's create-deal curl with `"customFields":{"<that id>":"10000-20000"}` and checking `deal_field_values` in SQL.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/custom-fields
git commit -m "feat: add custom fields read/create API"
```

---

### Task 14: Users (read-only)

**Files:**
- Create: `src/app/api/v1/users/route.ts` (`GET`)

**Interfaces:**
- Consumes: `admin.auth.admin.listUsers()` (service-role only API) to resolve display name/email — `workspace_members` has no name column (Fase 1 finding: no `profiles` table, names live in `auth.users.user_metadata`).

- [ ] **Step 1: Write the route**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_users");
  if (!auth.ok) return auth.response;

  const { data: members, error } = await admin
    .from("workspace_members")
    .select("member_user_id, role, status")
    .eq("workspace_id", auth.ctx.workspaceId)
    .eq("status", "accepted");
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
  const byId = new Map((authUsers?.users ?? []).map((u) => [u.id, u]));

  const data = (members ?? []).map((m) => {
    const u = byId.get(m.member_user_id);
    const name = (u?.user_metadata?.full_name as string | undefined) || (u?.user_metadata?.name as string | undefined) || u?.email || null;
    return { id: m.member_user_id, name, email: u?.email ?? null, role: m.role };
  });

  return new Response(JSON.stringify({ data }), { headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 2: `npm run build`, then verify**

```bash
curl -s http://localhost:3000/api/v1/users -H "Authorization: Bearer trn_test123" | jq
```

Expected: array including at least the workspace owner, with `name`/`email`/`role` populated.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/users
git commit -m "feat: add read-only users API"
```

---

### Task 15: Public lead-capture form endpoint

**Files:**
- Create: `src/app/api/v1/leads/form/[formId]/route.ts`

**Interfaces:**
- Consumes: `findOrCreateContact`, `resolvePipelineStage` from `@/lib/api-lead-helpers` (no `authenticateApiRequest` here — no Bearer key on this route).

- [ ] **Step 1: Write the route**

```typescript
import { createAdmin } from "@/lib/whatsapp/connection";
import { findOrCreateContact, resolvePipelineStage } from "@/lib/api-lead-helpers";

export const dynamic = "force-dynamic";

const PUBLIC_HOST = "api-crm.aimaze.com.br";

function jsonError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;

  // Closes the bypass of hitting trino-crm.vercel.app directly and skipping
  // the Cloudflare WAF/rate-limit in front of the dedicated subdomain (Task 17).
  const host = request.headers.get("host") ?? "";
  if (host !== PUBLIC_HOST && process.env.NODE_ENV === "production") {
    return jsonError("NOT_FOUND", "Not found", 404);
  }

  const admin = createAdmin();
  const { data: form } = await admin
    .from("lead_forms")
    .select("*")
    .eq("id", formId)
    .eq("active", true)
    .maybeSingle();
  if (!form) return jsonError("NOT_FOUND", "Formulário não encontrado", 404);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("VALIDATION_ERROR", "Corpo inválido", 400);
  }

  // Honeypot: bots fill every field, including hidden ones. Reply 200 with no
  // side effect so the bot doesn't learn it was caught.
  const honeypotValue = body[form.honeypot_field];
  if (honeypotValue) {
    return Response.json({ data: { received: true } }, { status: 200 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const email = typeof body.email === "string" ? body.email : undefined;
  const phone = typeof body.phone === "string" ? body.phone : undefined;
  const note = typeof body.note === "string" ? body.note : undefined;

  if (!name) return jsonError("VALIDATION_ERROR", "name é obrigatório", 400);
  if (!email && !phone) return jsonError("VALIDATION_ERROR", "email ou phone é obrigatório", 400);

  const contact = await findOrCreateContact(admin, form.workspace_id, { name, email, phone });

  const resolved = await resolvePipelineStage(
    admin,
    form.workspace_id,
    form.pipeline_id ?? undefined,
    form.stage_id ?? undefined
  );
  if (!resolved) return jsonError("INTERNAL_ERROR", "Workspace sem pipeline configurado", 500);

  const { data: deal, error } = await admin
    .from("deals")
    .insert({
      workspace_id: form.workspace_id,
      title: `Lead — ${name}`,
      pipeline_id: resolved.pipelineId,
      stage_id: resolved.stageId,
      contact_id: contact.id,
      owner_id: form.default_owner_id,
      source: form.source_label,
      origin: "form",
      status: "Ativo",
    })
    .select("id")
    .single();

  if (error || !deal) return jsonError("INTERNAL_ERROR", error?.message ?? "falha ao criar negócio", 500);

  if (note) {
    await admin.from("deal_notes").insert({ deal_id: deal.id, content: note });
  }

  return Response.json({ data: { received: true } }, { status: 201 });
}
```

- [ ] **Step 2: Add to `proxy.ts`'s exclusion**

`api/v1` (added in Task 3) already covers `api/v1/leads/form/...` — no further change needed. Confirm by reading the current matcher regex before moving on.

- [ ] **Step 3: Create a test form and verify**

```sql
insert into lead_forms (workspace_id, name)
values ('<workspace_id>', 'Site institucional')
returning id;
```

```bash
# host check active in prod only (NODE_ENV dev bypasses it) — dev verification:
curl -s -X POST http://localhost:3000/api/v1/leads/form/<form_id> \
  -H "Content-Type: application/json" -d '{"name":"Lead Formulário","email":"form@teste.com","note":"veio do site"}' | jq

# honeypot
curl -s -X POST http://localhost:3000/api/v1/leads/form/<form_id> \
  -H "Content-Type: application/json" -d '{"name":"Bot","email":"bot@teste.com","_hp":"filled"}' | jq

# inactive/unknown form
curl -s -X POST http://localhost:3000/api/v1/leads/form/00000000-0000-0000-0000-000000000000 \
  -H "Content-Type: application/json" -d '{"name":"x","email":"x@x.com"}' | jq
```

Expected: first call `201`; honeypot call `200` with `{received:true}` but **no new deal** (verify via `select count(*) from deals where source='Formulário';` before/after); unknown form `404`.

- [ ] **Step 4: `npm run build`**

Run: `npm run build`
Expected: compiles clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/leads
git commit -m "feat: add public lead-capture form endpoint"
```

---

### Task 16: Minimal `lead_forms` admin UI

**Files:**
- Modify: `src/app/configuracoes/api/page.tsx`

**Interfaces:**
- Consumes: `lead_forms` table (Task 1) directly via the browser Supabase client (RLS-gated, same pattern the rest of this page already uses for `api_keys`).

- [ ] **Step 1: Add a `lead_forms` section to the page**

Below the existing API keys list (find the closing `</div>` of the keys list section), add a new section following the same visual/data pattern already in the file (`useState`/`useCallback`/`load()` — mirror exactly how `keys` state is loaded/rendered a few lines up):

```typescript
type LeadFormRow = {
  id: string;
  name: string;
  active: boolean;
  source_label: string;
  created_at: string;
};

// inside the component, alongside the existing `keys`/`loading` state:
const [forms, setForms] = useState<LeadFormRow[]>([]);
const [newFormName, setNewFormName] = useState("");

const loadForms = useCallback(async () => {
  const { data } = await supabase.from("lead_forms").select("id, name, active, source_label, created_at").order("created_at", { ascending: false });
  setForms(data ?? []);
}, [supabase]);

useEffect(() => {
  loadForms();
}, [loadForms]);

const createForm = async () => {
  if (!newFormName.trim()) return;
  const { data } = await supabase.from("lead_forms").insert({ workspace_id: workspaceId, name: newFormName.trim() }).select("id, name, active, source_label, created_at").single();
  if (data) setForms((prev) => [data, ...prev]);
  setNewFormName("");
};

const toggleFormActive = async (id: string, active: boolean) => {
  await supabase.from("lead_forms").update({ active: !active }).eq("id", id);
  setForms((prev) => prev.map((f) => (f.id === id ? { ...f, active: !active } : f)));
};

const formSnippet = (formId: string) =>
  `<form method="POST" action="https://api-crm.aimaze.com.br/api/v1/leads/form/${formId}">\n  <input name="name" placeholder="Nome" required />\n  <input name="email" placeholder="Email" />\n  <input name="phone" placeholder="Telefone" />\n  <input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off" />\n  <button type="submit">Enviar</button>\n</form>`;
```

JSX (add after the existing API keys `<div className="space-y-3">...</div>` block, before the closing help-links section):

```tsx
<div className="mt-10">
  <h2 className="text-sm font-semibold text-zinc-900 mb-1">Formulários de captação</h2>
  <p className="text-xs text-zinc-400 mb-4">Cada formulário gera um snippet HTML público para embutir no site do cliente — sem precisar de API key.</p>

  <div className="flex gap-2 mb-4">
    <input value={newFormName} onChange={(e) => setNewFormName(e.target.value)} placeholder="Ex: Site institucional" className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
    <button onClick={createForm} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">Criar</button>
  </div>

  <div className="space-y-2">
    {forms.map((f) => (
      <div key={f.id} className="rounded-lg border border-zinc-200 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{f.name}</span>
          <button onClick={() => toggleFormActive(f.id, f.active)} className="text-xs text-zinc-500">
            {f.active ? "Desativar" : "Ativar"}
          </button>
        </div>
        <pre className="mt-2 bg-zinc-900 text-zinc-100 text-[11px] rounded-md p-3 overflow-x-auto whitespace-pre">{formSnippet(f.id)}</pre>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 2: `npm run build && npm run lint`**

Run: `npm run build && npm run lint`
Expected: no type errors, no unused-import warnings.

- [ ] **Step 3: Manual UI check**

`npm run dev`, open `/configuracoes/api` as an admin, create a form, confirm it appears with a snippet, toggle it inactive and confirm `select active from lead_forms where id = '<id>';` shows `false`.

- [ ] **Step 4: Commit**

```bash
git add src/app/configuracoes/api/page.tsx
git commit -m "feat: add minimal lead_forms admin UI to /configuracoes/api"
```

---

### Task 17: Cloudflare infra — `api-crm.aimaze.com.br`

**Files:** none (live Cloudflare/Vercel config via API calls) — document the resulting state in `docs/BACKLOG.md`'s "Infra pedida pelo dono" line so it's not rediscovered as pending.

**Prerequisite:** `CLOUDFLARE_API_TOKEN` in `.env.local` (Zone:DNS Edit + Zone:Firewall Services Edit scoped to the `aimaze.com.br` zone) — ask the user for this before starting if it isn't already present.

- [ ] **Step 1: Find the zone id**

```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=aimaze.com.br" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" | jq '.result[0].id'
```

- [ ] **Step 2: Create the DNS record**

```bash
ZONE_ID="<from step 1>"
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"api-crm","content":"cname.vercel-dns.com","proxied":true}' | jq
```

Expected: `"success": true`, `"proxied": true` (orange-cloud — this is what activates WAF/rate-limit at the edge).

- [ ] **Step 3: Add the custom domain to the Vercel project**

Use `mcp__plugin_vercel_vercel__` tooling (or `vercel domains add api-crm.aimaze.com.br` via the Vercel CLI against the `trino-crm` project) to attach `api-crm.aimaze.com.br` as a custom domain. Verify with `mcp__plugin_vercel_vercel__get_project` that the domain shows as verified (DNS propagation can take a few minutes — poll, don't block indefinitely).

- [ ] **Step 4: Create the edge rate-limit rule**

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "api-crm rate limit",
    "kind": "zone",
    "phase": "http_ratelimit",
    "rules": [{
      "action": "block",
      "expression": "(http.host eq \"api-crm.aimaze.com.br\")",
      "ratelimit": { "characteristics": ["cf.colo.id", "ip.src"], "period": 60, "requests_per_period": 100, "mitigation_timeout": 60 },
      "description": "100 req/min per IP on the leads intake subdomain"
    }]
  }' | jq
```

- [ ] **Step 5: Enable managed WAF ruleset for the zone**

```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets/phases/http_request_firewall_managed/entrypoint" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq
```

If no ruleset is active yet, enable Cloudflare's default Managed Ruleset via the dashboard (`Security → WAF → Managed rules`, toggle "Cloudflare Managed Ruleset" on) — the API for this specific toggle is account-plan-dependent, and doing it once by hand is safer than guessing the wrong API shape for a plan tier we haven't confirmed.

- [ ] **Step 6: Verify end-to-end**

```bash
curl -s https://api-crm.aimaze.com.br/api/v1/me -H "Authorization: Bearer trn_test123" | jq
```

Expected: `200` with the same body as the local `/api/v1/me` check in Task 3, now served through Cloudflare + the custom domain.

- [ ] **Step 7: Update the backlog**

Edit `docs/BACKLOG.md`'s "Infra pedida pelo dono" line under § Fase 2 to `[x]`, noting the domain and date.

- [ ] **Step 8: Commit**

```bash
git add docs/BACKLOG.md
git commit -m "docs: mark Cloudflare infra (api-crm.aimaze.com.br) done in the backlog"
```

---

### Task 18: `/ajuda/integracao-leads-externos`

**Files:**
- Create: `src/app/ajuda/integracao-leads-externos/page.tsx`

- [ ] **Step 1: Write the page**

Follow the visual pattern of any existing `/configuracoes/*` page in this repo (Tailwind utility classes, `max-w-3xl mx-auto px-6 py-8` container — copy the shell from `src/app/configuracoes/api/page.tsx`'s outer `<main>`/`<div>`). Content sections, each with a `curl` example targeting `https://api-crm.aimaze.com.br/api/v1/deals`:

1. **Facebook Lead Ads** — via Zapier/Make (no direct native integration exists; document the Zapier "Webhooks by Zapier" step pointing at `POST /api/v1/deals`, body mapped from Facebook's lead fields to `contact.name`/`contact.email`/`contact.phone`/`utmCampaign`).
2. **Elementor / WordPress forms** — via the public form endpoint (Task 15): copy the snippet from `/configuracoes/api`, paste as the form's HTML action, or use Elementor's "Webhook" action pointing at the same URL.
3. **Zapier / Make (genérico)** — `POST /api/v1/deals` with `Authorization: Bearer`, full body example matching Task 5's shape.
4. Link back to `/configuracoes/api/docs` (Task 19) for the full reference.

- [ ] **Step 2: `npm run build && npm run lint`**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/ajuda/integracao-leads-externos
git commit -m "docs: add /ajuda/integracao-leads-externos guide"
```

---

### Task 19: `/configuracoes/api/docs`

**Files:**
- Create: `src/app/configuracoes/api/docs/page.tsx`

- [ ] **Step 1: Write the reference page**

Same shell pattern as Task 18. Sections, matching the design doc's §8 and the reference structure the owner shared: Quickstart (create a key → discover pipeline/user ids via `GET /api/v1/pipelines` and `GET /api/v1/users` → `POST /api/v1/deals` → validate with `GET /api/v1/me`), Autenticação (Bearer + the 16-permission table from Task 1/16), Rate limiting (headers + `429` shape), one collapsible block per resource (Deals/Contacts/Companies/Activities/Notes/Pipelines/Custom fields/Users) listing verb + path + permission — mirror the table in the design doc's §3 exactly, Erros (the code table from the design doc's §2, including the documented-but-inert `402 SUBSCRIPTION_REQUIRED`).

- [ ] **Step 2: `npm run build && npm run lint`**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 3: Manual check**

`npm run dev`, open `/configuracoes/api`, confirm the "Documentação da API" card link (already present in the page, currently 404) now resolves.

- [ ] **Step 4: Commit**

```bash
git add src/app/configuracoes/api/docs
git commit -m "docs: add full public API reference at /configuracoes/api/docs"
```

---

## Post-plan cleanup

- [ ] Delete the test API key created in Task 3 (`delete from api_keys where key_prefix = 'trn_test123';`) and any leftover test rows (`deals`/`contacts`/`companies` with `Teste`/`API`/`curl` in the name) before calling this done.
- [ ] Update `docs/BACKLOG.md` § Fase 2 "Entrada de leads" — flip all items to `[x]` with today's date, same style as the Motor section's closing note.
- [ ] `vercel deploy --prod` (deploy is manual — `git push` alone does not deploy, per the standing project note) once every task above is merged.
