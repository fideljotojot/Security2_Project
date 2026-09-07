# Security 2 Database Setup Instructions

## Critical Prerequisites

### 1. Enable pgcrypto Extension in Supabase

The application requires the `pgcrypto` PostgreSQL extension for secure password and security question hashing.

**Steps:**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** (in the left sidebar)
4. Click **New query**
5. Copy and paste this command:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

6. Click **Run** or press `Ctrl+Enter`
7. You should see a success message

**Why:** The `pgcrypto` extension provides the `crypt()` function used for securely hashing passwords and security question answers.

---

## Migration Order

After enabling `pgcrypto`, apply migrations in this exact order:

1. **schema_supabase.sql** - Creates all tables and base functions
2. **migration_security_questions_two_of_three.sql** - Adds security question verification
3. **migration_password_recovery_otp.sql** - Adds password recovery functionality
4. **Other migrations** (admin management, registration approval, etc.)

---

## How to Apply Migrations

### Option A: Single All-in-One Query (Recommended) ⚡

This is the fastest way to set up everything at once.

1. Open Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Open the file **`ALL_IN_ONE_SETUP.sql`** and copy its entire content
4. Paste it into the SQL Editor
5. Click **Run** or press `Ctrl+Enter`
6. Wait for completion (should take 2-3 seconds)
7. All tables, functions, and triggers will be created

### Option B: Individual Migrations (Via SQL Editor)

If you prefer to run migrations separately:

1. Open Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Copy and run each migration in this order:
   - `schema_supabase.sql`
   - `migration_security_questions_two_of_three.sql`
   - `migration_password_recovery_otp.sql`
   - Other migrations as needed
4. Each file should be run as a separate query

### Option C: Via supabase CLI (If Installed)

```bash
supabase db push
```

---

## Verification

To verify that the setup is correct, run this test query in Supabase SQL Editor:

```sql
-- Test 1: Check pgcrypto is available
SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';
-- Should return one row with 'pgcrypto'

-- Test 2: Check that crypt function exists
SELECT crypt('test', gen_salt('bf'));
-- Should return a hashed string starting with '$2a$'
```

If both tests pass, your database is properly configured.

---

## Error Resolution

### Error: "function crypt(text, text) does not exist"

**Cause:** The `pgcrypto` extension is not enabled.

**Solution:** 
1. Follow the steps in section "Enable pgcrypto Extension in Supabase" above
2. Re-run the migrations
3. Refresh the application

### Error: "function verify_security_answers_only(text, text, text, text) does not exist"

**Cause:** Migration files were not applied in the correct order, or the schema hasn't been fully deployed.

**Solution:**
1. Ensure `schema_supabase.sql` was run first
2. Re-apply `migration_security_questions_two_of_three.sql`
3. Clear browser cache and refresh

---

## Troubleshooting

If you encounter issues:

1. **Check extension is installed:**
   ```sql
   SELECT * FROM pg_extension;
   ```

2. **Check all functions exist:**
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public';
   ```

3. **Check tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

---

## Notes

- The `pgcrypto` extension uses bcrypt (Blowfish) for hashing
- All passwords and security answers are stored as hashes, never in plaintext
- The application never stores or transmits unencrypted credentials
