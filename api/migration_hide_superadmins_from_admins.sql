-- Prevent administrators from discovering or reading superadmin accounts.
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE(user_id UUID,id_number VARCHAR,username VARCHAR,email VARCHAR,role VARCHAR,
  registration_status VARCHAR,is_locked_out BOOLEAN,created_at TIMESTAMPTZ,
  admin_permissions JSONB,viewer_permissions JSONB,"position" VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer_role TEXT;
BEGIN
  SELECT u.role INTO viewer_role FROM public.users AS u WHERE u.id = auth.uid();
  IF viewer_role IS NULL OR viewer_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only administrators can view users';
  END IF;
  RETURN QUERY
    SELECT u.id, u.id_number, u.username, u.email, u.role, u.registration_status,
      u.is_locked_out, u.created_at, COALESCE(u.admin_permissions, '[]'::jsonb),
      COALESCE((SELECT v.admin_permissions FROM public.users v WHERE v.id = auth.uid()), '[]'::jsonb),
      p.position
    FROM public.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE (viewer_role = 'superadmin' OR u.role <> 'superadmin')
    ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_full_user_for_admin_edit(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB; viewer_role TEXT;
BEGIN
  SELECT role INTO viewer_role FROM public.users WHERE id = auth.uid();
  IF viewer_role IS NULL OR viewer_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only administrators can view users';
  END IF;
  IF viewer_role = 'admin' AND (SELECT role FROM public.users WHERE id = p_user_id) = 'superadmin' THEN
    RAISE EXCEPTION 'Administrators cannot view superadmins';
  END IF;
  SELECT jsonb_build_object('user_id', u.id, 'id_number', u.id_number, 'username', u.username,
    'email', u.email, 'role', u.role, 'first_name', p.first_name, 'middle_initial', p.middle_initial,
    'last_name', p.last_name, 'suffix', p.suffix, 'birthdate', p.birthdate, 'age', p.age,
    'sex', p.sex, 'position', p.position, 'purok', a.purok, 'barangay', a.barangay,
    'city', a.city, 'province', a.province, 'country', a.country, 'zip', a.zip)
    INTO result
    FROM public.users u LEFT JOIN public.profiles p ON p.user_id = u.id
    LEFT JOIN public.addresses a ON a.user_id = u.id WHERE u.id = p_user_id;
  RETURN result;
END;
$$;
