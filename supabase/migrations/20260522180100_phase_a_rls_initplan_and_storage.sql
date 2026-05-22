-- Phase A: rewrite RLS to avoid per-row auth.uid() re-evaluation,
-- restrict signatures bucket listing, consolidate team_members policies
ALTER POLICY "saved_reports_owner" ON public.saved_reports
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users manage own emails" ON public.emails
  USING ((select auth.uid()) = user_id);

ALTER POLICY "sig_select_own" ON public.email_signatures
  USING (user_id = (select auth.uid()));

ALTER POLICY "sig_insert_own" ON public.email_signatures
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "sig_update_own" ON public.email_signatures
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "sig_delete_own" ON public.email_signatures
  USING (user_id = (select auth.uid()));

-- Signatures bucket: drop broad SELECT, restrict listing to owner's folder.
-- Public-bucket object URLs continue to work without a SELECT policy.
DROP POLICY IF EXISTS "sig_storage_read" ON storage.objects;
CREATE POLICY "sig_storage_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "team_members_self_read" ON public.team_members;
DROP POLICY IF EXISTS "team_members_owner_crud" ON public.team_members;

CREATE POLICY "team_members_read" ON public.team_members
  FOR SELECT TO authenticated
  USING (
    owner_user_id = (select auth.uid())
    OR member_user_id = (select auth.uid())
  );

CREATE POLICY "team_members_write" ON public.team_members
  FOR ALL TO authenticated
  USING (owner_user_id = (select auth.uid()))
  WITH CHECK (owner_user_id = (select auth.uid()));
