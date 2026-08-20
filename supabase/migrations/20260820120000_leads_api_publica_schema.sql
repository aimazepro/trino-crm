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
