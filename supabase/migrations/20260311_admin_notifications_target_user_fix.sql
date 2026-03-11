alter table if exists public.admin_notifications
  add column if not exists target_user_id uuid references public.profiles(id) on delete cascade;

create index if not exists idx_admin_notifications_target_user_id
  on public.admin_notifications(target_user_id);
