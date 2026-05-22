-- Phase A: security + performance hardening
-- 1. Lock down search_path on existing functions
ALTER FUNCTION public.update_stage_entered_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.enqueue_webhook_delivery(text, uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.on_deal_change() SET search_path = public, pg_temp;

-- 2. Revoke public RPC access to security-definer function
REVOKE EXECUTE ON FUNCTION public.enqueue_webhook_delivery(text, uuid, jsonb) FROM anon, authenticated, PUBLIC;

-- 3. Add missing covering indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_goals_owner_user_id ON public.goals(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON public.webhook_deliveries(webhook_id);

-- 4. Prevent duplicate Gmail sync inserts
CREATE UNIQUE INDEX IF NOT EXISTS emails_user_gmail_msg_uniq
  ON public.emails(user_id, gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;

-- 5. Fast lookup for the email-tab polling query
CREATE INDEX IF NOT EXISTS idx_emails_user_contact_created
  ON public.emails(user_id, contact_id, created_at DESC);
