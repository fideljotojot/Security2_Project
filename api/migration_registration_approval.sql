-- Run this once in the Supabase SQL Editor.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_locked_out BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_registration_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_registration_status_check
  CHECK (registration_status IN ('pending', 'approved', 'blocked'));

-- Preserve access for existing staff accounts after adding the new default.
UPDATE public.users
SET registration_status = 'approved'
WHERE role IN ('admin', 'superadmin');

CREATE OR REPLACE FUNCTION public.get_pending_registrations()
RETURNS TABLE(user_id UUID, id_number VARCHAR, username VARCHAR, email VARCHAR, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin')) THEN
    RAISE EXCEPTION 'Only administrators can view registrations';
  END IF;

  RETURN QUERY
  SELECT u.id, u.id_number, u.username, u.email, u.created_at
  FROM public.users u
  WHERE u.registration_status = 'pending'
    AND (u.role <> 'superadmin' OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'superadmin')
  ORDER BY u.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_registration_status(p_user_id UUID, p_status TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin')) THEN
    RAISE EXCEPTION 'Only administrators can update registrations';
  END IF;
  IF p_status NOT IN ('approved', 'blocked') THEN
    RAISE EXCEPTION 'Invalid registration status';
  END IF;
  IF (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
     AND (SELECT role FROM public.users WHERE id = p_user_id) = 'superadmin' THEN
    RAISE EXCEPTION 'Administrators cannot modify superadmin registrations';
  END IF;

  UPDATE public.users
  SET registration_status = p_status,
      is_locked_out = (p_status = 'blocked')
  WHERE id = p_user_id;
  RETURN FOUND;
END;
$$;
