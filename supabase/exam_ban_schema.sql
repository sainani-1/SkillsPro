alter table public.profiles
  add column if not exists is_exam_banned boolean not null default false,
  add column if not exists exam_ban_reason text,
  add column if not exists exam_banned_at timestamptz,
  add column if not exists exam_banned_by uuid references public.profiles(id) on delete set null;
