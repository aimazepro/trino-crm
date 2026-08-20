-- Enable RLS deny-all on internal service-role-only tables to prevent cross-tenant data leaks.
-- These tables are only accessed via the admin client (bypasses RLS), never through user-facing screens.
-- The default-deny policy (no explicit policies) is correct.
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limit_windows ENABLE ROW LEVEL SECURITY;
