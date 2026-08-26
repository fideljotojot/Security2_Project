# Superadmin User Management

The Superadmin Users page supports viewing, editing, deleting, and managing account privileges.

## Manage privileges

1. Open the Users page as a superadmin.
2. Click the shield button beside an account.
3. Choose `Admin` to grant admin privileges or `Regular User` to revoke them.
4. Click **Save Privileges**.

The users table refreshes after a successful update. The affected account may need to refresh the page or sign in again before role-based navigation changes appear.

## Delete an account

1. Click the trash button beside an account.
2. Enter the currently signed-in superadmin's password.
3. Confirm the deletion.

The password is verified through Supabase Auth. The account and related records are deleted only after successful verification. A superadmin cannot delete their own account.

## Supabase migrations

Run these SQL migrations in the Supabase SQL Editor before using the corresponding actions:

- `api/migration_set_user_role.sql` — creates the secure RPC for changing a user's role.
- `api/migration_delete_user_account.sql` — creates the secure RPC for deleting an account.

Both RPCs are restricted to authenticated users whose `public.users.role` is `superadmin`. Related profile, address, and security-question records are removed through the database's `ON DELETE CASCADE` relationships.
