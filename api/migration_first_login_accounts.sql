-- Run once in the Supabase SQL editor.
-- Superadmin-created accounts remain incomplete until their first-login profile is saved.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_registration_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_registration_status_check
  CHECK (registration_status IN ('pending', 'approved', 'blocked', 'inactive', 'incomplete'));

ALTER TABLE public.profiles ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN last_name DROP NOT NULL;

-- Multiple superadmin records are allowed. Active/inactive selection is
-- handled by the completion and login functions, not by a uniqueness rule.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS one_active_superadmin;
DROP INDEX IF EXISTS public.one_active_superadmin;

CREATE OR REPLACE FUNCTION public.create_initial_account(
  p_user_id UUID,
  p_id_number TEXT,
  p_username TEXT,
  p_email TEXT,
  p_role TEXT,
  p_position TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can create accounts';
  END IF;
  IF p_role NOT IN ('user', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  INSERT INTO public.users (id, id_number, username, email, role, registration_status)
  VALUES (p_user_id, p_id_number, p_username, p_email, p_role, 'incomplete');
  UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = p_user_id;
  INSERT INTO public.profiles (user_id, position)
  VALUES (p_user_id, NULLIF(p_position, ''));
  RETURN TRUE;
END;
$$;

-- Status changes for ordinary accounts and the single-superadmin handoff.
CREATE OR REPLACE FUNCTION public.admin_update_user_status(p_user_id UUID, p_status TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer_role TEXT; target_role TEXT; target_status TEXT;
BEGIN
  SELECT role INTO viewer_role FROM public.users WHERE id = auth.uid();
  SELECT role, registration_status INTO target_role, target_status FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF viewer_role IS NULL OR viewer_role NOT IN ('admin','superadmin') THEN RAISE EXCEPTION 'Only administrators can update status'; END IF;
  IF target_status = 'incomplete' THEN RAISE EXCEPTION 'Incomplete accounts cannot be managed'; END IF;
  IF p_status NOT IN ('approved','blocked','inactive') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF target_role = 'superadmin' THEN
    IF viewer_role <> 'superadmin' OR target_status = 'approved' OR p_user_id = auth.uid() THEN
      RAISE EXCEPTION 'Only the active superadmin can replace another superadmin';
    END IF;
    IF p_status = 'approved' THEN
      UPDATE public.users SET registration_status = 'inactive', is_locked_out = FALSE WHERE id = p_user_id;
    ELSE
      UPDATE public.users SET registration_status = p_status, is_locked_out = (p_status <> 'approved') WHERE id = p_user_id;
    END IF;
  ELSE
    UPDATE public.users SET registration_status = p_status, is_locked_out = (p_status <> 'approved') WHERE id = p_user_id;
  END IF;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id UUID, p_role TEXT, p_permissions JSONB DEFAULT '[]'::jsonb)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer_role TEXT; target_role TEXT; target_status TEXT;
BEGIN
  SELECT role INTO viewer_role FROM public.users WHERE id = auth.uid();
  SELECT role, registration_status INTO target_role, target_status FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF viewer_role <> 'superadmin' OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND registration_status = 'approved') THEN RAISE EXCEPTION 'Only the active superadmin can manage privileges'; END IF;
  IF target_status = 'incomplete' THEN RAISE EXCEPTION 'Incomplete accounts cannot be managed'; END IF;
  IF p_role NOT IN ('user','admin','superadmin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own privileges'; END IF;
  UPDATE public.users SET role=p_role,
    registration_status=CASE
      WHEN p_role='superadmin' AND target_role <> 'superadmin' AND target_status='approved'
        AND EXISTS (SELECT 1 FROM public.users WHERE role='superadmin' AND registration_status='approved')
      THEN 'inactive' ELSE registration_status END,
    is_locked_out=CASE
      WHEN p_role='superadmin' AND target_role <> 'superadmin' AND target_status='approved'
        AND EXISTS (SELECT 1 FROM public.users WHERE role='superadmin' AND registration_status='approved')
      THEN FALSE ELSE is_locked_out END,
    admin_permissions=CASE WHEN p_role='superadmin' THEN to_jsonb(ARRAY['manage_registrations','manage_account_info','block_accounts','reset_passwords','delete_accounts']) ELSE COALESCE(p_permissions,'[]'::jsonb) END
    WHERE id=p_user_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_initial_account(
  p_user_id UUID,
  p_id_number TEXT,
  p_username TEXT,
  p_email TEXT,
  p_first_name TEXT,
  p_middle_initial TEXT,
  p_last_name TEXT,
  p_suffix TEXT,
  p_birthdate DATE,
  p_age INT,
  p_sex TEXT,
  p_purok TEXT,
  p_barangay TEXT,
  p_city TEXT,
  p_province TEXT,
  p_country TEXT,
  p_zip TEXT,
  p_q1 TEXT,
  p_a1 TEXT,
  p_q2 TEXT,
  p_a2 TEXT,
  p_q3 TEXT,
  p_a3 TEXT,
  p_password TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_role TEXT;
  v_initial_status TEXT;
BEGIN
  IF auth.uid() <> p_user_id THEN RAISE EXCEPTION 'You can only complete your own account'; END IF;
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id AND registration_status = 'incomplete';
  IF v_role IS NULL THEN RAISE EXCEPTION 'This account is not awaiting completion'; END IF;
  v_initial_status := CASE
    WHEN v_role = 'superadmin'
      AND EXISTS (SELECT 1 FROM public.users WHERE role = 'superadmin' AND registration_status = 'approved')
    THEN 'inactive'
    ELSE 'approved'
  END;
  UPDATE auth.users
  SET email = p_email,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE id = p_user_id;

  UPDATE public.users
  SET id_number = p_id_number, username = p_username, email = p_email, registration_status = v_initial_status,
      is_locked_out = FALSE
  WHERE id = p_user_id;
  UPDATE public.profiles
  SET first_name = p_first_name, middle_initial = NULLIF(p_middle_initial, ''), last_name = p_last_name,
      suffix = NULLIF(p_suffix, ''), birthdate = p_birthdate, age = p_age, sex = p_sex
  WHERE user_id = p_user_id;
  INSERT INTO public.addresses (user_id, purok, barangay, city, province, country, zip)
  VALUES (p_user_id, p_purok, p_barangay, p_city, p_province, p_country, p_zip)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_security_questions (user_id, question, answer_hash)
  VALUES
    (p_user_id, p_q1, crypt(lower(trim(p_a1)), gen_salt('bf'))),
    (p_user_id, p_q2, crypt(lower(trim(p_a2)), gen_salt('bf'))),
    (p_user_id, p_q3, crypt(lower(trim(p_a3)), gen_salt('bf')));
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_initial_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_initial_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.complete_initial_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_initial_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
