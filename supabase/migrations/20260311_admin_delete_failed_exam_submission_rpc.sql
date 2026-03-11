create or replace function public.admin_delete_failed_exam_submission(
  target_submission_id bigint,
  target_user_id uuid,
  target_course_id bigint default null
)
returns table (
  deleted_submissions integer,
  deleted_overrides integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select role
  into caller_role
  from public.profiles
  where id = auth.uid();

  if caller_role not in ('admin', 'teacher') then
    raise exception 'Only admins or teachers can delete failed exam records.';
  end if;

  delete from public.exam_submissions
  where id = target_submission_id
    and user_id = target_user_id;
  get diagnostics deleted_submissions = row_count;

  deleted_overrides := 0;
  if target_course_id is not null and to_regclass('public.exam_retake_overrides') is not null then
    delete from public.exam_retake_overrides
    where user_id = target_user_id
      and course_id = target_course_id;
    get diagnostics deleted_overrides = row_count;
  end if;

  return query select deleted_submissions, deleted_overrides;
end;
$$;

revoke all on function public.admin_delete_failed_exam_submission(bigint, uuid, bigint) from public;
grant execute on function public.admin_delete_failed_exam_submission(bigint, uuid, bigint) to authenticated;
