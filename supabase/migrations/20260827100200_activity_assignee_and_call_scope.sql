-- supabase/migrations/20260827100200_activity_assignee_and_call_scope.sql
--
-- Duas lacunas de escopo que a Fase 1 do multi-tenant deixou passar.

-- 1. Atividade: o responsável designado precisa enxergar a própria tarefa,
--    mesmo quando o negócio é de outra pessoa. Sem isso o seletor de
--    responsável (que já existe no modal e na API v1) atribui para o vazio.

drop policy if exists "activities: select" on public.activities;
create policy "activities: select"
  on public.activities for select
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

-- 2. Ligação: vendedor via as ligações do workspace inteiro.

drop policy if exists "telephony_calls: select" on public.telephony_calls;
create policy "telephony_calls: select"
  on public.telephony_calls for select
  using (
    workspace_id in (select my_workspace_ids())
    and (
      user_id = (select auth.uid())
      or (select is_ws_manager(workspace_id))
    )
  );
