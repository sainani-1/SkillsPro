alter table if exists public.chat_groups enable row level security;
alter table if exists public.chat_members enable row level security;
alter table if exists public.chat_messages enable row level security;

drop policy if exists "Admins can read chat groups" on public.chat_groups;
create policy "Admins can read chat groups"
on public.chat_groups
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

drop policy if exists "Admins can read chat members" on public.chat_members;
create policy "Admins can read chat members"
on public.chat_members
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

drop policy if exists "Admins can read chat messages" on public.chat_messages;
create policy "Admins can read chat messages"
on public.chat_messages
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

drop policy if exists "Admins can insert chat messages" on public.chat_messages;
create policy "Admins can insert chat messages"
on public.chat_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
