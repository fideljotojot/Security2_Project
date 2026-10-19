-- Run after migration_audit_request_ip.sql in Supabase SQL Editor.
-- All test context changes are rolled back; no application rows are modified.
BEGIN;

DO $$
DECLARE
  test_case RECORD;
  actual INET;
BEGIN
  -- Also handles a request context that has never been set in this session.
  IF current_setting('request.headers', true) IS NULL THEN
    ASSERT public.audit_request_ip() IS NULL, 'Unset context must return NULL';
  END IF;

  FOR test_case IN
    SELECT * FROM (VALUES
      ('IPv4', '{"x-forwarded-for":"203.0.113.42"}', '203.0.113.42'),
      ('IPv6', '{"x-forwarded-for":"2001:db8::42"}', '2001:db8::42'),
      ('Forwarded chain', '{"x-forwarded-for":" 203.0.113.42 , 10.0.0.1"}', '203.0.113.42'),
      ('IPv6 chain', '{"x-forwarded-for":"2001:db8::42, 10.0.0.1"}', '2001:db8::42'),
      ('Missing header', '{}', NULL),
      ('Empty context', '', NULL),
      ('Malformed JSON', '{', NULL),
      ('Null context', 'null', NULL),
      ('Empty header', '{"x-forwarded-for":"   "}', NULL),
      ('Null header', '{"x-forwarded-for":null}', NULL),
      ('Invalid IP', '{"x-forwarded-for":"999.999.999.999"}', NULL),
      ('Invalid first hop', '{"x-forwarded-for":"bad, 203.0.113.42"}', NULL),
      ('Missing first hop', '{"x-forwarded-for":", 203.0.113.42"}', NULL),
      ('Wrong header type', '{"x-forwarded-for":{}}', NULL)
    ) AS cases(label, headers, expected)
  LOOP
    PERFORM set_config('request.headers', test_case.headers, true);
    actual := public.audit_request_ip();
    IF actual IS DISTINCT FROM test_case.expected::INET THEN
      RAISE EXCEPTION '%: expected %, got %', test_case.label, test_case.expected, actual;
    END IF;
  END LOOP;
  RAISE NOTICE 'All audit_request_ip cases passed';
END;
$$;

ROLLBACK;
