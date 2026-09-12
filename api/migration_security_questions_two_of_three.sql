-- Apply after schema_supabase.sql to require all three answers to match
-- their corresponding security questions.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

  RETURN v_matches = 3;
END;
$$;

-- Validate each answer against the question selected for that answer.
CREATE OR REPLACE FUNCTION public.verify_security_answers_selected(
  p_id_number TEXT,
  p_question1 TEXT,
  p_question2 TEXT,
  p_question3 TEXT,
  p_ans1 TEXT,
  p_ans2 TEXT,
  p_ans3 TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_hash TEXT;
  v_saved_question TEXT;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE id_number = p_id_number;
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;

  SELECT question, answer_hash INTO v_saved_question, v_hash
    FROM public.user_security_questions WHERE user_id = v_user_id ORDER BY id LIMIT 1 OFFSET 0;
  IF v_saved_question IS DISTINCT FROM p_question1 OR v_hash IS NULL OR crypt(lower(trim(p_ans1)), v_hash) <> v_hash THEN RETURN FALSE; END IF;

  SELECT question, answer_hash INTO v_saved_question, v_hash
    FROM public.user_security_questions WHERE user_id = v_user_id ORDER BY id LIMIT 1 OFFSET 1;
  IF v_saved_question IS DISTINCT FROM p_question2 OR v_hash IS NULL OR crypt(lower(trim(p_ans2)), v_hash) <> v_hash THEN RETURN FALSE; END IF;

  SELECT question, answer_hash INTO v_saved_question, v_hash
    FROM public.user_security_questions WHERE user_id = v_user_id ORDER BY id LIMIT 1 OFFSET 2;
  IF v_saved_question IS DISTINCT FROM p_question3 OR v_hash IS NULL OR crypt(lower(trim(p_ans3)), v_hash) <> v_hash THEN RETURN FALSE; END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_security_answers_selected(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_security_answer(
  p_id_number TEXT, p_question TEXT, p_answer TEXT, p_position INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_user_id UUID; v_hash TEXT; v_saved_question TEXT;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE id_number = p_id_number;
  SELECT question, answer_hash INTO v_saved_question, v_hash
    FROM public.user_security_questions WHERE user_id = v_user_id
    ORDER BY id LIMIT 1 OFFSET p_position;
  RETURN v_saved_question = p_question AND v_hash IS NOT NULL
    AND crypt(lower(trim(p_answer)), v_hash) = v_hash;
END; $$;

GRANT EXECUTE ON FUNCTION public.verify_security_answer(TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated;

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
