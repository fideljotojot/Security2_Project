import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

test('SMTP migration disables obsolete Resend RPC without removing accounts or Vault secrets', async t => {
  assert(process.env.PGLITE_MODULE);
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE TABLE public.users(id INT PRIMARY KEY); INSERT INTO public.users VALUES (1);
    CREATE SCHEMA vault; CREATE TABLE vault.secrets(name TEXT); INSERT INTO vault.secrets VALUES ('existing');
    CREATE FUNCTION public.create_account_with_email(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) RETURNS JSONB
    LANGUAGE SQL AS $$ SELECT '{}'::JSONB $$;
    GRANT EXECUTE ON FUNCTION public.create_account_with_email(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated,anon;`);
  const migration = await readFile(new URL('../api/migration_account_credentials_email.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  for (const role of ['authenticated', 'anon']) {
    const permission = await db.query("SELECT has_function_privilege($1,'public.create_account_with_email(text,text,text,text,text,text)','EXECUTE') AS allowed", [role]);
    assert.equal(permission.rows[0].allowed, false);
  }
  assert.equal((await db.query('SELECT count(*)::INT AS n FROM public.users')).rows[0].n, 1);
  assert.equal((await db.query('SELECT count(*)::INT AS n FROM vault.secrets')).rows[0].n, 1);
  await db.exec('DROP FUNCTION public.create_account_with_email(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)');
  await db.exec(migration);
});
