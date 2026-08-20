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
