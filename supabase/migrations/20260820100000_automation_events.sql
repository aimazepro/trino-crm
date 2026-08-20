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
