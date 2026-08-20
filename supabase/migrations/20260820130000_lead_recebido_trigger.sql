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
