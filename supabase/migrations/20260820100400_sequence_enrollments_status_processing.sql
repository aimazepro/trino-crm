-- Let a sequence_enrollments row be claimed.
--
-- claim_due_sequence_enrollments (previous migration) marks the rows it claims
-- as 'processing', but sequence_enrollments_status_check never allowed that
-- value -- so every claim aborted with
--   new row for relation "sequence_enrollments" violates check constraint
--   "sequence_enrollments_status_check"
-- Same bug as 20260819220000_queue_status_processing.sql, found live while
-- verifying this migration end to end: the email/WhatsApp queue tables were
-- fixed to allow 'processing', but sequence_enrollments was never included
-- because it had no claim RPC at the time.
--
-- 'processing' is what makes SKIP LOCKED useful in the first place: it is the
-- marker that keeps a second worker from picking up a row already in flight.

ALTER TABLE public.sequence_enrollments
  DROP CONSTRAINT IF EXISTS sequence_enrollments_status_check;

ALTER TABLE public.sequence_enrollments
  ADD CONSTRAINT sequence_enrollments_status_check
  CHECK (status = ANY (ARRAY['active', 'processing', 'paused', 'completed', 'cancelled']));
