-- As 4 colunas de Stripe/assinatura (stripe_customer_id, stripe_subscription_id,
-- subscription_status, current_period_end) são do painel da plataforma, não do
-- cliente: nenhum fluxo client-side deveria ler nem gravar isso, e um simples
-- `add column` em 20260830100000 herdou o GRANT de tabela inteira que
-- `authenticated` já tinha em workspaces (SELECT e INSERT em todas as colunas).
--
-- Mesma lição de 34b69eb, já aplicada ao UPDATE em
-- 20260829140000_revoke_workspace_admin_columns.sql: revoke por coluna NÃO
-- subtrai de um grant de tabela inteira -- é preciso revogar o grant de
-- tabela e regrantar só nas colunas que o client de fato usa.
--
-- Verificado: nenhum `from("workspaces")` client-side seleciona `*` (todo
-- select nomeia colunas), então estreitar o grant é seguro. As 10 colunas
-- abaixo são exatamente as que existiam antes de 20260830100000.
revoke select, insert on public.workspaces from authenticated;
grant select (id, name, slug, plan, owner_user_id, status, feature_flags, trial_ends_at, created_at, updated_at) on public.workspaces to authenticated;
grant insert (id, name, slug, plan, owner_user_id, status, feature_flags, trial_ends_at, created_at, updated_at) on public.workspaces to authenticated;
