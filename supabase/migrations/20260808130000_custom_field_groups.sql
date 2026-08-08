create table public.custom_field_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null check (entity in ('deal','contact','company','activity')),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, entity, name)
);

alter table public.custom_field_groups enable row level security;

create policy "custom_field_groups_select" on public.custom_field_groups
  for select using (user_id = auth.uid());
create policy "custom_field_groups_insert" on public.custom_field_groups
  for insert with check (user_id = auth.uid());
create policy "custom_field_groups_update" on public.custom_field_groups
  for update using (user_id = auth.uid());
create policy "custom_field_groups_delete" on public.custom_field_groups
  for delete using (user_id = auth.uid());

insert into public.custom_field_groups (user_id, entity, name, sort_order)
select distinct cf.user_id, cf.entity, cf.field_group, 0
from public.custom_fields cf
where cf.field_group is not null and cf.field_group <> ''
on conflict (user_id, entity, name) do nothing;
