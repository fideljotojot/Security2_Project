CREATE TABLE IF NOT EXISTS public.audit_logs (id BIGSERIAL PRIMARY KEY, actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, details JSONB NOT NULL DEFAULT '{}'::jsonb, ip_address INET, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- Informational client IP only: forwarded headers are not security evidence.
CREATE OR REPLACE FUNCTION public.audit_request_ip()
RETURNS INET
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog
AS $$
DECLARE
  headers JSONB;
  client_ip TEXT;
BEGIN
  headers := NULLIF(current_setting('request.headers', true), '')::JSONB;
  client_ip := NULLIF(btrim(split_part(headers->>'x-forwarded-for', ',', 1)), '');
  RETURN client_ip::INET;
EXCEPTION
  WHEN invalid_text_representation THEN
    -- Missing/malformed request context must not interrupt the audited action.
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_audit_log(p_action TEXT,p_entity_type TEXT,p_entity_id TEXT DEFAULT NULL,p_details JSONB DEFAULT '{}'::jsonb) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,details,ip_address) VALUES(auth.uid(),p_action,p_entity_type,p_entity_id,COALESCE(p_details,'{}'::jsonb),public.audit_request_ip()); RETURN currval('public.audit_logs_id_seq'); END; $$;
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

CREATE OR REPLACE FUNCTION public.audit_user_changes() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details, ip_address)
  VALUES (auth.uid(), CASE WHEN TG_OP='INSERT' THEN 'Signed up' WHEN TG_OP='DELETE' THEN 'Deleted user' WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'Changed admin privilege' WHEN NEW.registration_status='approved' AND OLD.registration_status='pending' THEN 'Approved registration' WHEN NEW.registration_status='blocked' AND OLD.registration_status='pending' THEN 'Rejected registration' WHEN NEW.registration_status='blocked' AND OLD.registration_status IS DISTINCT FROM 'blocked' THEN 'Blocked user' WHEN NEW.registration_status='approved' AND OLD.registration_status='blocked' THEN 'Unblocked user' ELSE 'Updated user' END, 'user', COALESCE(NEW.id, OLD.id)::TEXT, jsonb_build_object('username', COALESCE(NEW.username, OLD.username), 'operation', TG_OP, 'old_role', OLD.role, 'new_role', NEW.role), public.audit_request_ip());
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS audit_users_changes ON public.users;
CREATE TRIGGER audit_users_changes AFTER INSERT OR UPDATE OR DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.audit_user_changes();

CREATE OR REPLACE FUNCTION public.audit_delete_request_changes() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details, ip_address)
  VALUES (auth.uid(), CASE WHEN TG_OP='INSERT' THEN 'Created deletion request' WHEN TG_OP='UPDATE' AND NEW.status='approved' THEN 'Approved deletion request' WHEN TG_OP='UPDATE' AND NEW.status='rejected' THEN 'Rejected deletion request' ELSE 'Removed deletion request' END, 'deletion request', COALESCE(NEW.id, OLD.id)::TEXT, jsonb_build_object('status', COALESCE(NEW.status, OLD.status), 'operation', TG_OP), public.audit_request_ip());
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS audit_delete_request_changes ON public.delete_requests;
CREATE TRIGGER audit_delete_request_changes AFTER INSERT OR UPDATE OR DELETE ON public.delete_requests FOR EACH ROW EXECUTE FUNCTION public.audit_delete_request_changes();
