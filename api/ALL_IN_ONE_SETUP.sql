-- ================================================================================
-- SECURITY 2 - COMPLETE DATABASE SETUP (All-in-One)
-- ================================================================================
-- Run this entire script in Supabase SQL Editor as a single query.
-- This combines all migrations in the correct dependency order.
-- ================================================================================

-- STEP 1: Enable pgcrypto extension (MUST run first)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ================================================================================
-- STEP 2: CREATE TABLES
-- ================================================================================

-- 1. Users Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  id_number VARCHAR(9) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'superadmin')),
  registration_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (registration_status IN ('pending', 'approved', 'blocked')),
  is_locked_out BOOLEAN NOT NULL DEFAULT FALSE,
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

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Delete Requests Table
CREATE TABLE IF NOT EXISTS public.delete_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ
);

-- ================================================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY (RLS)
-- ================================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;

-- Add read-only RLS policies
DROP POLICY IF EXISTS "Users can read own record" ON public.users;
CREATE POLICY "Users can read own record" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own address" ON public.addresses;
CREATE POLICY "Users can read own address" ON public.addresses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own security questions" ON public.user_security_questions;
CREATE POLICY "Users can read own security questions" ON public.user_security_questions FOR SELECT USING (auth.uid() = user_id);

-- ================================================================================
-- STEP 4: CREATE DATABASE FUNCTIONS (RPCs)
-- ================================================================================

-- A. check_user_exists: Check if ID, email, or username is taken
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

