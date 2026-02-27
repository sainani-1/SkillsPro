-- Migration: Attendance edit overrides
-- Run this in your Supabase SQL Editor

create table if not exists attendance_edit_overrides (
  id bigserial primary key,
  session_id bigint not null,
  session_type text not null, -- class|guidance
  is_unlocked boolean default true,
  unlocked_by uuid references profiles(id),
  unlocked_at timestamptz default now(),
  unique (session_id, session_type)
);

create index if not exists idx_attendance_overrides_session
  on attendance_edit_overrides(session_type, session_id);

alter table attendance_edit_overrides enable row level security;

drop policy if exists "attendance_overrides_admin_select" on attendance_edit_overrides;
create policy "attendance_overrides_admin_select"
  on attendance_edit_overrides for select
  using (auth.uid() in (select id from profiles where role = 'admin'));

drop policy if exists "attendance_overrides_admin_insert" on attendance_edit_overrides;
create policy "attendance_overrides_admin_insert"
  on attendance_edit_overrides for insert
  with check (auth.uid() in (select id from profiles where role = 'admin'));

drop policy if exists "attendance_overrides_admin_delete" on attendance_edit_overrides;
create policy "attendance_overrides_admin_delete"
  on attendance_edit_overrides for delete
  using (auth.uid() in (select id from profiles where role = 'admin'));
