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
  )
);
