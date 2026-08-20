CREATE OR REPLACE FUNCTION public.claim_due_sequence_enrollments(p_limit integer DEFAULT 50)
RETURNS SETOF sequence_enrollments
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  UPDATE sequence_enrollments
  SET status = 'processing'
  WHERE id IN (
    SELECT id FROM sequence_enrollments
    WHERE status = 'active'
    ORDER BY enrolled_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$function$;
