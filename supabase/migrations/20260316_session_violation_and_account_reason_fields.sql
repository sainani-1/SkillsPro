alter table if exists public.profiles
  add column if not exists lock_reason text,
  add column if not exists disabled_reason text,
  add column if not exists session_violation_count integer not null default 0,
  add column if not exists session_violation_last_at timestamptz;
