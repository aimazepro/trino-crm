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