-- B. create_user_profile: Atomic transactional user setup after auth.signUp
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
  p_a3 TEXT,
  p_role TEXT DEFAULT 'user'
) RETURNS BOOLEAN AS $$
BEGIN
  IF p_role <> 'user' AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Only superadmins can create privileged accounts';
  END IF;

  IF p_role NOT IN ('user', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  INSERT INTO public.users (id, id_number, username, email, role)
  VALUES (p_user_id, p_id_number, p_username, p_email, p_role);

  INSERT INTO public.profiles (user_id, first_name, middle_initial, last_name, suffix, birthdate, age, sex)
  VALUES (p_user_id, p_first_name, p_middle_initial, p_last_name, p_suffix, p_birthdate, p_age, p_sex);

  INSERT INTO public.addresses (user_id, purok, barangay, city, province, country, zip)
  VALUES (p_user_id, p_purok, p_barangay, p_city, p_province, p_country, p_zip);

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

-- C. get_user_security_questions: Fetch questions for a user by id_number
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

-- D. verify_security_answers_only: Validate answers (at least 2 of 3 must match)
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

-- E. verify_and_reset_password: Verify answers and reset password atomically
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

-- F. get_recovery_email_after_answers: Get email after verifying answers
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

-- G. get_email_by_username: Resolve email for username-based login
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM public.users WHERE username = p_username;
  RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- H. get_pending_registrations: Fetch pending registrations for admins
CREATE OR REPLACE FUNCTION public.get_pending_registrations()
RETURNS TABLE(user_id UUID, id_number VARCHAR, username VARCHAR, email VARCHAR, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  viewer_role TEXT;
BEGIN
  SELECT role INTO viewer_role FROM public.users WHERE id = auth.uid();
  IF viewer_role IS NULL OR viewer_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only administrators can view registrations';
  END IF;

  RETURN QUERY
  SELECT u.id, u.id_number, u.username, u.email, u.created_at
  FROM public.users u
  WHERE u.registration_status = 'pending'
    AND (u.role <> 'superadmin' OR viewer_role = 'superadmin')
  ORDER BY u.created_at ASC;
END;
$$;

-- I. update_registration_status: Approve or block registrations
CREATE OR REPLACE FUNCTION public.update_registration_status(p_user_id UUID, p_status TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  viewer_role TEXT;
  target_role TEXT;
BEGIN
  SELECT role INTO viewer_role FROM public.users WHERE id = auth.uid();
  SELECT role INTO target_role FROM public.users WHERE id = p_user_id;

  IF viewer_role IS NULL OR viewer_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only administrators can update registrations';
  END IF;
  IF p_status NOT IN ('approved', 'blocked') THEN
    RAISE EXCEPTION 'Invalid registration status';
  END IF;
  IF viewer_role = 'admin' AND target_role = 'superadmin' THEN
    RAISE EXCEPTION 'Administrators cannot modify superadmin registrations';
  END IF;

  UPDATE public.users
  SET registration_status = p_status,
      is_locked_out = (p_status = 'blocked')
  WHERE id = p_user_id;
  RETURN FOUND;
END;
$$;

-- J. get_user_for_edit: Get user data for superadmin editing
CREATE OR REPLACE FUNCTION public.get_user_for_edit(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can edit users';
  END IF;
  SELECT jsonb_build_object('user_id', u.id, 'id_number', u.id_number, 'username', u.username, 'email', u.email,
    'role', u.role, 'first_name', p.first_name, 'middle_initial', p.middle_initial, 'last_name', p.last_name,
    'suffix', p.suffix, 'birthdate', p.birthdate, 'age', p.age, 'sex', p.sex, 'purok', a.purok,
    'barangay', a.barangay, 'city', a.city, 'province', a.province, 'country', a.country, 'zip', a.zip)
  INTO v_result FROM public.users u JOIN public.profiles p ON p.user_id = u.id
    LEFT JOIN public.addresses a ON a.user_id = u.id WHERE u.id = p_user_id;
  RETURN v_result;
END;
$$;

-- K. update_user_profile: Update user info and password (superadmin)
CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_user_id UUID, p_id_number TEXT, p_username TEXT, p_email TEXT, p_first_name TEXT,
  p_middle_initial TEXT, p_last_name TEXT, p_suffix TEXT, p_birthdate DATE, p_age INT,
  p_sex TEXT, p_purok TEXT, p_barangay TEXT, p_city TEXT, p_province TEXT, p_country TEXT,
  p_zip TEXT, p_role TEXT, p_password TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can edit users';
  END IF;
  IF p_role NOT IN ('user', 'admin', 'superadmin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  UPDATE auth.users SET email = p_email, email_confirmed_at = COALESCE(email_confirmed_at, now()),
    encrypted_password = CASE WHEN p_password IS NULL OR p_password = '' THEN encrypted_password ELSE crypt(p_password, gen_salt('bf')) END
    WHERE id = p_user_id;
  UPDATE public.users SET id_number = p_id_number, username = p_username, email = p_email, role = p_role WHERE id = p_user_id;
  UPDATE public.profiles SET first_name = p_first_name, middle_initial = NULLIF(p_middle_initial, ''), last_name = p_last_name,
    suffix = NULLIF(p_suffix, ''), birthdate = p_birthdate, age = p_age, sex = p_sex WHERE user_id = p_user_id;
  UPDATE public.addresses SET purok = p_purok, barangay = p_barangay, city = p_city, province = p_province,
    country = p_country, zip = p_zip WHERE user_id = p_user_id;
  RETURN TRUE;
END;
$$;

-- L. get_all_users: Fetch all users for superadmin panel
DROP FUNCTION IF EXISTS public.get_all_users();
CREATE FUNCTION public.get_all_users()
RETURNS TABLE(
  user_id UUID,
  id_number VARCHAR,
  username VARCHAR,
  email VARCHAR,
  role VARCHAR,
  registration_status VARCHAR,
  is_locked_out BOOLEAN,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can view all users';
  END IF;

  RETURN QUERY
  SELECT 
    public.users.id,
    public.users.id_number,
    public.users.username,
    public.users.email,
    public.users.role,
    public.users.registration_status,
    public.users.is_locked_out,
    public.users.created_at
  FROM public.users
  ORDER BY public.users.created_at DESC;
END;
$$;

-- M. get_admin_users: Admin user list view
CREATE OR REPLACE FUNCTION public.get_admin_users() 
RETURNS TABLE(user_id UUID,id_number VARCHAR,username VARCHAR,email VARCHAR,role VARCHAR,registration_status VARCHAR,is_locked_out BOOLEAN,created_at TIMESTAMPTZ) 
LANGUAGE plpgsql SECURITY DEFINER AS $$ 
BEGIN 
  IF NOT EXISTS(SELECT 1 FROM public.users AS viewer WHERE viewer.id=auth.uid() AND viewer.role IN('admin','superadmin')) THEN 
    RAISE EXCEPTION 'Only administrators can view users'; 
  END IF; 
  RETURN QUERY SELECT u.id,u.id_number,u.username,u.email,u.role,u.registration_status,u.is_locked_out,u.created_at FROM public.users AS u WHERE ((SELECT role FROM public.users WHERE id=auth.uid())='superadmin' OR u.role<>'superadmin') ORDER BY u.created_at DESC;
END $$;

-- N. admin_update_user_status: Update user status (admin/superadmin)
CREATE OR REPLACE FUNCTION public.admin_update_user_status(p_user_id UUID,p_status TEXT) 
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ 
BEGIN 
  IF NOT EXISTS(SELECT 1 FROM public.users AS viewer WHERE viewer.id=auth.uid() AND viewer.role IN('admin','superadmin')) THEN 
    RAISE EXCEPTION 'Only administrators can update status'; 
  END IF; 
  IF p_status NOT IN('approved','blocked') THEN 
    RAISE EXCEPTION 'Invalid status'; 
  END IF; 
  IF (SELECT viewer.role FROM public.users AS viewer WHERE viewer.id=auth.uid())='admin' AND (SELECT target.role FROM public.users AS target WHERE target.id=p_user_id)='superadmin' THEN 
    RAISE EXCEPTION 'Administrators cannot modify superadmins'; 
  END IF; 
  UPDATE public.users SET registration_status=p_status,is_locked_out=(p_status='blocked') WHERE id=p_user_id; 
  RETURN FOUND; 
END $$;

-- O. get_user_for_admin_edit: Get user data for admin edit
CREATE OR REPLACE FUNCTION public.get_user_for_admin_edit(p_user_id UUID) 
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$ 
DECLARE r JSONB; 
BEGIN 
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role IN('admin','superadmin')) THEN 
    RAISE EXCEPTION 'Only administrators can edit users'; 
  END IF; 
  SELECT jsonb_build_object('id_number',id_number,'username',username,'email',email) INTO r FROM public.users WHERE id=p_user_id; 
  RETURN r; 
END $$;

-- P. admin_update_user_profile: Update user info (admin)
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(p_user_id UUID,p_id_number TEXT,p_username TEXT,p_email TEXT) 
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ 
BEGIN 
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role IN('admin','superadmin')) THEN 
    RAISE EXCEPTION 'Only administrators can edit users'; 
  END IF; 
  UPDATE public.users SET id_number=p_id_number,username=p_username,email=p_email WHERE id=p_user_id; 
  RETURN FOUND; 
END $$;

-- Q. Audit logging functions
CREATE OR REPLACE FUNCTION public.create_audit_log(p_action TEXT,p_entity_type TEXT,p_entity_id TEXT DEFAULT NULL,p_details JSONB DEFAULT '{}'::jsonb) 
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$ 
BEGIN 
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,details) VALUES(auth.uid(),p_action,p_entity_type,p_entity_id,COALESCE(p_details,'{}'::jsonb)); 
  RETURN currval('public.audit_logs_id_seq'); 
END; $$;

DROP FUNCTION IF EXISTS public.get_audit_logs(INTEGER);
CREATE OR REPLACE FUNCTION public.get_audit_logs(p_limit INTEGER DEFAULT 20) 
RETURNS TABLE(log_id BIGINT,action TEXT,entity_type TEXT,entity_id TEXT,details JSONB,actor_username TEXT,actor_role TEXT,created_at TIMESTAMPTZ) 
LANGUAGE plpgsql SECURITY DEFINER AS $$ 
BEGIN 
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='superadmin') THEN 
    RAISE EXCEPTION 'Only superadmins can view audit logs'; 
  END IF; 
  RETURN QUERY SELECT l.id,l.action,l.entity_type,l.entity_id,l.details,u.username::TEXT,u.role::TEXT,l.created_at FROM public.audit_logs l LEFT JOIN public.users u ON u.id=l.actor_id ORDER BY l.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100); 
END; $$;

-- R. delete_user_account: Delete a user (superadmin only)
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Only superadmins can delete users';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RETURN FALSE;
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated;

-- S. Delete request functions
CREATE OR REPLACE FUNCTION public.create_delete_request(p_user_id UUID,p_reason TEXT) 
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$ 
DECLARE rid BIGINT; 
BEGIN 
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin') THEN 
    RAISE EXCEPTION 'Only administrators can request deletion'; 
  END IF; 
  IF (SELECT role FROM public.users WHERE id=p_user_id)='superadmin' THEN 
    RAISE EXCEPTION 'Administrators cannot request deletion of superadmins'; 
  END IF; 
  IF length(trim(p_reason))<3 THEN 
    RAISE EXCEPTION 'A deletion reason is required'; 
  END IF; 
  INSERT INTO public.delete_requests(user_id,requested_by,reason) VALUES(p_user_id,auth.uid(),trim(p_reason)) RETURNING id INTO rid; 
  RETURN rid; 
END $$;

DROP FUNCTION IF EXISTS public.get_delete_requests();
CREATE OR REPLACE FUNCTION public.get_delete_requests() 
RETURNS TABLE(request_id BIGINT,user_id UUID,id_number VARCHAR,username VARCHAR,email VARCHAR,first_name VARCHAR,middle_initial VARCHAR,last_name VARCHAR,suffix VARCHAR,birthdate DATE,age INT,sex VARCHAR,purok VARCHAR,barangay VARCHAR,city VARCHAR,province VARCHAR,country VARCHAR,zip VARCHAR,reason TEXT,requested_by UUID,created_at TIMESTAMPTZ) 
LANGUAGE plpgsql SECURITY DEFINER AS $$ 
BEGIN 
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='superadmin') THEN 
    RAISE EXCEPTION 'Only superadmins can view deletion requests'; 
  END IF; 
  RETURN QUERY SELECT d.id,u.id,u.id_number,u.username,u.email,p.first_name,p.middle_initial,p.last_name,p.suffix,p.birthdate,p.age,p.sex,a.purok,a.barangay,a.city,a.province,a.country,a.zip,d.reason,d.requested_by,d.created_at FROM public.delete_requests d JOIN public.users u ON u.id=d.user_id LEFT JOIN public.profiles p ON p.user_id=u.id LEFT JOIN public.addresses a ON a.user_id=u.id WHERE d.status='pending' ORDER BY d.created_at; 
