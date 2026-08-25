-- 1) Deal payload extras that turned out to be REAL data (not fabricated):
--    labels (deal_labels/labels tables exist) and lostReasonId (resolved by
--    matching deals.loss_reason text against loss_reasons.name).
--    Still NOT added: sequential "number", optimistic "version", stage.color
--    — none of these exist anywhere in the schema, faking them risks feeding
--    wrong/unstable data into the user's automations downstream.
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
    'lossReasonId', (SELECT lr.id FROM public.loss_reasons lr WHERE lr.workspace_id = p_deal.workspace_id AND lr.name = p_deal.loss_reason LIMIT 1),
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
    'labels', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color))
      FROM public.deal_labels dl JOIN public.labels l ON l.id = dl.label_id
      WHERE dl.deal_id = p_deal.id
    ), '[]'::jsonb),
    'stage', (
      SELECT jsonb_build_object(
        'id', s.id, 'name', s.name, 'order', s."order",
        'stagnationDays', s.max_days, 'pipelineId', s.pipeline_id, 'createdAt', s.created_at
      )
      FROM public.pipeline_stages s WHERE s.id = p_deal.stage_id
    ),
    'pipeline', (
      SELECT jsonb_build_object('id', pl.id, 'name', pl.name, 'sortOrder', pl.sort_order)
      FROM public.pipelines pl WHERE pl.id = p_deal.pipeline_id
    ),
    'contact', (
      SELECT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.emails -> 0 ->> 'value', 'phone', c.phones -> 0 ->> 'value')
      FROM public.contacts c WHERE c.id = p_deal.contact_id
    ),
    'company', (
      SELECT jsonb_build_object('id', co.id, 'name', co.name)
      FROM public.companies co WHERE co.id = p_deal.company_id
    )
  );
$function$;

-- 2) contact_created
CREATE OR REPLACE FUNCTION public.build_contact_webhook_payload(p_contact public.contacts)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'id', p_contact.id,
    'name', p_contact.name,
    'role', p_contact.role,
    'email', p_contact.emails -> 0 ->> 'value',
    'phone', p_contact.phones -> 0 ->> 'value',
    'emails', p_contact.emails,
    'phones', p_contact.phones,
    'companyId', p_contact.company_id,
    'workspaceId', p_contact.workspace_id,
    'createdAt', p_contact.created_at,
    'company', (
      SELECT jsonb_build_object('id', co.id, 'name', co.name)
      FROM public.companies co WHERE co.id = p_contact.company_id
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.on_contact_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enqueue_webhook_delivery('contact_created', NEW.workspace_id, build_contact_webhook_payload(NEW));
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_contacts_webhook ON public.contacts;
CREATE TRIGGER trg_contacts_webhook
  AFTER INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.on_contact_change();

-- 3) activity_created
CREATE OR REPLACE FUNCTION public.build_activity_webhook_payload(p_activity public.activities)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'id', p_activity.id,
    'title', p_activity.title,
    'description', p_activity.description,
    'type', p_activity.type,
    'date', p_activity.date,
    'endDate', p_activity.end_date,
    'completed', p_activity.completed,
    'dealId', p_activity.deal_id,
    'assigneeId', p_activity.assignee_id,
    'workspaceId', p_activity.workspace_id,
    'meetLink', p_activity.meet_link,
    'createdAt', p_activity.created_at,
    'deal', (
      SELECT jsonb_build_object('id', d.id, 'title', d.title)
      FROM public.deals d WHERE d.id = p_activity.deal_id
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.on_activity_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enqueue_webhook_delivery('activity_created', NEW.workspace_id, build_activity_webhook_payload(NEW));
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_activities_webhook ON public.activities;
CREATE TRIGGER trg_activities_webhook
  AFTER INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.on_activity_change();
