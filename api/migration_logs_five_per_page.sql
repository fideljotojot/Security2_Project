-- Apply after migration_all_activity_logs.sql to allow five-row pages.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_activity_log_page(
  p_category TEXT DEFAULT 'activity', p_search TEXT DEFAULT '', p_actor UUID DEFAULT NULL,
  p_action TEXT DEFAULT NULL, p_role TEXT DEFAULT NULL, p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL, p_page INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE result JSONB;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION 'Only superadmins can view audit logs' USING ERRCODE = '42501'; END IF;
  IF p_category IS NULL OR p_category NOT IN ('all', 'activity', 'security', 'system')
    OR p_page IS NULL OR p_page < 1 OR p_page_size IS NULL OR p_page_size NOT IN (5, 10, 25, 50)
    OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to) THEN
    RAISE EXCEPTION 'Invalid log filters' USING ERRCODE = '22023'; END IF;
  WITH category_rows AS MATERIALIZED (
    SELECT l.id AS log_id, l.action, l.entity_type, l.entity_id, l.details,
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
      AND (NULLIF(p_action, '') IS NULL OR r.action = p_action)
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

NOTIFY pgrst, 'reload schema';
COMMIT;
