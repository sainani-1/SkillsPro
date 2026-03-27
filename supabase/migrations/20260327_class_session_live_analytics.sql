create table if not exists public.class_session_live_activity_events (
  id uuid primary key default gen_random_uuid(),
  session_id bigint not null references public.class_sessions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_session_live_activity_events_type_check'
  ) then
    alter table public.class_session_live_activity_events
      add constraint class_session_live_activity_events_type_check
      check (
        event_type in (
          'join',
          'leave',
          'speaking_start',
          'speaking_stop',
          'chat_message',
          'private_message',
          'reaction',
          'raise_hand',
          'lower_hand',
          'screen_share_start',
          'screen_share_stop',
          'focus_lost',
          'focus_restored',
          'recording_started',
          'recording_stopped'
        )
      );
  end if;
end $$;

create index if not exists class_session_live_activity_events_session_created_idx
  on public.class_session_live_activity_events(session_id, created_at desc);

create index if not exists class_session_live_activity_events_user_created_idx
  on public.class_session_live_activity_events(user_id, created_at desc);

create table if not exists public.class_session_live_participant_stats (
  id uuid primary key default gen_random_uuid(),
  session_id bigint not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz,
  last_seen_at timestamptz,
  left_at timestamptz,
  speaking_seconds integer not null default 0,
  screen_share_seconds integer not null default 0,
  hand_raise_count integer not null default 0,
  chat_messages_count integer not null default 0,
  private_messages_count integer not null default 0,
  reactions_count integer not null default 0,
  focus_loss_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index if not exists class_session_live_participant_stats_session_idx
  on public.class_session_live_participant_stats(session_id, updated_at desc);

create table if not exists public.class_session_recordings (
  id uuid primary key default gen_random_uuid(),
  session_id bigint not null references public.class_sessions(id) on delete cascade,
  started_by uuid not null references public.profiles(id) on delete cascade,
  stopped_by uuid references public.profiles(id) on delete set null,
  status text not null default 'idle',
  recording_mode text not null default 'session-log',
  started_at timestamptz,
  stopped_at timestamptz,
  storage_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_session_recordings_status_check'
  ) then
    alter table public.class_session_recordings
      add constraint class_session_recordings_status_check
      check (status in ('idle', 'recording', 'completed'));
  end if;
end $$;

create index if not exists class_session_recordings_session_idx
  on public.class_session_recordings(session_id, created_at desc);

alter table if exists public.class_session_live_activity_events enable row level security;
alter table if exists public.class_session_live_participant_stats enable row level security;
alter table if exists public.class_session_recordings enable row level security;

drop policy if exists "Class live activity visible to session staff" on public.class_session_live_activity_events;
create policy "Class live activity visible to session staff"
on public.class_session_live_activity_events
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_activity_events.session_id
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

drop policy if exists "Session members can insert their live activity" on public.class_session_live_activity_events;
create policy "Session members can insert their live activity"
on public.class_session_live_activity_events
for insert
to authenticated
with check (
  (user_id is null or user_id = auth.uid())
  and exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_activity_events.session_id
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

drop policy if exists "Class participant stats visible to session staff" on public.class_session_live_participant_stats;
create policy "Class participant stats visible to session staff"
on public.class_session_live_participant_stats
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_live_participant_stats.session_id
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

drop policy if exists "Users can read own class participant stats" on public.class_session_live_participant_stats;
create policy "Users can read own class participant stats"
on public.class_session_live_participant_stats
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Session members can upsert own class participant stats" on public.class_session_live_participant_stats;
create policy "Session members can upsert own class participant stats"
on public.class_session_live_participant_stats
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Class recordings visible to session staff" on public.class_session_recordings;
create policy "Class recordings visible to session staff"
on public.class_session_recordings
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_recordings.session_id
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

drop policy if exists "Teachers and admins manage class recordings" on public.class_session_recordings;
create policy "Teachers and admins manage class recordings"
on public.class_session_recordings
for all
to authenticated
using (
  exists (
    select 1
    from public.class_sessions cs
    where cs.id = class_session_recordings.session_id
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
    where cs.id = class_session_recordings.session_id
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
