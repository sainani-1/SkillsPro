create unique index if not exists generated_certificates_one_logic_winner_per_user
on public.generated_certificates (user_id)
where award_type = 'weekly_contest_winner';
