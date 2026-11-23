-- Automatic blocking removed; slot limits reject additions instead.
-- Apply migration_remove_auto_block.sql LAST on existing installations.
DROP TRIGGER IF EXISTS enforce_superadmin_capacity ON public.users;
DROP FUNCTION IF EXISTS public.normalize_superadmin_capacity_on_change();
DROP FUNCTION IF EXISTS public.normalize_superadmin_capacity();

-- Logout only changes the caller's own superadmin status, never other accounts.
CREATE OR REPLACE FUNCTION public.deactivate_superadmin_on_logout()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.users SET registration_status = 'inactive', is_locked_out = FALSE
  WHERE id = auth.uid() AND role = 'superadmin' AND registration_status = 'approved';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.deactivate_superadmin_on_logout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_superadmin_on_logout() TO authenticated;


-- Atomically replace the inactive backup while an active superadmin is signed in.
CREATE OR REPLACE FUNCTION public.replace_inactive_superadmin_backup(
  p_block_user_id UUID,
  p_unblock_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_status TEXT;
  v_block_role TEXT;
  v_block_status TEXT;
  v_unblock_role TEXT;
  v_unblock_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('superadmin-capacity', 0));

  SELECT registration_status INTO v_caller_status
  FROM public.users
  WHERE id = auth.uid() AND role = 'superadmin';
  IF v_caller_status <> 'approved' THEN
    RAISE EXCEPTION 'Only the active superadmin can replace the inactive backup';
  END IF;
  IF p_block_user_id = p_unblock_user_id THEN
    RAISE EXCEPTION 'The accounts to block and unblock must be different';
  END IF;

  SELECT role, registration_status INTO v_block_role, v_block_status
  FROM public.users WHERE id = p_block_user_id FOR UPDATE;
  SELECT role, registration_status INTO v_unblock_role, v_unblock_status
  FROM public.users WHERE id = p_unblock_user_id FOR UPDATE;
  IF v_block_role <> 'superadmin' OR v_block_status <> 'inactive' THEN
    RAISE EXCEPTION 'The account to block must be an inactive superadmin';
  END IF;
  IF v_unblock_role <> 'superadmin' OR v_unblock_status <> 'blocked' THEN
    RAISE EXCEPTION 'The account to unblock must be a blocked superadmin';
  END IF;

  UPDATE public.users
  SET registration_status = 'blocked', is_locked_out = TRUE
  WHERE id = p_block_user_id;
  UPDATE public.users
  SET registration_status = 'inactive', is_locked_out = FALSE
  WHERE id = p_unblock_user_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_inactive_superadmin_backup(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_inactive_superadmin_backup(UUID, UUID) TO authenticated;

-- Restore a blocked account after password confirmation, optionally changing
-- its role and position in the same transaction.
CREATE OR REPLACE FUNCTION public.restore_blocked_account(
  p_user_id UUID,
  p_role TEXT,
  p_position TEXT,
  p_block_inactive_superadmin_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer_role TEXT;
  v_viewer_status TEXT;
  v_target_role TEXT;
  v_target_status TEXT;
  v_has_active_superadmin BOOLEAN;
  v_permissions JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('superadmin-capacity', 0));

  SELECT role, registration_status INTO v_viewer_role, v_viewer_status
  FROM public.users WHERE id = auth.uid();
  IF v_viewer_role IS NULL OR v_viewer_role NOT IN ('admin', 'superadmin')
     OR v_viewer_status <> 'approved' THEN
    RAISE EXCEPTION 'Only an active administrator can restore accounts';
  END IF;
  IF p_role NOT IN ('user', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF (p_role = 'user' AND p_position NOT IN ('Student', 'Instructor', 'Staff'))
     OR (p_role IN ('admin', 'superadmin') AND p_position NOT IN ('Instructor', 'Staff')) THEN
    RAISE EXCEPTION 'Invalid position for selected role';
  END IF;
  IF p_role = 'superadmin' AND v_viewer_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Administrators cannot assign the superadmin role';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot restore your own account';
  END IF;

  SELECT role, registration_status INTO v_target_role, v_target_status
  FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF v_target_status <> 'blocked' THEN
    RAISE EXCEPTION 'Only blocked accounts can be restored';
  END IF;

  IF v_viewer_role = 'admin' AND v_target_role = 'superadmin' THEN
    RAISE EXCEPTION 'Administrators cannot restore superadmins';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE role = 'superadmin' AND registration_status = 'approved'
  ) INTO v_has_active_superadmin;

  IF p_role = 'superadmin' AND v_has_active_superadmin THEN
    -- A null replacement is valid when no inactive backup exists. The target
    -- account will be restored as the inactive backup below.
    IF p_block_inactive_superadmin_id IS NOT NULL THEN
      IF p_block_inactive_superadmin_id = p_user_id THEN
        RAISE EXCEPTION 'An inactive superadmin must be selected before restoring this account';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_block_inactive_superadmin_id
          AND role = 'superadmin' AND registration_status = 'inactive'
      ) THEN
        RAISE EXCEPTION 'The selected account must be an inactive superadmin';
      END IF;
      UPDATE public.users
      SET registration_status = 'blocked', is_locked_out = TRUE
      WHERE id = p_block_inactive_superadmin_id;
    END IF;
  ELSIF p_block_inactive_superadmin_id IS NOT NULL THEN
    RAISE EXCEPTION 'An inactive superadmin may only be blocked for a superadmin restoration';
  END IF;

  v_permissions := CASE
    WHEN p_role = 'superadmin' THEN to_jsonb(ARRAY['manage_registrations','manage_account_info','block_accounts','reset_passwords','delete_accounts'])
    WHEN p_role = 'user' THEN '[]'::jsonb
    ELSE (SELECT COALESCE(admin_permissions, '[]'::jsonb) FROM public.users WHERE id = p_user_id)
  END;

  UPDATE public.users
  SET role = p_role,
      registration_status = CASE WHEN p_role = 'superadmin' AND v_has_active_superadmin THEN 'inactive' ELSE 'approved' END,
      is_locked_out = FALSE,
      admin_permissions = v_permissions
  WHERE id = p_user_id;

  UPDATE public.profiles
  SET position = p_position
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_blocked_account(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_blocked_account(UUID, TEXT, TEXT, UUID) TO authenticated;
