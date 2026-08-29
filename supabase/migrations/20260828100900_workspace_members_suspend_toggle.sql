-- Toggle ativar/desativar acesso: terceiro valor de status, sem apagar o
-- membro. Todos os helpers de RLS (my_workspace_ids, is_ws_admin, is_ws_manager,
-- my_role, is_workspace_member) já filtram por status = 'accepted', então um
-- membro 'suspended' perde acesso a todo dado do workspace automaticamente,
-- sem precisar reescrever nenhuma policy de dados.
alter table public.workspace_members drop constraint workspace_members_status_check;
alter table public.workspace_members add constraint workspace_members_status_check
  check (status = any (array['pending'::text, 'accepted'::text, 'suspended'::text]));

-- Fecha a brecha de um admin suspender sem querer o dono do workspace (o que
-- travaria o próprio dono fora, sem ninguém pra reverter): mesma proteção que
-- já existia pra "role", estendida pra "status". O UPDATE em si continua
-- permitido para qualquer outro campo da linha do dono.
drop policy "workspace_members: update" on public.workspace_members;
create policy "workspace_members: update" on public.workspace_members
  for update
  using (
    (workspace_id in (select my_workspace_ids()))
    and (select is_ws_admin(workspace_members.workspace_id))
  )
  with check (
    (workspace_id in (select my_workspace_ids()))
    and (select is_ws_admin(workspace_members.workspace_id))
    and (
      not exists (
        select 1 from workspaces w
        where w.id = workspace_members.workspace_id
          and w.owner_user_id = workspace_members.member_user_id
      )
      or (role = 'admin' and status = 'accepted')
    )
  );
