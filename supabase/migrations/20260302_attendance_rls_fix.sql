-- Fix attendance RLS so teachers/admins can mark attendance reliably.

alter table if exists public.class_attendance enable row level security;
alter table if exists public.guidance_attendance enable row level security;

-- CLASS ATTENDANCE
drop policy if exists "Teachers and admins can read class attendance" on public.class_attendance;
create policy "Teachers and admins can read class attendance"
on public.class_attendance
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_attendance.session_id
      and cs.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers and admins can insert class attendance" on public.class_attendance;
create policy "Teachers and admins can insert class attendance"
on public.class_attendance
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_attendance.session_id
      and cs.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers and admins can update class attendance" on public.class_attendance;
create policy "Teachers and admins can update class attendance"
on public.class_attendance
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_attendance.session_id
      and cs.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_attendance.session_id
      and cs.teacher_id = auth.uid()
  )
);

-- GUIDANCE ATTENDANCE
drop policy if exists "Teachers and admins can read guidance attendance" on public.guidance_attendance;
create policy "Teachers and admins can read guidance attendance"
on public.guidance_attendance
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or exists (
    select 1
    from public.guidance_sessions gs
    where gs.id = guidance_attendance.session_id
      and gs.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers and admins can insert guidance attendance" on public.guidance_attendance;
create policy "Teachers and admins can insert guidance attendance"
on public.guidance_attendance
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or exists (
    select 1
    from public.guidance_sessions gs
    where gs.id = guidance_attendance.session_id
      and gs.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers and admins can update guidance attendance" on public.guidance_attendance;
create policy "Teachers and admins can update guidance attendance"
on public.guidance_attendance
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or exists (
    select 1
    from public.guidance_sessions gs
    where gs.id = guidance_attendance.session_id
      and gs.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or exists (
    select 1
    from public.guidance_sessions gs
    where gs.id = guidance_attendance.session_id
      and gs.teacher_id = auth.uid()
  )
);
