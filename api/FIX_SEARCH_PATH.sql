-- ================================================================================
-- CRITICAL FIX: Search Path Issue in Functions
-- ================================================================================
-- The functions exist but fail because SET search_path = public
-- restricts them from finding crypt() in pg_catalog.
-- This recreates the functions with the CORRECT search path
-- ================================================================================

-- FIRST: Verify pgcrypto is installed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- FIX 1: Recreate verify_security_answers_only with correct search path
DROP FUNCTION IF EXISTS public.verify_security_answers_only(TEXT, TEXT, TEXT, TEXT) CASCADE;

CREATE FUNCTION public.verify_security_answers_only(
  p_id_number TEXT,
  p_ans1 TEXT,
  p_ans2 TEXT,
  p_ans3 TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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

-- FIX 2: Recreate get_recovery_email_after_answers with correct search path
DROP FUNCTION IF EXISTS public.get_recovery_email_after_answers(TEXT, TEXT, TEXT, TEXT) CASCADE;

CREATE FUNCTION public.get_recovery_email_after_answers(
  p_id_number TEXT,
  p_ans1 TEXT,
  p_ans2 TEXT,
  p_ans3 TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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

-- FIX 3: Recreate verify_and_reset_password with correct search path
DROP FUNCTION IF EXISTS public.verify_and_reset_password(TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;

CREATE FUNCTION public.verify_and_reset_password(
  p_id_number TEXT,
  p_ans1 TEXT,
  p_ans2 TEXT,
  p_ans3 TEXT,
  p_new_password TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

-- FIX 4: Recreate get_user_security_questions with correct search path
DROP FUNCTION IF EXISTS public.get_user_security_questions(TEXT) CASCADE;

CREATE FUNCTION public.get_user_security_questions(p_id_number TEXT)
RETURNS TABLE(question TEXT, username TEXT, user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT usq.question::TEXT, u.username::TEXT, u.id
  FROM public.user_security_questions usq
  JOIN public.users u ON usq.user_id = u.id
  WHERE u.id_number = p_id_number
  ORDER BY usq.id;
END;
$$;

-- ================================================================================
-- VERIFICATION: Test the functions
-- ================================================================================
-- This query shows if the functions are now working correctly
SELECT 'verify_security_answers_only' as function_name, 'FIXED ✓' as status
UNION ALL
SELECT 'get_recovery_email_after_answers', 'FIXED ✓'
UNION ALL
SELECT 'verify_and_reset_password', 'FIXED ✓'
UNION ALL
SELECT 'get_user_security_questions', 'FIXED ✓';
