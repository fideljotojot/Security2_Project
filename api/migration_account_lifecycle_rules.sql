-- Account lifecycle rules:
-- public registrations are pending, superadmin-created accounts are incomplete,
-- and only approved/inactive accounts may use password-recovery OTP.

CREATE OR REPLACE FUNCTION public.send_otp_code(p_id_number TEXT, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  v_user_id UUID;
  v_status TEXT;
  v_registered_email TEXT;
  v_code VARCHAR(6);
  v_otp_id BIGINT;
BEGIN
  SELECT u.id, u.registration_status, au.email
    INTO v_user_id, v_status, v_registered_email
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.id_number = p_id_number;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  IF v_status NOT IN ('approved', 'inactive') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OTP is unavailable for this account');
  END IF;
  IF lower(trim(COALESCE(p_email, ''))) <> lower(trim(COALESCE(v_registered_email, ''))) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Email does not match this account');
  END IF;

  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  DELETE FROM public.otp_codes WHERE user_id = v_user_id AND verified_at IS NULL;
  INSERT INTO public.otp_codes (user_id, code) VALUES (v_user_id, v_code) RETURNING id INTO v_otp_id;

  PERFORM extensions.http_post(
    'https://vecdbfwsvbijnfkcsfzd.supabase.co/functions/v1/send-otp-email',
    jsonb_build_object('email', v_registered_email, 'code', v_code, 'user_id', v_user_id::TEXT)::TEXT,
    'application/json'
  );
  RETURN jsonb_build_object('ok', true, 'message', 'OTP code sent to your email address', 'otp_id', v_otp_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_otp_code(p_id_number TEXT, p_code VARCHAR)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID; v_status TEXT; v_otp_id BIGINT;
BEGIN
  SELECT id, registration_status INTO v_user_id, v_status FROM public.users WHERE id_number = p_id_number;
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'User not found'); END IF;
  IF v_status NOT IN ('approved', 'inactive') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OTP is unavailable for this account');
  END IF;
  SELECT id INTO v_otp_id FROM public.otp_codes
  WHERE user_id = v_user_id AND code = p_code AND verified_at IS NULL
    AND expires_at > now() AND attempts < 3
  ORDER BY created_at DESC LIMIT 1;
  IF v_otp_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired OTP code');
  END IF;
  UPDATE public.otp_codes SET verified_at = now() WHERE id = v_otp_id;
  RETURN jsonb_build_object('ok', true, 'message', 'OTP verified successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recovery_email_by_id(p_id_number TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT au.email
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.id_number = p_id_number
    AND u.registration_status IN ('approved', 'inactive')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_recovery_email_by_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recovery_email_by_id(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_and_reset_password(
  p_id_number TEXT, p_ans1 TEXT, p_ans2 TEXT, p_ans3 TEXT, p_new_password TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_user_id UUID; v_status TEXT;
BEGIN
  SELECT id, registration_status INTO v_user_id, v_status
  FROM public.users WHERE id_number = p_id_number;
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'User not found'); END IF;
  IF v_status NOT IN ('approved', 'inactive') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Password changes are unavailable for this account');
  END IF;
  IF NOT public.verify_security_answers_only(p_id_number, p_ans1, p_ans2, p_ans3) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Incorrect answers');
  END IF;
  UPDATE auth.users SET encrypted_password = crypt(p_new_password, gen_salt('bf')) WHERE id = v_user_id;
  RETURN jsonb_build_object('ok', true, 'message', 'Password successfully changed');
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_superadmin_on_login(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT; v_status TEXT; v_active UUID;
BEGIN
  IF auth.uid() <> p_user_id THEN RAISE EXCEPTION 'You can only activate your own account'; END IF;
  SELECT role, registration_status INTO v_role, v_status FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF v_role <> 'superadmin' OR v_status <> 'inactive' THEN RETURN COALESCE(v_status, 'unknown'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('active-superadmin', 0));
  SELECT id INTO v_active FROM public.users
    WHERE role = 'superadmin' AND registration_status = 'approved' AND id <> p_user_id LIMIT 1;
  IF v_active IS NOT NULL THEN RETURN 'inactive'; END IF;
  UPDATE public.users SET registration_status = 'approved', is_locked_out = FALSE WHERE id = p_user_id;
  RETURN 'approved';
END;
$$;

REVOKE ALL ON FUNCTION public.activate_superadmin_on_login(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_superadmin_on_login(UUID) TO authenticated;
