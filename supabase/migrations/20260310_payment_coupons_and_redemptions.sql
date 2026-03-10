create extension if not exists pgcrypto;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_code text not null default 'premium_6months',
  gateway text not null default 'razorpay',
  gateway_order_id text,
  gateway_payment_id text,
  gateway_signature text,
  gateway_ref text,
  status text not null default 'created' check (status in ('created', 'success', 'failed')),
  base_amount numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  final_amount numeric(10,2) not null default 0,
  amount numeric(10,2) not null default 0,
  currency text not null default 'INR',
  coupon_offer_id bigint references public.offers(id) on delete set null,
  coupon_code text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  valid_until timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.payments
  add column if not exists plan_code text not null default 'premium_6months',
  add column if not exists gateway text not null default 'razorpay',
  add column if not exists gateway_order_id text,
  add column if not exists gateway_payment_id text,
  add column if not exists gateway_signature text,
  add column if not exists gateway_ref text,
  add column if not exists base_amount numeric(10,2) not null default 0,
  add column if not exists discount_amount numeric(10,2) not null default 0,
  add column if not exists final_amount numeric(10,2) not null default 0,
  add column if not exists amount numeric(10,2) not null default 0,
  add column if not exists currency text not null default 'INR',
  add column if not exists coupon_offer_id bigint references public.offers(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists failure_reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.payments
set
  base_amount = coalesce(nullif(base_amount, 0), amount, 0),
  final_amount = coalesce(nullif(final_amount, 0), amount, 0),
  amount = coalesce(amount, final_amount, base_amount, 0),
  updated_at = timezone('utc', now())
where true;

create table if not exists public.offer_redemptions (
  id uuid primary key default gen_random_uuid(),
  offer_id bigint not null references public.offers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_id bigint references public.payments(id) on delete set null,
  status text not null default 'redeemed' check (status in ('redeemed', 'failed')),
  discount_amount numeric(10,2) not null default 0,
  final_amount numeric(10,2) not null default 0,
  redeemed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (offer_id, user_id)
);

create index if not exists idx_payments_user_created_at
  on public.payments(user_id, created_at desc);

create index if not exists idx_payments_status_created_at
  on public.payments(status, created_at desc);

create index if not exists idx_offer_redemptions_user_redeemed_at
  on public.offer_redemptions(user_id, redeemed_at desc);

alter table if exists public.payments enable row level security;
alter table if exists public.offer_redemptions enable row level security;

drop policy if exists "Users can read own payments" on public.payments;
create policy "Users can read own payments"
on public.payments
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all payments" on public.payments;
create policy "Admins can read all payments"
on public.payments
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Users can read own offer redemptions" on public.offer_redemptions;
create policy "Users can read own offer redemptions"
on public.offer_redemptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all offer redemptions" on public.offer_redemptions;
create policy "Admins can read all offer redemptions"
on public.offer_redemptions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
