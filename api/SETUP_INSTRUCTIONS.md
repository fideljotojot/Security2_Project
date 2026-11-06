# Security 2 Database Setup Instructions

## Add User credentials email using existing Gmail SMTP

The current account mailer uses your existing Gmail SMTP provider. It does
not need Resend. Supabase Auth's SMTP settings and OTP templates remain as
configured. The mailer needs a second copy of those SMTP credentials as server
secrets; Edge Functions cannot automatically read Auth's SMTP password.

A custom email containing the username and initial password requires a
backend mailer. SQL Editor alone cannot deploy it or send a custom message
through Supabase Auth SMTP. The old Resend SQL setup is no longer used.

1. Apply migration_first_login_otp.sql and existing account-management
   migrations in the project used by the app.
2. In that project's Edge Functions secrets, set:
   - SMTP_HOST: smtp.gmail.com
   - SMTP_PORT: 465
   - SMTP_USERNAME: your existing Gmail sender account
   - SMTP_PASSWORD: that account's Google App Password, not the app user's
     initial password or your normal Google sign-in password
   - SMTP_FROM: the same sender email, optionally Your App <sender@gmail.com>
3. Deploy the included function from the correct linked project:

~~~sh
supabase functions deploy create-account-with-email --project-ref YOUR_PROJECT_ID
~~~

Supabase supplies SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
inside the hosted function. Never place SMTP passwords or service keys in
VITE variables, frontend files, chat messages, or committed secrets files.
Keep VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY pointed at that same project.

Port 465 uses implicit TLS with certificate verification enabled. Gmail also
supports STARTTLS 587 for Auth, but hosted Edge mailers cannot use ports 25/587.
Leave the existing Auth SMTP port unchanged; the separate mailer uses 465.
Gmail App Passwords require an eligible Google account with 2-Step Verification.
If App Passwords are unavailable under your organization's policy, the mailer
will require a separately configured OAuth solution rather than a normal password.

Run api/migration_account_credentials_email.sql in SQL Editor if you previously
installed the Resend-based RPC. It only revokes client execution of that obsolete
RPC; it preserves existing accounts and Vault entries. No Resend secrets are
required by the new flow. Reload Accounts to clear a previous local request block.

The mailer verifies an approved, unlocked superadmin, creates the Auth account,
then calls create_initial_account using that superadmin's identity. It emails
the exact username and initial password. Account creation reports success only
when SMTP accepts the recipient/message. Passwords remain in request memory
and the outgoing email, never plaintext application records or application logs.
After first login, the recipient still verifies an OTP and completes their profile.

If sending fails, the mailer deletes only the account created by that attempt.
The form clears and focuses the recipient email and requires re-entry plus
confirmation before another attempt. If deletion fails, it shows the account
ID and blocks resubmission. Remove that exact leftover Auth account, then
reload Accounts. If the response was lost, check the attempted email/username
in Auth before retrying. Never delete an unrelated existing account.

SMTP acceptance does not guarantee inbox placement or prevent later bounces.
Test deployment with a dedicated account. Automated tests mock delivery; no real
email is sent by the test suite. Sender authentication failures, recipient
rejection and network failures must not show account-creation success.

References:
- https://developers.google.com/workspace/gmail/imap/imap-smtp
- https://support.google.com/accounts/answer/185833
- https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/send-email-smtp

Apply `migration_first_login_otp.sql` after the first-login, self-profile,
superadmin-capacity/slot-limit, and current account-management migrations,
before deploying the frontend. Superadmins must now supply a real email when
creating accounts. Incomplete accounts verify an email OTP before personal
details are available; completion and direct writes also enforce verification.
Completed accounts keep their existing login flow.

Use the existing Supabase Email provider configuration: eight-digit OTPs and
an email template containing `{{ .Token }}` (not only a magic-link URL).
Expiry and resend limits are controlled by Supabase Auth. Test delivery with
a dedicated incomplete account after applying the migration. The frontend
uses `shouldCreateUser: false`; verification must return the same account ID.

