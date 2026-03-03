-- Add profile fields to enforce legal acceptance + phone OTP verification + Google onboarding completion.
alter table if exists public.profiles
  add column if not exists terms_accepted boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists auth_provider text,
  add column if not exists google_profile_completed boolean not null default false;

create index if not exists idx_profiles_phone_verified on public.profiles(phone_verified);
create index if not exists idx_profiles_terms_accepted on public.profiles(terms_accepted);
