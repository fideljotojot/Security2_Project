-- Apply after migration_superadmin_capacity.sql and current account-management migrations.
-- Reserve at most two slots across active, inactive and incomplete superadmins.
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_superadmin_slots() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE occupied INTEGER; old_occupies BOOLEAN := false;
BEGIN
  IF NEW.role IS DISTINCT FROM 'superadmin'
     AND (TG_OP='INSERT' OR OLD.role IS DISTINCT FROM 'superadmin') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('superadmin-capacity', 0));
  IF TG_OP='UPDATE' THEN
    old_occupies := OLD.role='superadmin' AND OLD.registration_status IN ('approved','inactive','incomplete');
  END IF;
  IF NEW.role='superadmin' AND NEW.registration_status IN ('approved','inactive','incomplete')
     AND NOT COALESCE(old_occupies,false) THEN
    SELECT count(*) INTO occupied FROM public.users
      WHERE role='superadmin' AND registration_status IN ('approved','inactive','incomplete');
    IF occupied >= 2 THEN
      RAISE EXCEPTION 'Superadmin limit reached. Only two active, inactive or incomplete superadmin accounts are allowed.'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_superadmin_slots ON public.users;
CREATE TRIGGER guard_superadmin_slots BEFORE INSERT OR UPDATE OF role,registration_status ON public.users
FOR EACH ROW EXECUTE FUNCTION public.guard_superadmin_slots();
REVOKE ALL ON FUNCTION public.guard_superadmin_slots() FROM PUBLIC;
NOTIFY pgrst, 'reload schema';
COMMIT;
