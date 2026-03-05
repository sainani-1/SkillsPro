-- Support teacher custom test naming/no-certificate and
-- block suspicious users per-exam until questions are updated.

alter table if exists public.exams
  add column if not exists test_name text,
  add column if not exists generate_certificate boolean not null default true,
  add column if not exists question_set_updated_at timestamptz not null default now();

create table if not exists public.exam_attempt_blocks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_id bigint not null references public.exams(id) on delete cascade,
  unblock_after_question_update_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
   not null default now(),
  unique (user_id, exam_id)
);

alter table if exists public.exam_attempt_blocks enable row level security;

drop policy if exists "Users can read own exam blocks" on public.exam_attempt_blocks;
create policy "Users can read own exam blocks"
on public.exam_attempt_blocks
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
);

drop policy if exists "Users can upsert own exam blocks" on public.exam_attempt_blocks;
create policy "Users can upsert own exam blocks"
on public.exam_attempt_blocks
for insert
to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists "Users can update own exam blocks" on public.exam_attempt_blocks;
create policy "Users can update own exam blocks"
on public.exam_attempt_blocks
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
