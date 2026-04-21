-- Live exam proctoring RLS hotfix
-- Run this in the Supabase SQL editor if live exam media stays stuck on
-- "Student is still on the permission/fullscreen steps..." even after the
-- student grants camera, mic, and entire-screen share.

create extension if not exists "pgcrypto";

alter table if exists public.exam_live_slots enable row level security;
alter table if exists public.exam_slot_bookings enable row level security;
alter table if exists public.exam_live_sessions enable row level security;
alter table if exists public.exam_live_violations enable row level security;
alter table if exists public.exam_live_messages enable row level security;
alter table if exists public.exam_live_actions enable row level security;
alter table if exists public.exam_slot_instructors enable row level security;
alter table if exists public.exam_slot_booking_overrides enable row level security;
alter table if exists public.exam_slot_faculty_attendance enable row level security;

alter table if exists public.exam_live_sessions replica identity full;
alter table if exists public.exam_slot_bookings replica identity full;
alter table if exists public.exam_live_messages replica identity full;
alter table if exists public.exam_live_actions replica identity full;
alter table if exists public.exam_live_violations replica identity full;

drop policy if exists "Live exam slots are readable by authenticated users" on public.exam_live_slots;
create policy "Live exam slots are readable by authenticated users"
on public.exam_live_slots
for select
to authenticated
using (true);

drop policy if exists "Students can read own live exam bookings" on public.exam_slot_bookings;
create policy "Students can read own live exam bookings"
on public.exam_slot_bookings
for select
to authenticated
using (student_id = auth.uid());

drop policy if exists "Students can update own live exam bookings" on public.exam_slot_bookings;
create policy "Students can update own live exam bookings"
on public.exam_slot_bookings
for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists "Students can insert own live exam bookings" on public.exam_slot_bookings;
create policy "Students can insert own live exam bookings"
on public.exam_slot_bookings
for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists "Staff can manage live exam bookings" on public.exam_slot_bookings;
create policy "Staff can manage live exam bookings"
on public.exam_slot_bookings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);

drop policy if exists "Students can read own live exam sessions" on public.exam_live_sessions;
create policy "Students can read own live exam sessions"
on public.exam_live_sessions
for select
to authenticated
using (student_id = auth.uid());

drop policy if exists "Students can update own live exam sessions" on public.exam_live_sessions;
create policy "Students can update own live exam sessions"
on public.exam_live_sessions
for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists "Students can insert own live exam sessions" on public.exam_live_sessions;
create policy "Students can insert own live exam sessions"
on public.exam_live_sessions
for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists "Staff can manage live exam sessions" on public.exam_live_sessions;
create policy "Staff can manage live exam sessions"
on public.exam_live_sessions
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);

drop policy if exists "Students can read own live exam violations" on public.exam_live_violations;
create policy "Students can read own live exam violations"
on public.exam_live_violations
for select
to authenticated
using (student_id = auth.uid());

drop policy if exists "Students can insert own live exam violations" on public.exam_live_violations;
create policy "Students can insert own live exam violations"
on public.exam_live_violations
for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists "Staff can manage live exam violations" on public.exam_live_violations;
create policy "Staff can manage live exam violations"
on public.exam_live_violations
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);

drop policy if exists "Students can read own live exam messages" on public.exam_live_messages;
create policy "Students can read own live exam messages"
on public.exam_live_messages
for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or recipient_id is null
);

drop policy if exists "Students can insert own live exam messages" on public.exam_live_messages;
create policy "Students can insert own live exam messages"
on public.exam_live_messages
for insert
to authenticated
with check (sender_id = auth.uid());

drop policy if exists "Staff can manage live exam messages" on public.exam_live_messages;
create policy "Staff can manage live exam messages"
on public.exam_live_messages
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);

drop policy if exists "Students can read own live exam actions" on public.exam_live_actions;
create policy "Students can read own live exam actions"
on public.exam_live_actions
for select
to authenticated
using (target_student_id = auth.uid());

drop policy if exists "Staff can manage live exam actions" on public.exam_live_actions;
create policy "Staff can manage live exam actions"
on public.exam_live_actions
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);

drop policy if exists "Staff can read live exam slot instructors" on public.exam_slot_instructors;
create policy "Staff can read live exam slot instructors"
on public.exam_slot_instructors
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);

drop policy if exists "Staff can manage live exam slot instructors" on public.exam_slot_instructors;
create policy "Staff can manage live exam slot instructors"
on public.exam_slot_instructors
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);

drop policy if exists "Staff can read live exam overrides" on public.exam_slot_booking_overrides;
create policy "Staff can read live exam overrides"
on public.exam_slot_booking_overrides
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);

drop policy if exists "Staff can manage live exam overrides" on public.exam_slot_booking_overrides;
create policy "Staff can manage live exam overrides"
on public.exam_slot_booking_overrides
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);

drop policy if exists "Staff can read live exam faculty attendance" on public.exam_slot_faculty_attendance;
create policy "Staff can read live exam faculty attendance"
on public.exam_slot_faculty_attendance
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);

drop policy if exists "Staff can manage live exam faculty attendance" on public.exam_slot_faculty_attendance;
create policy "Staff can manage live exam faculty attendance"
on public.exam_slot_faculty_attendance
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher', 'instructor')
  )
);
