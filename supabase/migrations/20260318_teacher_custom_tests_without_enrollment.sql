-- Allow teachers with assigned students to create and manage custom tests
-- without depending on enrollment in a specific course bucket.

drop policy if exists "Teachers can insert exams for assigned students' courses" on public.exams;
create policy "Teachers can insert exams when they have assigned students"
on public.exams
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
  and exists (
    select 1
    from public.profiles s
    where s.role = 'student'
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can update exams for assigned students' courses" on public.exams;
create policy "Teachers can update exams when they have assigned students"
on public.exams
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
  and exists (
    select 1
    from public.profiles s
    where s.role = 'student'
      and s.assigned_teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
  and exists (
    select 1
    from public.profiles s
    where s.role = 'student'
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can delete exams for assigned students' courses" on public.exams;
create policy "Teachers can delete exams when they have assigned students"
on public.exams
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
  and exists (
    select 1
    from public.profiles s
    where s.role = 'student'
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can insert exam questions for assigned students' courses" on public.exam_questions;
create policy "Teachers can insert exam questions when they have assigned students"
on public.exam_questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
  and exists (
    select 1
    from public.profiles s
    where s.role = 'student'
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can update exam questions for assigned students' courses" on public.exam_questions;
create policy "Teachers can update exam questions when they have assigned students"
on public.exam_questions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
  and exists (
    select 1
    from public.profiles s
    where s.role = 'student'
      and s.assigned_teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
  and exists (
    select 1
    from public.profiles s
    where s.role = 'student'
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can delete exam questions for assigned students' courses" on public.exam_questions;
create policy "Teachers can delete exam questions when they have assigned students"
on public.exam_questions
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
  and exists (
    select 1
    from public.profiles s
    where s.role = 'student'
      and s.assigned_teacher_id = auth.uid()
  )
);
