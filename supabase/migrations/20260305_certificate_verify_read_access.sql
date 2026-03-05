-- Allow authenticated users to verify and preview any issued certificate.
-- Existing owner/admin checks remain for insert/update/delete.

alter table if exists public.certificates enable row level security;

drop policy if exists "Users and admins can read certificates" on public.certificates;
drop policy if exists "Authenticated can read certificates for verification" on public.certificates;

create policy "Authenticated can read certificates for verification"
on public.certificates
for select
to authenticated
using (true);
