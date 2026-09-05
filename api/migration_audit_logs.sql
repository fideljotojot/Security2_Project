CREATE TABLE IF NOT EXISTS public.audit_logs (id BIGSERIAL PRIMARY KEY, actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.create_audit_log(p_action TEXT,p_entity_type TEXT,p_entity_id TEXT DEFAULT NULL,p_details JSONB DEFAULT '{}'::jsonb) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,details) VALUES(auth.uid(),p_action,p_entity_type,p_entity_id,COALESCE(p_details,'{}'::jsonb)); RETURN currval('public.audit_logs_id_seq'); END; $$;
CREATE OR REPLACE FUNCTION public.get_audit_logs(p_limit INTEGER DEFAULT 20) RETURNS TABLE(log_id BIGINT,action TEXT,entity_type TEXT,entity_id TEXT,details JSONB,actor_username TEXT,created_at TIMESTAMPTZ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='superadmin') THEN RAISE EXCEPTION 'Only superadmins can view audit logs'; END IF; RETURN QUERY SELECT l.id,l.action,l.entity_type,l.entity_id,l.details,u.username::TEXT,l.created_at FROM public.audit_logs l LEFT JOIN public.users u ON u.id=l.actor_id ORDER BY l.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),100); END; $$;

CREATE OR REPLACE FUNCTION public.audit_user_changes() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN TG_OP='INSERT' THEN 'Signed up' WHEN TG_OP='DELETE' THEN 'Deleted user' WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'Changed admin privilege' WHEN NEW.registration_status='approved' AND OLD.registration_status='pending' THEN 'Approved registration' WHEN NEW.registration_status='blocked' AND OLD.registration_status='pending' THEN 'Rejected registration' WHEN NEW.registration_status='blocked' AND OLD.registration_status IS DISTINCT FROM 'blocked' THEN 'Blocked user' WHEN NEW.registration_status='approved' AND OLD.registration_status='blocked' THEN 'Unblocked user' ELSE 'Updated user' END, 'user', COALESCE(NEW.id, OLD.id)::TEXT, jsonb_build_object('username', COALESCE(NEW.username, OLD.username), 'operation', TG_OP, 'old_role', OLD.role, 'new_role', NEW.role));
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS audit_users_changes ON public.users;
CREATE TRIGGER audit_users_changes AFTER INSERT OR UPDATE OR DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.audit_user_changes();

CREATE OR REPLACE FUNCTION public.audit_delete_request_changes() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN TG_OP='INSERT' THEN 'Created deletion request' WHEN TG_OP='UPDATE' AND NEW.status='approved' THEN 'Approved deletion request' WHEN TG_OP='UPDATE' AND NEW.status='rejected' THEN 'Rejected deletion request' ELSE 'Removed deletion request' END, 'deletion request', COALESCE(NEW.id, OLD.id)::TEXT, jsonb_build_object('status', COALESCE(NEW.status, OLD.status), 'operation', TG_OP));
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS audit_delete_request_changes ON public.delete_requests;
CREATE TRIGGER audit_delete_request_changes AFTER INSERT OR UPDATE OR DELETE ON public.delete_requests FOR EACH ROW EXECUTE FUNCTION public.audit_delete_request_changes();
