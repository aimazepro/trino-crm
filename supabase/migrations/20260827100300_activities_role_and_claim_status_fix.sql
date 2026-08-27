-- supabase/migrations/20260827100300_activities_role_and_claim_status_fix.sql
--
-- Fix round 1 da revisão da Task 3 (F3) e da Task 1 (F4). As migrations
-- anteriores já foram aplicadas em produção -- não editamos as antigas.

-- F3 -------------------------------------------------------------------
-- As três policies de `activities` recriadas na Task 3 ficaram com role
-- {public} (o "to authenticated" some quando não é escrito explicitamente).
-- "activities: insert", intocada, continua {authenticated}. Recria as três
-- com o role certo -- comportamento não muda para usuário autenticado (a
-- checagem de auth.uid() dentro da policy já exigia sessão), mas fecha o
-- ramo perdido da política original.

drop policy if exists "activities: select" on public.activities;
create policy "activities: select"
  on public.activities for select
  to authenticated
  using (
    workspace_id in (select my_workspace_ids())
    and (
      assignee_id = (select auth.uid())
      or (select is_ws_manager(workspace_id))
      or exists (
        select 1 from public.deals d
         where d.id = activities.deal_id
           and d.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists "activities: update" on public.activities;
create policy "activities: update"
  on public.activities for update
  to authenticated
  using (
    workspace_id in (select my_workspace_ids())
    and (
      assignee_id = (select auth.uid())
      or (select is_ws_manager(workspace_id))
      or exists (
        select 1 from public.deals d
         where d.id = activities.deal_id
           and d.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists "activities: delete" on public.activities;
create policy "activities: delete"
  on public.activities for delete
  to authenticated
  using (
    workspace_id in (select my_workspace_ids())
    and (
      assignee_id = (select auth.uid())
      or (select is_ws_manager(workspace_id))
      or exists (
        select 1 from public.deals d
         where d.id = activities.deal_id
           and d.owner_id = (select auth.uid())
      )
    )
  );

-- F4 -------------------------------------------------------------------
-- send.ts insere a mensagem com status 'pending' ANTES de chamar o provedor
-- (assim um timeout ainda deixa mensagem visível como falha, em vez de
-- silêncio). O trigger antigo disparava só no INSERT e reivindicava a
-- conversa ali -- se o envio falhasse depois (status -> 'failed'), o
-- vendedor já tinha ficado dono de um lead que nunca recebeu mensagem
-- nenhuma. Agora o claim só vale para mensagem efetivamente entregue: o
-- trigger cobre também a transição de status, e a guarda exige
-- sent/delivered/read.

create or replace function public.claim_whatsapp_conversation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Só mensagem de gente, com sent_by preenchido, e que chegou a sair
  -- (sent/delivered/read) reivindica. 'pending' e 'failed' não contam --
  -- senão um envio que falha reivindicaria um lead que nunca foi respondido.
  if new.from_me is true
     and new.sent_by is not null
     and new.status in ('sent', 'delivered', 'read') then
    update public.whatsapp_conversations
       set owner_id = new.sent_by,
           updated_at = now()
     where id = new.conversation_id
       and owner_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists whatsapp_messages_autoclaim_conversation on public.whatsapp_messages;
create trigger whatsapp_messages_autoclaim_conversation
  after insert or update of status on public.whatsapp_messages
  for each row
  execute function public.claim_whatsapp_conversation();
