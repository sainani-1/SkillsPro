-- Emergency live-exam RLS hotfix.
-- Replaces recursive cross-table policy checks with security-definer helpers
-- so slot loading does not deadlock or time out in Supabase.

create or replace function public.current_exam_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    ),
    ''
  );
$$;

create or replace function public.is_exam_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_exam_role() = 'admin';
$$;

create or replace function public.is_booked_on_exam_live_slot(target_slot_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_slot_bookings b
    where b.slot_id = target_slot_id
      and b.student_id = auth.uid()
      and b.status <> 'cancelled'
  );
$$;

create or replace function public.has_exam_slot_override(target_slot_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_slot_booking_overrides o
    where o.slot_id = target_slot_id
      and o.student_id = auth.uid()
  );
$$;

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
    or exists (
      select 1
      from public.exam_slot_instructors si
      where si.slot_id = target_slot_id
        and si.instructor_id = auth.uid()
    );
$$;

create or replace function public.can_access_exam_live_slot(target_slot_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_invigilate_exam_live_slot(target_slot_id)
    or public.is_booked_on_exam_live_slot(target_slot_id)
    or public.has_exam_slot_override(target_slot_id);
$$;

grant execute on function public.current_exam_role() to authenticated;
grant execute on function public.is_exam_admin() to authenticated;
grant execute on function public.is_booked_on_exam_live_slot(bigint) to authenticated;
grant execute on function public.has_exam_slot_override(bigint) to authenticated;
grant execute on function public.can_invigilate_exam_live_slot(bigint) to authenticated;
grant execute on function public.can_access_exam_live_slot(bigint) to authenticated;

drop policy if exists "Exam live slots visible to allowed users" on public.exam_live_slots;
create policy "Exam live slots visible to allowed users"
on public.exam_live_slots
for select
to authenticated
using (
  public.can_access_exam_live_slot(id)
  or (
    public.current_exam_role() = 'student'
    and status <> 'cancelled'
    and starts_at <= now() + interval '2 months'
    and ends_at >= now() - interval '1 day'
  )
);

drop policy if exists "Admins can manage exam live slots" on public.exam_live_slots;
create policy "Admins can manage exam live slots"
on public.exam_live_slots
for all
to authenticated
using (public.is_exam_admin())
with check (public.is_exam_admin());

drop policy if exists "Slot instructors visible to allowed users" on public.exam_slot_instructors;
create policy "Slot instructors visible to allowed users"
on public.exam_slot_instructors
for select
to authenticated
using (
  instructor_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
);

drop policy if exists "Admins can manage slot instructors" on public.exam_slot_instructors;
create policy "Admins can manage slot instructors"
on public.exam_slot_instructors
for all
to authenticated
using (public.is_exam_admin())
with check (public.is_exam_admin());

drop policy if exists "Booking overrides visible to allowed users" on public.exam_slot_booking_overrides;
create policy "Booking overrides visible to allowed users"
on public.exam_slot_booking_overrides
for select
to authenticated
using (
  student_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
);

drop policy if exists "Admins can manage booking overrides" on public.exam_slot_booking_overrides;
create policy "Admins can manage booking overrides"
on public.exam_slot_booking_overrides
for all
to authenticated
using (public.is_exam_admin())
with check (public.is_exam_admin());

drop policy if exists "Bookings visible to allowed users" on public.exam_slot_bookings;
create policy "Bookings visible to allowed users"
on public.exam_slot_bookings
for select
to authenticated
using (
  student_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
);

drop policy if exists "Students can book own slot" on public.exam_slot_bookings;
create policy "Students can book own slot"
on public.exam_slot_bookings
for insert
to authenticated
with check (
  student_id = auth.uid()
  and public.current_exam_role() = 'student'
);

drop policy if exists "Students and admins can update bookings" on public.exam_slot_bookings;
create policy "Students and admins can update bookings"
on public.exam_slot_bookings
for update
to authenticated
using (
  student_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
)
with check (
  student_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
);

drop policy if exists "Live sessions visible to allowed users" on public.exam_live_sessions;
create policy "Live sessions visible to allowed users"
on public.exam_live_sessions
for select
to authenticated
using (
  student_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
);

drop policy if exists "Students can create own live session" on public.exam_live_sessions;
create policy "Students can create own live session"
on public.exam_live_sessions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and public.current_exam_role() = 'student'
);

drop policy if exists "Allowed users can update live sessions" on public.exam_live_sessions;
create policy "Allowed users can update live sessions"
on public.exam_live_sessions
for update
to authenticated
using (
  student_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
)
with check (
  student_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
);

drop policy if exists "Violations visible to allowed users" on public.exam_live_violations;
create policy "Violations visible to allowed users"
on public.exam_live_violations
for select
to authenticated
using (
  student_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
);

drop policy if exists "Allowed users can insert violations" on public.exam_live_violations;
create policy "Allowed users can insert violations"
on public.exam_live_violations
for insert
to authenticated
with check (
  student_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
);

drop policy if exists "Actions visible to allowed users" on public.exam_live_actions;
create policy "Actions visible to allowed users"
on public.exam_live_actions
for select
to authenticated
using (
  target_student_id = auth.uid()
  or public.can_invigilate_exam_live_slot(slot_id)
);

drop policy if exists "Allowed invigilators can insert actions" on public.exam_live_actions;
create policy "Allowed invigilators can insert actions"
on public.exam_live_actions
for insert
to authenticated
with check (public.can_invigilate_exam_live_slot(slot_id));

drop policy if exists "Messages visible to allowed users" on public.exam_live_messages;
create policy "Messages visible to allowed users"
on public.exam_live_messages
for select
to authenticated
using (
  recipient_id is null
  or recipient_id = auth.uid()
  or sender_id = auth.uid()
  or public.can_access_exam_live_slot(slot_id)
  or public.can_invigilate_exam_live_slot(slot_id)
);

drop policy if exists "Allowed users can insert messages" on public.exam_live_messages;
create policy "Allowed users can insert messages"
on public.exam_live_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    public.can_access_exam_live_slot(slot_id)
    or public.can_invigilate_exam_live_slot(slot_id)
  )
);
