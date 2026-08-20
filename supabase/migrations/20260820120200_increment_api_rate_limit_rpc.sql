CREATE OR REPLACE FUNCTION public.increment_api_rate_limit(p_api_key_id uuid, p_window_start timestamptz)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count int;
BEGIN
  INSERT INTO public.api_rate_limit_windows (api_key_id, window_start, request_count)
  VALUES (p_api_key_id, p_window_start, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET request_count = api_rate_limit_windows.request_count + 1
  RETURNING request_count INTO v_count;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.increment_api_rate_limit(uuid, timestamptz) FROM PUBLIC;
