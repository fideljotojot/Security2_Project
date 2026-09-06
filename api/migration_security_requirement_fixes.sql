-- Apply after the existing schema/migrations.

-- Prevent anonymous callers from creating admin or superadmin accounts.
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID, p_id_number TEXT, p_username TEXT, p_email TEXT,
  p_first_name TEXT, p_middle_initial TEXT, p_last_name TEXT, p_suffix TEXT,
  p_birthdate DATE, p_age INT, p_sex TEXT, p_purok TEXT, p_barangay TEXT,
  p_city TEXT, p_province TEXT, p_country TEXT, p_zip TEXT,
  p_q1 TEXT, p_a1 TEXT, p_q2 TEXT, p_a2 TEXT, p_q3 TEXT, p_a3 TEXT,
  p_role TEXT DEFAULT 'user'
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_role NOT IN ('user', 'admin', 'superadmin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_role <> 'user' AND NOT EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can create privileged accounts';
  END IF;
  INSERT INTO public.users (id,id_number,username,email,role) VALUES (p_user_id,p_id_number,p_username,p_email,p_role);
  INSERT INTO public.profiles (user_id,first_name,middle_initial,last_name,suffix,birthdate,age,sex) VALUES (p_user_id,p_first_name,p_middle_initial,p_last_name,p_suffix,p_birthdate,p_age,p_sex);
  INSERT INTO public.addresses (user_id,purok,barangay,city,province,country,zip) VALUES (p_user_id,p_purok,p_barangay,p_city,p_province,p_country,p_zip);
  INSERT INTO public.user_security_questions (user_id,question,answer_hash) VALUES
    (p_user_id,p_q1,crypt(lower(trim(p_a1)),gen_salt('bf'))),(p_user_id,p_q2,crypt(lower(trim(p_a2)),gen_salt('bf'))),(p_user_id,p_q3,crypt(lower(trim(p_a3)),gen_salt('bf')));
  RETURN TRUE;
END; $$;

REVOKE ALL ON FUNCTION public.create_user_profile(
  UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,INT,TEXT,TEXT,TEXT,TEXT,
  TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_user_profile(
  UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,INT,TEXT,TEXT,TEXT,TEXT,
  TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT
) TO anon, authenticated;
