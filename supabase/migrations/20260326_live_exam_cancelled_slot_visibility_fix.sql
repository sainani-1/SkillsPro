-- Prevent cancelled live-exam slots from remaining visible to teachers,
-- instructors, or students after admin hides or cancels them.

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
        and s.status <> 'cancelled'
        and s.teacher_id = auth.uid()
    )
    or exists (
      select 1
      from public.exam_slot_instructors si
      join public.exam_live_slots s on s.id = si.slot_id
      where si.slot_id = target_slot_id
        and si.instructor_id = auth.uid()
        and s.status <> 'cancelled'
    );
$$;

create or replace function public.can_access_exam_live_slot(target_slot_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_live_slots s
    where s.id = target_slot_id
      and s.status <> 'cancelled'
      and (
        public.can_invigilate_exam_live_slot(target_slot_id)
        or public.is_booked_on_exam_live_slot(target_slot_id)
        or public.has_exam_slot_override(target_slot_id)
      )
  );
$$;

grant execute on function public.can_invigilate_exam_live_slot(bigint) to authenticated;
grant execute on function public.can_access_exam_live_slot(bigint) to authenticated;
