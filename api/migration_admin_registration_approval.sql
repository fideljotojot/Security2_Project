-- Allow administrators to review ordinary user registrations.
-- Apply after migration_registration_approval.sql.

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
