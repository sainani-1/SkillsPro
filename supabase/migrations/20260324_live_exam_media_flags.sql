alter table public.exam_live_sessions
  add column if not exists camera_connected boolean not null default false,
  add column if not exists mic_connected boolean not null default false,
  add column if not exists screen_share_connected boolean not null default false;