END $$;

CREATE OR REPLACE FUNCTION public.review_delete_request(p_request_id BIGINT,p_approve BOOLEAN) 
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ 
DECLARE target UUID; 
BEGIN 
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='superadmin') THEN 
    RAISE EXCEPTION 'Only superadmins can review deletion requests'; 
  END IF; 
  SELECT user_id INTO target FROM public.delete_requests WHERE id=p_request_id AND status='pending'; 
  IF target IS NULL THEN 
    RETURN FALSE; 
  END IF; 
  IF p_approve THEN 
    DELETE FROM public.users WHERE id=target; 
  END IF; 
  UPDATE public.delete_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=p_request_id; 
  RETURN TRUE; 
END $$;

-- ================================================================================
-- STEP 5: CREATE AUDIT TRIGGERS
-- ================================================================================

CREATE OR REPLACE FUNCTION public.audit_user_changes() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN TG_OP='INSERT' THEN 'Signed up' WHEN TG_OP='DELETE' THEN 'Deleted user' WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'Changed admin privilege' WHEN NEW.registration_status='approved' AND OLD.registration_status='pending' THEN 'Approved registration' WHEN NEW.registration_status='blocked' AND OLD.registration_status='pending' THEN 'Rejected registration' WHEN NEW.registration_status='blocked' AND OLD.registration_status IS DISTINCT FROM 'blocked' THEN 'Blocked user' WHEN NEW.registration_status='approved' AND OLD.registration_status='blocked' THEN 'Unblocked user' ELSE 'Updated user' END, 'user', COALESCE(NEW.id, OLD.id)::TEXT, jsonb_build_object('username', COALESCE(NEW.username, OLD.username), 'operation', TG_OP, 'old_role', OLD.role, 'new_role', NEW.role));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS audit_users_changes ON public.users;
CREATE TRIGGER audit_users_changes AFTER INSERT OR UPDATE OR DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.audit_user_changes();

CREATE OR REPLACE FUNCTION public.audit_delete_request_changes() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN TG_OP='INSERT' THEN 'Created deletion request' WHEN TG_OP='UPDATE' AND NEW.status='approved' THEN 'Approved deletion request' WHEN TG_OP='UPDATE' AND NEW.status='rejected' THEN 'Rejected deletion request' ELSE 'Removed deletion request' END, 'deletion request', COALESCE(NEW.id, OLD.id)::TEXT, jsonb_build_object('status', COALESCE(NEW.status, OLD.status), 'operation', TG_OP));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS audit_delete_request_changes ON public.delete_requests;
CREATE TRIGGER audit_delete_request_changes AFTER INSERT OR UPDATE OR DELETE ON public.delete_requests FOR EACH ROW EXECUTE FUNCTION public.audit_delete_request_changes();

-- ================================================================================
-- SETUP COMPLETE
-- ================================================================================
-- All tables, functions, and triggers have been created successfully.
-- The database is now ready for the Security 2 application.
-- ================================================================================
