create table if not exists public.chat_read_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id bigint not null references public.chat_groups(id) on delete cascade,
  last_read_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, group_id)
);

create index if not exists idx_chat_read_states_group_id
  on public.chat_read_states(group_id);

create index if not exists idx_chat_read_states_user_last_read
  on public.chat_read_states(user_id, last_read_at desc);

alter table if exists public.chat_read_states enable row level security;

drop policy if exists "Users can read own chat read states" on public.chat_read_states;
create policy "Users can read own chat read states"
  on public.chat_read_states
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.chat_members cm
      where cm.group_id = chat_read_states.group_id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own chat read states" on public.chat_read_states;
create policy "Users can insert own chat read states"
  on public.chat_read_states
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.chat_members cm
      where cm.group_id = chat_read_states.group_id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own chat read states" on public.chat_read_states;
create policy "Users can update own chat read states"
  on public.chat_read_states
  for update
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.chat_members cm
      where cm.group_id = chat_read_states.group_id
        and cm.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.chat_members cm
      where cm.group_id = chat_read_states.group_id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own chat read states" on public.chat_read_states;
create policy "Users can delete own chat read states"
  on public.chat_read_states
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.chat_members cm
      where cm.group_id = chat_read_states.group_id
        and cm.user_id = auth.uid()
    )
  );
