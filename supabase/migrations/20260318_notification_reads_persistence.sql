create table if not exists public.notification_reads (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (notification_id, user_id)
);

create index if not exists idx_notification_reads_user_id
  on public.notification_reads(user_id);

create index if not exists idx_notification_reads_notification_id
  on public.notification_reads(notification_id);

alter table if exists public.notification_reads enable row level security;

drop policy if exists "Users can read own notification reads" on public.notification_reads;
create policy "Users can read own notification reads"
  on public.notification_reads
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own notification reads" on public.notification_reads;
create policy "Users can insert own notification reads"
  on public.notification_reads
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own notification reads" on public.notification_reads;
create policy "Users can update own notification reads"
  on public.notification_reads
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own notification reads" on public.notification_reads;
create policy "Users can delete own notification reads"
  on public.notification_reads
  for delete
  using (user_id = auth.uid());
