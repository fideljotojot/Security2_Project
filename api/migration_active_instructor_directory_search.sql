-- Search the active Instructor directory by first name, last name, or full name.
DROP FUNCTION IF EXISTS public.search_active_instructors(TEXT);

CREATE OR REPLACE FUNCTION public.search_active_instructors(p_search TEXT DEFAULT '')
RETURNS TABLE(user_id UUID, first_name VARCHAR, last_name VARCHAR, "position" VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE query_text TEXT := lower(regexp_replace(trim(COALESCE(p_search, '')), '\s+', ' ', 'g'));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
    SELECT u.id, p.first_name, p.last_name, p.position
    FROM public.users AS u
    JOIN public.profiles AS p ON p.user_id = u.id
    WHERE u.registration_status = 'approved'
      AND COALESCE(u.is_locked_out, FALSE) = FALSE
      AND lower(trim(p.position)) = 'instructor'
      AND (
        query_text = ''
        OR lower(COALESCE(p.first_name, '')) LIKE '%' || query_text || '%'
        OR lower(COALESCE(p.last_name, '')) LIKE '%' || query_text || '%'
        OR lower(regexp_replace(trim(concat_ws(' ', p.first_name, p.last_name)), '\s+', ' ', 'g')) LIKE '%' || query_text || '%'
      )
    ORDER BY p.last_name, p.first_name;
END;
$$;
