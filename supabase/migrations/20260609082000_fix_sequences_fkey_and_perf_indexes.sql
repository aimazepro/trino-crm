-- Convert invalid UUIDs in sequence_id to NULL to allow type casting
UPDATE public.sequence_enrollments
SET sequence_id = NULL
WHERE sequence_id IS NOT NULL 
  AND sequence_id != '' 
  AND NOT (sequence_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

-- Convert empty strings to NULL
UPDATE public.sequence_enrollments
SET sequence_id = NULL
WHERE sequence_id = '';

-- Alter type of sequence_id to uuid
ALTER TABLE public.sequence_enrollments
  ALTER COLUMN sequence_id TYPE uuid USING sequence_id::uuid;

-- Add missing foreign key constraint for sequence_enrollments -> sequences
ALTER TABLE public.sequence_enrollments
  ADD CONSTRAINT sequence_enrollments_sequence_id_fkey
  FOREIGN KEY (sequence_id) REFERENCES public.sequences(id)
  ON DELETE CASCADE;

-- Optimize webhook deliveries polling query
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status_attempts
  ON public.webhook_deliveries(status, attempts);

-- Optimize email queue polling query
CREATE INDEX IF NOT EXISTS idx_automation_email_queue_status_pending
  ON public.automation_email_queue(status)
  WHERE status = 'pending';

-- Optimize WhatsApp queue polling query
CREATE INDEX IF NOT EXISTS idx_automation_whatsapp_queue_status_pending
  ON public.automation_whatsapp_queue(status)
  WHERE status = 'pending';
