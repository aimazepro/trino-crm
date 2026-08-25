-- Fix: deals.loss_reason was free-text (tag + ": " + comment concatenated by
-- the loss modal), so build_deal_webhook_payload's join on
-- loss_reasons.name = deals.loss_reason almost never matched (confirmed on
-- prod data: 3 lost deals, only 1 matched). Root cause: no FK from deal to
-- loss_reasons, and no separate column for the free-text note.
--
-- Fix: add a real FK (loss_reason_id) and a separate note column
-- (loss_reason_note), set at write time by the loss-reason modal (mirrors
-- the existing delete_reason/delete_note pattern). loss_reason (text) is
-- kept as-is for back-compat display of legacy concatenated values.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS loss_reason_id uuid REFERENCES public.loss_reasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loss_reason_note text;

-- One-time backfill: recover the FK for existing rows where loss_reason
-- happens to match a catalog name exactly (best-effort, not relied upon
-- going forward).
UPDATE public.deals d
SET loss_reason_id = lr.id
FROM public.loss_reasons lr
WHERE d.loss_reason_id IS NULL
  AND d.loss_reason IS NOT NULL
  AND lr.workspace_id = d.workspace_id
  AND lr.name = d.loss_reason;

-- lossReasonId now comes straight from the FK (no more name-join guessing).
-- Adds lostReasonNote from the new column.
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
    'lossReasonId', p_deal.loss_reason_id,
    'lostReasonNote', p_deal.loss_reason_note,
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
