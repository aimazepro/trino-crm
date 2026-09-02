-- supabase/migrations/20260830100100_platform_dashboard_stats.sql
--
-- Cartões do dashboard do painel numa chamada só. Existe como função porque
-- dois dos números não saem do supabase-js: "contas paradas" precisa de
-- greatest() sobre agregados de duas tabelas, e "contas órfãs" precisa ler
-- auth.users -- e porque puxar deals inteiro pro Node só pra tirar um max()
-- é desperdício que cresce com o cliente.
--
-- ATENÇÃO: deal_history e contact_history NÃO têm workspace_id (só deal_id /
-- contact_id). Por isso "parada" é medida por deals.updated_at e
-- activities.created_at, que têm.
create or replace function public.platform_dashboard_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'workspaces', (
      select json_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'suspended', count(*) filter (where status = 'suspended'),
        'deleted', count(*) filter (where status = 'deleted'),
        'trial', count(*) filter (where plan = 'trial')
      )
      from public.workspaces
    ),
    'trialsExpiring', (
      select coalesce(json_agg(json_build_object(
        'id', id, 'name', name, 'slug', slug, 'trialEndsAt', trial_ends_at
      ) order by trial_ends_at), '[]'::json)
      from public.workspaces
      where status = 'active'
        and trial_ends_at is not null
        and trial_ends_at between now() and now() + interval '7 days'
    ),
    'stalled', (
      select coalesce(json_agg(json_build_object(
        'id', x.id, 'name', x.name, 'slug', x.slug, 'lastActivityAt', x.last_activity_at
      ) order by x.last_activity_at), '[]'::json)
      from (
        select w.id, w.name, w.slug,
          greatest(
            coalesce((select max(d.updated_at) from public.deals d where d.workspace_id = w.id), 'epoch'::timestamptz),
            coalesce((select max(a.created_at) from public.activities a where a.workspace_id = w.id), 'epoch'::timestamptz)
          ) as last_activity_at
        from public.workspaces w
        where w.status = 'active'
      ) x
      where x.last_activity_at < now() - interval '14 days'
    ),
    'orphanAccounts', (
      -- Operador da plataforma é órfão por desenho (não é membro de
      -- workspace nenhum): não conta como cadastro que não converteu.
      select coalesce(json_agg(json_build_object(
        'id', u.id, 'email', u.email, 'createdAt', u.created_at
      ) order by u.created_at desc), '[]'::json)
      from auth.users u
      where not exists (select 1 from public.workspace_members m where m.member_user_id = u.id)
        and not exists (select 1 from public.platform_admins pa where pa.user_id = u.id)
    ),
    'telephony', (
      select json_build_object(
        'balanceCents', coalesce(sum(balance_cents), 0),
        'reservedCents', coalesce(sum(reserved_cents), 0)
      )
      from public.telephony_balances
    ),
    -- Débito é negativo no ledger (kind = 'call_debit', amount_cents < 0);
    -- o sinal é invertido aqui pra "gasto do mês" ser um número positivo.
    'telephonySpentMonthCents', (
      select coalesce(-sum(amount_cents) filter (where amount_cents < 0), 0)
      from public.telephony_ledger
      where created_at >= date_trunc('month', now())
    )
  );
$$;

revoke all on function public.platform_dashboard_stats() from anon, authenticated, public;
grant execute on function public.platform_dashboard_stats() to service_role;
