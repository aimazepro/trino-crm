-- supabase/migrations/20260830100300_platform_account_deletion_preview.sql
--
-- Contagem real do que apagar uma CONTA destrói, separado em dois grupos:
--
-- 1. destruido: conteúdo próprio da pessoa que cascateia via FOREIGN KEY. Apagar
--    a linha em auth.users mata tudo isso sem volta.
-- 2. perdeAutoria: registros que sobrevivem, mas ficam órfãos (owner_id/linked_by/
--    created_by → NULL). A conta não podia ser deletada sem que o log dissesse
--    quanto ficava órfão.
--
-- Contexto: Uma conta pode ser dona de workspaces (que passa para Finding 3 da
-- workspace path, não aqui), ou ter links em várias tabelas como usuário comum,
-- ou ter ligações de autoria. O log da exclusão precisa dizer tudo o que se perde.
create or replace function public.platform_account_deletion_preview(p_user_id uuid)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'destruido', json_build_object(
      'emails', (select count(*) from public.emails where user_id = p_user_id),
      'email_signatures', (select count(*) from public.email_signatures where user_id = p_user_id),
      'dashboards', (select count(*) from public.dashboards where user_id = p_user_id),
      'saved_reports', (select count(*) from public.saved_reports where user_id = p_user_id),
      'telephony_extensions', (select count(*) from public.telephony_extensions where user_id = p_user_id),
      'notifications', (select count(*) from public.notifications where user_id = p_user_id),
      'integrations', (select count(*) from public.integrations where user_id = p_user_id),
      'whatsapp_member_settings', (select count(*) from public.whatsapp_member_settings where user_id = p_user_id),
      'activity_attachments', (select count(*) from public.activity_attachments where actor_user_id = p_user_id),
      'company_history', (select count(*) from public.company_history where actor_user_id = p_user_id),
      'contact_history', (select count(*) from public.contact_history where actor_user_id = p_user_id),
      'workspace_members', (select count(*) from public.workspace_members where member_user_id = p_user_id)
    ),
    'perdeAutoria', json_build_object(
      'deals', (select count(*) from public.deals where owner_id = p_user_id),
      'contacts', (select count(*) from public.contacts where owner_id = p_user_id),
      'companies', (select count(*) from public.companies where owner_id = p_user_id),
      'goals', (select count(*) from public.goals where owner_user_id = p_user_id),
      'telephony_calls', (select count(*) from public.telephony_calls where user_id = p_user_id)
    )
  );
$$;

revoke all on function public.platform_account_deletion_preview(uuid) from anon, authenticated, public;
grant execute on function public.platform_account_deletion_preview(uuid) to service_role;
