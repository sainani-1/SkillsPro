-- Create gifts table for coupons/offers
create table if not exists gifts (
  id bigserial primary key,
  coupon_code text not null,
  discount_type text not null, -- 'percent' or 'flat'
  discount_value numeric not null,
  valid_until timestamptz not null,
  sent_by uuid references profiles(id),
  sent_to uuid references profiles(id),
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table gifts enable row level security;

-- Allow admins to insert gifts
create policy "admin_insert_gifts" on gifts
  for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Allow admins to select all gifts
create policy "admin_select_all_gifts" on gifts
  for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Allow users to select gifts sent to them
create policy "user_select_own_gifts" on gifts
  for select
  using (sent_to = auth.uid());

-- Allow admins to delete any gift
create policy "admin_delete_gifts" on gifts
  for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
