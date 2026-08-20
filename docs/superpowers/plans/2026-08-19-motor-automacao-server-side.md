# Motor de Automação Server-Side — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move deal/activity automation execution off the browser onto a Postgres-trigger outbox drained by `pg_cron`-invoked Next.js routes, so automation fires reliably regardless of what wrote the deal (UI, CSV import, public API, inbound webhook), with a per-step execution log, working webhook signing/retry, and the email/sequence queues finally draining.

**Architecture:** `deals`/`activities` triggers write to a new `automation_events` outbox on every INSERT/UPDATE; `POST /api/automations/run` (pg_cron, 1min) claims pending events with `SELECT ... FOR UPDATE SKIP LOCKED` and runs the ported engine (`src/lib/automation-engine.ts`) against an admin Supabase client, logging every step to `automation_runs`/`automation_run_steps`. Email and sequence processing move from Deno Edge Functions to the same Next.js route pattern already proven by `/api/whatsapp/queue`.

**Tech Stack:** Next.js API routes (Node runtime), Supabase Postgres (triggers, RLS, `pg_cron`, `pg_net`), `@supabase/supabase-js` admin client.

**Spec:** `docs/superpowers/specs/2026-08-19-motor-automacao-server-side-design.md`

## Global Constraints

- No test framework in this repo (`package.json` has no test script). Every task's verification step is `npm run build` (type-check) + `npm run lint` + a manual check (SQL query or `curl`) — never a fabricated test file.
- All new server routes reuse the existing `AUTOMATION_DISPATCH_SECRET` env var and the `authorized()` bearer-check pattern from `src/app/api/whatsapp/queue/route.ts:42-52` — no new secret.
- `createAdmin()` is imported from `@/lib/whatsapp/connection` (already exported there, already used by two routes) — do not create a second copy.
- Every new/modified table or function that touches `deals`/`webhooks`/`webhook_deliveries` must use `workspace_id`, never `user_id` — see Task 0 below for why this is not hypothetical.
- Supabase project id for all MCP calls: `etdkzpiehoivrviylemd`.
- After any migration that adds/changes tables, regenerate `src/lib/supabase/database.types.ts` via `mcp__supabase__generate_typescript_types` before writing TypeScript against the new schema.

## Task 0 — already done, informational only

Before this plan was written, a live probe found `on_deal_change()` (the trigger backing `webhook_deliveries` for `deal_created`/`deal_won`/`deal_lost`) still referenced the pre-Phase-1 `user_id` column, which aborted **every** `INSERT` into `deals` in production. This was fixed and verified out-of-band in migration `supabase/migrations/20260819230000_fix_deal_webhook_trigger_workspace_id_rename.sql` (already applied to the live project and committed). No task below needs to touch it again — it's listed here only so whoever executes this plan doesn't rediscover it as a surprise.

---

### Task 1: `automation_events` outbox table + claim RPC

**Files:**
- Create: `supabase/migrations/20260820100000_automation_events.sql`

**Interfaces:**
- Produces: table `public.automation_events(id, workspace_id, deal_id, trigger, status, attempts, error, created_at)`; RPC `public.claim_pending_automation_events(p_limit integer default 50) returns setof automation_events`.

- [ ] **Step 1: Write the migration**

```sql
-- automation_events is the outbox the deals/activities triggers (Task 2) write to.
-- A worker (Task 6) claims rows with SKIP LOCKED, same pattern as
-- claim_pending_whatsapp_queue / claim_pending_email_queue.
CREATE TABLE public.automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  trigger text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_events_pending ON public.automation_events (created_at) WHERE status = 'pending';

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

-- Written only by the deals/activities triggers and read only by the worker's
-- admin client (both bypass RLS) — this policy exists so a workspace admin can
-- inspect the outbox from the SQL editor / a future debug screen, nothing else.
CREATE POLICY "automation_events: select" ON public.automation_events
  FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()) AND is_ws_admin(automation_events.workspace_id));

CREATE OR REPLACE FUNCTION public.claim_pending_automation_events(p_limit integer DEFAULT 50)
RETURNS SETOF automation_events
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  UPDATE automation_events
  SET status = 'processing'
  WHERE id IN (
    SELECT id FROM automation_events
    WHERE status = 'pending'
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$function$;
```

- [ ] **Step 2: Apply via MCP**

Call `mcp__supabase__apply_migration` with `project_id: "etdkzpiehoivrviylemd"`, `name: "automation_events"`, and the SQL above (same content, so the remote project and the local file in Step 1 never drift).

- [ ] **Step 3: Verify**

Run (via `mcp__supabase__execute_sql`, in a `BEGIN ... ROLLBACK`):
```sql
begin;
insert into automation_events (workspace_id, deal_id, trigger)
select workspace_id, id, 'deal_created' from deals limit 1
returning id, status;
select * from claim_pending_automation_events(10);
rollback;
```
Expected: the insert returns one row with `status='pending'`; the claim call returns that same row with `status='processing'`.

- [ ] **Step 4: Regenerate types**

Call `mcp__supabase__generate_typescript_types` and overwrite `src/lib/supabase/database.types.ts`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260820100000_automation_events.sql src/lib/supabase/database.types.ts
git commit -m "feat: add automation_events outbox table + claim RPC"
```

---

### Task 2: Outbox-emitting triggers on `deals` and `activities`

**Files:**
- Create: `supabase/migrations/20260820100100_automation_event_triggers.sql`

**Interfaces:**
- Consumes: `automation_events` table (Task 1).
- Produces: triggers `trg_deal_automation_events` on `deals`, `trg_activity_automation_events` on `activities`.

- [ ] **Step 1: Write the migration**

```sql
-- Replaces src/lib/run-automations.ts being called from the browser (S-2). Any
-- INSERT/UPDATE on deals, from any source (UI, CSV import, public API, inbound
-- webhook — including ones that don't exist yet), now writes to
-- automation_events automatically. Priority order below mirrors exactly what
-- use-crm-mutations.ts used to decide client-side (moveDeal -> stage_changed,
-- markDealStatus -> deal_won/deal_lost, updateDealFields -> deal_updated), so no
-- trigger fires twice for one UPDATE. As a side effect this also fixes
-- moveDealToPipeline (use-crm-mutations.ts:47-73), which changes stage_id but
-- never called runAutomations — the trigger fires on the column, not on which
-- JS function touched it.
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
      VALUES (NEW.workspace_id, NEW.id, 'deal_created');
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE. Skip soft-deleted rows entirely -- a delete should not fire automations.
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

CREATE TRIGGER trg_deal_automation_events
AFTER INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.emit_deal_automation_event();

CREATE OR REPLACE FUNCTION public.emit_activity_automation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO automation_events (workspace_id, deal_id, trigger)
  VALUES (NEW.workspace_id, NEW.deal_id, 'activity_created');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_activity_automation_events
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.emit_activity_automation_event();
```

- [ ] **Step 2: Apply via MCP** — same as Task 1 Step 2, `name: "automation_event_triggers"`.

- [ ] **Step 3: Verify** — exercise every branch in one rolled-back transaction:

```sql
begin;
-- deal_created
insert into deals (workspace_id, title, value, pipeline_id, stage_id, status)
select workspace_id, 'PROBE', 0, pipeline_id, stage_id, 'Ativo' from deals limit 1
returning id \gset probe_
-- stage_changed (pick a different stage in the same pipeline)
update deals set stage_id = (select id from pipeline_stages where pipeline_id = (select pipeline_id from deals where id = :'probe_id') and id != (select stage_id from deals where id = :'probe_id') limit 1) where id = :'probe_id';
-- deal_won
update deals set status = 'Ganho' where id = :'probe_id';
-- deal_updated (title change, status/stage untouched)
update deals set title = 'PROBE 2' where id = :'probe_id';
-- activity_created
insert into activities (workspace_id, deal_id, title, type, date) values ((select workspace_id from deals where id = :'probe_id'), :'probe_id', 'Probe activity', 'Tarefa', now());
select trigger, count(*) from automation_events where deal_id = :'probe_id' group by trigger order by 1;
rollback;
```
Expected: 4 rows — `activity_created`, `deal_created`, `deal_won`, `stage_changed` (the title-only update after `deal_won` does **not** add a `deal_updated` row, because `deal_won`'s branch already matched and `deal_updated` is only reached via `ELSIF`, so it's fine that this single probe touches multiple branches across separate statements — each `UPDATE` evaluates independently). If `psql`-style `\gset` isn't supported through the MCP SQL runner, substitute the returned id literally between statements instead.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260820100100_automation_event_triggers.sql
git commit -m "feat: emit automation_events from deals/activities triggers"
```

---

### Task 3: Execution log tables — `automation_runs` / `automation_run_steps`

**Files:**
- Create: `supabase/migrations/20260820100200_automation_run_logs.sql`

**Interfaces:**
- Produces: tables `automation_runs(id, workspace_id, automation_id, event_id, trigger, deal_id, started_at, finished_at, status)` and `automation_run_steps(id, run_id, step_id, action_type, status, error, response_code, created_at)`.

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.automation_events(id) ON DELETE SET NULL,
  trigger text NOT NULL,
  deal_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed'))
);

