-- Webhook payload for deal_created/deal_won/deal_lost was raw to_jsonb(NEW):
-- flat snake_case columns, no nested stage/pipeline/contact/company. Matches
-- the shape a competitor's webhook already sends (camelCase + nested
-- objects), using only real columns we actually have — nothing fabricated.
--
-- NOT included because we don't have the data: sequential deal "number",
-- "labels", optimistic-lock "version", stage "color", a lostReasonId (loss
-- reason is a single text column, not FK'd). Flagged to the user rather than
-- faked.
CREATE OR REPLACE FUNCTION public.build_deal_webhook_payload(p_deal public.deals)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'id', p_deal.id,
    'title', p_deal.title,
    'value', p_deal.value,
    'status', p_deal.status,
    'stageId', p_deal.stage_id,
    'pipelineId', p_deal.pipeline_id,
    'contactId', p_deal.contact_id,
    'companyId', p_deal.company_id,
    'ownerId', p_deal.owner_id,
    'workspaceId', p_deal.workspace_id,
    'lossReason', p_deal.loss_reason,
    'expectedCloseDate', p_deal.expected_close_date,
    'probability', p_deal.probability,
    'source', p_deal.source,
    'daysInStage', p_deal.days_in_stage,
    'stageEnteredAt', p_deal.stage_entered_at,
    'closedAt', CASE WHEN p_deal.status IN ('Ganho', 'Perdido') THEN p_deal.updated_at ELSE NULL END,
    'createdAt', p_deal.created_at,
    'updatedAt', p_deal.updated_at,
    'deletedAt', p_deal.deleted_at,
    'deletedBy', p_deal.deleted_by,
    'origin', p_deal.origin,
    'campaignId', p_deal.campaign_id,
    'utm', jsonb_build_object(
      'source', p_deal.utm_source,
      'medium', p_deal.utm_medium,
      'campaign', p_deal.utm_campaign,
      'content', p_deal.utm_content,
      'term', p_deal.utm_term
    ),
    'stage', (
      SELECT jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'order', s."order",
        'stagnationDays', s.max_days,
        'pipelineId', s.pipeline_id,
        'createdAt', s.created_at
      )
      FROM public.pipeline_stages s WHERE s.id = p_deal.stage_id
    ),
    'pipeline', (
      SELECT jsonb_build_object('id', pl.id, 'name', pl.name, 'sortOrder', pl.sort_order)
      FROM public.pipelines pl WHERE pl.id = p_deal.pipeline_id
    ),
    'contact', (
      SELECT jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'email', c.emails -> 0 ->> 'value',
        'phone', c.phones -> 0 ->> 'value'
      )
      FROM public.contacts c WHERE c.id = p_deal.contact_id
    ),
    'company', (
      SELECT jsonb_build_object('id', co.id, 'name', co.name)
      FROM public.companies co WHERE co.id = p_deal.company_id
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.on_deal_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enqueue_webhook_delivery('deal_created', NEW.workspace_id, build_deal_webhook_payload(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'Ganho' AND (OLD.status IS NULL OR OLD.status != 'Ganho') THEN
      PERFORM enqueue_webhook_delivery('deal_won', NEW.workspace_id, build_deal_webhook_payload(NEW));
    END IF;
    IF NEW.status = 'Perdido' AND (OLD.status IS NULL OR OLD.status != 'Perdido') THEN
      PERFORM enqueue_webhook_delivery('deal_lost', NEW.workspace_id, build_deal_webhook_payload(NEW));
    END IF;
  END IF;
  RETURN NEW;
END
$function$;
