-- webhook_deliveries had a SELECT policy but no INSERT policy (Finding 6 of
-- the final whole-branch review). The "test this webhook" feature in Settings
-- (src/app/api/webhooks/trigger/route.ts) has therefore never actually logged
-- a delivery for any workspace: the insert was silently denied by RLS (using
-- the session-scoped client, not an admin client), and its error was
-- discarded (no `{ error }` destructuring on the call, fixed alongside this
-- migration). The insert also used a `user_id` column that table
-- never had -- only `workspace_id` (NOT NULL), also fixed alongside this.
--
-- Mirrors the `webhooks: insert` policy on the sibling table: workspace
-- membership via my_workspace_ids() (same base check the existing
-- `webhook_deliveries: select` policy's USING clause uses), scoped further to
-- workspace admins via is_ws_admin() -- the Settings > Webhooks page that
-- calls this route is itself admin-gated in the UI.
CREATE POLICY "webhook_deliveries: insert" ON public.webhook_deliveries
  FOR INSERT
  WITH CHECK (
    (workspace_id IN (SELECT my_workspace_ids()))
    AND (SELECT is_ws_admin(webhook_deliveries.workspace_id))
  );
