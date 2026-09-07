# Fix: "function crypt(text, text) does not exist" Error

## Problem Summary

The "Forgot Password" form is failing with the error: **`function crypt(text, text) does not exist`**

This occurs because the application uses PostgreSQL's `crypt()` function (from the `pgcrypto` extension) to securely hash passwords and security question answers, but the extension hasn't been enabled on your Supabase database.

---

## Root Cause

The following SQL functions rely on the `crypt()` function:
- `verify_security_answers_only()` - Validates security answers during password recovery
- `reset_password()` - Updates user password after verification
- User registration functions - Hash security question answers

Without `pgcrypto`, these functions cannot execute.

---

## Solution

### Step 1: Enable pgcrypto Extension

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New query**
5. Run this command:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

6. Click **Run** or press `Ctrl+Enter`
7. Verify success (no red errors)

### Step 2: Apply All Migrations (Choose One Option)

#### **Option A: Single All-in-One Query (Recommended) ⚡**

1. Go to **SQL Editor** → **New query**
2. Copy the entire content of **`api/ALL_IN_ONE_SETUP.sql`**
3. Click **Run** or press `Ctrl+Enter`
4. Wait for completion (~2-3 seconds)
5. Done! All tables, functions, and triggers are set up.

#### **Option B: Individual Migrations (If Preferred)**

Run these files sequentially in SQL Editor:

1. `schema_supabase.sql` - Base schema and initial functions
2. `migration_security_questions_two_of_three.sql` - Security question verification
3. `migration_password_recovery_otp.sql` - Password recovery
4. Other migrations as needed

Each file should be run as a separate query.

### Step 3: Verify Setup

Run this test query in SQL Editor:

```sql
SELECT crypt('test_password', gen_salt('bf'));
```

If it returns a hashed string starting with `$2a$`, the setup is successful.

### Step 4: Clear and Refresh

1. Clear browser cache (or use Ctrl+Shift+Delete in Chrome)
2. Refresh the application
3. Try the Forgot Password flow again

---

## Files Provided

Two new files have been created to help with setup:

1. **`migration_enable_pgcrypto_first.sql`**
   - Standalone file to enable pgcrypto
   - Run this FIRST before any other migrations
   - Safe to run even if pgcrypto already exists (uses `IF NOT EXISTS`)

2. **`SETUP_INSTRUCTIONS.md`**
   - Complete setup guide with troubleshooting
   - Verification steps
   - Error resolution

---

## Security Notes

- The `crypt()` function uses **bcrypt** with blowfish salt (`'bf'`)
- All passwords and answers are hashed, never stored in plaintext
- Hashes cannot be reversed; only verified by re-hashing with the stored salt
- This is a cryptographically secure approach (OWASP approved)

---

## What Each Function Does

| Function | Purpose | Uses crypt() |
|----------|---------|-------------|
| `register_user()` | Creates new user account | Yes (hashes answers) |
| `verify_security_answers_only()` | Validates answers for password recovery | Yes |
| `reset_password()` | Updates password after answer verification | Yes |
| `edit_user_password()` | Updates password for admin/superadmin | Yes |

All these functions will fail until `pgcrypto` is enabled.

---

## Troubleshooting

### If error persists after enabling pgcrypto:

1. **Hard refresh browser:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Check extension is loaded:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
   ```
   Should return one row.

3. **Verify function exists:**
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'crypt';
   ```
   Should return `crypt`.

4. **Re-apply migrations:**
   - Run `migration_security_questions_two_of_three.sql` again
   - Then `migration_password_recovery_otp.sql`
   - Then refresh app

### If you still get errors:

Contact Supabase support or check if your database account has permission to:
- Create extensions
- Create functions in the `public` schema
- Run migrations

---

## Implementation Checklist

- [ ] Enable pgcrypto extension in Supabase SQL Editor
- [ ] Apply `migration_enable_pgcrypto_first.sql`
- [ ] Apply `schema_supabase.sql`
- [ ] Apply `migration_security_questions_two_of_three.sql`
- [ ] Apply `migration_password_recovery_otp.sql`
- [ ] Run verification query (test `crypt()` function)
- [ ] Clear browser cache
- [ ] Refresh application
- [ ] Test Forgot Password flow

---

## References

- [PostgreSQL pgcrypto Extension Documentation](https://www.postgresql.org/docs/current/pgcrypto.html)
- [Supabase Database Setup Guide](https://supabase.com/docs/guides/database/connecting-to-postgres)
