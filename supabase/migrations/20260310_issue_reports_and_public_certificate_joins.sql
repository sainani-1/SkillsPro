create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reporter_role text not null check (reporter_role in ('student', 'teacher', 'admin')),
  category text not null check (category in ('technical', 'payment', 'course', 'exam', 'chat', 'account', 'certificate', 'other')),
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_issue_reports_reporter_created
  on public.issue_reports(reporter_id, created_at desc);

create index if not exists idx_issue_reports_status_created
  on public.issue_reports(status, created_at desc);

alter table if exists public.issue_reports enable row level security;

drop policy if exists "Users can read own issue reports and admins read all" on public.issue_reports;
create policy "Users can read own issue reports and admins read all"
on public.issue_reports
for select
to authenticated
using (
  reporter_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Users can insert own issue reports" on public.issue_reports;
create policy "Users can insert own issue reports"
on public.issue_reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and reporter_role in ('student', 'teacher', 'admin')
);

drop policy if exists "Admins can update issue reports" on public.issue_reports;
create policy "Admins can update issue reports"
on public.issue_reports
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Anonymous can read certificate holders for verification" on public.profiles;
create policy "Anonymous can read certificate holders for verification"
on public.profiles
for select
to anon
using (
  exists (
    select 1
    from public.certificates c
    where c.user_id = profiles.id
  )
);

drop policy if exists "Anonymous can read certificate courses for verification" on public.courses;
create policy "Anonymous can read certificate courses for verification"
on public.courses
for select
to anon
using (
  exists (
    select 1
    from public.certificates c
    where c.course_id = courses.id
  )
);
