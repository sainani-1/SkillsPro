create table if not exists public.class_session_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id bigint not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null,
  feedback_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_session_feedback_rating_check'
  ) then
    alter table public.class_session_feedback
      add constraint class_session_feedback_rating_check
      check (rating between 1 and 5);
  end if;
end $$;

create index if not exists class_session_feedback_session_idx
  on public.class_session_feedback(session_id, created_at desc);

create index if not exists class_session_feedback_student_idx
  on public.class_session_feedback(student_id, created_at desc);

alter table if exists public.class_session_feedback enable row level security;

drop policy if exists "Students read own class feedback" on public.class_session_feedback;
create policy "Students read own class feedback"
on public.class_session_feedback
for select
to authenticated
using (student_id = auth.uid());

drop policy if exists "Students upsert own class feedback" on public.class_session_feedback;
create policy "Students upsert own class feedback"
on public.class_session_feedback
for all
to authenticated
using (student_id = auth.uid())
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_feedback.session_id
      and (
        exists (
          select 1
          from public.class_session_participants csp
          where csp.session_id = cs.id
            and csp.student_id = auth.uid()
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
  )
);

drop policy if exists "Teachers and admins read class feedback" on public.class_session_feedback;
create policy "Teachers and admins read class feedback"
on public.class_session_feedback
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_feedback.session_id
      and (
        cs.teacher_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
  )
);
