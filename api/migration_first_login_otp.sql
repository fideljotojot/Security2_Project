-- Apply after first-login, self-profile and current account-management migrations.
BEGIN;

-- Only Supabase-signed claims prove verification; user metadata is never trusted.
CREATE OR REPLACE FUNCTION public.initial_account_otp_verified()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u JOIN auth.users au ON au.id = u.id
    WHERE u.id = auth.uid() AND u.registration_status = 'incomplete'
      AND NOT COALESCE(u.is_locked_out, false)
      AND lower(u.email) = lower(au.email)
      AND lower(au.email) = lower(auth.jwt()->>'email')
      AND lower(au.email) NOT LIKE '%@accounts.local'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr', '[]'::jsonb)) method
        WHERE method->>'method' = 'otp'
          AND (method->>'timestamp')::numeric >= COALESCE((
            SELECT max((pw->>'timestamp')::numeric)
            FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr', '[]'::jsonb)) pw
            WHERE pw->>'method' = 'password'
          ), 0)
      )
  );
$$;
REVOKE ALL ON FUNCTION public.initial_account_otp_verified() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.initial_account_otp_verified() TO authenticated;

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
  IF p_email IS NULL OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     OR lower(p_email) LIKE '%@accounts.local' THEN
    RAISE EXCEPTION 'A valid real email address is required for first-login verification';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND lower(email) = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'Account email must match the authentication email';
  END IF;
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
  IF auth.uid() IS DISTINCT FROM p_user_id OR NOT public.initial_account_otp_verified() THEN
    RAISE EXCEPTION 'Verify your email OTP before completing your account';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND lower(email) = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'The verified email cannot be changed during account completion';
  END IF;
  IF auth.uid() <> p_user_id THEN RAISE EXCEPTION 'You can only complete your own account'; END IF;
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id AND registration_status = 'incomplete';
  IF v_role IS NULL THEN RAISE EXCEPTION 'This account is not awaiting completion'; END IF;
  -- A newly completed superadmin is always the inactive backup. The
  -- superadmin-capacity migration normalizes the previous backup if needed.
  v_initial_status := CASE WHEN v_role = 'superadmin' THEN 'inactive' ELSE 'approved' END;
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
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND registration_status = 'incomplete') THEN
    RAISE EXCEPTION 'Complete first-login email verification and onboarding before updating your profile';
  END IF;
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

-- Cover direct table writes and other SECURITY DEFINER RPCs as well as onboarding.
CREATE OR REPLACE FUNCTION public.guard_incomplete_account_writes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE target_id UUID; incomplete BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    target_id := NEW.id;
  ELSE
    target_id := NEW.user_id;
  END IF;
  IF target_id IS DISTINCT FROM auth.uid() THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'users' AND TG_OP = 'UPDATE' THEN
    incomplete := OLD.registration_status = 'incomplete';
  ELSE
    SELECT registration_status = 'incomplete' INTO incomplete FROM public.users WHERE id = target_id;
  END IF;
  IF COALESCE(incomplete, false) THEN
    IF NOT public.initial_account_otp_verified() THEN
      RAISE EXCEPTION 'Verify your email OTP before updating account details';
    END IF;
    IF TG_TABLE_NAME = 'users' THEN
      IF lower(NEW.email) IS DISTINCT FROM (SELECT lower(email) FROM auth.users WHERE id = target_id) THEN
        RAISE EXCEPTION 'The verified email cannot be changed during account completion';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_incomplete_account_writes() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_incomplete_account_writes ON public.users;
CREATE TRIGGER guard_incomplete_account_writes BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.guard_incomplete_account_writes();
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['profiles', 'addresses', 'user_security_questions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_incomplete_account_writes ON public.%I', table_name);
    EXECUTE format('CREATE TRIGGER guard_incomplete_account_writes BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_incomplete_account_writes()', table_name);
  END LOOP;
END;
$$;

-- Prevent Auth updateUser from changing the OTP destination or password first.
CREATE OR REPLACE FUNCTION public.guard_incomplete_auth_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  -- GoTrue uses its own database connection without the user's PostgREST JWT.
  IF (NEW.id = auth.uid() OR session_user = 'supabase_auth_admin') AND EXISTS (
    SELECT 1 FROM public.users WHERE id = NEW.id AND registration_status = 'incomplete'
  ) THEN
    IF lower(NEW.email) IS DISTINCT FROM lower(OLD.email) OR
       NULLIF(NEW.email_change, '') IS DISTINCT FROM NULLIF(OLD.email_change, '') THEN
      RAISE EXCEPTION 'The registered email cannot be changed during account completion';
    END IF;
    IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
       AND NOT public.initial_account_otp_verified() THEN
      RAISE EXCEPTION 'Verify your email OTP before updating account details';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_incomplete_auth_changes() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_incomplete_auth_changes ON auth.users;
CREATE TRIGGER guard_incomplete_auth_changes BEFORE UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.guard_incomplete_auth_changes();
NOTIFY pgrst, 'reload schema';
COMMIT;
