-- Run LAST, after all account-management migrations.
BEGIN;
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

-- Table-level protection also applies inside SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.guard_admin_block_targets() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE viewer_role TEXT; viewer_status TEXT; viewer_locked BOOLEAN;
BEGIN
  IF (NEW.registration_status = 'blocked' AND OLD.registration_status IS DISTINCT FROM 'blocked')
     OR (NEW.is_locked_out IS TRUE AND OLD.is_locked_out IS DISTINCT FROM TRUE) THEN
    -- Permit trusted database maintenance without an end-user identity.
    IF auth.uid() IS NULL AND (session_user IN ('postgres', 'supabase_admin')
       OR COALESCE(auth.role(), '') = 'service_role') THEN RETURN NEW; END IF;
    SELECT role, registration_status, is_locked_out INTO viewer_role, viewer_status, viewer_locked
    FROM public.users WHERE id = auth.uid();
    IF viewer_role IS NULL OR viewer_role NOT IN ('admin', 'superadmin')
       OR viewer_status IS DISTINCT FROM 'approved' OR viewer_locked IS DISTINCT FROM FALSE THEN
      RAISE EXCEPTION 'Only active administrators can block accounts.' USING ERRCODE='42501';
    END IF;
    IF viewer_role = 'admin' AND (OLD.role IS DISTINCT FROM 'user' OR NEW.role IS DISTINCT FROM 'user') THEN
      RAISE EXCEPTION 'Admins can only block user accounts.' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_admin_block_targets ON public.users;
CREATE TRIGGER guard_admin_block_targets BEFORE UPDATE OF registration_status,is_locked_out ON public.users
FOR EACH ROW EXECUTE FUNCTION public.guard_admin_block_targets();
REVOKE ALL ON FUNCTION public.guard_admin_block_targets() FROM PUBLIC;
NOTIFY pgrst, 'reload schema';
COMMIT;
