-- Enable pgcrypto extension for secure hashing and crypt functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Users Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  id_number VARCHAR(9) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  middle_initial VARCHAR(10) NULL,
  last_name VARCHAR(100) NOT NULL,
  suffix VARCHAR(20) NULL,
  birthdate DATE NULL,
  age INT NULL,
  sex VARCHAR(10) CHECK (sex IN ('male', 'female')) NULL
);

-- 3. Addresses Table
CREATE TABLE IF NOT EXISTS public.addresses (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purok VARCHAR(100) NULL,
  barangay VARCHAR(100) NULL,
  city VARCHAR(120) NULL,
  province VARCHAR(120) NULL,
  country VARCHAR(120) NULL,
  zip VARCHAR(20) NULL
);

-- 4. User Security Questions Table
CREATE TABLE IF NOT EXISTS public.user_security_questions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question VARCHAR(255) NOT NULL,
  answer_hash VARCHAR(255) NOT NULL
);

-- Enable RLS on all public tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_questions ENABLE ROW LEVEL SECURITY;

-- Add read-only RLS policies (only user can read their own data)
CREATE POLICY "Users can read own record" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read own address" ON public.addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read own security questions" ON public.user_security_questions FOR SELECT USING (auth.uid() = user_id);


--------------------------------------------------------------------------------
-- DATABASE FUNCTIONS (RPCs)
--------------------------------------------------------------------------------

-- A. check_user_exists: Public RPC to check if ID, email, or username is taken
CREATE OR REPLACE FUNCTION public.check_user_exists(p_type TEXT, p_value TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF p_type = 'id' THEN
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id_number = p_value) INTO v_exists;
  ELSIF p_type = 'username' THEN
    SELECT EXISTS(SELECT 1 FROM public.users WHERE username = p_value) INTO v_exists;
  ELSIF p_type = 'email' THEN
    SELECT EXISTS(SELECT 1 FROM public.users WHERE email = p_value) INTO v_exists;
  ELSE
    v_exists := FALSE;
  END IF;
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. create_user_profile: Atomic transactional user setup called right after auth.signUp
CREATE OR REPLACE FUNCTION public.create_user_profile(
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
  p_a3 TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Insert user
  INSERT INTO public.users (id, id_number, username, email)
  VALUES (p_user_id, p_id_number, p_username, p_email);

  -- Insert profile
  INSERT INTO public.profiles (user_id, first_name, middle_initial, last_name, suffix, birthdate, age, sex)
  VALUES (p_user_id, p_first_name, p_middle_initial, p_last_name, p_suffix, p_birthdate, p_age, p_sex);

  -- Insert address
  INSERT INTO public.addresses (user_id, purok, barangay, city, province, country, zip)
  VALUES (p_user_id, p_purok, p_barangay, p_city, p_province, p_country, p_zip);

  -- Insert security questions and hash answers securely using crypt + blowfish salt
  INSERT INTO public.user_security_questions (user_id, question, answer_hash)
  VALUES 
    (p_user_id, p_q1, crypt(lower(trim(p_a1)), gen_salt('bf'))),
    (p_user_id, p_q2, crypt(lower(trim(p_a2)), gen_salt('bf'))),
    (p_user_id, p_q3, crypt(lower(trim(p_a3)), gen_salt('bf')));

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. get_user_security_questions: Safely fetches questions for a user by id_number
CREATE OR REPLACE FUNCTION public.get_user_security_questions(p_id_number TEXT)
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


-- D. verify_security_answers_only: Validates answers against hashed questions (prior to reset)
CREATE OR REPLACE FUNCTION public.verify_security_answers_only(
  p_id_number TEXT,
  p_ans1 TEXT,
  p_ans2 TEXT,
  p_ans3 TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_hash1 TEXT;
  v_hash2 TEXT;
  v_hash3 TEXT;
BEGIN
  -- Resolve user
  SELECT id INTO v_user_id FROM public.users WHERE id_number = p_id_number;
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Load security question hashes
  SELECT answer_hash INTO v_hash1 FROM public.user_security_questions WHERE user_id = v_user_id ORDER BY id LIMIT 1 OFFSET 0;
  SELECT answer_hash INTO v_hash2 FROM public.user_security_questions WHERE user_id = v_user_id ORDER BY id LIMIT 1 OFFSET 1;
  SELECT answer_hash INTO v_hash3 FROM public.user_security_questions WHERE user_id = v_user_id ORDER BY id LIMIT 1 OFFSET 2;

  IF v_hash1 IS NULL OR v_hash2 IS NULL OR v_hash3 IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Compare lowercase trimmed answers with hashes using crypt
  RETURN (
    crypt(lower(trim(p_ans1)), v_hash1) = v_hash1 AND
    crypt(lower(trim(p_ans2)), v_hash2) = v_hash2 AND
    crypt(lower(trim(p_ans3)), v_hash3) = v_hash3
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- E. verify_and_reset_password: Verifies answers and updates auth.users password atomically
CREATE OR REPLACE FUNCTION public.verify_and_reset_password(
  p_id_number TEXT,
  p_ans1 TEXT,
  p_ans2 TEXT,
  p_ans3 TEXT,
  p_new_password TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_verified BOOLEAN;
BEGIN
  -- 1. Check answers
  SELECT verify_security_answers_only(p_id_number, p_ans1, p_ans2, p_ans3) INTO v_verified;
  
  IF NOT v_verified THEN
    RETURN json_build_object('ok', false, 'error', 'Incorrect answers')::jsonb;
  END IF;

  -- 2. Find user UUID
  SELECT id INTO v_user_id FROM public.users WHERE id_number = p_id_number;

  -- 3. Update auth.users encrypted password with crypt(password, salt)
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = v_user_id;

  RETURN json_build_object('ok', true, 'message', 'Password successfully changed')::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- F. get_email_by_username: Resolves email for username-based login
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM public.users WHERE username = p_username;
  RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
