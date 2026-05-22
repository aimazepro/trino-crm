-- Phase A: split team_members write policy so SELECT has a single
-- permissive policy (eliminates multiple_permissive_policies warning).
DROP POLICY IF EXISTS "team_members_write" ON public.team_members;

CREATE POLICY "team_members_insert" ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = (select auth.uid()));

CREATE POLICY "team_members_update" ON public.team_members
  FOR UPDATE TO authenticated
  USING (owner_user_id = (select auth.uid()))
  WITH CHECK (owner_user_id = (select auth.uid()));

CREATE POLICY "team_members_delete" ON public.team_members
  FOR DELETE TO authenticated
  USING (owner_user_id = (select auth.uid()));
