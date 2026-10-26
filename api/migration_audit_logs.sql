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

-- BEGIN CATEGORIZED ACTIVITY LOGS
-- Apply after migration_audit_actor_full_name.sql and migration_audit_request_ip.sql.
-- This migration is also embedded at the end of the audit installation scripts.
BEGIN;

CREATE TABLE IF NOT EXISTS public.application_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  login_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT CHECK (end_reason IN ('logout', 'timeout')),
  user_agent TEXT,
  ip_address INET
);
ALTER TABLE public.application_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_sessions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS module TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS application_session_id UUID
  REFERENCES public.application_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS transaction_id BIGINT;
UPDATE public.audit_logs SET category = CASE WHEN entity_type = 'authentication'
  THEN 'security' ELSE 'activity' END WHERE category IS NULL;
UPDATE public.audit_logs SET module = CASE entity_type
  WHEN 'authentication' THEN 'Authentication' WHEN 'deletion request' THEN 'Deletion Requests'
  WHEN 'user' THEN 'User Management' ELSE 'General' END WHERE module IS NULL;
ALTER TABLE public.audit_logs ALTER COLUMN category SET DEFAULT 'activity';
ALTER TABLE public.audit_logs ALTER COLUMN category SET NOT NULL;
CREATE INDEX IF NOT EXISTS audit_logs_category_created_idx ON public.audit_logs(category, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_logs_transaction_target_idx ON public.audit_logs(transaction_id, entity_type, entity_id);

CREATE OR REPLACE FUNCTION public.audit_header(p_name TEXT) RETURNS TEXT
LANGUAGE plpgsql STABLE SET search_path = pg_catalog AS $$
BEGIN
  RETURN NULLIF(current_setting('request.headers', true), '')::JSONB ->> p_name;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.enrich_audit_log() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE session_id UUID;
BEGIN
  NEW.category := CASE WHEN NEW.entity_type = 'authentication' THEN 'security'
    ELSE COALESCE(NEW.category, 'activity') END;
  NEW.module := COALESCE(NEW.module, CASE NEW.entity_type
    WHEN 'authentication' THEN 'Authentication' WHEN 'deletion request' THEN 'Deletion Requests'
    WHEN 'user' THEN CASE WHEN NEW.actor_id::TEXT = NEW.entity_id THEN 'Account Management' ELSE 'User Management' END
    ELSE 'General' END);
  NEW.user_agent := left(public.audit_header('user-agent'), 1024);
  NEW.transaction_id := txid_current();
  BEGIN
    session_id := public.audit_header('x-app-session-id')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN session_id := NULL;
  END;
  -- The header is only a lookup hint; the authenticated owner is checked here.
  IF NEW.application_session_id IS NULL AND EXISTS (
    SELECT 1 FROM public.application_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid() AND s.ended_at IS NULL
  ) THEN NEW.application_session_id := session_id; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS enrich_audit_log ON public.audit_logs;
CREATE TRIGGER enrich_audit_log BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.enrich_audit_log();

CREATE OR REPLACE FUNCTION public.start_application_session(p_session_id UUID, p_resumed BOOLEAN DEFAULT false)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE inserted_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.users
    WHERE id = auth.uid() AND registration_status IN ('approved', 'incomplete') AND NOT is_locked_out)
    THEN RAISE EXCEPTION 'An eligible signed-in account is required' USING ERRCODE = '42501'; END IF;
  IF p_session_id IS NULL THEN RAISE EXCEPTION 'A session ID is required'; END IF;
  INSERT INTO public.application_sessions(id, user_id, login_at, user_agent, ip_address)
  VALUES(p_session_id, auth.uid(), CASE WHEN NOT p_resumed THEN now() END,
    left(public.audit_header('user-agent'), 1024), public.audit_request_ip())
  ON CONFLICT (id) DO NOTHING RETURNING id INTO inserted_id;
  IF NOT EXISTS (SELECT 1 FROM public.application_sessions WHERE id = p_session_id
    AND user_id = auth.uid() AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'Session is unavailable' USING ERRCODE = '42501'; END IF;
  IF inserted_id IS NOT NULL THEN
    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details, ip_address, application_session_id)
    VALUES(auth.uid(), CASE WHEN p_resumed THEN 'Session resumed' ELSE 'Login' END,
      'authentication', auth.uid()::TEXT, jsonb_build_object('summary',
        CASE WHEN p_resumed THEN 'Existing session detected; original login time is unknown.' ELSE 'Logged in successfully.' END),
      public.audit_request_ip(), p_session_id);
  END IF;
  RETURN p_session_id;
