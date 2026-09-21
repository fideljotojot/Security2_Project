-- ================================================================================
-- Legacy custom OTP management. Password recovery now uses Supabase Auth OTP
-- and Supabase-configured SMTP instead of these custom email functions.
-- ================================================================================
-- Run this in Supabase SQL Editor to enable custom OTP handling

-- 1. Create OTP verification table
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  verified_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- 2. Function to generate and send OTP
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
  SELECT u.id INTO v_user_id
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.id_number = p_id_number
    AND u.registration_status IN ('approved', 'inactive')
    AND lower(trim(COALESCE(p_email, ''))) = lower(trim(COALESCE(au.email, '')));
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OTP is unavailable for this account');
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

  -- NOTE: Email sending would happen here via Supabase functions or external service
  -- For now, return the code (in production, send via email and don't return)
  RETURN jsonb_build_object(
    'ok', true, 
    'message', 'OTP code generated successfully',
    'otp_id', v_otp_id,
    'code', v_code
  );
END;
$$;

-- 3. Function to verify OTP code
CREATE OR REPLACE FUNCTION public.verify_otp_code(p_id_number TEXT, p_code VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_otp_id BIGINT;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id FROM public.users WHERE id_number = p_id_number;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;

  -- Find matching OTP (not expired, not verified, not too many attempts)
  SELECT id INTO v_otp_id FROM public.otp_codes
  WHERE user_id = v_user_id
    AND code = p_code
    AND verified_at IS NULL
    AND expires_at > now()
    AND attempts < 3
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_otp_id IS NULL THEN
    -- Log attempt on the most recent OTP
    UPDATE public.otp_codes
    SET attempts = attempts + 1
    WHERE id = (
      SELECT id FROM public.otp_codes
      WHERE user_id = v_user_id
        AND verified_at IS NULL
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1
    );
    
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired OTP code');
  END IF;

  -- Mark OTP as verified
  UPDATE public.otp_codes
  SET verified_at = now()
  WHERE id = v_otp_id;

  RETURN jsonb_build_object('ok', true, 'message', 'OTP verified successfully');
END;
$$;

-- 4. Cleanup function to delete expired OTPs (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < now() OR (verified_at IS NOT NULL AND created_at < now() - INTERVAL '1 hour');
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ================================================================================
-- VERIFICATION
-- ================================================================================
SELECT 'send_otp_code' as function_name, 'CREATED ✓' as status
UNION ALL
SELECT 'verify_otp_code', 'CREATED ✓'
UNION ALL
SELECT 'cleanup_expired_otps', 'CREATED ✓';
