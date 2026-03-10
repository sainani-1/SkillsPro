alter table if exists public.certificates enable row level security;

drop policy if exists "Anonymous can read certificates for public verification" on public.certificates;
create policy "Anonymous can read certificates for public verification"
on public.certificates
for select
to anon
using (true);
