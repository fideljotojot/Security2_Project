-- Apply after migration_admin_activity_logs.sql and existing admin permission migrations.
BEGIN;

CREATE OR REPLACE FUNCTION public.audit_delete_request_changes() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE request_row public.delete_requests;
BEGIN
  IF TG_OP = 'DELETE' THEN request_row := OLD; ELSE request_row := NEW; END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details, ip_address)
  VALUES(auth.uid(), CASE WHEN TG_OP='INSERT' THEN 'Created deletion request'
    WHEN TG_OP='UPDATE' AND NEW.status='approved' THEN 'Approved deletion request'
    WHEN TG_OP='UPDATE' AND NEW.status='rejected' THEN 'Rejected deletion request'
    ELSE 'Removed deletion request' END, 'deletion request', request_row.id::TEXT,
    jsonb_build_object('status', request_row.status, 'operation', TG_OP,
      'reason', request_row.reason, 'target_user_id', request_row.user_id), public.audit_request_ip());
  RETURN request_row;
END; $$;

CREATE OR REPLACE FUNCTION public.review_delete_request(p_request_id BIGINT,p_approve BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE request_row public.delete_requests; target_role TEXT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can review deletion requests'; END IF;
  IF p_approve IS NULL THEN RAISE EXCEPTION 'An approval decision is required'; END IF;
  SELECT * INTO request_row FROM public.delete_requests WHERE id=p_request_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT role INTO target_role FROM public.users WHERE id=request_row.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account no longer exists'; END IF;
  IF p_approve AND (request_row.user_id=auth.uid() OR target_role='superadmin') THEN
    RAISE EXCEPTION 'Superadmin accounts cannot be deleted'; END IF;
  UPDATE public.delete_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by=auth.uid(),reviewed_at=now() WHERE id=p_request_id;
  IF p_approve THEN
    -- Record once before cascades; account triggers merge into this event.
    PERFORM public.record_account_change(request_row.user_id, 'Deleted user', ARRAY['account']);
    UPDATE public.audit_logs SET details=details || jsonb_build_object('reason', request_row.reason,
      'deletion_request_id', request_row.id)
      WHERE transaction_id=txid_current() AND entity_type='user'
      AND entity_id=request_row.user_id::TEXT AND actor_id=auth.uid();
    DELETE FROM auth.users WHERE id=request_row.user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Authentication account no longer exists'; END IF;
  END IF;
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.create_delete_request(p_user_id UUID,p_reason TEXT)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE rid BIGINT; viewer_role TEXT; target_role TEXT; permissions JSONB; reason TEXT;
BEGIN
  SELECT role,admin_permissions INTO viewer_role,permissions FROM public.users WHERE id=auth.uid();
  IF viewer_role IS NULL OR viewer_role NOT IN ('admin','superadmin') OR
    (viewer_role='admin' AND NOT COALESCE(permissions ? 'delete_accounts', false)) THEN
    RAISE EXCEPTION 'You do not have permission to request account deletion'; END IF;
  reason := regexp_replace(p_reason, '^\s+|\s+$', '', 'g');
  IF reason IS NULL OR length(reason)<3 THEN RAISE EXCEPTION 'A deletion reason of at least 3 characters is required'; END IF;
  IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'You cannot delete your own account'; END IF;
  SELECT role INTO target_role FROM public.users WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account no longer exists'; END IF;
  IF target_role='superadmin' THEN RAISE EXCEPTION 'Superadmin accounts cannot be deleted'; END IF;
  INSERT INTO public.delete_requests(user_id,requested_by,reason) VALUES(p_user_id,auth.uid(),reason) RETURNING id INTO rid;
  IF viewer_role='superadmin' THEN PERFORM public.review_delete_request(rid,true); END IF;
  RETURN rid;
END; $$;

DROP FUNCTION IF EXISTS public.delete_user_account(UUID);
REVOKE ALL ON FUNCTION public.create_delete_request(UUID,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_delete_request(BIGINT,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_delete_request(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_delete_request(BIGINT,BOOLEAN) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
