create table if not exists public.admin_managed_user_passwords (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  auth_user_id uuid,
  email text,
  password_plain text,
  password_source text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_managed_user_passwords enable row level security;