CREATE TABLE public.automation_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  action_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  error text,
  response_code int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_run_steps_run ON public.automation_run_steps(run_id);
CREATE INDEX idx_automation_runs_automation ON public.automation_runs(automation_id, started_at DESC);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_runs: select" ON public.automation_runs
  FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()) AND is_ws_admin(automation_runs.workspace_id));

CREATE POLICY "automation_run_steps: select" ON public.automation_run_steps
  FOR SELECT
  USING (run_id IN (
    SELECT id FROM public.automation_runs
    WHERE workspace_id IN (SELECT my_workspace_ids()) AND is_ws_admin(automation_runs.workspace_id)
  ));
```

- [ ] **Step 2: Apply via MCP** — `name: "automation_run_logs"`.

- [ ] **Step 3: Verify**

```sql
begin;
insert into automation_runs (workspace_id, automation_id, trigger, deal_id, status)
select workspace_id, id, 'deal_created', null, 'running' from automations limit 1
returning id \gset run_
insert into automation_run_steps (run_id, step_id, action_type, status, response_code)
values (:'run_id', 'step_1', 'send_webhook', 'success', 200)
returning *;
rollback;
```
Expected: both inserts succeed (if no `automations` row exists yet in this workspace to reference, insert one minimal row first inside the same transaction, still rolled back).

- [ ] **Step 4: Regenerate types** — `mcp__supabase__generate_typescript_types`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260820100200_automation_run_logs.sql src/lib/supabase/database.types.ts
git commit -m "feat: add automation_runs/automation_run_steps execution log tables"
```

---

### Task 4: Extract SSRF guard + HMAC into `src/lib/webhook-security.ts`

**Files:**
- Create: `src/lib/webhook-security.ts`
- Modify: `src/app/api/webhooks/trigger/route.ts:1-27` (remove local copy, import instead)
- Modify: `src/lib/webhooks.ts:1-30` (remove local copy, import instead)

**Interfaces:**
- Produces: `isPrivateOrUnsafeUrl(rawUrl: string): boolean`, `hmacSha256(secret: string, body: string): string`.

- [ ] **Step 1: Create the module**

```typescript
import crypto from "crypto";

// Shared by every Node-side outbound webhook sender: src/lib/webhooks.ts
// (registered subscriptions), src/app/api/webhooks/trigger/route.ts (manual
// test-send from Settings), and src/lib/automation-engine.ts (the motor's
// send_webhook action). The Deno copy in
// supabase/functions/dispatch-webhooks/index.ts stays separate — different
// runtime, can't import this file — and is kept in sync by hand if this list
// ever changes.
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
];

export function isPrivateOrUnsafeUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "https:") return true;
  return PRIVATE_IP_PATTERNS.some((re) => re.test(parsed.hostname));
}

export function hmacSha256(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}
```

- [ ] **Step 2: Update `src/lib/webhooks.ts`**

