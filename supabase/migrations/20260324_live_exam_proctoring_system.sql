-- Live exam proctoring system with slots, bookings, invigilator actions,
-- violations, attendance, and instructor assignments.

create table if not exists public.exam_live_slots (
  id bigint generated always as identity primary key,
  exam_id bigint not null references public.exams(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text,
  status text not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_capacity integer not null default 1,
  monitor_room_name text,
  notes text,
  cancelled_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_live_slots_status_check check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  constraint exam_live_slots_capacity_check check (max_capacity > 0),
  constraint exam_live_slots_time_check check (ends_at > starts_at)
);

create table if not exists public.exam_slot_instructors (
  id bigint generated always as identity primary key,
  slot_id bigint not null references public.exam_live_slots(id) on delete cascade,
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (slot_id, instructor_id)
);

create table if not exists public.exam_slot_booking_overrides (
  id bigint generated always as identity primary key,
  slot_id bigint not null references public.exam_live_slots(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  unique (slot_id, student_id)
);

create table if not exists public.exam_slot_bookings (
  id bigint generated always as identity primary key,
  slot_id bigint not null references public.exam_live_slots(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'booked',
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  override_applied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id, student_id),
  constraint exam_slot_bookings_status_check check (status in ('booked', 'cancelled', 'active', 'completed', 'terminated', 'absent'))
);

create table if not exists public.exam_live_sessions (
  id bigint generated always as identity primary key,
  slot_id bigint not null references public.exam_live_slots(id) on delete cascade,
  booking_id bigint not null references public.exam_slot_bookings(id) on delete cascade,
  exam_id bigint not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'scheduled',
  attendance_status text not null default 'pending',
  attendance_marked_by uuid references public.profiles(id) on delete set null,
  attendance_marked_role text,
  violation_count integer not null default 0,
  last_violation_type text,
  last_violation_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  last_heartbeat_at timestamptz,
  termination_reason text,
  monitor_room_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id),
  constraint exam_live_sessions_status_check check (status in ('scheduled', 'active', 'paused', 'completed', 'terminated', 'disconnected')),
  constraint exam_live_sessions_attendance_check check (attendance_status in ('pending', 'present', 'absent'))
);

create table if not exists public.exam_live_violations (
  id bigint generated always as identity primary key,
  slot_id bigint not null references public.exam_live_slots(id) on delete cascade,
  session_id bigint not null references public.exam_live_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  exam_id bigint references public.exams(id) on delete set null,
  violation_type text not null,
  attempt_count integer not null,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_live_actions (
  id bigint generated always as identity primary key,
  slot_id bigint not null references public.exam_live_slots(id) on delete cascade,
  session_id bigint references public.exam_live_sessions(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  target_student_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  message text,
  lock_days integer,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_live_messages (
  id bigint generated always as identity primary key,
  slot_id bigint not null references public.exam_live_slots(id) on delete cascade,
  session_id bigint references public.exam_live_sessions(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_role text,
  recipient_id uuid references public.profiles(id) on delete set null,
  is_broadcast boolean not null default false,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists exam_live_slots_exam_id_idx on public.exam_live_slots(exam_id);
create index if not exists exam_live_slots_teacher_id_idx on public.exam_live_slots(teacher_id);
create index if not exists exam_live_slots_starts_at_idx on public.exam_live_slots(starts_at);
create index if not exists exam_slot_instructors_slot_id_idx on public.exam_slot_instructors(slot_id);
create index if not exists exam_slot_instructors_instructor_id_idx on public.exam_slot_instructors(instructor_id);
create index if not exists exam_slot_booking_overrides_slot_id_idx on public.exam_slot_booking_overrides(slot_id);
create index if not exists exam_slot_booking_overrides_student_id_idx on public.exam_slot_booking_overrides(student_id);
create index if not exists exam_slot_bookings_slot_id_idx on public.exam_slot_bookings(slot_id);
create index if not exists exam_slot_bookings_student_id_idx on public.exam_slot_bookings(student_id);
create index if not exists exam_live_sessions_slot_id_idx on public.exam_live_sessions(slot_id);
create index if not exists exam_live_sessions_student_id_idx on public.exam_live_sessions(student_id);
create index if not exists exam_live_violations_session_id_idx on public.exam_live_violations(session_id);
create index if not exists exam_live_violations_slot_id_idx on public.exam_live_violations(slot_id);
create index if not exists exam_live_messages_slot_id_idx on public.exam_live_messages(slot_id);

alter table if exists public.exam_live_slots enable row level security;
alter table if exists public.exam_slot_instructors enable row level security;
alter table if exists public.exam_slot_booking_overrides enable row level security;
alter table if exists public.exam_slot_bookings enable row level security;
alter table if exists public.exam_live_sessions enable row level security;
alter table if exists public.exam_live_violations enable row level security;
alter table if exists public.exam_live_actions enable row level security;
alter table if exists public.exam_live_messages enable row level security;

create or replace function public.can_access_exam_live_slot(target_slot_id bigint)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.exam_live_slots s
    where s.id = target_slot_id
      and (
        exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
        or s.teacher_id = auth.uid()
        or exists (
          select 1
          from public.exam_slot_instructors si
          join public.profiles p on p.id = auth.uid()
          where si.slot_id = s.id
            and si.instructor_id = auth.uid()
            and p.role = 'instructor'
        )
        or exists (
          select 1
          from public.exam_slot_bookings b
          where b.slot_id = s.id
            and b.student_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists "Exam live slots visible to allowed users" on public.exam_live_slots;
create policy "Exam live slots visible to allowed users"
on public.exam_live_slots
for select
to authenticated
using (
  public.can_access_exam_live_slot(id)
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'student'
      and status <> 'cancelled'
      and starts_at <= now() + interval '2 months'
  )
);

drop policy if exists "Admins can manage exam live slots" on public.exam_live_slots;
create policy "Admins can manage exam live slots"
on public.exam_live_slots
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Slot instructors visible to allowed users" on public.exam_slot_instructors;
create policy "Slot instructors visible to allowed users"
on public.exam_slot_instructors
for select
to authenticated
using (public.can_access_exam_live_slot(slot_id));

drop policy if exists "Admins can manage slot instructors" on public.exam_slot_instructors;
create policy "Admins can manage slot instructors"
on public.exam_slot_instructors
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Booking overrides visible to allowed users" on public.exam_slot_booking_overrides;
create policy "Booking overrides visible to allowed users"
on public.exam_slot_booking_overrides
for select
to authenticated
using (
  student_id = auth.uid()
  or public.can_access_exam_live_slot(slot_id)
);

drop policy if exists "Admins can manage booking overrides" on public.exam_slot_booking_overrides;
create policy "Admins can manage booking overrides"
on public.exam_slot_booking_overrides
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Bookings visible to allowed users" on public.exam_slot_bookings;
create policy "Bookings visible to allowed users"
on public.exam_slot_bookings
for select
to authenticated
using (
  student_id = auth.uid()
  or public.can_access_exam_live_slot(slot_id)
);

drop policy if exists "Students can book own slot" on public.exam_slot_bookings;
create policy "Students can book own slot"
on public.exam_slot_bookings
for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'student'
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
  or public.can_access_exam_live_slot(slot_id)
)
with check (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or public.can_access_exam_live_slot(slot_id)
);

drop policy if exists "Live sessions visible to allowed users" on public.exam_live_sessions;
create policy "Live sessions visible to allowed users"
on public.exam_live_sessions
for select
to authenticated
using (
  student_id = auth.uid()
  or public.can_access_exam_live_slot(slot_id)
);

drop policy if exists "Students can create own live session" on public.exam_live_sessions;
create policy "Students can create own live session"
on public.exam_live_sessions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'student'
  )
);

drop policy if exists "Allowed users can update live sessions" on public.exam_live_sessions;
create policy "Allowed users can update live sessions"
on public.exam_live_sessions
for update
to authenticated
using (
  student_id = auth.uid()
  or public.can_access_exam_live_slot(slot_id)
)
with check (
  student_id = auth.uid()
  or public.can_access_exam_live_slot(slot_id)
);

drop policy if exists "Violations visible to allowed users" on public.exam_live_violations;
create policy "Violations visible to allowed users"
on public.exam_live_violations
for select
to authenticated
using (
  student_id = auth.uid()
  or public.can_access_exam_live_slot(slot_id)
);

drop policy if exists "Allowed users can insert violations" on public.exam_live_violations;
create policy "Allowed users can insert violations"
on public.exam_live_violations
for insert
to authenticated
with check (
  student_id = auth.uid()
  or public.can_access_exam_live_slot(slot_id)
);

drop policy if exists "Actions visible to allowed users" on public.exam_live_actions;
create policy "Actions visible to allowed users"
on public.exam_live_actions
for select
to authenticated
using (
  target_student_id = auth.uid()
  or public.can_access_exam_live_slot(slot_id)
);

drop policy if exists "Allowed invigilators can insert actions" on public.exam_live_actions;
create policy "Allowed invigilators can insert actions"
on public.exam_live_actions
for insert
to authenticated
with check (
  public.can_access_exam_live_slot(slot_id)
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
  or public.can_access_exam_live_slot(slot_id)
);

drop policy if exists "Allowed users can insert messages" on public.exam_live_messages;
create policy "Allowed users can insert messages"
on public.exam_live_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.can_access_exam_live_slot(slot_id)
);
