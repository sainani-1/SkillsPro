-- Migration: Add guidance_attendance table
-- Run this in your Supabase SQL Editor

-- Create guidance_attendance table for guidance session attendance tracking
create table if not exists guidance_attendance (
  id bigserial primary key,
  session_id bigint references guidance_sessions(id) on delete cascade,
  student_id uuid references profiles(id),
  teacher_id uuid references profiles(id),
  attended boolean,
  is_locked boolean default false,
  locked_by uuid references profiles(id),
  marked_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (session_id, student_id)
);

-- Create index for faster queries
create index if not exists idx_guidance_attendance_student on guidance_attendance(student_id);
create index if not exists idx_guidance_attendance_teacher on guidance_attendance(teacher_id);
create index if not exists idx_guidance_attendance_session on guidance_attendance(session_id);

-- Enable Row Level Security
alter table guidance_attendance enable row level security;

-- RLS Policies
create policy "Teachers can view their own guidance attendance"
  on guidance_attendance for select
  using (auth.uid() in (
    select id from profiles where role = 'teacher' and id = teacher_id
  ));

create policy "Students can view their own attendance"
  on guidance_attendance for select
  using (auth.uid() = student_id);

create policy "Teachers can insert/update attendance for their sessions"
  on guidance_attendance for all
  using (auth.uid() in (
    select id from profiles where role = 'teacher' and id = teacher_id
  ));

create policy "Admins can view all guidance attendance"
  on guidance_attendance for select
  using (auth.uid() in (
    select id from profiles where role = 'admin'
  ));
