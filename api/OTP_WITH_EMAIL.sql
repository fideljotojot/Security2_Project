-- ================================================================================
-- Update: Remove OTP code from frontend response (security)
-- ================================================================================
-- This version doesn't return the OTP code to the client
-- The code is only sent via email

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Return the registered Auth email after the ID number is confirmed.
-- This supports the recovery order: ID number -> OTP -> security questions.
CREATE OR REPLACE FUNCTION public.get_recovery_email_by_id(p_id_number TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.email
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.id_number = p_id_number
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_recovery_email_by_id(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_otp_code(p_id_number TEXT, p_code VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_otp_id BIGINT;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE id_number = p_id_number;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;

  SELECT id INTO v_otp_id
  FROM public.otp_codes
  WHERE user_id = v_user_id
    AND code = p_code
    AND verified_at IS NULL
    AND expires_at > now()
    AND attempts < 3
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_otp_id IS NULL THEN
    UPDATE public.otp_codes
    SET attempts = attempts + 1
    WHERE id = (
      SELECT id FROM public.otp_codes
      WHERE user_id = v_user_id AND verified_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1
    );
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired OTP code');
  END IF;

  UPDATE public.otp_codes SET verified_at = now() WHERE id = v_otp_id;
  RETURN jsonb_build_object('ok', true, 'message', 'OTP verified successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_otp_code(TEXT, VARCHAR) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_otp_code(p_id_number TEXT, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_code VARCHAR(6);
  v_otp_id BIGINT;
BEGIN
  -- Validate user exists
  SELECT id INTO v_user_id FROM public.users WHERE id_number = p_id_number;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;

  -- Generate random 6-digit code
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Delete old, unverified OTP codes for this user
  DELETE FROM public.otp_codes 
  WHERE user_id = v_user_id 
    AND verified_at IS NULL;

  -- Insert new OTP code
  INSERT INTO public.otp_codes (user_id, code)
  VALUES (v_user_id, v_code)
  RETURNING id INTO v_otp_id;

  -- Call Edge Function to send email
  -- The Edge Function will handle sending the OTP via email service
  PERFORM extensions.http_post(
    'https://vecdbfwsvbijnfkcsfzd.supabase.co/functions/v1/send-otp-email',
    jsonb_build_object(
      'email', p_email,
      'code', v_code,
      'user_id', v_user_id::TEXT
    )::TEXT,
    'application/json'
  );

  -- Return success WITHOUT exposing the code
  RETURN jsonb_build_object(
    'ok', true, 
    'message', 'OTP code sent to your email address',
    'otp_id', v_otp_id
  );
END;
$$;

-- Note: You need to enable http extension first:
-- CREATE EXTENSION IF NOT EXISTS http;
