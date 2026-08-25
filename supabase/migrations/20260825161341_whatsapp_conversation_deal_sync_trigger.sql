-- Team filter on /conversas ("Time" + escolher vendedor) was never matching:
-- whatsapp_conversations.owner_id is set once, when the conversation row is
-- first created (see resolveConversationLinks / linking.ts), and never again.
-- A lead that texts in before any deal exists keeps owner_id = null forever,
-- even after someone creates a deal for that contact later -- which is the
-- normal case, so almost every conversation stayed unassigned and "Time" +
-- vendor selected always looked broken (it was filtering correctly, there
-- was just nothing with a matching owner_id to show).
--
-- Fixes it at the source: any INSERT/UPDATE on deals that touches contact_id,
-- owner_id, status or deleted_at re-resolves every whatsapp_conversations row
-- for that contact, picking the same deal resolveConversationLinks() would
-- (prefer an Ativo deal, else the most recently updated one). Runs regardless
-- of which code path wrote the deal -- UI, CSV import, public API, the new
-- "Criar negocio" button on /conversas -- same spirit as trg_deal_automation_events.
CREATE OR REPLACE FUNCTION public.sync_whatsapp_conversation_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  WITH best AS (
    SELECT id, owner_id
    FROM public.deals
    WHERE workspace_id = NEW.workspace_id
      AND contact_id = NEW.contact_id
      AND deleted_at IS NULL
    ORDER BY (status = 'Ativo') DESC, updated_at DESC
    LIMIT 1
  )
  UPDATE public.whatsapp_conversations c
  SET deal_id = best.id,
      owner_id = best.owner_id,
      updated_at = now()
  FROM best
  WHERE c.workspace_id = NEW.workspace_id
    AND c.contact_id = NEW.contact_id
    AND (c.deal_id IS DISTINCT FROM best.id OR c.owner_id IS DISTINCT FROM best.owner_id);

  -- Contact has no live deal left at all (last one just got soft-deleted, or
  -- this update moved the deal to a different contact): stop pointing the
  -- conversation at a deal that no longer applies, instead of leaving a stale
  -- link that would silently misfilter forever.
  IF NOT EXISTS (
    SELECT 1 FROM public.deals
    WHERE workspace_id = NEW.workspace_id AND contact_id = NEW.contact_id AND deleted_at IS NULL
  ) THEN
    UPDATE public.whatsapp_conversations
    SET deal_id = NULL, owner_id = NULL, updated_at = now()
    WHERE workspace_id = NEW.workspace_id
      AND contact_id = NEW.contact_id
      AND (deal_id IS NOT NULL OR owner_id IS NOT NULL);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_deal_sync_whatsapp_links ON public.deals;
CREATE TRIGGER trg_deal_sync_whatsapp_links
AFTER INSERT OR UPDATE OF contact_id, owner_id, status, deleted_at ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.sync_whatsapp_conversation_links();
