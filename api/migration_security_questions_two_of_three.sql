-- Apply after schema_supabase.sql to allow password recovery with any two
-- correct answers out of the user's three stored security answers.

CREATE OR REPLACE FUNCTION public.verify_security_answers_only(
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
  SELECT id INTO v_user_id
  FROM public.users
  WHERE id_number = p_id_number;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT answer_hash INTO v_hash1
  FROM public.user_security_questions
  WHERE user_id = v_user_id
  ORDER BY id
  LIMIT 1 OFFSET 0;
  SELECT answer_hash INTO v_hash2
  FROM public.user_security_questions
  WHERE user_id = v_user_id
  ORDER BY id
  LIMIT 1 OFFSET 1;
  SELECT answer_hash INTO v_hash3
  FROM public.user_security_questions
  WHERE user_id = v_user_id
  ORDER BY id
  LIMIT 1 OFFSET 2;

  IF v_hash1 IS NULL OR v_hash2 IS NULL OR v_hash3 IS NULL THEN
    RETURN FALSE;
  END IF;

  v_matches :=
    (CASE WHEN crypt(lower(trim(p_ans1)), v_hash1) = v_hash1 THEN 1 ELSE 0 END) +
    (CASE WHEN crypt(lower(trim(p_ans2)), v_hash2) = v_hash2 THEN 1 ELSE 0 END) +
    (CASE WHEN crypt(lower(trim(p_ans3)), v_hash3) = v_hash3 THEN 1 ELSE 0 END);

  RETURN v_matches >= 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_and_reset_password(
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

  SELECT id INTO v_user_id
  FROM public.users
  WHERE id_number = p_id_number;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Password successfully changed');
END;
$$;