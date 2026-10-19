-- Run in Supabase SQL Editor after audit logging is installed.
-- Names reflect current profiles; no audit rows or IP functions are modified.
BEGIN;

-- Preserve execution grants while replacing the RPC's return type.
DO $migration$
DECLARE
  old_acl ACLITEM[];
  old_owner NAME;
  permission RECORD;
  role_sql TEXT;
BEGIN
  SELECT COALESCE(p.proacl, acldefault('f', p.proowner)), r.rolname
  INTO old_acl, old_owner
  FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.oid = to_regprocedure('public.get_audit_logs(integer)');

  DROP FUNCTION IF EXISTS public.get_audit_logs(INTEGER);
  EXECUTE $definition$
CREATE OR REPLACE FUNCTION public.get_audit_logs(p_limit INTEGER DEFAULT 20)
RETURNS TABLE(log_id BIGINT, action TEXT, entity_type TEXT, entity_id TEXT,
  details JSONB, actor_username TEXT, actor_role TEXT, ip_address INET,
  created_at TIMESTAMPTZ, actor_full_name TEXT, actor_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can view audit logs';
  END IF;
  RETURN QUERY
  SELECT l.id, l.action, l.entity_type, l.entity_id, l.details,
    u.username::TEXT, u.role::TEXT, l.ip_address, l.created_at,
    NULLIF(concat_ws(' ', NULLIF(btrim(p.first_name), ''),
      NULLIF(btrim(p.middle_initial), ''), NULLIF(btrim(p.last_name), ''),
      NULLIF(btrim(p.suffix), '')), ''), l.actor_id
  FROM public.audit_logs l
  LEFT JOIN public.users u ON u.id = l.actor_id
  -- Older schemas allow multiple profiles; keep one result per audit entry.
  LEFT JOIN LATERAL (
    SELECT profile.first_name, profile.middle_initial, profile.last_name, profile.suffix
    FROM public.profiles profile WHERE profile.user_id = u.id
    ORDER BY profile.id LIMIT 1
  ) p ON true
  ORDER BY l.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$function$;
$definition$;

  IF old_acl IS NOT NULL THEN
    -- Remove defaults on the new function before restoring the saved grants.
    FOR permission IN
      SELECT a.grantee FROM pg_proc p,
        LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
      WHERE p.oid = 'public.get_audit_logs(integer)'::regprocedure
    LOOP
      role_sql := CASE WHEN permission.grantee = 0 THEN 'PUBLIC'
        ELSE quote_ident(pg_get_userbyid(permission.grantee)) END;
      EXECUTE 'REVOKE ALL ON FUNCTION public.get_audit_logs(INTEGER) FROM ' || role_sql;
    END LOOP;
    FOR permission IN SELECT * FROM aclexplode(old_acl)
    LOOP
      role_sql := CASE WHEN permission.grantee = 0 THEN 'PUBLIC'
        ELSE quote_ident(pg_get_userbyid(permission.grantee)) END;
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_audit_logs(INTEGER) TO ' || role_sql
        || CASE WHEN permission.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END;
    END LOOP;
    EXECUTE format('ALTER FUNCTION public.get_audit_logs(INTEGER) OWNER TO %I', old_owner);
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;
