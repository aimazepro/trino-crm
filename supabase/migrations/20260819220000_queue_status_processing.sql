-- Let a queue row be claimed.
--
-- claim_pending_email_queue and claim_pending_whatsapp_queue both mark the rows
-- they claim as 'processing', but neither status check allowed that value — so
-- every claim aborted with
--   new row for relation "automation_email_queue" violates check constraint
--   "automation_email_queue_status_check"
-- and both edge functions had been answering 500 to pg_cron once a minute since
-- they were written. No automated email or WhatsApp message ever left the queue.
--
-- 'processing' is what makes SKIP LOCKED useful in the first place: it is the
-- marker that keeps a second worker from picking up a row already in flight.

ALTER TABLE public.automation_email_queue
  DROP CONSTRAINT IF EXISTS automation_email_queue_status_check;

ALTER TABLE public.automation_email_queue
  ADD CONSTRAINT automation_email_queue_status_check
  CHECK (status = ANY (ARRAY['pending', 'processing', 'sent', 'failed']));

ALTER TABLE public.automation_whatsapp_queue
  DROP CONSTRAINT IF EXISTS automation_whatsapp_queue_status_check;

ALTER TABLE public.automation_whatsapp_queue
  ADD CONSTRAINT automation_whatsapp_queue_status_check
  CHECK (status = ANY (ARRAY['pending', 'processing', 'sent', 'failed']));
