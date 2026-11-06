-- Gmail SMTP setup: the current frontend uses the create-account-with-email
-- Edge Function. Sending custom username/password email requires that mailer;
-- it cannot be installed or sent using SQL Editor alone.
-- Keep migration_first_login_otp.sql and the account-management migrations.
-- Configure SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USERNAME,
-- SMTP_PASSWORD (Google App Password), and SMTP_FROM as Edge Function secrets.
-- Deploy: supabase functions deploy create-account-with-email
-- Supabase Auth's existing SMTP/OTP configuration remains unchanged.
-- Full instructions: api/SETUP_INSTRUCTIONS.md
--
-- Run this SQL to disable the OLD Resend-based RPC if it was installed.
-- It preserves accounts and Vault entries; it does not send any email.
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.create_account_with_email(text,text,text,text,text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_account_with_email(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)
      FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
