alter table if exists public.class_attendance
  add column if not exists join_time timestamptz,
  add column if not exists leave_time timestamptz,
  add column if not exists live_minutes integer not null default 0,
  add column if not exists attendance_source text not null default 'manual';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_attendance_source_check'
  ) then
    alter table public.class_attendance
      add constraint class_attendance_source_check
      check (attendance_source in ('manual', 'livekit', 'jitsi', 'external'));
  end if;
end $$;

create table if not exists public.class_session_live_polls (
  id uuid primary key default gen_random_uuid(),
  session_id bigint not null references public.class_sessions(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  allow_multiple boolean not null default false,
  status text not null default 'live',
  correct_option_index integer,
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_session_live_polls_status_check'
  ) then
    alter table public.class_session_live_polls
      add constraint class_session_live_polls_status_check
      check (status in ('draft', 'live', 'closed'));
  end if;
end $$;

create index if not exists class_session_live_polls_session_id_idx
  on public.class_session_live_polls(session_id, created_at desc);

create table if not exists public.class_session_live_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.class_session_live_polls(id) on delete cascade,
  session_id bigint not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_index integer not null,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id, option_index)
);

create index if not exists class_session_live_poll_votes_poll_id_idx
  on public.class_session_live_poll_votes(poll_id, created_at desc);

create index if not exists class_session_live_poll_votes_session_id_idx
  on public.class_session_live_poll_votes(session_id, created_at desc);

create table if not exists public.class_session_live_questions (
  id uuid primary key default gen_random_uuid(),
  session_id bigint not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  status text not null default 'open',
  is_pinned boolean not null default false,
  answer_text text,
  answered_by uuid references public.profiles(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_session_live_questions_status_check'
  ) then
    alter table public.class_session_live_questions
      add constraint class_session_live_questions_status_check
      check (status in ('open', 'answered', 'dismissed'));
  end if;
end $$;

create index if not exists class_session_live_questions_session_id_idx
  on public.class_session_live_questions(session_id, is_pinned desc, created_at desc);

create table if not exists public.class_session_live_question_votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.class_session_live_questions(id) on delete cascade,
  session_id bigint not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create index if not exists class_session_live_question_votes_question_id_idx
  on public.class_session_live_question_votes(question_id, created_at desc);

create index if not exists class_session_live_question_votes_session_id_idx
  on public.class_session_live_question_votes(session_id, created_at desc);

alter table if exists public.class_session_live_polls enable row level security;
alter table if exists public.class_session_live_poll_votes enable row level security;
alter table if exists public.class_session_live_questions enable row level security;
alter table if exists public.class_session_live_question_votes enable row level security;

drop policy if exists "Class live polls visible to session members" on public.class_session_live_polls;
create policy "Class live polls visible to session members"
on public.class_session_live_polls
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_polls.session_id
      and (
        cs.teacher_id = auth.uid()
        or exists (
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

drop policy if exists "Teachers and admins manage class live polls" on public.class_session_live_polls;
create policy "Teachers and admins manage class live polls"
on public.class_session_live_polls
for all
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_polls.session_id
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
)
with check (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_polls.session_id
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

drop policy if exists "Class live poll votes visible to session members" on public.class_session_live_poll_votes;
create policy "Class live poll votes visible to session members"
on public.class_session_live_poll_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_poll_votes.session_id
      and (
        cs.teacher_id = auth.uid()
        or exists (
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

drop policy if exists "Session members can vote in class live polls" on public.class_session_live_poll_votes;
create policy "Session members can vote in class live polls"
on public.class_session_live_poll_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_poll_votes.session_id
      and (
        cs.teacher_id = auth.uid()
        or exists (
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

drop policy if exists "Users can retract their poll votes" on public.class_session_live_poll_votes;
create policy "Users can retract their poll votes"
on public.class_session_live_poll_votes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Class live questions visible to session members" on public.class_session_live_questions;
create policy "Class live questions visible to session members"
on public.class_session_live_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_questions.session_id
      and (
        cs.teacher_id = auth.uid()
        or exists (
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

drop policy if exists "Session members can ask class live questions" on public.class_session_live_questions;
create policy "Session members can ask class live questions"
on public.class_session_live_questions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_questions.session_id
      and (
        cs.teacher_id = auth.uid()
        or exists (
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

drop policy if exists "Authors can edit their own open live questions" on public.class_session_live_questions;
create policy "Authors can edit their own open live questions"
on public.class_session_live_questions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Teachers and admins moderate class live questions" on public.class_session_live_questions;
create policy "Teachers and admins moderate class live questions"
on public.class_session_live_questions
for update
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_questions.session_id
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
)
with check (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_questions.session_id
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

drop policy if exists "Teachers admins and authors can delete class live questions" on public.class_session_live_questions;
create policy "Teachers admins and authors can delete class live questions"
on public.class_session_live_questions
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_questions.session_id
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

drop policy if exists "Class live question votes visible to session members" on public.class_session_live_question_votes;
create policy "Class live question votes visible to session members"
on public.class_session_live_question_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_question_votes.session_id
      and (
        cs.teacher_id = auth.uid()
        or exists (
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

drop policy if exists "Session members can vote on class live questions" on public.class_session_live_question_votes;
create policy "Session members can vote on class live questions"
on public.class_session_live_question_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_question_votes.session_id
      and (
        cs.teacher_id = auth.uid()
        or exists (
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

drop policy if exists "Users can retract their class live question votes" on public.class_session_live_question_votes;
create policy "Users can retract their class live question votes"
on public.class_session_live_question_votes
for delete
to authenticated
using (user_id = auth.uid());
