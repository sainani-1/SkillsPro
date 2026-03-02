-- Add explicit end time for live classes so status remains active until session end.

alter table if exists public.class_sessions
  add column if not exists ends_at timestamptz;

create index if not exists idx_class_sessions_ends_at
  on public.class_sessions(ends_at);