For legacy incomplete accounts with `@accounts.local` addresses, first obtain
the user's real email and run this targeted transaction in the Supabase SQL
editor as the database administrator. Replace both example values. This
updates Auth and application records together without completing the account:

```sql
BEGIN;
DO $$
DECLARE
  target_id UUID := '00000000-0000-0000-0000-000000000000';
  real_email TEXT := lower(trim('person@example.com'));
BEGIN
  IF real_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     OR real_email LIKE '%@accounts.local' THEN
    RAISE EXCEPTION 'Supply a real email';
  END IF;
  PERFORM 1 FROM public.users
    WHERE id = target_id AND registration_status = 'incomplete' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incomplete account not found'; END IF;
  UPDATE auth.users SET email = real_email, email_confirmed_at = now(),
    email_change = '', email_change_token_new = '', email_change_token_current = ''
    WHERE id = target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auth account not found'; END IF;
  UPDATE public.users SET email = real_email WHERE id = target_id;
END;
$$;
COMMIT;
```

Have the user log out and log in again after the correction. Never mark the
account complete or set browser verification flags as a substitute for OTP.

Apply `migration_admin_block_users_only.sql` after current account-management
migrations. Admins may block only user accounts; database enforcement applies
to status and lockout updates through all existing RPCs. Superadmin controls
and existing unblock permissions remain unchanged.

Apply `migration_superadmin_slot_limit.sql` after `migration_superadmin_capacity.sql`
and the current account-management migrations, for existing and fresh installations.
Active (approved), inactive and incomplete superadmins each occupy one of two slots;
blocked accounts do not. Creation, promotion and restoration cannot exceed the limit.
Explicit backup replacement can still free a slot by blocking the old backup first.
Existing accounts are not modified by this migration; first-login completion and
login/logout transitions keep their reserved slots. Apply before deploying the UI.

Apply `migration_hide_account_status_updates.sql` after
`migration_hide_removed_deletion_requests.sql` for existing and fresh installations.
Status changes continue to save and be audited. The Logs page hides only Updated
user events with changed_fields exactly ["registration_status"], including from
counts and filter options. Mixed-field edits, events with missing/unknown metadata,
and explicit approval, rejection, blocking and unblocking events stay visible.

Apply `migration_hide_removed_deletion_requests.sql` after
`migration_deletion_target_role.sql` for existing and fresh installations.
The Logs page excludes Removed deletion request events from every category,
including totals and filter options, for both admins and superadmins.
Stored audit history and other deletion/request events remain intact.

Apply `migration_deletion_target_role.sql` after `migration_deletion_reasons.sql`
for role-specific removal descriptions in log Details. It captures the deleted
account role before deletion and preserves it through cascading request removal.
Historical removal logs without a recorded target role display "Removed an account."

Apply `migration_deletion_reasons.sql` after the admin permissions, deletion
request, categorized audit, and `migration_admin_activity_logs.sql` migrations,
before deploying the frontend. Run it for fresh installations too, after the
base setup scripts. Both roles enter a reason then confirm their password.
Admins submit pending requests; superadmins automatically approve and delete.
Reasons persist in audit logs after request/account cascades. The old direct
`delete_user_account(UUID)` RPC is removed; update all clients to
`create_delete_request(p_user_id, p_reason)`.

For admin log access, run `migration_admin_activity_logs.sql` after
`migration_unify_login_actions.sql` before deploying the frontend. Admins can
open Logs from their navigation and see events performed by accounts whose
current role is admin or user. Superadmin events and events without an existing
actor account are excluded, including from totals and filter options.
Superadmins retain full access. Role changes affect visibility of past events.

Run `migration_unify_login_actions.sql` after the eight-per-page migration to
display both historical `Logged in` and newer `Login` events as `Login`, with a
single action-filter option. Stored audit history is preserved.

The Logs page displays eight entries per page. For an existing database, apply
`migration_logs_eight_per_page.sql` after `migration_all_activity_logs.sql` to
enable eight-row requests before deploying this frontend change.

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
