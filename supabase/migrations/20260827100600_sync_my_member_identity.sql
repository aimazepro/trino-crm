-- Permite que o próprio usuário espelhe nome e avatar em workspace_members.
--
-- Descoberto ao implementar a Task 19: a policy "workspace_members: update"
-- exige is_ws_admin(...) -- correta para editar QUALQUER membro, mas isso
-- também bloqueia o vendedor de atualizar a PRÓPRIA linha. Sem isto, a tela
-- de Perfil chamando update direto na tabela falha em silêncio por RLS (a
-- query roda, zero linhas afetadas, nenhum erro) -- confirmado com uma
-- asserção como Ana Clara antes desta migration.
--
-- Abre só essa fresta: SECURITY DEFINER, restrita a nome/avatar (nunca
-- role/status/permissions), e sempre member_user_id = auth.uid() -- não há
-- parâmetro de usuário para forjar.

create or replace function public.sync_my_member_identity(
  p_name text default null,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.workspace_members
     set name = coalesce(p_name, name),
         avatar_url = coalesce(p_avatar_url, avatar_url)
   where member_user_id = auth.uid()
     and status = 'accepted';
end;
$$;

revoke all on function public.sync_my_member_identity(text, text) from public;
grant execute on function public.sync_my_member_identity(text, text) to authenticated;