END; $$;

CREATE OR REPLACE FUNCTION public.heartbeat_application_session(p_session_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.application_sessions SET last_seen_at = now()
  WHERE id = p_session_id AND user_id = auth.uid() AND ended_at IS NULL;
  RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.end_application_session(p_session_id UUID, p_reason TEXT DEFAULT 'logout')
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE ended_id UUID;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('logout', 'timeout') THEN RAISE EXCEPTION 'Invalid session end reason'; END IF;
  UPDATE public.application_sessions SET ended_at = now(), end_reason = p_reason
  WHERE id = p_session_id AND user_id = auth.uid() AND ended_at IS NULL RETURNING id INTO ended_id;
  IF ended_id IS NOT NULL THEN
    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details, ip_address, application_session_id)
    VALUES(auth.uid(), CASE WHEN p_reason = 'timeout' THEN 'Session Timeout' ELSE 'Logout' END,
      'authentication', auth.uid()::TEXT, jsonb_build_object('summary', CASE WHEN p_reason = 'timeout'
        THEN 'Session ended after three minutes of superadmin inactivity.' ELSE 'User logged out.' END),
      public.audit_request_ip(), ended_id);
  END IF;
  RETURN ended_id IS NOT NULL;
END; $$;

-- Aggregate account-table writes in one transaction into one audit event per target.
-- Details contain field names and safe account identifiers, never field values.
CREATE OR REPLACE FUNCTION public.record_account_change(p_user_id UUID, p_action TEXT, p_fields TEXT[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE existing_id BIGINT; target_username TEXT; previous_action TEXT; merged_fields JSONB;
BEGIN
  SELECT username INTO target_username FROM public.users WHERE id = p_user_id;
  SELECT id, action INTO existing_id, previous_action FROM public.audit_logs
    WHERE transaction_id = txid_current() AND entity_type = 'user' AND entity_id = p_user_id::TEXT
    AND actor_id IS NOT DISTINCT FROM auth.uid() ORDER BY id LIMIT 1;
  IF existing_id IS NULL THEN
    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details, ip_address)
    VALUES(auth.uid(), p_action, 'user', p_user_id::TEXT,
      jsonb_build_object('target_username', target_username, 'changed_fields', to_jsonb(p_fields)), public.audit_request_ip());
  ELSE
    SELECT jsonb_agg(DISTINCT field ORDER BY field) INTO merged_fields FROM (
      SELECT jsonb_array_elements_text(COALESCE(details->'changed_fields', '[]'::JSONB)) AS field
        FROM public.audit_logs WHERE id = existing_id
      UNION SELECT unnest(p_fields)
    ) fields;
    UPDATE public.audit_logs SET details = details || jsonb_build_object('changed_fields', merged_fields),
      action = CASE
        WHEN p_action IN ('Signed up', 'Deleted user') THEN p_action
        WHEN previous_action IN ('Signed up', 'Deleted user', 'Password changed', 'Password reset') THEN previous_action
        WHEN p_action IN ('Password changed', 'Password reset', 'Changed admin privilege', 'Updated permissions') THEN p_action
        WHEN previous_action <> 'Updated user' THEN previous_action ELSE p_action END
    WHERE id = existing_id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_user_changes() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE fields TEXT[]; event_action TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_account_change(NEW.id, 'Signed up', ARRAY['account']); RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.record_account_change(OLD.id, 'Deleted user', ARRAY['account']); RETURN OLD;
  END IF;
  SELECT array_agg(key ORDER BY key) INTO fields FROM jsonb_each(to_jsonb(NEW)) item
    WHERE key IN ('id_number', 'username', 'email', 'role', 'registration_status', 'is_locked_out', 'admin_permissions')
      AND item.value IS DISTINCT FROM to_jsonb(OLD)->key;
  IF fields IS NULL THEN RETURN NEW; END IF;
  event_action := CASE
    WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'Changed admin privilege'
    WHEN to_jsonb(NEW)->'admin_permissions' IS DISTINCT FROM to_jsonb(OLD)->'admin_permissions' THEN 'Updated permissions'
    WHEN NEW.registration_status = 'approved' AND OLD.registration_status = 'pending' THEN 'Approved registration'
    WHEN NEW.registration_status = 'blocked' AND OLD.registration_status = 'pending' THEN 'Rejected registration'
    WHEN NEW.registration_status = 'blocked' AND OLD.registration_status IS DISTINCT FROM 'blocked' THEN 'Blocked user'
    WHEN NEW.registration_status = 'approved' AND OLD.registration_status = 'blocked' THEN 'Unblocked user'
    ELSE 'Updated user' END;
  PERFORM public.record_account_change(NEW.id, event_action, fields);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_profile_changes() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE fields TEXT[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key ORDER BY key) INTO fields FROM jsonb_each(to_jsonb(NEW)) item
      WHERE key NOT IN ('id', 'user_id') AND item.value IS DISTINCT FROM to_jsonb(OLD)->key;
  ELSE fields := ARRAY['profile']; END IF;
  IF fields IS NOT NULL THEN
    PERFORM public.record_account_change(COALESCE(NEW.user_id, OLD.user_id), 'Profile update', fields);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();
DROP TRIGGER IF EXISTS audit_address_changes ON public.addresses;
CREATE TRIGGER audit_address_changes AFTER INSERT OR UPDATE OR DELETE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();

CREATE OR REPLACE FUNCTION public.audit_password_changes() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    PERFORM public.record_account_change(NEW.id,
      CASE WHEN NEW.id = auth.uid() THEN 'Password changed' ELSE 'Password reset' END, ARRAY['password']);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS audit_password_changes ON auth.users;
CREATE TRIGGER audit_password_changes AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_password_changes();

CREATE OR REPLACE FUNCTION public.record_system_log(p_operation TEXT, p_code TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, module, category, details, ip_address)
  VALUES(auth.uid(), 'Operation failed', 'system', 'Application', 'system',
    jsonb_build_object('summary', 'An unexpected application operation failed.',
      'operation', left(regexp_replace(COALESCE(p_operation, 'unknown'), '[^a-zA-Z0-9_]', '', 'g'), 80),
      'code', left(regexp_replace(COALESCE(p_code, 'unknown'), '[^a-zA-Z0-9_]', '', 'g'), 32)), public.audit_request_ip());
END; $$;

CREATE OR REPLACE FUNCTION public.get_activity_log_page(
  p_category TEXT DEFAULT 'activity', p_search TEXT DEFAULT '', p_actor UUID DEFAULT NULL,
  p_action TEXT DEFAULT NULL, p_role TEXT DEFAULT NULL, p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL, p_page INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 8)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE result JSONB;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can view audit logs' USING ERRCODE = '42501'; END IF;
  IF p_category IS NULL OR p_category NOT IN ('all', 'activity', 'security', 'system')
    OR p_page IS NULL OR p_page < 1 OR p_page_size IS NULL OR p_page_size NOT IN (5, 7, 8, 10, 25, 50)
    OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to) THEN
    RAISE EXCEPTION 'Invalid log filters' USING ERRCODE = '22023'; END IF;
  WITH category_rows AS MATERIALIZED (
    SELECT l.id AS log_id, CASE WHEN l.action = 'Logged in' THEN 'Login' ELSE l.action END AS action, l.entity_type, l.entity_id, l.details,
      l.actor_id, u.id_number AS actor_id_number, u.username AS actor_username, u.role AS actor_role,
      NULLIF(concat_ws(' ', NULLIF(btrim(p.first_name), ''), NULLIF(btrim(p.middle_initial), ''),
        NULLIF(btrim(p.last_name), ''), NULLIF(btrim(p.suffix), '')), '') AS actor_full_name,
      l.category, l.module, l.user_agent, l.ip_address, l.created_at,
      l.application_session_id, CASE WHEN l.action IN ('Login', 'Logged in') THEN COALESCE(s.login_at, l.created_at) END AS time_in,
      CASE WHEN s.id IS NULL AND l.action = 'Logged out' THEN l.created_at ELSE s.ended_at END AS time_out,
      CASE WHEN s.id IS NULL THEN NULL WHEN s.ended_at IS NOT NULL THEN 'Ended'
        WHEN s.last_seen_at >= now() - INTERVAL '150 seconds' THEN 'Active' ELSE 'Unknown' END AS session_status
    FROM public.audit_logs l
    LEFT JOIN public.users u ON u.id = l.actor_id
    LEFT JOIN LATERAL (SELECT first_name, middle_initial, last_name, suffix FROM public.profiles
      WHERE user_id = u.id ORDER BY id LIMIT 1) p ON true
    LEFT JOIN public.application_sessions s ON s.id = l.application_session_id
    WHERE (p_category = 'all' OR l.category = p_category)
  ), matching AS MATERIALIZED (
    SELECT * FROM category_rows r
    WHERE (p_actor IS NULL OR r.actor_id = p_actor)
      AND (NULLIF(p_action, '') IS NULL OR r.action = CASE WHEN p_action = 'Logged in' THEN 'Login' ELSE p_action END)
      AND (NULLIF(p_role, '') IS NULL OR r.actor_role = p_role)
      AND (p_from IS NULL OR r.created_at >= p_from) AND (p_to IS NULL OR r.created_at < p_to)
      AND (NULLIF(btrim(p_search), '') IS NULL OR strpos(lower(concat_ws(' ', r.actor_id_number,
        r.actor_full_name, r.actor_username, r.action, r.module, r.entity_type, r.entity_id,
        r.ip_address::TEXT, r.details::TEXT)), lower(btrim(p_search))) > 0)
  ), page_rows AS (
    SELECT * FROM matching ORDER BY created_at DESC, log_id DESC
    LIMIT p_page_size OFFSET (p_page::BIGINT - 1) * p_page_size
  )
  SELECT jsonb_build_object('rows', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC, r.log_id DESC)
    FROM page_rows r), '[]'::JSONB), 'total', (SELECT count(*) FROM matching),
    'actors', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.name, a.id) FROM (
      SELECT DISTINCT actor_id AS id, COALESCE(actor_full_name, actor_username, 'System') AS name,
        actor_username AS username FROM category_rows WHERE actor_id IS NOT NULL) a), '[]'::JSONB),
    'actions', COALESCE((SELECT jsonb_agg(action ORDER BY action) FROM (SELECT DISTINCT action FROM category_rows) a), '[]'::JSONB),
    'roles', COALESCE((SELECT jsonb_agg(actor_role ORDER BY actor_role) FROM (
      SELECT DISTINCT actor_role FROM category_rows WHERE actor_role IS NOT NULL) r), '[]'::JSONB)) INTO result;
  RETURN result;
END; $$;

-- Existing replaced functions retain their ACL and owner via CREATE OR REPLACE.
-- New internal helpers are not callable through the public Data API.
REVOKE ALL ON FUNCTION public.audit_header(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enrich_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_account_change(UUID, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_profile_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_password_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_application_session(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.heartbeat_application_session(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_application_session(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_system_log(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_activity_log_page(TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_application_session(UUID, BOOLEAN),
  public.heartbeat_application_session(UUID), public.end_application_session(UUID, TEXT),
  public.record_system_log(TEXT, TEXT),
  public.get_activity_log_page(TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
-- END CATEGORIZED ACTIVITY LOGS
