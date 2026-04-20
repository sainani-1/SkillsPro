-- Premium Plus career support: resume reviews, mock interviews, and monthly roadmaps.
-- Run this in Supabase SQL editor before using the new pages.

create extension if not exists "pgcrypto";

create table if not exists public.career_resume_reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  cycle_month text not null,
  source_type text not null default 'builder',
  resume_snapshot jsonb default '{}'::jsonb,
  file_name text,
  file_url text,
  student_note text,
  ats_score integer,
  ats_details jsonb default '{}'::jsonb,
  status text not null default 'pending',
  teacher_feedback text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_mock_interviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  cycle_month text not null,
  preferred_time timestamptz,
  scheduled_at timestamptz,
  meeting_link text,
  student_note text,
  teacher_feedback text,
  rating integer,
  communication_score integer,
  technical_score integer,
  confidence_score integer,
  project_explanation_score integer,
  improvement_notes text,
  final_recommendation text,
  status text not null default 'requested',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.career_resume_reviews add column if not exists ats_score integer;
alter table public.career_resume_reviews add column if not exists ats_details jsonb default '{}'::jsonb;
alter table public.career_mock_interviews add column if not exists communication_score integer;
alter table public.career_mock_interviews add column if not exists technical_score integer;
alter table public.career_mock_interviews add column if not exists confidence_score integer;
alter table public.career_mock_interviews add column if not exists project_explanation_score integer;
alter table public.career_mock_interviews add column if not exists improvement_notes text;
alter table public.career_mock_interviews add column if not exists final_recommendation text;

create table if not exists public.career_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  target_role text,
  preferred_industry text,
  skill_level text,
  expected_placement_month text,
  weak_areas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id)
);

create table if not exists public.career_profile_reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  cycle_month text not null,
  review_type text not null,
  url text not null,
  student_note text,
  status text not null default 'pending',
  teacher_feedback text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  source_type text not null default 'manual',
  source_id uuid,
  title text not null,
  description text,
  due_date date,
  status text not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_roadmaps (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  cycle_month text not null,
  generated_plan jsonb not null default '{}'::jsonb,
  editor_notes text,
  status text not null default 'draft',
  edited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, cycle_month)
);

create index if not exists career_resume_reviews_student_month_idx on public.career_resume_reviews(student_id, cycle_month);
create index if not exists career_resume_reviews_teacher_idx on public.career_resume_reviews(teacher_id, created_at desc);
create index if not exists career_mock_interviews_student_month_idx on public.career_mock_interviews(student_id, cycle_month);
create index if not exists career_mock_interviews_teacher_idx on public.career_mock_interviews(teacher_id, created_at desc);
create index if not exists career_roadmaps_student_month_idx on public.career_roadmaps(student_id, cycle_month);
create index if not exists career_roadmaps_teacher_idx on public.career_roadmaps(teacher_id, updated_at desc);
create index if not exists career_goals_teacher_idx on public.career_goals(teacher_id, updated_at desc);
create index if not exists career_profile_reviews_student_month_idx on public.career_profile_reviews(student_id, cycle_month, review_type);
create index if not exists career_profile_reviews_teacher_idx on public.career_profile_reviews(teacher_id, created_at desc);
create index if not exists career_tasks_student_idx on public.career_tasks(student_id, status, created_at desc);
create index if not exists career_tasks_teacher_idx on public.career_tasks(teacher_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('career-support', 'career-support', true)
on conflict (id) do nothing;

drop policy if exists "Career support files are readable" on storage.objects;
create policy "Career support files are readable"
on storage.objects for select
to authenticated
using (bucket_id = 'career-support');

drop policy if exists "Students can upload own career support files" on storage.objects;
create policy "Students can upload own career support files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'career-support'
  and (storage.foldername(name))[1] = 'resume-reviews'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Students can update own career support files" on storage.objects;
create policy "Students can update own career support files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'career-support'
  and (storage.foldername(name))[1] = 'resume-reviews'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'career-support'
  and (storage.foldername(name))[1] = 'resume-reviews'
  and (storage.foldername(name))[2] = auth.uid()::text
);

alter table public.career_resume_reviews enable row level security;
alter table public.career_mock_interviews enable row level security;
alter table public.career_roadmaps enable row level security;
alter table public.career_goals enable row level security;
alter table public.career_profile_reviews enable row level security;
alter table public.career_tasks enable row level security;

