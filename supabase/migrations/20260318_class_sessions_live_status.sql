-- Add class session live status support so only teachers/admins can start a session
-- and students can wait until the teacher starts it.

alter table if exists public.class_sessions
  add column if not exists status text;

update public.class_sessions
set status = coalesce(status, 'scheduled')
where status is null;

alter table if exists public.class_sessions
  alter column status set default 'scheduled';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_sessions_status_check'
  ) then
    alter table public.class_sessions
      add constraint class_sessions_status_check
      check (status in ('scheduled', 'live', 'ended'));
  end if;
end $$;

alter table if exists public.class_sessions enable row level security;

drop policy if exists "Authenticated can read class sessions" on public.class_sessions;
create policy "Authenticated can read class sessions"
on public.class_sessions
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
    from public.class_session_participants csp
    where csp.session_id = class_sessions.id
      and csp.student_id = auth.uid()
  )
);

drop policy if exists "Teachers and admins can insert class sessions" on public.class_sessions;
create policy "Teachers and admins can insert class sessions"
on public.class_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or teacher_id = auth.uid()
);

drop policy if exists "Teachers and admins can update class sessions" on public.class_sessions;
create policy "Teachers and admins can update class sessions"
on public.class_sessions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or teacher_id = auth.uid()
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or teacher_id = auth.uid()
);

drop policy if exists "Teachers and admins can delete class sessions" on public.class_sessions;
create policy "Teachers and admins can delete class sessions"
on public.class_sessions
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or teacher_id = auth.uid()
);

create index if not exists idx_class_sessions_status
  on public.class_sessions(status);
