-- Soft-delete support for self-deleted users and admin visibility of deletion reason.

alter table if exists public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_reason text,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create table if not exists public.deleted_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  full_name text,
  email text,
  role text,
  phone text,
  reason text not null,
  deleted_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_deleted_accounts_user_id on public.deleted_accounts(user_id);
create index if not exists idx_deleted_accounts_deleted_at on public.deleted_accounts(deleted_at desc);

alter table public.deleted_accounts enable row level security;

drop policy if exists "Users can insert own deleted account record" on public.deleted_accounts;
create policy "Users can insert own deleted account record"
on public.deleted_accounts
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can read deleted accounts" on public.deleted_accounts;
create policy "Admins can read deleted accounts"
on public.deleted_accounts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can update deleted accounts" on public.deleted_accounts;
create policy "Admins can update deleted accounts"
on public.deleted_accounts
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
