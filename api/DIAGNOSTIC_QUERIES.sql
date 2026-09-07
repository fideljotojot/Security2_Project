-- DIAGNOSTIC: Check if functions exist
-- Copy and run this entire query in Supabase SQL Editor

-- 1. Check if pgcrypto extension is installed
SELECT 'Extension Status' as check_type, extname as status FROM pg_extension WHERE extname = 'pgcrypto'
UNION ALL
SELECT 'pgcrypto installed?', CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN 'YES ✓' ELSE 'NO ✗ - MUST RUN: CREATE EXTENSION IF NOT EXISTS pgcrypto;' END;

-- 2. Check if key functions exist
SELECT 'Function: verify_security_answers_only', CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'verify_security_answers_only') THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'Function: get_recovery_email_after_answers', CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_recovery_email_after_answers') THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'Function: create_user_profile', CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'create_user_profile') THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

-- 3. Check if tables exist
SELECT 'Table: users', CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'Table: user_security_questions', CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_security_questions' AND table_schema = 'public') THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

-- 4. List all functions in public schema
SELECT 'Total Functions' as type, COUNT(*)::TEXT as count FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
