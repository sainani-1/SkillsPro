-- Add targeted delivery fields for class schedule alerts.

alter table if exists public.admin_notifications
  add column if not exists target_user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists class_session_id uuid references public.class_sessions(id) on delete set null;

create index if not exists idx_admin_notifications_target_user_id
  on public.admin_notifications(target_user_id);

create index if not exists idx_admin_notifications_class_session_id
  on public.admin_notifications(class_session_id);
