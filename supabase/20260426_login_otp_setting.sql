insert into public.settings (key, value)
values ('login_email_otp_enabled', 'true')
on conflict (key) do nothing;
