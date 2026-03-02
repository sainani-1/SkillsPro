-- Fix certificate blocking and avatar visibility for authenticated/admin users.

alter table if exists public.certificates enable row level security;

drop policy if exists "Users and admins can read certificates" on public.certificates;
create policy "Users and admins can read certificates"
on public.certificates
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Users and admins can insert certificates" on public.certificates;
create policy "Users and admins can insert certificates"
on public.certificates
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can update certificates" on public.certificates;
create policy "Admins can update certificates"
on public.certificates
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can delete certificates" on public.certificates;
create policy "Admins can delete certificates"
on public.certificates
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Avatar storage policies.
drop policy if exists "Authenticated can read avatars" on storage.objects;
create policy "Authenticated can read avatars"
on storage.objects
for select
to authenticated
using (bucket_id = 'avatars');

drop policy if exists "Users and admins can upload avatars" on storage.objects;
create policy "Users and admins can upload avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (
    name like auth.uid()::text || '.%'
    or name like 'avatars/' || auth.uid()::text || '.%'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

drop policy if exists "Users and admins can update avatars" on storage.objects;
create policy "Users and admins can update avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (
    name like auth.uid()::text || '.%'
    or name like 'avatars/' || auth.uid()::text || '.%'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
)
with check (
  bucket_id = 'avatars'
  and (
    name like auth.uid()::text || '.%'
    or name like 'avatars/' || auth.uid()::text || '.%'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

drop policy if exists "Users and admins can delete avatars" on storage.objects;
create policy "Users and admins can delete avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (
    name like auth.uid()::text || '.%'
    or name like 'avatars/' || auth.uid()::text || '.%'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);