Replace lines 1-30 (imports through `hmacSha256`) with:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isPrivateOrUnsafeUrl, hmacSha256 } from "@/lib/webhook-security";
```
The rest of the file (from `type WebhookRow = {` onward) is unchanged in this step — Task 9 edits its body separately.

- [ ] **Step 3: Update `src/app/api/webhooks/trigger/route.ts`**

Replace lines 1-27 (imports through the closing brace of `isPrivateOrUnsafeUrl`) with:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";
import { isPrivateOrUnsafeUrl, hmacSha256 } from "@/lib/webhook-security";
```
Remove the now-duplicate local `hmacSha256` function further down (currently lines 55-57) — the imported one replaces it. Everything else in the file is unchanged in this step — Task 8 edits the handler body separately.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: no type errors, no unused-import lint warnings from either modified file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/webhook-security.ts src/lib/webhooks.ts src/app/api/webhooks/trigger/route.ts
git commit -m "refactor: extract SSRF guard + HMAC into shared webhook-security module"
```

---

### Task 5: `src/lib/automation-engine.ts` — the server-side motor

**Files:**
- Create: `src/lib/automation-engine.ts`

**Interfaces:**
- Consumes: `transformDeal`, `transformPipeline` (`@/lib/crm-transforms`); `isPrivateOrUnsafeUrl`, `hmacSha256` (`@/lib/webhook-security`, Task 4); `Deal`, `Pipeline`, `TriggerType` (`@/lib/crm-types`).
- Produces: `runAutomationsServer(admin, triggerType, dealId, workspaceId, eventId): Promise<void>`; `queueEmail(admin, params): Promise<void>`; `queueWhatsApp(admin, params): Promise<void>` — the latter two are reused by Task 11 (sequences).

- [ ] **Step 1: Write the file**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { transformDeal, transformPipeline } from "@/lib/crm-transforms";
import type { Deal, Pipeline, TriggerType } from "@/lib/crm-types";
import { isPrivateOrUnsafeUrl, hmacSha256 } from "@/lib/webhook-security";

type Admin = SupabaseClient<Database>;

// ── Internal types ─────────────────────────────────────────────────────────

interface ConditionRule {
  field: string;
  operator: string;
  value: string;
}

interface AutomationStep {
  id: string;
  type: "condition" | "action";
  condition?: { rules: ConditionRule[] };
  action?: { type: string; config: Record<string, unknown> };
}

interface AutomationRow {
  id: string;
  trigger: string;
  steps: AutomationStep[];
  execution_count: number;
}

interface RunCtx {
  workspaceId: string;
  pipelines: Pipeline[];
}

// ── Condition evaluation (ported verbatim from the old client-side engine) ──

function evaluateRule(rule: ConditionRule, deal: Deal, pipelines: Pipeline[]): boolean {
  const { field, operator, value } = rule;
  let dealValue: string | number = "";

  switch (field) {
    case "pipeline": {
      const p = pipelines.find((p) => p.id === deal.pipelineId);
      dealValue = p?.name ?? "";
      break;
    }
    case "stage": {
      const s = pipelines.flatMap((p) => p.stages).find((s) => s.id === deal.stageId);
      dealValue = s?.name ?? "";
      break;
    }
    case "status":
      dealValue = deal.status;
      break;
    case "value":
      dealValue = deal.value ?? 0;
      break;
    case "label":
      return deal.labels.includes(value);
    default:
      return true;
  }

  const dv = String(dealValue).toLowerCase();
  const rv = value.toLowerCase();

  switch (operator) {
    case "is": return dv === rv;
    case "is_not": return dv !== rv;
    case "contains": return dv.includes(rv);
    case "greater_than": return Number(dealValue) > Number(value);
    case "less_than": return Number(dealValue) < Number(value);
    default: return true;
  }
}

function conditionsPass(steps: AutomationStep[], deal: Deal, pipelines: Pipeline[]): boolean {
  const conds = steps.filter((s) => s.type === "condition");
  if (conds.length === 0) return true;
  for (const step of conds) {
    if (!step.condition) continue;
    for (const rule of step.condition.rules) {
      if (!evaluateRule(rule, deal, pipelines)) return false;
    }
  }
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function interpolate(template: string, deal: Deal): string {
  return template
    .replace(/\{loss_reason\}/g, deal.lossReason ?? "")
    .replace(/\{deal\.title\}/g, deal.title ?? "")
    .replace(/\{deal\.value\}/g, String(deal.value ?? 0))
    .replace(/\{contact\.name\}/g, deal.title ?? "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstEmail(emails: any[]): string {
  if (!emails?.length) return "";
  const e = emails[0];
  return typeof e === "string" ? e : (e?.value ?? e?.email ?? "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstPhone(phones: any[]): string {
  if (!phones?.length) return "";
  const p = phones[0];
  return typeof p === "string" ? p : (p?.value ?? p?.phone ?? p?.number ?? "");
}

// ── Queue helpers ────────────────────────────────────────────────────────
// Exported so the sequences worker (Task 11) enqueues through the same code
// path as the motor's send_email/send_whatsapp actions, instead of a second
// hand-rolled insert.

export async function queueEmail(admin: Admin, params: {
  workspaceId: string;
  dealId: string;
  automationId: string | null;
  toEmail: string | null;
  subject: string;
  body: string;
  templateId?: string | null;
}): Promise<void> {
  await admin.from("automation_email_queue").insert({
    workspace_id: params.workspaceId,
    deal_id: params.dealId,
    automation_id: params.automationId,
    to_email: params.toEmail,
    subject: params.subject,
    body: params.body,
    template_id: params.templateId ?? null,
    status: "pending",
  });
}

export async function queueWhatsApp(admin: Admin, params: {
  workspaceId: string;
  dealId: string;
  automationId: string | null;
  phone: string | null;
  message: string;
  templateId?: string | null;
}): Promise<void> {
  await admin.from("automation_whatsapp_queue").insert({
    workspace_id: params.workspaceId,
    deal_id: params.dealId,
    automation_id: params.automationId,
    phone: params.phone,
    template_id: params.templateId ?? null,
    message: params.message,
    status: "pending",
  });
}

// ── Per-step logging ─────────────────────────────────────────────────────

async function logStep(
  admin: Admin,
  runId: string,
  stepId: string,
  actionType: string,
  status: "success" | "failed",
  error: string | null,
  responseCode: number | null,
): Promise<void> {
  await admin.from("automation_run_steps").insert({
    run_id: runId,
    step_id: stepId,
    action_type: actionType,
    status,
    error,
    response_code: responseCode,
  });
}

// ── Action executor ──────────────────────────────────────────────────────

async function executeAction(
  admin: Admin,
  runId: string,
  automationId: string,
  step: AutomationStep,
  deal: Deal,
  ctx: RunCtx,
): Promise<boolean> {
  if (!step.action) return false;
  const { type, config } = step.action;

  try {
    switch (type) {

      case "move_stage": {
        const stageId = config.stageId as string;
        if (stageId && stageId !== deal.stageId) {
          await admin.from("deals").update({ stage_id: stageId, days_in_stage: 0 }).eq("id", deal.id);
          await admin.from("deal_history").insert({
            deal_id: deal.id, description: "Etapa alterada por automação", subtext: "",
          });
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "mark_won": {
        if (deal.status !== "Ganho") {
          await admin.from("deals").update({ status: "Ganho", loss_reason: null }).eq("id", deal.id);
          await admin.from("deal_history").insert({
            deal_id: deal.id, description: "Negócio marcado como Ganho por automação", subtext: "",
          });
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "mark_lost": {
        if (deal.status !== "Perdido") {
          await admin.from("deals").update({ status: "Perdido" }).eq("id", deal.id);
          await admin.from("deal_history").insert({
            deal_id: deal.id, description: "Negócio marcado como Perdido por automação", subtext: "",
          });
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "create_activity": {
        const daysAhead = Number(config.deadline ?? 1);
        await admin.from("activities").insert({
          deal_id: deal.id,
          workspace_id: ctx.workspaceId,
          title: interpolate((config.title as string) || "Atividade criada por automação", deal),
          type: (config.activityType as string) || "Tarefa",
          date: daysFromNow(daysAhead),
          description: null,
        });
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "create_note": {
        const content = interpolate(String(config.content ?? "Nota criada por automação"), deal);
        await admin.from("deal_notes").insert({ deal_id: deal.id, content });
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "send_webhook": {
        const url = config.url as string;
        if (!url) {
          await logStep(admin, runId, step.id, type, "success", null, null);
          return true;
        }
        if (isPrivateOrUnsafeUrl(url)) {
          await logStep(admin, runId, step.id, type, "failed", "URL de destino bloqueada (privada ou não-HTTPS).", null);
          return false;
        }

        const bodyString = JSON.stringify({
          event: "automation_trigger",
          automation_id: automationId,
          deal: {
            id: deal.id, title: deal.title, value: deal.value, status: deal.status,
            pipelineId: deal.pipelineId, stageId: deal.stageId,
          },
          timestamp: new Date().toISOString(),
        });

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const secret = config.secret as string | undefined;
        if (secret) headers["X-Signature"] = `sha256=${hmacSha256(secret, bodyString)}`;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(url, { method: "POST", headers, body: bodyString, signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            await logStep(admin, runId, step.id, type, "success", null, res.status);
            return true;
          }
          await logStep(admin, runId, step.id, type, "failed", `HTTP ${res.status}`, res.status);
          return false;
        } catch (err) {
          await logStep(admin, runId, step.id, type, "failed", err instanceof Error ? err.message : String(err), null);
          return false;
        }
      }

      case "add_label": {
        const labelName = config.labelName as string;
        if (labelName) {
          const { data: lbl } = await admin.from("labels").select("id").ilike("name", labelName).maybeSingle();
          if (lbl && !deal.labels.includes(lbl.id)) {
            await admin.from("deal_labels").insert({ deal_id: deal.id, label_id: lbl.id });
          }
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "create_deal": {
        const targetPipelineId = config.pipelineId as string | undefined;
        const targetPipeline = targetPipelineId
          ? ctx.pipelines.find((p) => p.id === targetPipelineId)
          : ctx.pipelines.find((p) => p.id !== deal.pipelineId);
        const firstStage = targetPipeline?.stages[0];

        if (targetPipeline && firstStage) {
          const title = interpolate((config.title as string) || deal.title, deal);
          const { data: newDeal } = await admin.from("deals").insert({
            workspace_id: ctx.workspaceId,
            title,
            value: config.copyAll ? deal.value : (Number(config.value ?? 0) || 0),
            contact_id: deal.contactId || null,
            company_id: config.copyAll ? (deal.companyId || null) : null,
            pipeline_id: targetPipeline.id,
            stage_id: firstStage.id,
            status: "Ativo",
            days_in_stage: 0,
          }).select("id").single();

          if (newDeal) {
            await admin.from("deal_history").insert({
              deal_id: newDeal.id, description: "Negócio criado por automação", subtext: `Originado de: ${deal.title}`,
            });
          }
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "duplicate_deal": {
        const targetPipelineId = config.pipelineId as string | undefined;
        const targetPipeline = targetPipelineId
          ? ctx.pipelines.find((p) => p.id === targetPipelineId)
          : ctx.pipelines.find((p) => p.id === deal.pipelineId);
        const firstStage = targetPipeline?.stages[0];

        if (targetPipeline && firstStage) {
          const { data: dup } = await admin.from("deals").insert({
            workspace_id: ctx.workspaceId,
            title: `${deal.title} (cópia)`,
            value: deal.value,
            contact_id: deal.contactId || null,
            company_id: deal.companyId || null,
            pipeline_id: targetPipeline.id,
            stage_id: firstStage.id,
            status: "Ativo",
            days_in_stage: 0,
          }).select("id").single();

          if (dup && deal.labels.length > 0) {
            await admin.from("deal_labels").insert(deal.labels.map((lid) => ({ deal_id: dup.id, label_id: lid })));
          }
          if (dup) {
            await admin.from("deal_history").insert({
              deal_id: dup.id, description: "Negócio duplicado por automação", subtext: `Cópia de: ${deal.title}`,
            });
          }
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "assign_owner": {
        const ownerMode = config.ownerMode as string;

        if (ownerMode === "fixed" && config.userId) {
          await admin.from("deals").update({ owner_id: config.userId as string }).eq("id", deal.id);
        } else if (ownerMode === "round_robin") {
          const ids = String(config.roundRobinIds ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          if (ids.length > 0) {
            const counts: Record<string, number> = {};
            for (const uid of ids) counts[uid] = 0;

            const { data: owned } = await admin.from("deals").select("owner_id").in("owner_id", ids);
            (owned ?? []).forEach((d: { owner_id: string | null }) => {
              if (d.owner_id && d.owner_id in counts) counts[d.owner_id]++;
            });

            const nextOwner = ids.reduce((min, id) => (counts[id] < counts[min] ? id : min), ids[0]);
            await admin.from("deals").update({ owner_id: nextOwner }).eq("id", deal.id);
          }
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "send_email": {
        let toEmail = "";
        if (deal.contactId) {
          const { data: contact } = await admin.from("contacts").select("emails").eq("id", deal.contactId).maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toEmail = firstEmail((contact?.emails ?? []) as any[]);
        }
        await queueEmail(admin, {
          workspaceId: ctx.workspaceId,
          dealId: deal.id,
          automationId,
          toEmail: toEmail || null,
          subject: interpolate((config.subject as string) ?? "", deal),
          body: interpolate((config.body as string) ?? (config.content as string) ?? "", deal),
          templateId: (config.templateId as string) ?? null,
        });
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "send_whatsapp": {
        let phone = "";
        if (deal.contactId) {
          const { data: contact } = await admin.from("contacts").select("phones").eq("id", deal.contactId).maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          phone = firstPhone((contact?.phones ?? []) as any[]);
        }

        const templateId = (config.templateId as string) || null;
        let message = interpolate((config.message as string) ?? "", deal);

        if (!message && templateId) {
          const { data: template } = await admin.from("whatsapp_templates").select("message").eq("id", templateId).maybeSingle();
          message = template?.message ?? "";
        }

        await queueWhatsApp(admin, {
          workspaceId: ctx.workspaceId,
          dealId: deal.id,
          automationId,
          phone: phone || null,
          templateId,
          message,
        });
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      case "start_sequence": {
        const sequenceId = config.sequenceId as string;
        const { data: existing } = await admin.from("sequence_enrollments")
          .select("id")
          .eq("deal_id", deal.id)
          .eq("sequence_id", sequenceId ?? "")
          .eq("status", "active")
          .maybeSingle();

        if (!existing) {
          await admin.from("sequence_enrollments").insert({
            workspace_id: ctx.workspaceId,
            deal_id: deal.id,
            automation_id: automationId,
            sequence_id: sequenceId ?? null,
            status: "active",
            current_step: 0,
          });
        }
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
      }

      default:
        await logStep(admin, runId, step.id, type, "success", null, null);
        return true;
    }
  } catch (err) {
    await logStep(admin, runId, step.id, type, "failed", err instanceof Error ? err.message : String(err), null);
    return false;
  }
}

// ── Main entry point ─────────────────────────────────────────────────────
// Called once per claimed automation_events row (Task 6). Re-reads the deal
// fresh rather than trusting a snapshot from whoever wrote the triggering row.

export async function runAutomationsServer(
  admin: Admin,
  triggerType: TriggerType,
  dealId: string,
  workspaceId: string,
  eventId: string | null,
): Promise<void> {
  const { data: dealRow } = await admin
    .from("deals")
    .select("*, deal_labels(label_id)")
    .eq("id", dealId)
    .maybeSingle();
  if (!dealRow) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deal = transformDeal(dealRow as any);

  const { data: pipelineRows } = await admin
    .from("pipelines")
    .select("*, pipeline_stages(*)")
    .eq("workspace_id", workspaceId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelines: Pipeline[] = (pipelineRows ?? []).map((row: any) => transformPipeline(row));

  const { data: automations } = await admin
    .from("automations")
    .select("id, trigger, steps, execution_count")
    .eq("active", true)
    .eq("trigger", triggerType)
    .eq("workspace_id", workspaceId);
  if (!automations?.length) return;

  for (const automation of automations as unknown as AutomationRow[]) {
    const steps = automation.steps as AutomationStep[];
    if (!conditionsPass(steps, deal, pipelines)) continue;

    const { data: run } = await admin
      .from("automation_runs")
      .insert({
        workspace_id: workspaceId,
        automation_id: automation.id,
        event_id: eventId,
        trigger: triggerType,
        deal_id: dealId,
        status: "running",
      })
      .select("id")
      .single();
    if (!run) continue;

    const actionSteps = steps.filter((s) => s.type === "action");
    let executed = 0;
    let failed = 0;
    for (const step of actionSteps) {
      const ok = await executeAction(admin, run.id, automation.id, step, deal, { workspaceId, pipelines });
      if (ok) executed++; else failed++;
    }

    await admin
      .from("automation_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: failed === 0 ? "success" : executed > 0 ? "partial" : "failed",
      })
      .eq("id", run.id);

    if (executed > 0) {
      await admin
        .from("automations")
        .update({ execution_count: (automation.execution_count ?? 0) + 1 })
        .eq("id", automation.id);
    }
  }
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: compiles clean. This step has no runtime check of its own — Task 6 exercises it end-to-end.

- [ ] **Step 3: Commit**

```bash
git add src/lib/automation-engine.ts
git commit -m "feat: port automation engine to server-side, admin-client based"
```

---

### Task 6: `POST /api/automations/run` — the outbox worker

**Files:**
- Create: `src/app/api/automations/run/route.ts`

**Interfaces:**
- Consumes: `claim_pending_automation_events` (Task 1), `runAutomationsServer` (Task 5), `createAdmin` (`@/lib/whatsapp/connection`).

- [ ] **Step 1: Write the route**

```typescript
// Drains automation_events. pg_cron calls this once a minute (Task 13); the
// deals/activities triggers (Task 2) are the only producer. Same claim +
// reap-stuck shape as /api/whatsapp/queue/route.ts.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdmin } from "@/lib/whatsapp/connection";
import { runAutomationsServer } from "@/lib/automation-engine";
import type { Database } from "@/lib/supabase/database.types";
import type { TriggerType } from "@/lib/crm-types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 20;
const STUCK_AFTER_MINUTES = 15;

function authorized(req: NextRequest): boolean {
  const expected = process.env.AUTOMATION_DISPATCH_SECRET ?? "";
  if (!expected) {
    console.error("automations/run: AUTOMATION_DISPATCH_SECRET não está definido — fila parada");
    return false;
  }
  const presented = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

async function reapStuck(admin: SupabaseClient<Database>): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString();
  await admin
    .from("automation_events")
    .update({ status: "failed", error: "Processamento interrompido antes de concluir." })
    .eq("status", "processing")
    .lt("created_at", cutoff);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdmin();
  await reapStuck(admin);

  const { data: events, error } = await admin.rpc("claim_pending_automation_events", { p_limit: BATCH_SIZE });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!events || events.length === 0) return NextResponse.json({ processed: 0, failed: 0 });

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await runAutomationsServer(
        admin,
        event.trigger as TriggerType,
        event.deal_id,
        event.workspace_id,
        event.id,
      );
      await admin.from("automation_events").update({ status: "done" }).eq("id", event.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("automations/run", event.id, message);
      await admin.from("automation_events")
        .update({ status: "failed", error: message.slice(0, 500), attempts: event.attempts + 1 })
        .eq("id", event.id);
      failed++;
    }
  }

  return NextResponse.json({ processed, failed });
}
```

- [ ] **Step 2: Verify end-to-end**

1. Deploy or run locally with `AUTOMATION_DISPATCH_SECRET` set (`vercel env pull` if needed).
2. Create a test automation via the UI with `trigger: deal_created` and one `create_note` action, in a real workspace.
3. Insert a deal via the app UI.
4. Call the route directly:
   ```bash
   curl -s -X POST https://trino-crm.vercel.app/api/automations/run \
     -H "Authorization: Bearer $AUTOMATION_DISPATCH_SECRET"
   ```
   (or the local dev URL, if testing pre-deploy).
5. Query via `mcp__supabase__execute_sql`:
   ```sql
   select ae.status, ar.status as run_status, ars.action_type, ars.status as step_status
   from automation_events ae
   left join automation_runs ar on ar.event_id = ae.id
   left join automation_run_steps ars on ars.run_id = ar.id
   order by ae.created_at desc limit 5;
   ```
   Expected: `automation_events.status = 'done'`, one `automation_runs` row with `status='success'`, one `automation_run_steps` row for `create_note` with `status='success'`, and the note visible on the deal in the UI.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/automations/run/route.ts
git commit -m "feat: add /api/automations/run outbox worker"
```

