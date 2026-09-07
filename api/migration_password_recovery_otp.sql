-- Run after migration_security_questions_two_of_three.sql.
-- Returns the recovery email only after two of the three security answers match.
CREATE OR REPLACE FUNCTION public.get_recovery_email_after_answers(
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