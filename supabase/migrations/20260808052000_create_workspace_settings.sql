-- The "Empresa" settings screen was fully hardcoded. Back it with real data,
-- keyed by the workspace owner (same identity model as is_workspace_member).
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Meu workspace',
  slug text UNIQUE,
  plan text NOT NULL DEFAULT 'trial',
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

-- Owner has full control; accepted team members can read their workspace.
DROP POLICY IF EXISTS workspace_settings_owner_crud ON public.workspace_settings;
CREATE POLICY workspace_settings_owner_crud ON public.workspace_settings
  FOR ALL
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS workspace_settings_member_read ON public.workspace_settings;
CREATE POLICY workspace_settings_member_read ON public.workspace_settings
  FOR SELECT
  USING (public.is_workspace_member(owner_user_id));

REVOKE ALL ON public.workspace_settings FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.workspace_settings TO authenticated;
