-- Activity types were stored only in localStorage, so they never synced across
-- devices or users. Persist them per user, mirroring the loss_reasons pattern.

CREATE TABLE IF NOT EXISTS public.activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'Circle',
  is_system boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_types_user_sort
  ON public.activity_types(user_id, sort_order);

-- One row per name per user, so seeding defaults is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_types_user_name
  ON public.activity_types(user_id, name);

ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_types_crud ON public.activity_types;
CREATE POLICY activity_types_crud ON public.activity_types
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.activity_types FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_types TO authenticated;
