-- Per-admin capabilities managed by the superadmin privilege modal.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_permissions JSONB NOT NULL DEFAULT
    '["manage_registrations","manage_account_info","block_accounts","reset_passwords","delete_accounts"]'::jsonb;

DROP FUNCTION IF EXISTS public.get_pending_registrations();
CREATE OR REPLACE FUNCTION public.get_pending_registrations()
RETURNS TABLE(user_id UUID,id_number VARCHAR,username VARCHAR,email VARCHAR,created_at TIMESTAMPTZ,viewer_permissions JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer_role TEXT;
BEGIN
  SELECT u.role INTO viewer_role FROM public.users u WHERE u.id = auth.uid();
  IF viewer_role IS NULL OR viewer_role NOT IN ('admin','superadmin') THEN RAISE EXCEPTION 'Only administrators can view registrations'; END IF;
  RETURN QUERY SELECT u.id,u.id_number,u.username,u.email,u.created_at,
    COALESCE((SELECT viewer.admin_permissions FROM public.users viewer WHERE viewer.id = auth.uid()), '[]'::jsonb)
    FROM public.users u WHERE u.registration_status = 'pending'
      AND (u.role <> 'superadmin' OR viewer_role = 'superadmin') ORDER BY u.created_at ASC;
END;
$$;

DROP FUNCTION IF EXISTS public.set_user_role(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.set_user_role(
  p_user_id UUID,
  p_role TEXT,
  p_permissions JSONB DEFAULT '[]'::jsonb
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users AS viewer WHERE viewer.id = auth.uid() AND viewer.role = 'superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can manage privileges';
  END IF;
  IF p_role NOT IN ('user', 'admin', 'superadmin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own privileges'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users AS target WHERE target.id = p_user_id AND target.role IN ('user', 'admin', 'superadmin')) THEN
    RAISE EXCEPTION 'Only user, admin, and superadmin accounts can have their privileges changed';
  END IF;
  UPDATE users
  SET role = p_role,
      admin_permissions = CASE WHEN p_role = 'superadmin' THEN to_jsonb(ARRAY['manage_registrations','manage_account_info','block_accounts','reset_passwords','delete_accounts']) ELSE COALESCE(p_permissions, '[]'::jsonb) END
  WHERE id = p_user_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_registration_status(p_user_id UUID, p_status TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer_role TEXT; target_role TEXT; admin_permissions JSONB;
BEGIN
  SELECT u.role, u.admin_permissions INTO viewer_role, admin_permissions
  FROM public.users u WHERE u.id = auth.uid();
  SELECT u.role INTO target_role FROM public.users u WHERE u.id = p_user_id;
  IF viewer_role IS NULL OR viewer_role NOT IN ('admin','superadmin') THEN RAISE EXCEPTION 'Only administrators can update registrations'; END IF;
  IF viewer_role = 'admin' AND NOT (admin_permissions ? 'manage_registrations') THEN RAISE EXCEPTION 'You do not have permission to manage registrations'; END IF;
  IF p_status NOT IN ('approved','blocked') THEN RAISE EXCEPTION 'Invalid registration status'; END IF;
  IF viewer_role = 'admin' AND target_role = 'superadmin' THEN RAISE EXCEPTION 'Administrators cannot modify superadmin registrations'; END IF;
  UPDATE public.users SET registration_status=p_status,is_locked_out=(p_status='blocked') WHERE id=p_user_id;
  RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS public.get_admin_users();
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE(user_id UUID,id_number VARCHAR,username VARCHAR,email VARCHAR,role VARCHAR,registration_status VARCHAR,is_locked_out BOOLEAN,created_at TIMESTAMPTZ,admin_permissions JSONB,viewer_permissions JSONB,"position" VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer_role TEXT;
BEGIN
  SELECT u.role INTO viewer_role FROM public.users AS u WHERE u.id = auth.uid();
  IF viewer_role IS NULL OR viewer_role NOT IN ('admin','superadmin') THEN
    RAISE EXCEPTION 'Only administrators can view users';
  END IF;
  RETURN QUERY SELECT u.id,u.id_number,u.username,u.email,u.role,u.registration_status,u.is_locked_out,u.created_at,COALESCE(u.admin_permissions, '[]'::jsonb),COALESCE((SELECT viewer.admin_permissions FROM public.users AS viewer WHERE viewer.id = auth.uid()), '[]'::jsonb),p.position
    FROM public.users AS u LEFT JOIN public.profiles AS p ON p.user_id = u.id
    WHERE (viewer_role = 'superadmin' OR u.role <> 'superadmin')
    ORDER BY u.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.create_delete_request(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.create_delete_request(p_user_id UUID,p_reason TEXT)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users AS viewer WHERE viewer.id = auth.uid() AND viewer.role = 'admin' AND viewer.admin_permissions ? 'delete_accounts') THEN
    RAISE EXCEPTION 'You do not have permission to request account deletion';
  END IF;
  IF (SELECT target.role FROM public.users AS target WHERE target.id = p_user_id) = 'superadmin' THEN
    RAISE EXCEPTION 'Administrators cannot request deletion of superadmins';
  END IF;
  IF length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'A deletion reason is required'; END IF;
  INSERT INTO public.delete_requests(user_id,requested_by,reason) VALUES(p_user_id,auth.uid(),trim(p_reason)) RETURNING id INTO rid;
  RETURN rid;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT, JSONB) TO authenticated;

DROP FUNCTION IF EXISTS public.get_all_users();
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE(user_id UUID,id_number VARCHAR,username VARCHAR,email VARCHAR,role VARCHAR,registration_status VARCHAR,is_locked_out BOOLEAN,created_at TIMESTAMPTZ,admin_permissions JSONB,"position" VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users AS viewer WHERE viewer.id = auth.uid() AND viewer.role = 'superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can view all users';
  END IF;
  RETURN QUERY SELECT u.id,u.id_number,u.username,u.email,u.role,u.registration_status,u.is_locked_out,u.created_at,COALESCE(u.admin_permissions, '[]'::jsonb),p.position
  FROM users u LEFT JOIN profiles p ON p.user_id = u.id ORDER BY u.created_at DESC;
END;
$$;
