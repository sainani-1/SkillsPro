-- Startup collaborations between students on approved startup ideas

create extension if not exists pgcrypto;

create table if not exists public.startup_collaborations (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.startup_ideas(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.startup_collaborations enable row level security;

drop policy if exists "Users can create own collaboration request" on public.startup_collaborations;
create policy "Users can create own collaboration request"
on public.startup_collaborations
for insert
to authenticated
with check (requester_id = auth.uid());

drop policy if exists "Participants and admins can read collaboration requests" on public.startup_collaborations;
create policy "Participants and admins can read collaboration requests"
on public.startup_collaborations
for select
to authenticated
using (
  requester_id = auth.uid()
  or owner_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Owners and admins can update collaboration requests" on public.startup_collaborations;
create policy "Owners and admins can update collaboration requests"
on public.startup_collaborations
for update
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  owner_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

