-- Apply after migration_audit_logs.sql in the Supabase SQL Editor.
-- Replaces functions only; existing rows, triggers, and access rules are preserved.
BEGIN;

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

CREATE OR REPLACE FUNCTION public.audit_user_changes() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details, ip_address)
  VALUES (auth.uid(), CASE WHEN TG_OP='INSERT' THEN 'Signed up' WHEN TG_OP='DELETE' THEN 'Deleted user' WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'Changed admin privilege' WHEN NEW.registration_status='approved' AND OLD.registration_status='pending' THEN 'Approved registration' WHEN NEW.registration_status='blocked' AND OLD.registration_status='pending' THEN 'Rejected registration' WHEN NEW.registration_status='blocked' AND OLD.registration_status IS DISTINCT FROM 'blocked' THEN 'Blocked user' WHEN NEW.registration_status='approved' AND OLD.registration_status='blocked' THEN 'Unblocked user' ELSE 'Updated user' END, 'user', COALESCE(NEW.id, OLD.id)::TEXT, jsonb_build_object('username', COALESCE(NEW.username, OLD.username), 'operation', TG_OP, 'old_role', OLD.role, 'new_role', NEW.role), public.audit_request_ip());
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE FUNCTION public.audit_delete_request_changes() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details, ip_address)
  VALUES (auth.uid(), CASE WHEN TG_OP='INSERT' THEN 'Created deletion request' WHEN TG_OP='UPDATE' AND NEW.status='approved' THEN 'Approved deletion request' WHEN TG_OP='UPDATE' AND NEW.status='rejected' THEN 'Rejected deletion request' ELSE 'Removed deletion request' END, 'deletion request', COALESCE(NEW.id, OLD.id)::TEXT, jsonb_build_object('status', COALESCE(NEW.status, OLD.status), 'operation', TG_OP), public.audit_request_ip());
  RETURN COALESCE(NEW, OLD);
END; $$;

COMMIT;
