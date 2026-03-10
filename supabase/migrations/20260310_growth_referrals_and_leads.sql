create extension if not exists pgcrypto;

create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid references public.profiles(id) on delete cascade,
  referred_email text,
  referral_code text not null,
  status text not null default 'joined' check (status in ('joined', 'qualified', 'rewarded')),
  reward_type text not null default 'premium_days' check (reward_type in ('premium_days', 'coupon_credit')),
  reward_days integer not null default 7,
  qualified_payment_id bigint references public.payments(id) on delete set null,
  rewarded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (referrer_user_id, referred_user_id)
);

create index if not exists idx_referrals_referrer_status
  on public.referrals(referrer_user_id, status, created_at desc);

create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  phone text,
  interest_type text not null check (interest_type in ('sample_test', 'resume_template', 'certificate_verify', 'campus_ambassador', 'premium_interest')),
  source text not null default 'home_page',
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_marketing_leads_created
  on public.marketing_leads(created_at desc);

alter table if exists public.referral_codes enable row level security;
alter table if exists public.referrals enable row level security;
alter table if exists public.marketing_leads enable row level security;

drop policy if exists "Users can read own referral code" on public.referral_codes;
create policy "Users can read own referral code"
on public.referral_codes
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own referral code" on public.referral_codes;
create policy "Users can insert own referral code"
on public.referral_codes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own referral code" on public.referral_codes;
create policy "Users can update own referral code"
on public.referral_codes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Admins can read all referral codes" on public.referral_codes;
create policy "Admins can read all referral codes"
on public.referral_codes
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Users can read own referrals and admins read all" on public.referrals;
create policy "Users can read own referrals and admins read all"
on public.referrals
for select
to authenticated
using (
  referrer_user_id = auth.uid()
  or referred_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Users can insert own referrals as referred user" on public.referrals;
create policy "Users can insert own referrals as referred user"
on public.referrals
for insert
to authenticated
with check (
  referred_user_id = auth.uid()
  and referrer_user_id <> auth.uid()
);

drop policy if exists "Admins can update referrals" on public.referrals;
create policy "Admins can update referrals"
on public.referrals
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Anyone can submit marketing leads" on public.marketing_leads;
create policy "Anyone can submit marketing leads"
on public.marketing_leads
for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins can read marketing leads" on public.marketing_leads;
create policy "Admins can read marketing leads"
on public.marketing_leads
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
