-- ================================================================================
-- RECOVERY: Create Missing RPC Functions Only
-- ================================================================================
-- Run this if verify_security_answers_only is not found in Supabase
-- This recreates ONLY the essential password recovery functions
-- ================================================================================

-- FIRST: Ensure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 1: Create verify_security_answers_only (CRITICAL - required for password recovery)
DROP FUNCTION IF EXISTS public.verify_security_answers_only(TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.verify_security_answers_only(
  p_id_number TEXT,
  p_ans1 TEXT,
  p_ans2 TEXT,
  p_ans3 TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_hash1 TEXT;
  v_hash2 TEXT;
  v_hash3 TEXT;
  v_matches INTEGER;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE id_number = p_id_number;
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;
  
  SELECT answer_hash INTO v_hash1 FROM public.user_security_questions WHERE user_id = v_user_id ORDER BY id LIMIT 1 OFFSET 0;
  SELECT answer_hash INTO v_hash2 FROM public.user_security_questions WHERE user_id = v_user_id ORDER BY id LIMIT 1 OFFSET 1;
  SELECT answer_hash INTO v_hash3 FROM public.user_security_questions WHERE user_id = v_user_id ORDER BY id LIMIT 1 OFFSET 2;

  IF v_hash1 IS NULL OR v_hash2 IS NULL OR v_hash3 IS NULL THEN RETURN FALSE; END IF;

  v_matches := 
    (CASE WHEN crypt(lower(trim(p_ans1)), v_hash1) = v_hash1 THEN 1 ELSE 0 END) +
    (CASE WHEN crypt(lower(trim(p_ans2)), v_hash2) = v_hash2 THEN 1 ELSE 0 END) +
    (CASE WHEN crypt(lower(trim(p_ans3)), v_hash3) = v_hash3 THEN 1 ELSE 0 END);

  RETURN v_matches >= 2;
END;
$$;

-- Step 2: Create get_recovery_email_after_answers (required for password reset)
DROP FUNCTION IF EXISTS public.get_recovery_email_after_answers(TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.get_recovery_email_after_answers(
  p_id_number TEXT,
  p_ans1 TEXT,
  p_ans2 TEXT,
  p_ans3 TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  IF NOT public.verify_security_answers_only(p_id_number, p_ans1, p_ans2, p_ans3) THEN
    RETURN NULL;
  END IF;

  SELECT u.id, au.email
  INTO v_user_id, v_email
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.id_number = p_id_number;

  RETURN NULLIF(lower(trim(v_email)), '');
END;
$$;

REVOKE ALL ON FUNCTION public.get_recovery_email_after_answers(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recovery_email_after_answers(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Step 3: Create verify_and_reset_password (required to update password)
DROP FUNCTION IF EXISTS public.verify_and_reset_password(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.verify_and_reset_password(
  p_id_number TEXT,
  p_ans1 TEXT,
  p_ans2 TEXT,
  p_ans3 TEXT,
  p_new_password TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.verify_security_answers_only(p_id_number, p_ans1, p_ans2, p_ans3) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Incorrect answers');
  END IF;

  SELECT id INTO v_user_id FROM public.users WHERE id_number = p_id_number;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Password successfully changed');
END;
$$;

-- Step 4: Create get_user_security_questions (required to fetch questions)
DROP FUNCTION IF EXISTS public.get_user_security_questions(TEXT);

CREATE FUNCTION public.get_user_security_questions(p_id_number TEXT)
RETURNS TABLE(question TEXT, username TEXT, user_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT usq.question::TEXT, u.username::TEXT, u.id
  FROM public.user_security_questions usq
  JOIN public.users u ON usq.user_id = u.id
  WHERE u.id_number = p_id_number
  ORDER BY usq.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================================
-- VERIFICATION: Check that functions were created
-- ================================================================================
SELECT 'verify_security_answers_only' as function_name, CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'verify_security_answers_only') THEN '✓ CREATED' ELSE '✗ FAILED' END as status
UNION ALL
SELECT 'get_recovery_email_after_answers', CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_recovery_email_after_answers') THEN '✓ CREATED' ELSE '✗ FAILED' END
UNION ALL
SELECT 'verify_and_reset_password', CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'verify_and_reset_password') THEN '✓ CREATED' ELSE '✗ FAILED' END
UNION ALL
SELECT 'get_user_security_questions', CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_user_security_questions') THEN '✓ CREATED' ELSE '✗ FAILED' END;
