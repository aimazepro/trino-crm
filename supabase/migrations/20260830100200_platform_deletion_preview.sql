-- supabase/migrations/20260830100200_platform_deletion_preview.sql
--
-- Contagem real do que a remoção definitiva destrói, medida no instante da
-- pergunta. O diálogo do painel mostra ESTES números -- texto genérico
-- ("isso apaga tudo") não é confirmação informada.
--
-- Contexto (§8.1 do spec, verificado em pg_constraint em 2026-08-30): apagar
-- a linha do DONO em auth.users cascateia para workspaces e de lá para 43
-- tabelas. Um clique destrói o CRM inteiro do cliente, sem volta.
create or replace function public.platform_deletion_preview(p_workspace_id uuid)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'deals', (select count(*) from public.deals where workspace_id = p_workspace_id),
    'contacts', (select count(*) from public.contacts where workspace_id = p_workspace_id),
    'companies', (select count(*) from public.companies where workspace_id = p_workspace_id),
    'activities', (select count(*) from public.activities where workspace_id = p_workspace_id),
    'whatsappMessages', (select count(*) from public.whatsapp_messages where workspace_id = p_workspace_id),
    'telephonyCalls', (select count(*) from public.telephony_calls where workspace_id = p_workspace_id),
    'telephonyBalanceCents', (
      select coalesce((select balance_cents from public.telephony_balances where workspace_id = p_workspace_id), 0)
    ),
    'members', (select count(*) from public.workspace_members where workspace_id = p_workspace_id)
  );
$$;

revoke all on function public.platform_deletion_preview(uuid) from anon, authenticated, public;
grant execute on function public.platform_deletion_preview(uuid) to service_role;
