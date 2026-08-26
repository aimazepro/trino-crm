-- Painéis customizados do Insights: o usuário cria um painel vazio e arrasta
-- relatórios da sidebar pra dentro. report_ids guarda a ordem dos cards.
create table if not exists public.dashboards (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  report_ids   jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists dashboards_workspace_user_idx
  on public.dashboards (workspace_id, user_id, created_at);

alter table public.dashboards enable row level security;

drop policy if exists "dashboards_owner" on public.dashboards;
create policy "dashboards_owner" on public.dashboards
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
