alter table public.course_protected_assets
add column if not exists notes_urls jsonb not null default '[]'::jsonb;

update public.course_protected_assets
set notes_urls = case
  when jsonb_typeof(notes_urls) = 'array' and jsonb_array_length(notes_urls) > 0 then notes_urls
  when nullif(btrim(coalesce(notes_url, '')), '') is not null then jsonb_build_array(nullif(btrim(notes_url), ''))
  else '[]'::jsonb
end;

alter table public.course_protected_assets
drop constraint if exists course_protected_assets_has_content;

alter table public.course_protected_assets
add constraint course_protected_assets_has_content check (
  nullif(btrim(coalesce(video_url, '')), '') is not null
  or nullif(btrim(coalesce(notes_url, '')), '') is not null
  or (jsonb_typeof(notes_urls) = 'array' and jsonb_array_length(notes_urls) > 0)
);
