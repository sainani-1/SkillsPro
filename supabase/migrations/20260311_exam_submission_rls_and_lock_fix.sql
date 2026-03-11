alter table if exists public.exam_submissions enable row level security;

drop policy if exists "Students can read own exam submissions" on public.exam_submissions;
create policy "Students can read own exam submissions"
on public.exam_submissions
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
);

drop policy if exists "Students can insert own exam submissions" on public.exam_submissions;
create policy "Students can insert own exam submissions"
on public.exam_submissions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Students can update own exam submissions" on public.exam_submissions;
create policy "Students can update own exam submissions"
on public.exam_submissions
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
);
