-- supabase/migrations/20260812190000_google_calendar_sync.sql
alter table activities
  add column google_event_id text,
  add column meet_link text,
  add column calendar_synced_at timestamptz;

alter table integrations
  add column sync_type text not null default 'bidirecional'
    check (sync_type in ('bidirecional', 'unidirecional')),
  add column calendar_id text not null default 'primary',
  add column sync_token text,
  add column last_synced_at timestamptz;
