alter table if exists public.class_sessions
  add column if not exists livekit_controls jsonb not null default '{}'::jsonb;
