-- Startup ideas submission + admin review

create extension if not exists pgcrypto;

create table if not exists public.startup_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  idea text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_message text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.startup_ideas enable row level security;

drop policy if exists "Users can submit own startup ideas" on public.startup_ideas;
create policy "Users can submit own startup ideas"
on public.startup_ideas
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can read own startup ideas and admins read all" on public.startup_ideas;
create policy "Users can read own startup ideas and admins read all"
on public.startup_ideas
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can update startup ideas" on public.startup_ideas;
create policy "Admins can update startup ideas"
on public.startup_ideas
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

