create table public.contact_history (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  subtext text not null default '',
  created_at timestamptz not null default now()
);

create table public.company_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  subtext text not null default '',
  created_at timestamptz not null default now()
);

alter table public.contact_history enable row level security;
alter table public.company_history enable row level security;

create policy "contact_history_select" on public.contact_history for select using (user_id = auth.uid());
create policy "contact_history_insert" on public.contact_history for insert with check (user_id = auth.uid());
create policy "company_history_select" on public.company_history for select using (user_id = auth.uid());
create policy "company_history_insert" on public.company_history for insert with check (user_id = auth.uid());
