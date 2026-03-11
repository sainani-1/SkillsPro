create table if not exists public.learning_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (char_length(trim(event_type)) > 0),
  points_awarded integer not null default 0,
  duration_minutes integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  occurred_on date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.coding_playground_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  language text not null,
  source_code text not null,
  stdin text,
  stdout text,
  stderr text,
  compile_output text,
  status text,
  execution_time text,
  memory text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.discussion_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  upvotes_count integer not null default 0,
  answers_count integer not null default 0,
  best_answer_id uuid,
  last_activity_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.discussion_answers (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.discussion_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_best_answer boolean not null default false,
  upvotes_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'discussion_posts_best_answer_id_fkey'
  ) then
    alter table public.discussion_posts
      add constraint discussion_posts_best_answer_id_fkey
      foreign key (best_answer_id) references public.discussion_answers(id) on delete set null;
  end if;
end $$;

create table if not exists public.discussion_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.discussion_posts(id) on delete cascade,
  answer_id uuid references public.discussion_answers(id) on delete cascade,
  value smallint not null default 1 check (value = 1),
  created_at timestamptz not null default timezone('utc', now()),
  constraint discussion_votes_target_check check (
    ((post_id is not null)::integer + (answer_id is not null)::integer) = 1
  )
);

create unique index if not exists discussion_votes_user_post_unique
  on public.discussion_votes (user_id, post_id)
  where post_id is not null;

create unique index if not exists discussion_votes_user_answer_unique
  on public.discussion_votes (user_id, answer_id)
  where answer_id is not null;

create index if not exists learning_activity_events_user_created_at_idx
  on public.learning_activity_events (user_id, created_at desc);

create index if not exists coding_playground_runs_user_created_at_idx
  on public.coding_playground_runs (user_id, created_at desc);

create index if not exists discussion_posts_last_activity_idx
  on public.discussion_posts (last_activity_at desc);

create index if not exists discussion_posts_tags_gin_idx
  on public.discussion_posts using gin (tags);

create index if not exists discussion_answers_post_id_created_at_idx
  on public.discussion_answers (post_id, created_at asc);

create or replace function public.set_student_feature_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.refresh_discussion_post_metrics(target_post_id uuid)
returns void
language plpgsql
as $$
begin
  update public.discussion_posts p
  set
    answers_count = coalesce((
      select count(*)
      from public.discussion_answers a
      where a.post_id = target_post_id
    ), 0),
    upvotes_count = coalesce((
      select count(*)
      from public.discussion_votes v
      where v.post_id = target_post_id
    ), 0),
    last_activity_at = greatest(
      p.created_at,
      coalesce((
        select max(coalesce(a.updated_at, a.created_at))
        from public.discussion_answers a
        where a.post_id = target_post_id
      ), p.created_at),
      coalesce((
        select max(v.created_at)
        from public.discussion_votes v
        where v.post_id = target_post_id
      ), p.created_at)
    )
  where p.id = target_post_id;
end;
$$;

create or replace function public.refresh_discussion_answer_metrics(target_answer_id uuid)
returns void
language plpgsql
as $$
declare
  affected_post_id uuid;
begin
  update public.discussion_answers a
  set upvotes_count = coalesce((
    select count(*)
    from public.discussion_votes v
    where v.answer_id = target_answer_id
  ), 0)
  where a.id = target_answer_id
  returning post_id into affected_post_id;

  if affected_post_id is not null then
    perform public.refresh_discussion_post_metrics(affected_post_id);
  end if;
end;
$$;

create or replace function public.sync_discussion_best_answer_flags()
returns trigger
language plpgsql
as $$
begin
  update public.discussion_answers
  set is_best_answer = (id = new.best_answer_id)
  where post_id = new.id;

  perform public.refresh_discussion_post_metrics(new.id);
  return new;
end;
$$;

create or replace function public.handle_discussion_answer_change()
returns trigger
language plpgsql
as $$
declare
  affected_post_id uuid;
begin
  affected_post_id = coalesce(new.post_id, old.post_id);
  if affected_post_id is not null then
    perform public.refresh_discussion_post_metrics(affected_post_id);
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.handle_discussion_vote_change()
returns trigger
language plpgsql
as $$
declare
  affected_post_id uuid;
  affected_answer_id uuid;
