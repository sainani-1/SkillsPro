-- Allow admins to insert startup collaborations directly

drop policy if exists "Users can create own collaboration request" on public.startup_collaborations;
create policy "Users can create own collaboration request"
on public.startup_collaborations
for insert
to authenticated
with check (
  requester_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

