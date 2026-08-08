-- deal_notes, deal_products and appointments only had a lone "user owns"
-- ALL policy (deal_id -> deals.user_id = auth.uid()), unlike deals/activities
-- which already got workspace-aware split policies. That meant any cross-owner
-- transfer (e.g. merging a deal you own with a teammate's deal) would silently
-- fail to move notes/products/appointments under RLS. Mirror the same
-- select/insert/update/delete split activities already uses.

-- deal_notes
DROP POLICY IF EXISTS "deal_notes: user owns" ON public.deal_notes;
DROP POLICY IF EXISTS workspace_select_deal_notes ON public.deal_notes;
DROP POLICY IF EXISTS workspace_insert_deal_notes ON public.deal_notes;
DROP POLICY IF EXISTS workspace_update_deal_notes ON public.deal_notes;
DROP POLICY IF EXISTS workspace_delete_deal_notes ON public.deal_notes;

CREATE POLICY workspace_select_deal_notes ON public.deal_notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_notes.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));
CREATE POLICY workspace_insert_deal_notes ON public.deal_notes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_notes.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));
CREATE POLICY workspace_update_deal_notes ON public.deal_notes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_notes.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_notes.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));
CREATE POLICY workspace_delete_deal_notes ON public.deal_notes FOR DELETE
  USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_notes.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));

-- deal_products
DROP POLICY IF EXISTS "deal_products: user owns" ON public.deal_products;
DROP POLICY IF EXISTS workspace_select_deal_products ON public.deal_products;
DROP POLICY IF EXISTS workspace_insert_deal_products ON public.deal_products;
DROP POLICY IF EXISTS workspace_update_deal_products ON public.deal_products;
DROP POLICY IF EXISTS workspace_delete_deal_products ON public.deal_products;

CREATE POLICY workspace_select_deal_products ON public.deal_products FOR SELECT
  USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_products.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));
CREATE POLICY workspace_insert_deal_products ON public.deal_products FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_products.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));
CREATE POLICY workspace_update_deal_products ON public.deal_products FOR UPDATE
  USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_products.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_products.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));
CREATE POLICY workspace_delete_deal_products ON public.deal_products FOR DELETE
  USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_products.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));

-- appointments
DROP POLICY IF EXISTS "appointments: user owns" ON public.appointments;
DROP POLICY IF EXISTS workspace_select_appointments ON public.appointments;
DROP POLICY IF EXISTS workspace_insert_appointments ON public.appointments;
DROP POLICY IF EXISTS workspace_update_appointments ON public.appointments;
DROP POLICY IF EXISTS workspace_delete_appointments ON public.appointments;

CREATE POLICY workspace_select_appointments ON public.appointments FOR SELECT
  USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = appointments.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));
CREATE POLICY workspace_insert_appointments ON public.appointments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM deals d WHERE d.id = appointments.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));
CREATE POLICY workspace_update_appointments ON public.appointments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = appointments.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM deals d WHERE d.id = appointments.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));
CREATE POLICY workspace_delete_appointments ON public.appointments FOR DELETE
  USING (EXISTS (SELECT 1 FROM deals d WHERE d.id = appointments.deal_id AND (d.user_id = (SELECT auth.uid()) OR is_workspace_member(d.user_id))));
