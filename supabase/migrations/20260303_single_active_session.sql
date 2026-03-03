create table if not exists public.active_user_sessions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active_session_key text not null,
  device_id text,
  device_label text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_active_user_sessions_updated_at
  on public.active_user_sessions(updated_at desc);

alter table if exists public.active_user_sessions enable row level security;

drop policy if exists "Users can read own active session" on public.active_user_sessions;
create policy "Users can read own active session"
  on public.active_user_sessions
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own active session" on public.active_user_sessions;
create policy "Users can insert own active session"
  on public.active_user_sessions
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own active session" on public.active_user_sessions;
create policy "Users can update own active session"
  on public.active_user_sessions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own active session" on public.active_user_sessions;
create policy "Users can delete own active session"
  on public.active_user_sessions
  for delete
  using (user_id = auth.uid());
