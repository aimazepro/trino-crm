alter table public.activities
  add column end_date timestamptz null,
  add column assignee_id uuid null references auth.users(id);

update public.activities set assignee_id = user_id where assignee_id is null;

create table public.activity_attachments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  size_bytes integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.activity_attachments enable row level security;

create policy "activity_attachments_select" on public.activity_attachments
  for select using (user_id = auth.uid());
create policy "activity_attachments_insert" on public.activity_attachments
  for insert with check (user_id = auth.uid());
create policy "activity_attachments_delete" on public.activity_attachments
  for delete using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('activity-attachments', 'activity-attachments', false)
on conflict (id) do nothing;

create policy "activity_attachments_storage_rw" on storage.objects
  for all using (bucket_id = 'activity-attachments' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'activity-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
