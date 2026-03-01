-- Fix RLS for exams and exam_questions so admins can create/manage exams.
-- Run this in Supabase SQL Editor.

alter table if exists public.exams enable row level security;
alter table if exists public.exam_questions enable row level security;

drop policy if exists "Authenticated can read exams" on public.exams;
create policy "Authenticated can read exams"
on public.exams
for select
to authenticated
using (true);

drop policy if exists "Admins can insert exams" on public.exams;
create policy "Admins can insert exams"
on public.exams
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

drop policy if exists "Admins can update exams" on public.exams;
create policy "Admins can update exams"
on public.exams
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

drop policy if exists "Admins can delete exams" on public.exams;
create policy "Admins can delete exams"
on public.exams
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

drop policy if exists "Authenticated can read exam questions" on public.exam_questions;
create policy "Authenticated can read exam questions"
on public.exam_questions
for select
to authenticated
using (true);

drop policy if exists "Admins can insert exam questions" on public.exam_questions;
create policy "Admins can insert exam questions"
on public.exam_questions
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

drop policy if exists "Admins can update exam questions" on public.exam_questions;
create policy "Admins can update exam questions"
on public.exam_questions
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

drop policy if exists "Admins can delete exam questions" on public.exam_questions;
create policy "Admins can delete exam questions"
on public.exam_questions
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

-- Backfill: create a default exam for each course that has none.
insert into public.exams (course_id, duration_minutes, pass_percent)
select c.id, 60, 70
from public.courses c
where not exists (
  select 1
  from public.exams e
  where e.course_id = c.id
);
