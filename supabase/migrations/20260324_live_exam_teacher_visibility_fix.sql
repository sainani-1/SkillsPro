create or replace function public.teacher_has_assigned_student_on_exam_live_slot(target_slot_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_slot_bookings b
    join public.profiles student on student.id = b.student_id
    where b.slot_id = target_slot_id
      and b.status <> 'cancelled'
      and student.assigned_teacher_id = auth.uid()
  );
$$;

grant execute on function public.teacher_has_assigned_student_on_exam_live_slot(bigint) to authenticated;

create or replace function public.can_invigilate_exam_live_slot(target_slot_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_exam_admin()
    or exists (
      select 1
      from public.exam_live_slots s
      where s.id = target_slot_id
        and s.teacher_id = auth.uid()
    )
    or public.teacher_has_assigned_student_on_exam_live_slot(target_slot_id)
    or exists (
      select 1
      from public.exam_slot_instructors si
      where si.slot_id = target_slot_id
        and si.instructor_id = auth.uid()
    );
$$;

grant execute on function public.can_invigilate_exam_live_slot(bigint) to authenticated;
