alter table if exists public.teacher_conducted_tests
  add column if not exists audience_mode text not null default 'all_assigned',
  add column if not exists target_student_ids uuid[] not null default '{}'::uuid[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teacher_conducted_tests_audience_mode_check'
  ) then
    alter table public.teacher_conducted_tests
      add constraint teacher_conducted_tests_audience_mode_check
      check (audience_mode in ('all_assigned', 'selected_students'));
  end if;
end $$;

drop policy if exists "Students can read assigned teacher conducted tests" on public.teacher_conducted_tests;
create policy "Students can read assigned teacher conducted tests"
on public.teacher_conducted_tests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'student'
      and me.assigned_teacher_id = teacher_conducted_tests.teacher_id
      and (
        teacher_conducted_tests.audience_mode = 'all_assigned'
        or auth.uid() = any(teacher_conducted_tests.target_student_ids)
      )
  )
);

drop policy if exists "Teachers can update own conducted tests" on public.teacher_conducted_tests;
create policy "Teachers can update own conducted tests"
on public.teacher_conducted_tests
for update
to authenticated
using (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