drop policy if exists "Students can read own resume reviews" on public.career_resume_reviews;
create policy "Students can read own resume reviews"
on public.career_resume_reviews for select
using (auth.uid() = student_id);

drop policy if exists "Students can create own resume reviews" on public.career_resume_reviews;
create policy "Students can create own resume reviews"
on public.career_resume_reviews for insert
to authenticated
with check (
  auth.uid() = student_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
  )
);

drop policy if exists "Students can update own pending resume reviews" on public.career_resume_reviews;
create policy "Students can update own pending resume reviews"
on public.career_resume_reviews for update
to authenticated
using (auth.uid() = student_id and status = 'pending')
with check (auth.uid() = student_id);

drop policy if exists "Teachers and admins manage resume reviews" on public.career_resume_reviews;
create policy "Teachers and admins manage resume reviews"
on public.career_resume_reviews for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_resume_reviews.teacher_id = auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_resume_reviews.teacher_id = auth.uid()))
  )
);

drop policy if exists "Students can read own mock interviews" on public.career_mock_interviews;
create policy "Students can read own mock interviews"
on public.career_mock_interviews for select
using (auth.uid() = student_id);

drop policy if exists "Students can create own mock interviews" on public.career_mock_interviews;
create policy "Students can create own mock interviews"
on public.career_mock_interviews for insert
to authenticated
with check (
  auth.uid() = student_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
  )
);

drop policy if exists "Teachers and admins manage mock interviews" on public.career_mock_interviews;
create policy "Teachers and admins manage mock interviews"
on public.career_mock_interviews for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_mock_interviews.teacher_id = auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_mock_interviews.teacher_id = auth.uid()))
  )
);

drop policy if exists "Students can read own roadmaps" on public.career_roadmaps;
create policy "Students can read own roadmaps"
on public.career_roadmaps for select
using (auth.uid() = student_id);

drop policy if exists "Students can create own roadmaps" on public.career_roadmaps;
create policy "Students can create own roadmaps"
on public.career_roadmaps for insert
to authenticated
with check (
  auth.uid() = student_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
  )
);

drop policy if exists "Teachers and admins manage roadmaps" on public.career_roadmaps;
create policy "Teachers and admins manage roadmaps"
on public.career_roadmaps for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_roadmaps.teacher_id = auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_roadmaps.teacher_id = auth.uid()))
  )
);

drop policy if exists "Students can manage own career goals" on public.career_goals;
create policy "Students can manage own career goals"
on public.career_goals for all
to authenticated
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

drop policy if exists "Teachers and admins read career goals" on public.career_goals;
create policy "Teachers and admins read career goals"
on public.career_goals for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_goals.teacher_id = auth.uid()))
  )
);

drop policy if exists "Students can read own profile reviews" on public.career_profile_reviews;
create policy "Students can read own profile reviews"
on public.career_profile_reviews for select
using (auth.uid() = student_id);

drop policy if exists "Students can create own profile reviews" on public.career_profile_reviews;
create policy "Students can create own profile reviews"
on public.career_profile_reviews for insert
to authenticated
with check (
  auth.uid() = student_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
  )
);

drop policy if exists "Teachers and admins manage profile reviews" on public.career_profile_reviews;
create policy "Teachers and admins manage profile reviews"
on public.career_profile_reviews for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_profile_reviews.teacher_id = auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_profile_reviews.teacher_id = auth.uid()))
  )
);

drop policy if exists "Students can read own career tasks" on public.career_tasks;
create policy "Students can read own career tasks"
on public.career_tasks for select
to authenticated
using (auth.uid() = student_id);

drop policy if exists "Students can complete own career tasks" on public.career_tasks;
create policy "Students can complete own career tasks"
on public.career_tasks for update
to authenticated
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

drop policy if exists "Teachers and admins manage career tasks" on public.career_tasks;
create policy "Teachers and admins manage career tasks"
on public.career_tasks for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_tasks.teacher_id = auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'teacher' and career_tasks.teacher_id = auth.uid()))
  )
);

do $$
begin
  if to_regclass('public.admin_notifications') is not null then
    execute 'alter table public.admin_notifications enable row level security';
    execute 'drop policy if exists "Authenticated users can create app notifications" on public.admin_notifications';
    execute 'create policy "Authenticated users can create app notifications" on public.admin_notifications for insert to authenticated with check (true)';
  end if;
end $$;
