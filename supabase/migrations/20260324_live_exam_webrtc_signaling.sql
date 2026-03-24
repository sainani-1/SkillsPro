create or replace function public.can_access_exam_live_session(target_session_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_live_sessions s
    where s.id = target_session_id
      and (
        s.student_id = auth.uid()
        or public.can_invigilate_exam_live_slot(s.slot_id)
      )
  );
$$;

grant execute on function public.can_access_exam_live_session(bigint) to authenticated;

create table if not exists public.exam_live_webrtc_signals (
  id bigint generated always as identity primary key,
  slot_id bigint not null references public.exam_live_slots(id) on delete cascade,
  session_id bigint not null references public.exam_live_sessions(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  from_role text,
  to_user_id uuid references public.profiles(id) on delete cascade,
  signal_type text not null,
  stream_type text not null default 'camera',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint exam_live_webrtc_signals_signal_type_check check (signal_type in ('offer', 'answer', 'ice-candidate')),
  constraint exam_live_webrtc_signals_stream_type_check check (stream_type in ('camera', 'screen'))
);

create index if not exists exam_live_webrtc_signals_session_id_idx
  on public.exam_live_webrtc_signals(session_id, created_at desc);

create index if not exists exam_live_webrtc_signals_to_user_id_idx
  on public.exam_live_webrtc_signals(to_user_id, created_at desc);

alter table public.exam_live_webrtc_signals enable row level security;

drop policy if exists "WebRTC signals visible to session participants" on public.exam_live_webrtc_signals;
create policy "WebRTC signals visible to session participants"
on public.exam_live_webrtc_signals
for select
to authenticated
using (
  public.can_access_exam_live_session(session_id)
  and (
    from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or public.can_invigilate_exam_live_slot(slot_id)
  )
);

drop policy if exists "WebRTC signals insertable by session participants" on public.exam_live_webrtc_signals;
create policy "WebRTC signals insertable by session participants"
on public.exam_live_webrtc_signals
for insert
to authenticated
with check (
  from_user_id = auth.uid()
  and public.can_access_exam_live_session(session_id)
  and (
    to_user_id is null
    or public.can_access_exam_live_session(session_id)
  )
);
