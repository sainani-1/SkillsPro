create table if not exists public.premium_pass_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text,
  pass_days integer not null default 3,
  status text not null default 'claimed',
  claimed_at timestamptz not null default timezone('utc', now()),
  premium_until_after timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint premium_pass_claims_user_id_key unique (user_id)
);

create index if not exists idx_premium_pass_claims_claimed_at
  on public.premium_pass_claims(claimed_at desc);

create table if not exists public.premium_event_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_premium_event_logs_created_at
  on public.premium_event_logs(created_at desc);

create index if not exists idx_premium_event_logs_event_name
  on public.premium_event_logs(event_name);

alter table if exists public.premium_pass_claims enable row level security;
alter table if exists public.premium_event_logs enable row level security;

drop policy if exists "Users can read own premium pass claims" on public.premium_pass_claims;
create policy "Users can read own premium pass claims"
  on public.premium_pass_claims
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own premium pass claims" on public.premium_pass_claims;
create policy "Users can insert own premium pass claims"
  on public.premium_pass_claims
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Admins can read all premium pass claims" on public.premium_pass_claims;
create policy "Admins can read all premium pass claims"
  on public.premium_pass_claims
  for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ));

drop policy if exists "Admins can update premium pass claims" on public.premium_pass_claims;
create policy "Admins can update premium pass claims"
  on public.premium_pass_claims
  for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ));

drop policy if exists "Anyone can insert premium event logs" on public.premium_event_logs;
create policy "Anyone can insert premium event logs"
  on public.premium_event_logs
  for insert
  with check (true);

drop policy if exists "Admins can read premium event logs" on public.premium_event_logs;
create policy "Admins can read premium event logs"
  on public.premium_event_logs
  for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ));
