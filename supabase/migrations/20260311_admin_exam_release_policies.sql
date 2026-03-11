alter table if exists public.exam_attempt_blocks enable row level security;

drop policy if exists "Admins can delete exam blocks" on public.exam_attempt_blocks;
create policy "Admins can delete exam blocks"
on public.exam_attempt_blocks
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
);

drop policy if exists "Admins can insert exam blocks" on public.exam_attempt_blocks;
create policy "Admins can insert exam blocks"
on public.exam_attempt_blocks
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
);

drop policy if exists "Admins can update exam blocks" on public.exam_attempt_blocks;
create policy "Admins can update exam blocks"
on public.exam_attempt_blocks
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
);

do $$
begin
  if to_regclass('public.exam_retake_overrides') is not null then
    execute 'alter table public.exam_retake_overrides enable row level security';

    execute 'drop policy if exists "Admins can read exam retake overrides" on public.exam_retake_overrides';
    execute $policy$
      create policy "Admins can read exam retake overrides"
      on public.exam_retake_overrides
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'teacher')
        )
      )
    $policy$;

    execute 'drop policy if exists "Admins can insert exam retake overrides" on public.exam_retake_overrides';
    execute $policy$
      create policy "Admins can insert exam retake overrides"
      on public.exam_retake_overrides
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'teacher')
        )
      )
    $policy$;

    execute 'drop policy if exists "Admins can update exam retake overrides" on public.exam_retake_overrides';
    execute $policy$
      create policy "Admins can update exam retake overrides"
      on public.exam_retake_overrides
      for update
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'teacher')
        )
      )
      with check (
        user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'teacher')
        )
      )
    $policy$;

    execute 'drop policy if exists "Admins can delete exam retake overrides" on public.exam_retake_overrides';
    execute $policy$
      create policy "Admins can delete exam retake overrides"
      on public.exam_retake_overrides
      for delete
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'teacher')
        )
      )
    $policy$;
  end if;
end $$;
