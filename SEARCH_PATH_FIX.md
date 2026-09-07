# Fix: "function crypt(text, text) does not exist" - Search Path Issue

## What We Found

✅ pgcrypto extension IS installed  
✅ verify_security_answers_only function EXISTS  
❌ But still getting error when form runs

## The Root Cause

The functions have `SET search_path = public` which tells PostgreSQL to ONLY look in the public schema. But `crypt()` is in the `pg_catalog` schema, so the functions can't find it.

This is the problematic code:
```sql
CREATE FUNCTION public.verify_security_answers_only(...)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  ← ❌ This restricts crypt() access
AS $$
  -- Inside, crypt() call fails because it's not in 'public' schema
```

## The Fix (< 1 minute)

1. Go to **Supabase SQL Editor** → **New query**
2. Copy the entire content from: **`api/FIX_SEARCH_PATH.sql`**
3. Click **Run**
4. See verification table showing all functions FIXED ✓
5. **Hard refresh browser:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
6. Try the Forgot Password form - it should work now!

---

## What This Does

Recreates the 4 critical functions **without** the restrictive `SET search_path = public`:

- ✅ `verify_security_answers_only` - Now can access `crypt()`
- ✅ `get_recovery_email_after_answers` - Depends on above
- ✅ `verify_and_reset_password` - Uses `crypt()` for hashing
- ✅ `get_user_security_questions` - Fetches questions

---

## Why This Happens

When `SECURITY DEFINER` functions use `SET search_path = public`, they:
- Can access anything in the `public` schema ✓
- Cannot access system functions like `crypt()` in `pg_catalog` ✗
- This is a Supabase default for security reasons

The fix removes the search_path restriction so functions can find built-in PostgreSQL functions while still being secure.

---

## After the Fix

1. Run `api/FIX_SEARCH_PATH.sql`
2. Hard refresh: `Ctrl+Shift+R`
3. Clear cache: `Ctrl+Shift+Delete`
4. Test Forgot Password flow
5. Should work now! ✓
