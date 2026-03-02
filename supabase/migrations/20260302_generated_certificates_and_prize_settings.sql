-- Admin-generated certificates and configurable weekly contest prize text.

create table if not exists public.generated_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  certificate_id uuid references public.certificates(id) on delete set null,
  award_type text not null check (award_type in ('course_completion', 'weekly_contest_winner', 'custom')),
  award_name text not null,
  reason text,
  course_name text,
  issued_by uuid references public.profiles(id) on delete set null,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.generated_certificates enable row level security;

drop policy if exists "Users read own generated certificates and admins read all" on public.generated_certificates;
create policy "Users read own generated certificates and admins read all"
on public.generated_certificates
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins insert generated certificates" on public.generated_certificates;
create policy "Admins insert generated certificates"
on public.generated_certificates
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins update generated certificates" on public.generated_certificates;
create policy "Admins update generated certificates"
on public.generated_certificates
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

drop policy if exists "Admins delete generated certificates" on public.generated_certificates;
create policy "Admins delete generated certificates"
on public.generated_certificates
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
