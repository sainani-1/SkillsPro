-- Allow teachers to conduct tests for their assigned students.
-- Scope: teachers can manage exams/questions only for courses where at least one
-- assigned student is enrolled, and can view submissions of their assigned students.

alter table if exists public.exams enable row level security;
alter table if exists public.exam_questions enable row level security;
alter table if exists public.exam_submissions enable row level security;

drop policy if exists "Teachers can insert exams for assigned students' courses" on public.exams;
create policy "Teachers can insert exams for assigned students' courses"
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
    from public.enrollments en
    join public.profiles s on s.id = en.student_id
    where en.course_id = exams.course_id
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can update exams for assigned students' courses" on public.exams;
create policy "Teachers can update exams for assigned students' courses"
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
    from public.enrollments en
    join public.profiles s on s.id = en.student_id
    where en.course_id = exams.course_id
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
    from public.enrollments en
    join public.profiles s on s.id = en.student_id
    where en.course_id = exams.course_id
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can delete exams for assigned students' courses" on public.exams;
create policy "Teachers can delete exams for assigned students' courses"
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
    from public.enrollments en
    join public.profiles s on s.id = en.student_id
    where en.course_id = exams.course_id
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can insert exam questions for assigned students' courses" on public.exam_questions;
create policy "Teachers can insert exam questions for assigned students' courses"
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
    from public.exams ex
    join public.enrollments en on en.course_id = ex.course_id
    join public.profiles s on s.id = en.student_id
    where ex.id = exam_questions.exam_id
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can update exam questions for assigned students' courses" on public.exam_questions;
create policy "Teachers can update exam questions for assigned students' courses"
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
    from public.exams ex
    join public.enrollments en on en.course_id = ex.course_id
    join public.profiles s on s.id = en.student_id
    where ex.id = exam_questions.exam_id
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
    from public.exams ex
    join public.enrollments en on en.course_id = ex.course_id
    join public.profiles s on s.id = en.student_id
    where ex.id = exam_questions.exam_id
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can delete exam questions for assigned students' courses" on public.exam_questions;
create policy "Teachers can delete exam questions for assigned students' courses"
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
    from public.exams ex
    join public.enrollments en on en.course_id = ex.course_id
    join public.profiles s on s.id = en.student_id
    where ex.id = exam_questions.exam_id
      and s.assigned_teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can read exam submissions of assigned students" on public.exam_submissions;
create policy "Teachers can read exam submissions of assigned students"
on public.exam_submissions
for select
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
    where s.id = exam_submissions.user_id
      and s.assigned_teacher_id = auth.uid()
  )
);
