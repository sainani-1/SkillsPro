-- Fix live exam RLS policies to avoid recursive access checks and statement timeouts.

drop function if exists public.can_access_exam_live_slot(bigint);

drop policy if exists "Exam live slots visible to allowed users" on public.exam_live_slots;
create policy "Exam live slots visible to allowed users"
on public.exam_live_slots
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or teacher_id = auth.uid()
  or exists (
    select 1
    from public.exam_slot_instructors si
    join public.profiles p on p.id = auth.uid()
    where si.slot_id = exam_live_slots.id
      and si.instructor_id = auth.uid()
      and p.role = 'instructor'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'student'
      and exam_live_slots.status <> 'cancelled'
      and exam_live_slots.starts_at <= now() + interval '2 months'
  )
);

drop policy if exists "Slot instructors visible to allowed users" on public.exam_slot_instructors;
create policy "Slot instructors visible to allowed users"
on public.exam_slot_instructors
for select
to authenticated
using (
  instructor_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_slot_instructors.slot_id
      and s.teacher_id = auth.uid()
  )
);

drop policy if exists "Booking overrides visible to allowed users" on public.exam_slot_booking_overrides;
create policy "Booking overrides visible to allowed users"
on public.exam_slot_booking_overrides
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_slot_booking_overrides.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_slot_booking_overrides.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Bookings visible to allowed users" on public.exam_slot_bookings;
create policy "Bookings visible to allowed users"
on public.exam_slot_bookings
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_slot_bookings.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_slot_bookings.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Students and admins can update bookings" on public.exam_slot_bookings;
create policy "Students and admins can update bookings"
on public.exam_slot_bookings
for update
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_slot_bookings.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_slot_bookings.slot_id
      and si.instructor_id = auth.uid()
  )
)
with check (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_slot_bookings.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_slot_bookings.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Live sessions visible to allowed users" on public.exam_live_sessions;
create policy "Live sessions visible to allowed users"
on public.exam_live_sessions
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_live_sessions.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_live_sessions.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Allowed users can update live sessions" on public.exam_live_sessions;
create policy "Allowed users can update live sessions"
on public.exam_live_sessions
for update
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_live_sessions.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_live_sessions.slot_id
      and si.instructor_id = auth.uid()
  )
)
with check (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_live_sessions.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_live_sessions.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Violations visible to allowed users" on public.exam_live_violations;
create policy "Violations visible to allowed users"
on public.exam_live_violations
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_live_violations.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_live_violations.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Allowed users can insert violations" on public.exam_live_violations;
create policy "Allowed users can insert violations"
on public.exam_live_violations
for insert
to authenticated
with check (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_live_violations.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_live_violations.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Actions visible to allowed users" on public.exam_live_actions;
create policy "Actions visible to allowed users"
on public.exam_live_actions
for select
to authenticated
using (
  target_student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_live_actions.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_live_actions.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Allowed invigilators can insert actions" on public.exam_live_actions;
create policy "Allowed invigilators can insert actions"
on public.exam_live_actions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_live_actions.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_live_actions.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Messages visible to allowed users" on public.exam_live_messages;
create policy "Messages visible to allowed users"
on public.exam_live_messages
for select
to authenticated
using (
  recipient_id is null
  or recipient_id = auth.uid()
  or sender_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_live_messages.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_live_messages.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Allowed users can insert messages" on public.exam_live_messages;
create policy "Allowed users can insert messages"
on public.exam_live_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
    or recipient_id = auth.uid()
    or exists (
      select 1
      from public.exam_live_slots s
      where s.id = exam_live_messages.slot_id
        and s.teacher_id = auth.uid()
    )
    or exists (
      select 1
      from public.exam_slot_instructors si
      where si.slot_id = exam_live_messages.slot_id
        and si.instructor_id = auth.uid()
    )
    or exists (
      select 1
      from public.exam_slot_bookings b
      where b.slot_id = exam_live_messages.slot_id
        and b.student_id = auth.uid()
    )
  )
);
