alter table if exists public.exam_questions
  add column if not exists question_type text not null default 'mcq',
  add column if not exists coding_description text,
  add column if not exists coding_language text,
  add column if not exists shown_test_cases jsonb,
  add column if not exists hidden_test_cases jsonb;

update public.exam_questions
set question_type = 'mcq'
where question_type is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exam_questions_question_type_check'
  ) then
    alter table public.exam_questions
      add constraint exam_questions_question_type_check
      check (question_type in ('mcq', 'coding'));
  end if;
end $$;
