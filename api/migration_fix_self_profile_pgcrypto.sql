-- Fix update_my_profile when pgcrypto functions are installed in the extensions schema.
-- Run this once in the Supabase SQL Editor after migration_self_profile.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_id_number TEXT,
  p_username TEXT,
  p_email TEXT,
  p_role TEXT,
  p_first_name TEXT,
  p_middle_initial TEXT,
  p_last_name TEXT,
  p_suffix TEXT,
  p_birthdate DATE,
  p_age INT,
  p_sex TEXT,
  p_position TEXT,
  p_password TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE auth.users
  SET email = p_email,
      encrypted_password = CASE
        WHEN p_password IS NULL OR p_password = '' THEN encrypted_password
        ELSE extensions.crypt(p_password, extensions.gen_salt('bf'))
      END
  WHERE id = auth.uid();

  UPDATE public.users
  SET id_number = p_id_number,
      username = p_username,
      email = p_email
  WHERE id = auth.uid();

  UPDATE public.profiles
  SET first_name = p_first_name,
      middle_initial = NULLIF(p_middle_initial, ''),
      last_name = p_last_name,
      suffix = NULLIF(p_suffix, ''),
      birthdate = p_birthdate,
      age = p_age,
      sex = p_sex,
      position = NULLIF(p_position, '')
  WHERE user_id = auth.uid();

  RETURN TRUE;
END;
$$;
