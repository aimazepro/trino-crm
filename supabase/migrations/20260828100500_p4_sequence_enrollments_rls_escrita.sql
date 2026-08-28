-- P4 — `sequence_enrollments` nunca gravou uma linha sequer.
--
-- A tabela tinha RLS ligada, uma policy de `select` e **nenhuma** de
-- insert/update/delete: todo insert vindo do cliente era recusado. Somado a
-- isso, `src/lib/sequence-helpers.ts` inseria sem `workspace_id` e envolvia a
-- chamada num `try/catch` que não pegava nada -- o supabase-js devolve
-- `{ error }` em vez de lançar. Resultado: zero linhas em produção, sem
-- nenhum sinal. Só a fila do motor (`/api/automations/sequences`, com service
-- role) escrevia ali, e ela só drenava o que nunca tinha sido inserido.
--
-- O predicado é o mesmo de `deal_history`: você mexe na inscrição de um
-- negócio que é seu, ou de qualquer um se for gerente.

drop policy if exists "sequence_enrollments: insert" on public.sequence_enrollments;
create policy "sequence_enrollments: insert" on public.sequence_enrollments
  for insert with check (
    workspace_id in (select public.my_workspace_ids())
    and exists (
      select 1 from public.deals d
      where d.id = sequence_enrollments.deal_id
        and d.workspace_id = sequence_enrollments.workspace_id
        and (d.owner_id = (select auth.uid()) or (select public.is_ws_manager(d.workspace_id)))));

drop policy if exists "sequence_enrollments: update" on public.sequence_enrollments;
create policy "sequence_enrollments: update" on public.sequence_enrollments
  for update using (
    workspace_id in (select public.my_workspace_ids())
    and exists (
      select 1 from public.deals d
      where d.id = sequence_enrollments.deal_id
        and (d.owner_id = (select auth.uid()) or (select public.is_ws_manager(d.workspace_id)))))
  with check (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "sequence_enrollments: delete" on public.sequence_enrollments;
create policy "sequence_enrollments: delete" on public.sequence_enrollments
  for delete using (
    workspace_id in (select public.my_workspace_ids())
    and exists (
      select 1 from public.deals d
      where d.id = sequence_enrollments.deal_id
        and (d.owner_id = (select auth.uid()) or (select public.is_ws_manager(d.workspace_id)))));
