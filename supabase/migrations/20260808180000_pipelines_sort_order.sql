-- Add sort_order to pipelines for drag-to-reorder in the UI
alter table public.pipelines
  add column if not exists sort_order integer;

-- Backfill: preserve current created_at order per user
with ranked as (
  select id, row_number() over (partition by user_id order by created_at) - 1 as rn
  from public.pipelines
)
update public.pipelines p
set sort_order = ranked.rn
from ranked
where ranked.id = p.id;

alter table public.pipelines
  alter column sort_order set default 0;

alter table public.pipelines
  alter column sort_order set not null;

create index if not exists pipelines_user_id_sort_order_idx
  on public.pipelines (user_id, sort_order);
