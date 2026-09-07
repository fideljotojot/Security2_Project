# Quick Fix: Missing RPC Function (404 Error)

## Error Message
```
POST https://vecdbfwsvbijnfkcsfzd.supabase.co/rest/v1/rpc/verify_security_answers_only 404 (Not Found)
```

## Cause
The function `verify_security_answers_only` is not in your Supabase database. This happens when:
- The ALL_IN_ONE_SETUP.sql didn't execute completely
- There was a silent error during setup
- The database connection was lost mid-execution

## Quick Fix (30 seconds)

1. Go to **Supabase Dashboard** → **SQL Editor** → **New query**
2. Copy and paste the entire content from: **`api/RECOVERY_FUNCTIONS_ONLY.sql`**
3. Click **Run**
4. Wait for the verification table to appear (shows ✓ CREATED for all functions)
5. Hard refresh your browser: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
6. Try the Forgot Password form again

---

## What This Script Does

Creates only the 4 essential functions needed for password recovery:
- ✅ `verify_security_answers_only()` - Validates answers (at least 2 of 3 must match)
- ✅ `get_recovery_email_after_answers()` - Returns email after successful verification
- ✅ `verify_and_reset_password()` - Updates password after answer verification
- ✅ `get_user_security_questions()` - Fetches questions for a user

---

## If It Still Doesn't Work

### Check 1: Verify pgcrypto is installed
```sql
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
```
Should return 1 row. If not, run:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Check 2: Verify tables exist
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('users', 'user_security_questions');
```
Should return 2 rows. If not, you need to re-run ALL_IN_ONE_SETUP.sql for the tables.

### Check 3: Verify function was created
```sql
SELECT proname FROM pg_proc WHERE proname = 'verify_security_answers_only';
```
Should return 1 row with `verify_security_answers_only`.

---

## Complete Recovery (If Above Doesn't Work)

If functions are still missing after running RECOVERY_FUNCTIONS_ONLY.sql:

1. **Option A:** Re-run ALL_IN_ONE_SETUP.sql (complete database setup)
   - Go to `api/ALL_IN_ONE_SETUP.sql`
   - Copy entire content
   - Paste in SQL Editor
   - Click Run

2. **Option B:** Check if there are SQL errors
   - Look at the SQL Editor output panel
   - Copy any error messages
   - The error will tell you what went wrong

3. **Option C:** Contact Supabase Support
   - Go to Supabase Dashboard
   - Click **Help** (bottom left)
   - Open a support ticket
   - Mention: "RPC functions not being created despite successful SQL execution"

---

## After Fix Checklist

- [ ] Run RECOVERY_FUNCTIONS_ONLY.sql
- [ ] See verification table with all ✓ CREATED
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Clear browser cache (Ctrl+Shift+Delete)
- [ ] Try Forgot Password form again
- [ ] If still broken, check tabs 1-3 above
