create or replace function public.admin_release_terminated_exam(
  target_user_id uuid,
  target_exam_id bigint,
  target_course_id bigint default null
)
returns table (
  removed_blocks integer,
  unlocked_profiles integer,
  override_rows integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  updated_override_count integer := 0;
begin
  select role
  into caller_role
  from public.profiles
  where id = auth.uid();

  if caller_role not in ('admin', 'teacher') then
    raise exception 'Only admins or teachers can release terminated exams.';
  end if;

  delete from public.exam_attempt_blocks
  where user_id = target_user_id
    and exam_id = target_exam_id;
  get diagnostics removed_blocks = row_count;

  update public.profiles
  set is_locked = false,
      locked_until = null
  where id = target_user_id;
  get diagnostics unlocked_profiles = row_count;

  override_rows := 0;
  if target_course_id is not null then
    update public.exam_retake_overrides
    set allow_retake_at = now()
    where user_id = target_user_id
      and course_id = target_course_id;
    get diagnostics updated_override_count = row_count;

    if updated_override_count = 0 then
      insert into public.exam_retake_overrides (user_id, course_id, allow_retake_at)
      values (target_user_id, target_course_id, now());
      get diagnostics override_rows = row_count;
    else
      override_rows := updated_override_count;
    end if;
  end if;

  return query select removed_blocks, unlocked_profiles, override_rows;
end;
$$;

revoke all on function public.admin_release_terminated_exam(uuid, bigint, bigint) from public;
grant execute on function public.admin_release_terminated_exam(uuid, bigint, bigint) to authenticated;
