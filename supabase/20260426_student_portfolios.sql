create table if not exists public.student_portfolios (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  username text not null unique,
  title text not null default 'Student Portfolio',
  tagline text,
  theme text not null default 'slate',
  is_published boolean not null default false,
  content jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_portfolios_username_lower_idx
  on public.student_portfolios (lower(username));

alter table public.student_portfolios enable row level security;

drop policy if exists "Students manage own portfolio" on public.student_portfolios;
create policy "Students manage own portfolio"
on public.student_portfolios
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Published portfolios are public" on public.student_portfolios;
create policy "Published portfolios are public"
on public.student_portfolios
for select
to anon, authenticated
using (is_published = true);
