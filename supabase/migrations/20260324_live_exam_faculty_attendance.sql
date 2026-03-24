create table if not exists public.exam_slot_faculty_attendance (
  id bigint generated always as identity primary key,
  slot_id bigint not null references public.exam_live_slots(id) on delete cascade,
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  faculty_role text not null,
  status text not null default 'pending',
  marked_by uuid references public.profiles(id) on delete set null,
  marked_by_role text,
  marked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id, faculty_id),
  constraint exam_slot_faculty_attendance_role_check check (faculty_role in ('teacher', 'instructor')),
  constraint exam_slot_faculty_attendance_status_check check (status in ('pending', 'present', 'absent'))

);
create index if not exists exam_slot_faculty_attendance_slot_id_idx
  on public.exam_slot_faculty_attendance(slot_id);

create index if not exists exam_slot_faculty_attendance_faculty_id_idx
  on public.exam_slot_faculty_attendance(faculty_id);

alter table if exists public.exam_slot_faculty_attendance enable row level security;

drop policy if exists "Faculty attendance visible to allowed users" on public.exam_slot_faculty_attendance;
create policy "Faculty attendance visible to allowed users"
on public.exam_slot_faculty_attendance
for select
to authenticated
using (
  faculty_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_slot_faculty_attendance.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_slot_faculty_attendance.slot_id
      and si.instructor_id = auth.uid()
  )
);

drop policy if exists "Faculty attendance manageable by invigilators" on public.exam_slot_faculty_attendance;
create policy "Faculty attendance manageable by invigilators"
on public.exam_slot_faculty_attendance
for all
to authenticated
using (
  faculty_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_slot_faculty_attendance.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_slot_faculty_attendance.slot_id
      and si.instructor_id = auth.uid()
  )
)
with check (
  faculty_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.exam_live_slots s
    where s.id = exam_slot_faculty_attendance.slot_id
      and s.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.exam_slot_instructors si
    where si.slot_id = exam_slot_faculty_attendance.slot_id
      and si.instructor_id = auth.uid()
  )
);
