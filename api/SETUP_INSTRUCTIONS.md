# Security 2 Database Setup Instructions

The Logs page displays seven entries per page. For an existing database, apply
`migration_logs_seven_per_page.sql` after `migration_all_activity_logs.sql` to
enable seven-row requests before deploying this frontend change.

## Categorized logs and session history

For an existing database, run these in the Supabase SQL Editor in order:

1. `migration_audit_request_ip.sql` (if not already applied).
2. `migration_audit_actor_full_name.sql` (if not already applied).
3. `migration_categorized_activity_logs.sql`.

If categorized logs are already installed, run `migration_all_activity_logs.sql`
to enable the new All Logs option. This incremental migration preserves existing
RPC permissions and audit rows. Apply it before deploying the updated frontend.
Fresh installations already include All Logs in the installation scripts.

Apply the database migration before deploying the updated frontend. New
installations using `ALL_IN_ONE_SETUP.sql` or `migration_audit_logs.sql` include
the categorized-log migration. Existing account/profile/address tables and audit
logging must be installed before running the standalone incremental migration.

The page defaults to All Logs and also offers Activity Logs, Login & Security Logs and
System Logs. All Logs combines all three categories and displays a
Category column and the event timestamp; the dedicated Login & Security view
retains Time In/Time Out. Combined search, options, counts, and pagination are
computed on the server.
Action/role and local-date filters apply immediately on
selection. Search applies after a 300 ms typing pause; Enter applies it immediately.
Clear resets the filters within the selected category. Reversed date ranges show
an error and retain the last valid results. To date includes the entire selected
day. Pagination uses matching
server totals, including records beyond the previous 100-record limit.

Session IDs are shared across tabs in a browser and checked against the signed-in
owner on the server. Successful application login creates a Login event; token
refresh and password confirmation do not. Previously signed-in browsers create
a Session resumed event without guessing their original login time. Heartbeats
run every 60 seconds. Active means a heartbeat was received within 150 seconds;
it does not establish user interaction. Stale unclosed sessions show Unknown.
Manual logout and the existing three-minute superadmin timeout close the matching
Login row and add one ending event. Other roles keep their existing idle policy.
Logout signs out this browser and its tabs; independent browser sessions remain
separate. Closed browsers have no fabricated ending time.

Profile/address, permission, and password changes record field names only.
Related account writes in one database transaction are consolidated. System logs
contain fixed descriptions and operation/error codes for unexpected failures in
signed-in account/session RPCs, without passwords, request bodies or raw error
messages. Reporting failures are not recursively logged. Anonymous failed login
attempts and infrastructure monitoring are outside this feature.

Historical rows retain their original contents and IPs; category/module metadata
is assigned, but browser metadata and session links are not reconstructed.
The legacy `get_audit_logs` RPC is retained. New session APIs require
authentication and the paginated log API additionally requires superadmin role.
Internal logging helpers and session tables are not accessible to browser roles.

Local verification:

```powershell
node --test tests/activity-logs.test.mjs
```

`tests/audit-logs.database.test.mjs` runs a fixture database in PGlite. Set
`PGLITE_MODULE` to an installed `@electric-sql/pglite/dist/index.js`, then run
`node --test tests/audit-logs.database.test.mjs`. It never connects to Supabase.
After deployment, verify login/logout, idle timeout, separate browsers, stale
presence, profile/password/permission changes, System Logs, and access restrictions
against the actual Supabase project. Refresh the log view to update presence.

## Full names in activity logs

For an existing database, run `migration_audit_actor_full_name.sql` in the
Supabase SQL Editor before deploying the updated activity log page. It preserves
the RPC's execution grants and superadmin check, and adds `actor_full_name` and
`actor_id` to its results. New installations already include this in the audit
migration and all-in-one setup.

Names use the current profile's first name, middle initial, last name, and suffix,
omitting blank parts. The page falls back to username, then `System`. If an older
database has multiple profiles for one user, the profile with the lowest ID is
used. Performer names can be found with the search field. Audit rows and
visitor-IP capture are preserved.

After applying, check complete and partial names, accounts without profiles,
system entries, duplicate-name filters, and both full-name and username searches.
Confirm a non-superadmin still cannot call `get_audit_logs`.

## Visitor IP addresses in audit logs

For an existing database with audit logging installed, run
`migration_audit_request_ip.sql` in the Supabase SQL Editor. New installations
using `ALL_IN_ONE_SETUP.sql` or `migration_audit_logs.sql` already include it.
The migration replaces functions without changing historical logs or access rules.

Run `test_audit_request_ip.sql` afterward to check address parsing. It rolls back
its request-context changes and does not modify application rows.

For end-to-end verification, use a test account to log in and out, update a user,
and create/review a deletion request. Check the resulting activity logs as a
superadmin and confirm a non-superadmin still cannot fetch audit logs. Compare
new addresses with the test visitor's public network address; IPv6 and shared
network/VPN addresses are valid. Existing `::1` entries remain unchanged.

The IP comes from the first `x-forwarded-for` value in Supabase's request context
and is informational, not verified security evidence. Missing or malformed
addresses are stored as NULL and displayed as `—`. SQL Editor operations and
internal service operations may have no visitor request context.

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
