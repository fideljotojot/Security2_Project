-- IMPORTANT: Run this file FIRST before applying any other migrations
-- This ensures the pgcrypto extension is available for password hashing

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify the extension was created successfully
-- Run this query to confirm: SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';
-- If it returns 'pgcrypto', you're ready to proceed with other migrations.
