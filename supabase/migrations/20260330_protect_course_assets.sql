create table if not exists public.course_protected_assets (
  course_id bigint primary key references public.courses(id) on delete cascade,
  video_url text,
  notes_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_protected_assets_has_content check (
    nullif(btrim(coalesce(video_url, '')), '') is not null
    or nullif(btrim(coalesce(notes_url, '')), '') is not null
  )
);

create or replace function public.touch_course_protected_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_course_protected_assets_updated_at on public.course_protected_assets;
create trigger trg_course_protected_assets_updated_at
before update on public.course_protected_assets
for each row
execute function public.touch_course_protected_assets_updated_at();

alter table public.course_protected_assets enable row level security;

drop policy if exists "Admins and teachers can read protected course assets" on public.course_protected_assets;
create policy "Admins and teachers can read protected course assets"
on public.course_protected_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
);

drop policy if exists "Premium enrolled students can read protected course assets" on public.course_protected_assets;
create policy "Premium enrolled students can read protected course assets"
on public.course_protected_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'student'
      and p.premium_until is not null
      and p.premium_until > now()
  )
  and exists (
    select 1
    from public.enrollments e
    where e.course_id = course_protected_assets.course_id
      and e.student_id = auth.uid()
  )
);

drop policy if exists "Admins can insert protected course assets" on public.course_protected_assets;
create policy "Admins can insert protected course assets"
on public.course_protected_assets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Admins can update protected course assets" on public.course_protected_assets;
create policy "Admins can update protected course assets"
on public.course_protected_assets
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Admins can delete protected course assets" on public.course_protected_assets;
create policy "Admins can delete protected course assets"
on public.course_protected_assets
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

insert into public.course_protected_assets (course_id, video_url, notes_url)
select
  c.id,
  nullif(btrim(c.video_url), ''),
  nullif(btrim(c.notes_url), '')
from public.courses c
where nullif(btrim(coalesce(c.video_url, '')), '') is not null
   or nullif(btrim(coalesce(c.notes_url, '')), '') is not null
on conflict (course_id) do update
set
  video_url = excluded.video_url,
  notes_url = excluded.notes_url,
  updated_at = now();

update public.courses
set
  video_url = null,
  notes_url = null
where nullif(btrim(coalesce(video_url, '')), '') is not null
   or nullif(btrim(coalesce(notes_url, '')), '') is not null;
