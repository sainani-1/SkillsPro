-- Add configurable meeting-link active-until time for guidance sessions.
alter table if exists public.guidance_sessions
add column if not exists link_active_until timestamptz;

-- Backfill existing rows with a sensible default window (1 hour from start).
update public.guidance_sessions
set link_active_until = coalesce(link_active_until, scheduled_for + interval '1 hour')
where scheduled_for is not null;
