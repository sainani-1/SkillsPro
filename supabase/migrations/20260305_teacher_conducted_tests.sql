-- Track which exams were published/conducted by which teacher.

create table if not exists public.teacher_conducted_tests (
  id bigint generated always as identity primary key,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  exam_id bigint not null references public.exams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, exam_id)
);

alter table if exists public.teacher_conducted_tests enable row level security;

drop policy if exists "Teachers can read own conducted tests" on public.teacher_conducted_tests;
create policy "Teachers can read own conducted tests"
on public.teacher_conducted_tests
for select
to authenticated
using (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Teachers can insert own conducted tests" on public.teacher_conducted_tests;
create policy "Teachers can insert own conducted tests"
on public.teacher_conducted_tests
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);
