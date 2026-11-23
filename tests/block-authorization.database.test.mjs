import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

test('User sessions cannot block accounts, including through privileged functions; logout never cleans up other superadmins', async t => {
  assert(process.env.PGLITE_MODULE, 'Set PGLITE_MODULE to the installed PGlite module.');
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
  const db = new PGlite();
  t.after(() => db.close());
  const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  await db.exec(`CREATE SCHEMA auth;
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::UUID $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE SQL AS $$ SELECT 'authenticated'::TEXT $$;
    CREATE TABLE public.users(id UUID PRIMARY KEY,role TEXT,registration_status TEXT,is_locked_out BOOLEAN DEFAULT false);
    INSERT INTO public.users VALUES
      ('${id(1)}','user','approved',false), ('${id(2)}','admin','approved',false),
      ('${id(3)}','superadmin','approved',false), ('${id(4)}','superadmin','inactive',false),
      ('${id(5)}','superadmin','inactive',false);
    CREATE FUNCTION public.unsafe_block(target UUID, lock_only BOOLEAN) RETURNS VOID
    LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
      IF lock_only THEN UPDATE public.users SET is_locked_out=true WHERE id=target;
      ELSE UPDATE public.users SET registration_status='blocked' WHERE id=target; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public,auth TO authenticated;
    GRANT SELECT ON public.users TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid(),auth.role(),public.unsafe_block(UUID,BOOLEAN) TO authenticated;`);
  const migration = await readFile(new URL('../api/migration_remove_auto_block.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Safe to reapply.
  const asAccount = n => db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(n)]);
  const snapshot = async () => (await db.query('SELECT * FROM public.users ORDER BY id')).rows;
  const before = await snapshot();
  await asAccount(1);
  await db.exec('SET ROLE authenticated');
  for (const target of [1, 2, 3, 4]) {
    for (const lockOnly of [false, true]) {
      await assert.rejects(db.query('SELECT public.unsafe_block($1,$2)', [id(target), lockOnly]),
        /Only active administrators can block accounts/);
    }
  }
  assert.deepEqual(await snapshot(), before);
  assert.equal((await db.query('SELECT public.deactivate_superadmin_on_logout() AS changed')).rows[0].changed, false);
  assert.deepEqual(await snapshot(), before);
  await asAccount(2);
  for (const target of [2, 3]) {
    await assert.rejects(db.query('SELECT public.unsafe_block($1,false)', [id(target)]), /Admins can only block user accounts/);
  }
  assert.equal((await db.query('SELECT public.deactivate_superadmin_on_logout() AS changed')).rows[0].changed, false);
  await db.query('SELECT public.unsafe_block($1,false)', [id(1)]);
  await asAccount(3);
  await db.query('SELECT public.unsafe_block($1,false)', [id(2)]);
  const beforeLogout = await snapshot();
  assert.equal((await db.query('SELECT public.deactivate_superadmin_on_logout() AS changed')).rows[0].changed, true);
  const afterLogout = await snapshot();
  assert.equal(afterLogout.find(row => row.id === id(3)).registration_status, 'inactive');
  assert.deepEqual(afterLogout.filter(row => row.id !== id(3)), beforeLogout.filter(row => row.id !== id(3)));
  await asAccount(999);
  await assert.rejects(db.query('SELECT public.unsafe_block($1,true)', [id(4)]), /Only active administrators/);
});
