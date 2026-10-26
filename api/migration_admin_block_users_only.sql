-- Apply after current account-management migrations.
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_admin_block_targets() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF (NEW.registration_status = 'blocked' AND OLD.registration_status IS DISTINCT FROM 'blocked')
     OR (NEW.is_locked_out IS TRUE AND OLD.is_locked_out IS DISTINCT FROM TRUE) THEN
    IF EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
       AND (OLD.role IS DISTINCT FROM 'user' OR NEW.role IS DISTINCT FROM 'user') THEN
      RAISE EXCEPTION 'Admins can only block user accounts.' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_admin_block_targets ON public.users;
CREATE TRIGGER guard_admin_block_targets BEFORE UPDATE OF registration_status,is_locked_out ON public.users
FOR EACH ROW EXECUTE FUNCTION public.guard_admin_block_targets();
REVOKE ALL ON FUNCTION public.guard_admin_block_targets() FROM PUBLIC;
NOTIFY pgrst, 'reload schema';
COMMIT;