---

### Task 7: Remove the browser-side automation trail (S-2)

**Files:**
- Delete: `src/lib/run-automations.ts`
- Modify: `src/hooks/use-crm-mutations.ts:10, 42-44, 93-96, 139-141, 247-249, 690-692`

**Interfaces:**
- Consumes: nothing new — this only removes dead client code now that Task 2's triggers cover every one of these call sites.

- [ ] **Step 1: Remove the import**

In `src/hooks/use-crm-mutations.ts:10`, delete:
```typescript
import { runAutomations } from "@/lib/run-automations";
```

- [ ] **Step 2: Remove the 5 call sites**

- `use-crm-mutations.ts:42-44` — delete the `if (deal && workspaceId) { runAutomations(...) }` block inside `moveDeal`.
- `use-crm-mutations.ts:93-96` — delete the `runAutomations(trigger, ...)` line inside `markDealStatus` (keep the `if (deal && userId && workspaceId && (status === "Ganho" || status === "Perdido"))` block itself — it still guards the notification insert right below; just remove the `const trigger = ...` line and the `runAutomations(...)` call, leaving the notification logic intact).
- `use-crm-mutations.ts:139-141` — delete the `if (deal && workspaceId) { runAutomations(...) }` block inside `updateDealFields`.
- `use-crm-mutations.ts:247-249` — delete `if (workspaceId) runAutomations("deal_created", newDeal, ...);` inside the deal-creation function (keep `return data.id;` right after it).
- `use-crm-mutations.ts:690-692` — delete `if (deal && workspaceId) { runAutomations("activity_created", ...) }` inside the activity-creation function (keep the closing brace of the function).

