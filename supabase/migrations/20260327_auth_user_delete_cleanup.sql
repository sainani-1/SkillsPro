-- Make auth user deletion from the Supabase dashboard clean up the related profile row.
-- This prevents "Database error deleting user" when public.profiles.auth_user_id
-- has a restrictive FK to auth.users or when profile rows are left behind.

do $$
declare
  existing_auth_user_fk_name text;
  existing_profile_id_fk_name text;
  existing_assigned_teacher_fk_name text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'assigned_teacher_id'
  ) then
    select con.conname
      into existing_assigned_teacher_fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = any (con.conkey)
    where con.contype = 'f'
      and nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and att.attname = 'assigned_teacher_id'
      and con.confrelid = 'public.profiles'::regclass
    limit 1;

    if existing_assigned_teacher_fk_name is not null then
      execute format('alter table public.profiles drop constraint %I', existing_assigned_teacher_fk_name);
    end if;

    alter table public.profiles
      add constraint profiles_assigned_teacher_id_fkey
      foreign key (assigned_teacher_id)
      references public.profiles(id)
      on delete set null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) then
    select con.conname
      into existing_profile_id_fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = any (con.conkey)
    where con.contype = 'f'
      and nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and att.attname = 'id'
      and con.confrelid = 'auth.users'::regclass
    limit 1;

    if existing_profile_id_fk_name is not null then
      execute format('alter table public.profiles drop constraint %I', existing_profile_id_fk_name);
    end if;

    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id)
      references auth.users(id)
      on delete cascade;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'auth_user_id'
  ) then
    select con.conname
      into existing_auth_user_fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = any (con.conkey)
    where con.contype = 'f'
      and nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and att.attname = 'auth_user_id'
      and con.confrelid = 'auth.users'::regclass
    limit 1;

    if existing_auth_user_fk_name is not null then
      execute format('alter table public.profiles drop constraint %I', existing_auth_user_fk_name);
    end if;

    alter table public.profiles
      add constraint profiles_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

create or replace function public.ignore_missing_table_delete(sql_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute sql_text;
exception
  when undefined_table then
    null;
end;
$$;

create or replace function public.handle_auth_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
begin
  select *
    into profile_row
  from public.profiles
  where id = old.id or auth_user_id = old.id
  order by case when id = old.id then 0 else 1 end
  limit 1;

  if profile_row.id is not null then
    perform public.ignore_missing_table_delete(
      format('delete from public.teacher_assignment_requests where student_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.teacher_assignment_requests where teacher_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.teacher_assignments where student_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.teacher_assignments where teacher_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.class_session_participants where student_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.exam_submissions where user_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.certificates where user_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.notification_reads where user_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.active_user_sessions where user_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.chat_members where user_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.chat_messages where sender_id = %L::uuid', profile_row.id)
    );
    perform public.ignore_missing_table_delete(
      format('delete from public.chat_groups where created_by = %L::uuid', profile_row.id)
    );

    update public.profiles
    set assigned_teacher_id = null
    where assigned_teacher_id = profile_row.id;

    perform public.ignore_missing_table_delete(
      format(
        'update public.guidance_requests
         set assigned_to_teacher_id = null,
             assigned_at = null,
             status = case
               when status in (''assigned'', ''scheduled'') then ''pending''
               else status
             end
         where assigned_to_teacher_id = %L::uuid',
        profile_row.id
      )
    );

    if not exists (
      select 1
      from public.deleted_accounts da
      where da.user_id = profile_row.id
        and da.deleted_at >= now() - interval '5 minutes'
    ) then
      insert into public.deleted_accounts (
        user_id,
        full_name,
        email,
        role,
        phone,
        reason,
        deleted_by,
        deleted_at
      )
      values (
        profile_row.id,
        profile_row.full_name,
        profile_row.email,
        profile_row.role,
        profile_row.phone,
        'Deleted from Supabase Auth dashboard',
        null,
        now()
      );
    end if;

    delete from public.profiles
    where id = profile_row.id;
  end if;

  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted_cleanup on auth.users;
create trigger on_auth_user_deleted_cleanup
before delete on auth.users
for each row
execute function public.handle_auth_user_deleted();
