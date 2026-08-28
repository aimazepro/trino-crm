-- Placar agregado do time.
--
-- Esta é a ÚNICA superfície que fura a RLS de propósito. Ela existe porque o
-- vendedor deve ver o próprio detalhe mais o comparativo do time, e a RLS de
-- deals impede que ele leia negócio alheio -- um relatório de time montado no
-- cliente viria zerado.
--
-- O que a protege: só devolve AGREGADO (nunca linha de negócio), e resolve o
-- workspace pela membership do próprio chamador (auth.uid()), então não há
-- parâmetro de workspace para forjar.
--
-- Nota: my_workspace_ids() é `returns setof uuid`, não array -- unnest(...)
-- sobre ela falha (`function unnest(uuid) does not exist`). Resolvemos o
-- workspace direto em workspace_members, que é o equivalente.

create or replace function public.team_scoreboard(
  period_start date,
  period_end date
)
returns table (
  user_id uuid,
  name text,
  avatar_url text,
  role text,
  deals_won bigint,
  value_won numeric,
  deals_open bigint,
  activities_done bigint,
  calls_made bigint
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  ws uuid;
begin
  select workspace_id into ws from public.workspace_members
   where member_user_id = auth.uid() and status = 'accepted' limit 1;

  if ws is null then
    raise exception 'sem workspace';
  end if;

  return query
  select
    m.member_user_id as user_id,
    coalesce(m.name, m.email) as name,
    m.avatar_url,
    m.role,
    coalesce(won.n, 0) as deals_won,
    coalesce(won.v, 0) as value_won,
    coalesce(open_.n, 0) as deals_open,
    coalesce(act.n, 0) as activities_done,
    coalesce(cal.n, 0) as calls_made
  from public.workspace_members m
  left join lateral (
    select count(*) n, coalesce(sum(d.value), 0) v
      from public.deals d
     where d.workspace_id = ws and d.owner_id = m.member_user_id
       and d.status = 'Ganho' and d.deleted_at is null
       and d.updated_at::date between period_start and period_end
  ) won on true
  left join lateral (
    select count(*) n from public.deals d
     where d.workspace_id = ws and d.owner_id = m.member_user_id
       and d.status = 'Ativo' and d.deleted_at is null
  ) open_ on true
  left join lateral (
    select count(*) n from public.activities a
     where a.workspace_id = ws and a.assignee_id = m.member_user_id
       and a.completed is true
       and a.date::date between period_start and period_end
  ) act on true
  left join lateral (
    select count(*) n from public.telephony_calls c
     where c.workspace_id = ws and c.user_id = m.member_user_id
       and c.created_at::date between period_start and period_end
  ) cal on true
  where m.workspace_id = ws
    and m.status = 'accepted'
    and m.member_user_id is not null
  order by coalesce(won.v, 0) desc, coalesce(m.name, m.email);
end;
$$;

revoke all on function public.team_scoreboard(date, date) from public;
grant execute on function public.team_scoreboard(date, date) to authenticated;