- [ ] **Step 3: Delete the file**

```bash
git rm src/lib/run-automations.ts
```

- [ ] **Step 4: Verify**

Run: `npm run build && npm run lint`
Expected: no unresolved import errors, no unused-variable warnings (e.g. an unused `trigger` local in `markDealStatus` if Step 2 wasn't applied precisely).

Manually: create a deal, move its stage, mark it won, in the UI — confirm the deal behaves exactly as before (client-side history/notifications still fire; only the automation dispatch moved server-side). Then run Task 6's worker and confirm `automation_runs` picked up the events.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove browser-side automation dispatch (S-2)

use-crm-mutations.ts no longer calls runAutomations directly — the
deals/activities triggers from Task 2 cover every one of these call
sites already, including moveDealToPipeline, which never called
runAutomations at all."
```

---

### Task 8: S-4 — verify `webhookId` ownership in `api/webhooks/trigger`

**Files:**
- Modify: `src/app/api/webhooks/trigger/route.ts` (handler body, after Task 4's import change)

**Interfaces:**
- Consumes: `webhooks` table (existing).

- [ ] **Step 1: Add the ownership check**

In the `POST` handler, right after `const { url, event, payload, secret, webhookId } = await request.json();` and its existing `if (!url) {...}` check, add:

```typescript
    if (webhookId) {
      const { data: owned } = await supabase
        .from("webhooks")
        .select("id")
        .eq("id", webhookId)
        .maybeSingle();
      if (!owned) {
        return Response.json({ error: "Webhook não encontrado" }, { status: 403 });
      }
    }
```

This relies on `webhooks` already being RLS-scoped to the caller's workspace — confirmed while writing this plan (`select polname from pg_policy where polrelid = 'public.webhooks'::regclass and polcmd = 'r'` → `{"webhooks: select"}`, one SELECT policy exists). The query above runs through the session-scoped `supabase` client already in this route (not an admin client), so a `webhookId` belonging to another workspace simply won't be found — RLS does the filtering, no explicit `workspace_id` comparison needed in the query itself.

- [ ] **Step 2: Verify**

Manually, from two different workspaces (or via `curl` with two different session cookies): call `POST /api/webhooks/trigger` with a `webhookId` that belongs to workspace A, using a session authenticated as a user in workspace B. Expected: `403 { "error": "Webhook não encontrado" }`, and no new row in `webhook_deliveries`. Then repeat with a `webhookId` that does belong to the caller's own workspace — expected: normal `200` response, delivery logged as before.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/trigger/route.ts
git commit -m "fix: verify webhookId ownership before logging in api/webhooks/trigger (S-4)"
```

---

### Task 9: Wire the dead `dispatch-webhooks` retry queue

**Files:**
- Modify: `src/lib/webhooks.ts` (the `dispatchWebhooks` function body — the part untouched by Task 4)

**Interfaces:**
- Consumes: `webhook_deliveries` table.

- [ ] **Step 1: Write `pending` instead of terminal `failed` on the first attempt**

In `dispatchWebhooks`, the `hooks.map(async (wh) => {...})` block currently ends with an unconditional insert of `status` as computed (`"sent"` or `"failed"`). Change the failure case to write `"pending"` so `dispatch-webhooks` (the Deno retry consumer, unchanged) has something to pick up:

```typescript
      await admin.from("webhook_deliveries").insert({
        webhook_id: wh.id,
        workspace_id: userId,
        event: eventCode,
        payload: envelope,
        status: status === "sent" ? "sent" : "pending",
        attempts: 1,
        response_code: responseCode,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        error: errorMessage,
      });
```
(Only the `status:` line changes — everything else in the insert is unchanged.)

- [ ] **Step 2: Verify**

Trigger an `email_open` webhook against an unreachable/refusing test URL (e.g. `https://127.0.0.1:9/`, which `isPrivateOrUnsafeUrl` will actually block before the fetch — use a valid public HTTPS URL that returns a non-2xx instead, e.g. a `https://httpstat.us/500` style endpoint) via the tracking-pixel flow, then:
```sql
select status, attempts, error from webhook_deliveries order by created_at desc limit 1;
```
Expected: `status = 'pending'`, `attempts = 1`. Then manually invoke the `dispatch-webhooks` Deno function (`curl` its URL with the current cron secret, or wait for the next cron tick — see Task 13) and re-check: `attempts` incremented, `status` still `pending` (until 5 attempts) or `failed` (at 5).

- [ ] **Step 3: Commit**

```bash
git add src/lib/webhooks.ts
git commit -m "fix: write pending (not failed) on first webhook delivery failure

Lets the dispatch-webhooks retry queue actually retry instead of
dead-ending on the first attempt."
```

---

### Task 10: `POST /api/automations/email-queue` — migrate off the Deno edge function

**Files:**
- Create: `src/app/api/automations/email-queue/route.ts`

**Interfaces:**
- Consumes: RPC `claim_pending_email_queue` (already exists), `integrations` table, `automation_email_queue` table.

- [ ] **Step 1: Write the route**

Ported from `supabase/functions/process-email-queue/index.ts`, same Gmail OAuth/refresh logic, same claim RPC, now on the app's claim+reap pattern:

```typescript
// Drains automation_email_queue. Replaces supabase/functions/process-email-queue
// (Deno) — same reasoning as /api/whatsapp/queue/route.ts: one runtime for every
// pg_cron-invoked queue instead of Deno and Next doing the same job twice.
// Gmail OAuth/refresh logic is unchanged from the Deno version.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdmin } from "@/lib/whatsapp/connection";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 20;
const STUCK_AFTER_MINUTES = 15;

function authorized(req: NextRequest): boolean {
  const expected = process.env.AUTOMATION_DISPATCH_SECRET ?? "";
  if (!expected) {
    console.error("automations/email-queue: AUTOMATION_DISPATCH_SECRET não está definido — fila parada");
    return false;
  }
  const presented = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

async function reapStuck(admin: SupabaseClient<Database>): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString();
  await admin
    .from("automation_email_queue")
    .update({ status: "failed", error: "Processamento interrompido antes de concluir." })
    .eq("status", "processing")
    .lt("created_at", cutoff);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdmin();
  await reapStuck(admin);

  const { data: items, error } = await admin.rpc("claim_pending_email_queue", { p_limit: BATCH_SIZE });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) return NextResponse.json({ processed: 0, failed: 0 });

  let processed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const { data: intRow } = await admin
        .from("integrations")
        .select("access_token, refresh_token, expires_at, id")
        .eq("workspace_id", item.workspace_id)
        .eq("provider", "gmail")
        .eq("active", true)
        .maybeSingle();

      if (!intRow) {
        await admin.from("automation_email_queue")
          .update({ status: "failed", error: "Nenhuma integração Gmail ativa." })
          .eq("id", item.id);
        failed++;
        continue;
      }

      let token = intRow.access_token;

      if (intRow.expires_at && new Date(intRow.expires_at) < new Date()) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GMAIL_OAUTH_CLIENT_ID!,
            client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET!,
            refresh_token: intRow.refresh_token!,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          token = refreshData.access_token;
          await admin.from("integrations")
            .update({
              access_token: token,
              expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            })
            .eq("id", intRow.id);
        }
      }

      const raw = Buffer.from(
        `To: ${item.to_email}\r\nSubject: ${item.subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${item.body}`
      ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

      const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });

      if (gmailRes.ok) {
        await admin.from("automation_email_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.id);
        processed++;
      } else {
        const err = await gmailRes.text();
        await admin.from("automation_email_queue")
          .update({ status: "failed", error: err.slice(0, 500) })
          .eq("id", item.id);
        failed++;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await admin.from("automation_email_queue")
        .update({ status: "failed", error: message.slice(0, 500) })
        .eq("id", item.id);
      failed++;
    }
  }

  return NextResponse.json({ processed, failed });
}
```

**Confirmed while writing this plan (2026-08-19), so the implementer doesn't have to re-derive it:** `integrations` has both `workspace_id` and `user_id` columns — a Gmail connection is technically per-member, not per-workspace. `automation_email_queue` itself, however, has no `user_id` at all (only `workspace_id`/`deal_id`/`automation_id`), so there is no way for a queued email to say which member's Gmail should send it — the queue schema only supports one Gmail sender per workspace. Live data confirms that's also the reality today: every workspace with a Gmail integration has exactly one (`select workspace_id, count(*) from integrations where provider='gmail' group by 1` → all `1`). `.eq("workspace_id", item.workspace_id).maybeSingle()` is therefore correct as written — `maybeSingle()` will throw loudly (not silently pick one) if a workspace ever ends up with two, which is the right failure mode until/unless this queue grows a per-user sender concept. The Deno version's `.eq("user_id", item.user_id)` was the same stale-column bug as Task 0 (`item.user_id` doesn't exist on `automation_email_queue` rows either — it was always `undefined`, matching nothing).

- [ ] **Step 2: Verify**

With a real Gmail integration connected in a test workspace: trigger an automation with a `send_email` action (or insert a row into `automation_email_queue` directly with a valid `to_email`), then:
```bash
curl -s -X POST https://trino-crm.vercel.app/api/automations/email-queue \
  -H "Authorization: Bearer $AUTOMATION_DISPATCH_SECRET"
```
Expected: `{"processed":1,"failed":0}`, email arrives, `automation_email_queue.status = 'sent'`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/automations/email-queue/route.ts
git commit -m "feat: add /api/automations/email-queue, migrating off process-email-queue"
```

---

### Task 11: `POST /api/automations/sequences` — migrate + fix both bugs

**Files:**
- Create: `src/app/api/automations/sequences/route.ts`
- Create: `supabase/migrations/20260820100300_claim_pending_sequence_enrollments.sql`

**Interfaces:**
- Consumes: `queueEmail`, `queueWhatsApp` (`@/lib/automation-engine`, Task 5); `parseSequenceStepNote` (`@/lib/sequence-helpers`, existing).

- [ ] **Step 1: Add a claim RPC for due sequence steps**

Sequences only need to advance once a day (unlike the per-minute message queues), but two overlapping cron ticks could still double-advance the same enrollment without a claim step. Mirror the existing pattern instead of trusting a plain `SELECT`:

```sql
CREATE OR REPLACE FUNCTION public.claim_due_sequence_enrollments(p_limit integer DEFAULT 50)
RETURNS SETOF sequence_enrollments
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  UPDATE sequence_enrollments
  SET status = 'processing'
  WHERE id IN (
    SELECT id FROM sequence_enrollments
    WHERE status = 'active'
    ORDER BY enrolled_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$function$;
```
Apply via `mcp__supabase__apply_migration`, `name: "claim_pending_sequence_enrollments"`. This claims ALL active enrollments (not just due-today ones) because "is this step due yet" depends on `sequences.sequence_steps.day_offset`, which needs a join the claim function doesn't have — the route itself re-checks the due date after claiming and puts anything not due back to `active` (Step 2 below), same "claim broad, filter precise, unclaim if not actually ready" shape as nothing else in this codebase, so read Step 2 closely.

- [ ] **Step 2: Write the route**

```typescript
// Drains sequence_enrollments, advancing one step per enrollment per run.
// Replaces supabase/functions/process-sequences (Deno). Fixes two bugs found
// while migrating:
//   1. The Deno version inserted with `user_id`, dropped by the Phase 1 rename
//      -- every insert here was failing silently the same way Task 0's bug did.
//   2. step.note is JSON (parseSequenceStepNote), not a raw string -- the Deno
//      version used it unparsed as the email subject/body and WhatsApp text.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdmin } from "@/lib/whatsapp/connection";
import { queueEmail, queueWhatsApp } from "@/lib/automation-engine";
import { parseSequenceStepNote } from "@/lib/sequence-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 50;

function authorized(req: NextRequest): boolean {
  const expected = process.env.AUTOMATION_DISPATCH_SECRET ?? "";
  if (!expected) {
    console.error("automations/sequences: AUTOMATION_DISPATCH_SECRET não está definido — fila parada");
    return false;
  }
  const presented = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdmin();
  const { data: claimed, error } = await admin.rpc("claim_due_sequence_enrollments", { p_limit: BATCH_SIZE });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!claimed || claimed.length === 0) return NextResponse.json({ processed: 0 });

  let processed = 0;
  const now = new Date();

  for (const enrollment of claimed) {
    try {
      const { data: seq } = await admin
        .from("sequences")
        .select("*, sequence_steps(*)")
        .eq("id", enrollment.sequence_id ?? "")
        .maybeSingle();

      if (!seq) {
        await admin.from("sequence_enrollments").update({ status: "active" }).eq("id", enrollment.id);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const steps = ((seq as any).sequence_steps ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);
      const currentStep = enrollment.current_step ?? 0;

      if (currentStep >= steps.length) {
        await admin.from("sequence_enrollments")
          .update({ status: "completed", updated_at: now.toISOString() })
          .eq("id", enrollment.id);
        continue;
      }

      const step = steps[currentStep];
      const enrolledAt = new Date(enrollment.enrolled_at ?? now);
      const targetDate = new Date(enrolledAt.getTime() + step.day_offset * 86400000);

      if (now < targetDate) {
        // Not due yet -- put it back so the next tick reconsiders it.
        await admin.from("sequence_enrollments").update({ status: "active" }).eq("id", enrollment.id);
        continue;
      }

      const parsed = parseSequenceStepNote(step.note ?? "", step.day_offset);

      if (step.step_type === "Email") {
        await queueEmail(admin, {
          workspaceId: enrollment.workspace_id,
          dealId: enrollment.deal_id ?? "",
          automationId: enrollment.automation_id,
          toEmail: null,
          subject: parsed.title || "Sequência de email",
          body: parsed.notes || "",
          templateId: parsed.emailTemplateId || null,
        });
      } else if (step.step_type === "WhatsApp") {
        await queueWhatsApp(admin, {
          workspaceId: enrollment.workspace_id,
          dealId: enrollment.deal_id ?? "",
          automationId: enrollment.automation_id,
          phone: null,
          templateId: null,
          message: parsed.notes || parsed.title || "",
        });
      } else {
        await admin.from("activities").insert({
          workspace_id: enrollment.workspace_id,
          deal_id: enrollment.deal_id,
          type: step.step_type,
          title: parsed.title || step.step_type,
          date: targetDate.toISOString(),
          description: parsed.notes || null,
        });
      }

      const nextStep = currentStep + 1;
      const completed = nextStep >= steps.length;
      await admin.from("sequence_enrollments")
        .update({
          current_step: nextStep,
          status: completed ? "completed" : "active",
          updated_at: now.toISOString(),
        })
        .eq("id", enrollment.id);

      processed++;
    } catch (e) {
      console.error("automations/sequences", enrollment.id, e);
      await admin.from("sequence_enrollments").update({ status: "active" }).eq("id", enrollment.id);
    }
  }

  return NextResponse.json({ processed });
}
```

- [ ] **Step 3: Verify**

Enroll a deal in a sequence whose first step has `day_offset: 0` and `step_type: 'Email'` (so it's immediately due), then:
```bash
curl -s -X POST https://trino-crm.vercel.app/api/automations/sequences \
  -H "Authorization: Bearer $AUTOMATION_DISPATCH_SECRET"
```
Expected: `{"processed":1}`; `automation_email_queue` gets a new `pending` row with `subject`/`body` matching the step's parsed title/notes (not raw JSON); `sequence_enrollments.current_step` incremented.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/automations/sequences/route.ts supabase/migrations/20260820100300_claim_pending_sequence_enrollments.sql
git commit -m "feat: add /api/automations/sequences, fixing workspace_id and step.note bugs"
```

---

### Task 12: Execution log screen

**Files:**
- Create: `src/app/configuracoes/automacoes/[id]/log/page.tsx`

**Interfaces:**
- Consumes: `automation_runs`, `automation_run_steps` (Task 3) via the session-scoped Supabase client (RLS-filtered, admin-only per the policies in Task 3).

- [ ] **Step 1: Write the page**

Follow the existing pattern in this codebase for a settings sub-page that lists rows with drill-down (check `src/app/configuracoes/webhooks/page.tsx` for the shape of a comparable settings list page before writing this — component structure, loading state, and the Supabase client import path should match it exactly rather than being invented fresh). At minimum the page must:
- Fetch `automation_runs` where `automation_id = params.id`, ordered by `started_at desc`, limited (e.g. 50, with pagination or a "load more" if the existing settings pages already have that pattern — match whichever they do).
- For each run, show `trigger`, `status`, `started_at`, `finished_at`.
- On expanding a run (or a separate route/modal — match whatever interaction pattern `configuracoes/webhooks` or `configuracoes/api` already uses for drill-down), fetch and show its `automation_run_steps`: `action_type`, `status`, `error`, `response_code`.

Because the exact JSX/styling conventions live in sibling files this task must read first, write the actual component only after reading `src/app/configuracoes/webhooks/page.tsx` and `src/app/configuracoes/api/page.tsx` in full — do not guess at the design system's classes.

- [ ] **Step 2: Link to it**

Find wherever the automations list page renders each automation (e.g. `src/app/configuracoes/automacoes/page.tsx` or equivalent) and add a "Ver log" link to `/configuracoes/automacoes/[id]/log` next to each automation row.

- [ ] **Step 3: Verify**

Run: `npm run build`. Then manually: open the page for an automation that Task 6's verification already exercised, confirm the run and its step appear with the right status/error/response_code.

- [ ] **Step 4: Commit**

```bash
git add src/app/configuracoes/automacoes
git commit -m "feat: add automation execution log screen"
```

---

### Task 13: Cron — repoint 3 existing jobs, add 1 new, close the S-1 exposure in those 3

**Files:** none (live `pg_cron`/Edge Function config, via MCP tools) — write the resulting state to `docs/BACKLOG.md`'s S-1 entry so it's not rediscovered as new.

**Interfaces:** none — this task wires already-built routes into the scheduler.

**Context the implementer needs, already confirmed live (do not re-verify by re-reading cron.job broadly — just apply the change):**
```
jobid 1 "email-queue"    -> https://.../functions/v1/process-email-queue  (sb_secret_..., every 1 min)
jobid 2 "whatsapp-queue" -> https://trino-crm.vercel.app/api/whatsapp/queue (AUTOMATION_DISPATCH_SECRET, every 1 min) -- already correct, don't touch
jobid 3 "sequences"      -> https://.../functions/v1/process-sequences    (sb_secret_..., every 5 min)
jobid 4 "webhooks"       -> https://.../functions/v1/dispatch-webhooks    (sb_secret_..., every 1 min)
```
All three non-WhatsApp jobs share one `sb_secret_...` key in plain text in `cron.job.command` — this is S-1 (`docs/BACKLOG.md`), live, not theoretical. Jobs 1 and 3 are being fully replaced by Vercel routes in this plan, so switching them to `AUTOMATION_DISPATCH_SECRET` is free. Job 4 stays a Supabase Edge Function (`dispatch-webhooks` is explicitly out of migration scope — see spec §6), so closing its exposure needs one extra step: giving the function its own bearer check and turning off Supabase's platform-level JWT gate, instead of relying on that gate's `sb_secret_...` key.

- [ ] **Step 1: Give `dispatch-webhooks` its own auth check**

Edit `supabase/functions/dispatch-webhooks/index.ts`: add the same `authorized()`-style check used everywhere else in this plan, reading a Deno env var, at the top of the `Deno.serve` handler:
```typescript
function authorized(req: Request): boolean {
  const expected = Deno.env.get("AUTOMATION_DISPATCH_SECRET") ?? "";
  if (!expected) return false;
  const presented = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return presented === expected;
}

Deno.serve(async (req) => {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }
  // ...rest of the existing handler unchanged
```
Set the same `AUTOMATION_DISPATCH_SECRET` value as a Supabase Edge Function secret: `supabase secrets set AUTOMATION_DISPATCH_SECRET=<value> --project-ref etdkzpiehoivrviylemd` (or via `mcp__supabase__deploy_edge_function` if it exposes secret-setting — otherwise the Supabase CLI/dashboard).

- [ ] **Step 2: Redeploy `dispatch-webhooks` with `verify_jwt: false`**

Call `mcp__supabase__deploy_edge_function` with `project_id: "etdkzpiehoivrviylemd"`, `name: "dispatch-webhooks"`, `verify_jwt: false`, and the updated file content from Step 1. `verify_jwt: false` is safe here specifically because Step 1 just added the function's own bearer check — per the tool's own guidance, only disable the platform gate when the function implements its own auth.

- [ ] **Step 3: Repoint all 3 jobs + rotate the secret**

Via `mcp__supabase__execute_sql`:
```sql
SELECT cron.alter_job(1, command := $$
  SELECT net.http_post(
    url := 'https://trino-crm.vercel.app/api/automations/email-queue',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.automation_dispatch_secret')),
    timeout_milliseconds := 30000
  )
$$);
```
Replace the `current_setting(...)` placeholder above with the literal `AUTOMATION_DISPATCH_SECRET` value inline in the `Authorization` header string (same as job 2's existing command already does — match that exact shape, there is no `app.automation_dispatch_secret` GUC configured in this project, that line is illustrative only, not to be run as-is). Repeat `cron.alter_job` for:
- jobid 3 → `url := 'https://trino-crm.vercel.app/api/automations/sequences'`, same header shape.
- jobid 4 → `url := 'https://etdkzpiehoivrviylemd.supabase.co/functions/v1/dispatch-webhooks'` (URL unchanged — only the `Authorization` header value changes from `sb_secret_...` to `AUTOMATION_DISPATCH_SECRET`).

Then add the one genuinely new job, for Task 6's worker:
```sql
SELECT cron.schedule('automations-run', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://trino-crm.vercel.app/api/automations/run',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <AUTOMATION_DISPATCH_SECRET value, literal>'),
    timeout_milliseconds := 30000
  )
$$);
```

- [ ] **Step 4: Verify**

```sql
select jobid, jobname, schedule, command from cron.job order by jobid;
```
Expected: no job's `command` contains `sb_secret_`; jobs 1/3/5(new) point at `trino-crm.vercel.app`; job 4 points at the Supabase function URL but with `AUTOMATION_DISPATCH_SECRET` in its header. Wait one full minute, then re-check `automation_events`, `automation_email_queue`, `webhook_deliveries` for movement (`status` transitions away from `pending` without manual `curl` calls this time — proving the schedule itself works, not just the routes).

- [ ] **Step 5: Retire the old Edge Functions**

Only after Step 4 has run clean for a few cron ticks: delete `supabase/functions/process-email-queue/` and `supabase/functions/process-sequences/` from the repo (the deployed versions can be left running dormant on Supabase, or deleted via dashboard — no cron job points at them anymore after Step 3, so leaving them deployed-but-unreferenced is harmless, just clutter). Also note `process-whatsapp-queue` (found deployed but already unreferenced by any cron job, predating this plan) as a separate, low-priority cleanup — not this task's job to remove.

```bash
git rm -r supabase/functions/process-email-queue supabase/functions/process-sequences
```

- [ ] **Step 6: Update the backlog**

Edit `docs/BACKLOG.md`'s S-1 entry: note that jobs 1/3/4 (email-queue, sequences, webhooks) no longer carry the exposed `sb_secret_...` key as of this task, so only `cron.job.command` entries for anything still calling Supabase Edge Functions directly with a raw service-style key (if any remain — re-check `cron.job` at that point, don't assume) are left of the original finding.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/dispatch-webhooks/index.ts docs/BACKLOG.md
git commit -m "fix: dispatch-webhooks gets its own bearer auth; retire 2 Deno queue workers

Repoints the email-queue and sequences pg_cron jobs at the new Vercel
routes and rotates all 3 non-WhatsApp cron jobs off the exposed
sb_secret_ key onto AUTOMATION_DISPATCH_SECRET -- closes 3 of the 4
S-1 exposures (docs/BACKLOG.md) as a side effect of migrations already
required by this plan."
```

---

## Self-Review Notes

- **Spec coverage:** every numbered section of the design spec maps to a task — outbox architecture → Tasks 1/2/6/7; queues → Tasks 10/11; log → Tasks 3/12; S-4 → Task 8; SSRF/HMAC dedupe → Task 4; retry wiring → Task 9; cron → Task 13. Task 0 documents the out-of-band production hotfix the spec didn't originally anticipate.
- **Type consistency checked:** `queueEmail`/`queueWhatsApp` signatures in Task 5 match their call sites in Task 11 exactly (`workspaceId`, `dealId`, `automationId`, plus the type-specific fields). `runAutomationsServer`'s 5-argument signature in Task 5 matches its one call site in Task 6. `authorized()` is duplicated (not shared) across Tasks 6/10/11/13 deliberately, matching the existing `whatsapp/queue` convention of one small local copy per route rather than a shared import — noted here so it isn't "fixed" into an inconsistency later.
- **Assumptions that could have repeated Task 0's mistake, checked instead of guessed:** Task 10's `integrations` join and Task 8's `webhooks` RLS reliance were both verified live against the database while writing this plan (not just inferred by analogy with other Phase-1-renamed tables) — see the confirmed-findings notes inline in each task. Task 0 is proof this repo has at least one place where the rename-by-analogy assumption already broke silently in production; both were checked directly rather than trusted.
