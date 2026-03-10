alter table if exists public.marketing_leads
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'responded', 'closed')),
  add column if not exists admin_response text,
  add column if not exists responded_at timestamptz,
  add column if not exists responded_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists idx_marketing_leads_status_created
  on public.marketing_leads(status, created_at desc);

drop policy if exists "Admins can update marketing leads" on public.marketing_leads;
create policy "Admins can update marketing leads"
on public.marketing_leads
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
