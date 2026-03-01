-- Fix RLS for courses: allow only admins to insert/update/delete
-- Run this in Supabase SQL Editor.

alter table if exists public.courses enable row level security;

drop policy if exists "Admins can insert courses" on public.courses;
create policy "Admins can insert courses"
on public.courses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Admins can update courses" on public.courses;
create policy "Admins can update courses"
on public.courses
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Admins can delete courses" on public.courses;
create policy "Admins can delete courses"
on public.courses
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- Optional: students/others can read active courses
drop policy if exists "Authenticated can read courses" on public.courses;
create policy "Authenticated can read courses"
on public.courses
for select
to authenticated
using (
  coalesce(is_active, true) = true
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