begin
  affected_post_id = coalesce(new.post_id, old.post_id);
  affected_answer_id = coalesce(new.answer_id, old.answer_id);

  if affected_post_id is not null then
    perform public.refresh_discussion_post_metrics(affected_post_id);
  end if;

  if affected_answer_id is not null then
    perform public.refresh_discussion_answer_metrics(affected_answer_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists discussion_posts_set_updated_at on public.discussion_posts;
create trigger discussion_posts_set_updated_at
before update on public.discussion_posts
for each row execute function public.set_student_feature_updated_at();

drop trigger if exists discussion_answers_set_updated_at on public.discussion_answers;
create trigger discussion_answers_set_updated_at
before update on public.discussion_answers
for each row execute function public.set_student_feature_updated_at();

drop trigger if exists discussion_posts_sync_best_answer on public.discussion_posts;
create trigger discussion_posts_sync_best_answer
after update of best_answer_id on public.discussion_posts
for each row execute function public.sync_discussion_best_answer_flags();

drop trigger if exists discussion_answers_metrics_trigger on public.discussion_answers;
create trigger discussion_answers_metrics_trigger
after insert or update or delete on public.discussion_answers
for each row execute function public.handle_discussion_answer_change();

drop trigger if exists discussion_votes_metrics_trigger on public.discussion_votes;
create trigger discussion_votes_metrics_trigger
after insert or update or delete on public.discussion_votes
for each row execute function public.handle_discussion_vote_change();

alter table public.learning_activity_events enable row level security;
alter table public.coding_playground_runs enable row level security;
alter table public.discussion_posts enable row level security;
alter table public.discussion_answers enable row level security;
alter table public.discussion_votes enable row level security;

drop policy if exists "Users read own learning activity" on public.learning_activity_events;
create policy "Users read own learning activity"
  on public.learning_activity_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own learning activity" on public.learning_activity_events;
create policy "Users insert own learning activity"
  on public.learning_activity_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users read own coding runs" on public.coding_playground_runs;
create policy "Users read own coding runs"
  on public.coding_playground_runs
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own coding runs" on public.coding_playground_runs;
create policy "Users insert own coding runs"
  on public.coding_playground_runs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users read discussion posts" on public.discussion_posts;
create policy "Authenticated users read discussion posts"
  on public.discussion_posts
  for select
  to authenticated
  using (true);

drop policy if exists "Users create discussion posts" on public.discussion_posts;
create policy "Users create discussion posts"
  on public.discussion_posts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Owners update discussion posts" on public.discussion_posts;
create policy "Owners update discussion posts"
  on public.discussion_posts
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'teacher')
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'teacher')
    )
  );

drop policy if exists "Owners delete discussion posts" on public.discussion_posts;
create policy "Owners delete discussion posts"
  on public.discussion_posts
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'teacher')
    )
  );

drop policy if exists "Authenticated users read discussion answers" on public.discussion_answers;
create policy "Authenticated users read discussion answers"
  on public.discussion_answers
  for select
  to authenticated
  using (true);

drop policy if exists "Users create discussion answers" on public.discussion_answers;
create policy "Users create discussion answers"
  on public.discussion_answers
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Owners or moderators update discussion answers" on public.discussion_answers;
create policy "Owners or moderators update discussion answers"
  on public.discussion_answers
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.discussion_posts p
      where p.id = post_id
        and p.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'teacher')
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1
      from public.discussion_posts p
      where p.id = post_id
        and p.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'teacher')
    )
  );

drop policy if exists "Owners or moderators delete discussion answers" on public.discussion_answers;
create policy "Owners or moderators delete discussion answers"
  on public.discussion_answers
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.discussion_posts p
      where p.id = post_id
        and p.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'teacher')
    )
  );

drop policy if exists "Authenticated users read discussion votes" on public.discussion_votes;
create policy "Authenticated users read discussion votes"
  on public.discussion_votes
  for select
  to authenticated
  using (true);

drop policy if exists "Users create own discussion votes" on public.discussion_votes;
create policy "Users create own discussion votes"
  on public.discussion_votes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own discussion votes" on public.discussion_votes;
create policy "Users update own discussion votes"
  on public.discussion_votes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own discussion votes" on public.discussion_votes;
create policy "Users delete own discussion votes"
  on public.discussion_votes
  for delete
  to authenticated
  using (auth.uid() = user_id);
