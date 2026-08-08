-- Motivos de Exclusão (delete reasons) — mirrors the loss_reasons pattern,
-- persisted per user, standardized picklist shown when excluding a negócio.

CREATE TABLE IF NOT EXISTS public.delete_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delete_reasons_user_sort
  ON public.delete_reasons(user_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delete_reasons_user_name
  ON public.delete_reasons(user_id, name);

ALTER TABLE public.delete_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delete_reasons_crud ON public.delete_reasons;
CREATE POLICY delete_reasons_crud ON public.delete_reasons
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.delete_reasons FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delete_reasons TO authenticated;

-- Soft-delete for deals: excluir sai das listas/relatórios but stays around
-- for consulta + restauração (matches Motivos de Exclusão settings copy).
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delete_reason text,
  ADD COLUMN IF NOT EXISTS delete_note text;

CREATE INDEX IF NOT EXISTS idx_deals_deleted_at ON public.deals(deleted_at);
