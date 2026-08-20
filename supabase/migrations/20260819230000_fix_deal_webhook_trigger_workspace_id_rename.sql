-- trg_deals_webhook (on_deal_change) and enqueue_webhook_delivery still referenced
-- user_id, a column dropped from deals/webhooks/webhook_deliveries by the Phase 1
-- multi-tenancy rename (user_id -> workspace_id). Since the rename, every INSERT
-- into deals raised "record new has no field user_id" inside the trigger, aborting
-- the transaction -- deal creation was silently failing (the app inserts
-- fire-and-forget with an optimistic client update, so nothing surfaced in the UI;
-- the deal just never persisted). Marking a deal Ganho/Perdido hit the same bug in
-- the UPDATE branch. This is also why the dispatch-webhooks retry queue looked
-- dead: this is the one path that ever wrote status='pending', and it was
-- erroring before it could.
--
-- Parameter name p_user is kept as-is (Postgres won't let CREATE OR REPLACE
-- rename an input parameter without a DROP FUNCTION first) -- only what it's
-- compared/inserted against changes, from the dropped user_id column to workspace_id.

CREATE OR REPLACE FUNCTION public.enqueue_webhook_delivery(p_event text, p_user uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO webhook_deliveries(webhook_id, workspace_id, event, payload, status, attempts)
  SELECT id, p_user, p_event, p_payload, 'pending', 0
  FROM webhooks
  WHERE workspace_id = p_user
    AND active = true
    AND p_event = ANY(events);
END
$function$;

CREATE OR REPLACE FUNCTION public.on_deal_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enqueue_webhook_delivery('deal_created', NEW.workspace_id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'Ganho' AND (OLD.status IS NULL OR OLD.status != 'Ganho') THEN
      PERFORM enqueue_webhook_delivery('deal_won', NEW.workspace_id, to_jsonb(NEW));
    END IF;
    IF NEW.status = 'Perdido' AND (OLD.status IS NULL OR OLD.status != 'Perdido') THEN
      PERFORM enqueue_webhook_delivery('deal_lost', NEW.workspace_id, to_jsonb(NEW));
    END IF;
  END IF;
  RETURN NEW;
END
$function$;
