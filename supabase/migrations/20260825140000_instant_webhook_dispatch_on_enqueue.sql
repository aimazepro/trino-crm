-- enqueue_webhook_delivery previously only inserted 'pending' rows and waited
-- for the pg_cron "webhooks" job (dispatch-webhooks edge function) to flush
-- them, capping latency to the cron interval (was 5min, now 1min). This adds
-- a fire-and-forget net.http_post to dispatch-webhooks right after the
-- insert, so deal_created/deal_won/deal_lost fire near-instantly. The cron
-- job stays as-is and now only exists as a retry net for failed deliveries.
CREATE OR REPLACE FUNCTION public.enqueue_webhook_delivery(p_event text, p_user uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO webhook_deliveries(webhook_id, workspace_id, event, payload, status, attempts)
  SELECT id, p_user, p_event, p_payload, 'pending', 0
  FROM webhooks
  WHERE workspace_id = p_user
    AND active = true
    AND p_event = ANY(events);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    PERFORM net.http_post(
      url := 'https://etdkzpiehoivrviylemd.supabase.co/functions/v1/dispatch-webhooks',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'automation_dispatch_secret')
      )
    );
  END IF;
END
$function$;
