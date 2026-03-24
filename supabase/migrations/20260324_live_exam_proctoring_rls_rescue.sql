-- Emergency rescue for live exam timeouts.
-- If policy migrations keep timing out in Supabase SQL editor,
-- run these statements one by one to immediately stop recursive RLS checks.

alter table if exists public.exam_live_slots disable row level security;
alter table if exists public.exam_slot_instructors disable row level security;
alter table if exists public.exam_slot_booking_overrides disable row level security;
alter table if exists public.exam_slot_bookings disable row level security;
alter table if exists public.exam_live_sessions disable row level security;
alter table if exists public.exam_live_violations disable row level security;
alter table if exists public.exam_live_actions disable row level security;
alter table if exists public.exam_live_messages disable row level security;
