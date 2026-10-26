// Set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js file.
// Runs only against an isolated in-memory PostgreSQL database, never Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const admin = '00000000-0000-4000-8000-000000000001';
const user = '00000000-0000-4000-8000-000000000002';
const other = '00000000-0000-4000-8000-000000000003';

test('categorized audit migration and session security', async t => {
  assert(process.env.PGLITE_MODULE, 'Set PGLITE_MODULE to the temporary PGlite installation.');
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE auth.users(id UUID PRIMARY KEY, encrypted_password TEXT);
    CREATE TABLE public.users(id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      id_number TEXT, username TEXT, role TEXT, email TEXT, registration_status TEXT DEFAULT 'approved',
      is_locked_out BOOLEAN DEFAULT false, admin_permissions JSONB DEFAULT '[]');
    CREATE TABLE public.profiles(id SERIAL PRIMARY KEY, user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
      first_name TEXT, middle_initial TEXT, last_name TEXT, suffix TEXT, position TEXT);
    CREATE TABLE public.addresses(id SERIAL PRIMARY KEY, user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
      city TEXT, province TEXT);
    CREATE TABLE public.delete_requests(id BIGSERIAL PRIMARY KEY, user_id UUID, status TEXT DEFAULT 'pending');
  `);
  const auditSetup = await readFile(new URL('../api/migration_audit_logs.sql', import.meta.url), 'utf8');
  await db.exec(auditSetup.split('-- BEGIN CATEGORIZED ACTIVITY LOGS')[0]);
  await db.exec(`INSERT INTO public.audit_logs(action,entity_type,details,ip_address)
    VALUES('Logged in','authentication','{"historical":true}','::1'),
      ('Updated user','user','{"historical":true}','203.0.113.5')`);
  const migration = await readFile(new URL('../api/migration_categorized_activity_logs.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Reapplying is safe and does not duplicate triggers.
  const history = (await db.query("SELECT action,category,details,ip_address,user_agent,application_session_id FROM public.audit_logs ORDER BY id")).rows;
  assert.equal(history[0].category, 'security'); assert.equal(history[0].ip_address, '::1');
  assert.equal(history[0].user_agent, null); assert.equal(history[0].application_session_id, null);
  assert.deepEqual(history[0].details, { historical: true }); assert.equal(history[1].category, 'activity');
  await db.exec(`
    INSERT INTO auth.users(id) VALUES ('${admin}'), ('${user}'), ('${other}');
    INSERT INTO public.users(id,id_number,username,role,email) VALUES
      ('${admin}', '2026-001', 'root', 'superadmin', 'root@example.invalid'),
      ('${user}', '2026-002', 'alex1', 'user', 'alex1@example.invalid'),
      ('${other}', '2026-003', 'alex2', 'user', 'alex2@example.invalid');
    INSERT INTO public.profiles(user_id,first_name,middle_initial,last_name,suffix) VALUES
      ('${admin}', ' Mars ', ' M. ', ' Cruz ', ' Jr. '),
      ('${user}', 'Alex', NULL, 'Cruz', ''), ('${other}', 'Alex', '', 'Cruz', NULL);
  `);
  const asUser = async id => {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id || '']);
  };
  const page = async args => (await db.query(`SELECT public.get_activity_log_page(
    p_category => $1, p_search => $2, p_actor => $3, p_action => $4, p_role => $5,
    p_from => $6, p_to => $7, p_page => $8, p_page_size => $9) AS data`,
  [args.category || 'activity', args.search || '', args.actor || null, args.action || null,
    args.role || null, args.from || null, args.to || null, args.page || 1, args.size || 10])).rows[0].data;

  await t.test('only superadmins read logs and authenticated callers cannot read session tables', async () => {
    await asUser(user);
    await assert.rejects(page({}), /Only superadmins/);
    await asUser(null);
    await assert.rejects(page({}), /Only superadmins/);
    await db.exec('SET ROLE authenticated');
    await assert.rejects(db.query('SELECT * FROM public.application_sessions'), /permission denied/);
    await assert.rejects(db.query("SELECT public.record_account_change($1,'fake',ARRAY['x'])", [user]), /permission denied/);
    await db.exec('RESET ROLE');
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT public.start_application_session($1,false)', [randomUUID()]), /permission denied/);
    await assert.rejects(page({}), /permission denied/);
    await db.exec('RESET ROLE');
  });

  const session = randomUUID();
  await t.test('idempotent login and owner checks, forwarded IP and browser metadata', async () => {
    await asUser(user);
    await db.exec('SET ROLE authenticated');
    await db.query("SELECT set_config('request.headers', $1, false)", [JSON.stringify({
      'x-forwarded-for': '203.0.113.42, 10.0.0.1', 'user-agent': 'Chrome/123 Windows', 'x-app-session-id': session,
    })]);
    await db.query('SELECT public.start_application_session($1,false)', [session]);
    await db.query('SELECT public.start_application_session($1,false)', [session]);
    await db.exec('RESET ROLE');
    assert.equal((await db.query("SELECT count(*)::INT AS n FROM public.audit_logs WHERE application_session_id=$1 AND action='Login'", [session])).rows[0].n, 1);
    await asUser(other);
    assert.equal((await db.query('SELECT public.heartbeat_application_session($1) AS ok', [session])).rows[0].ok, false);
    assert.equal((await db.query('SELECT public.end_application_session($1) AS ok', [session])).rows[0].ok, false);
    await assert.rejects(db.query('SELECT public.start_application_session($1,false)', [session]), /unavailable/);
    await db.query("SELECT public.create_audit_log('Other user action','other')");
    assert.equal((await db.query("SELECT application_session_id FROM public.audit_logs WHERE action='Other user action'")).rows[0].application_session_id, null);
    await asUser(admin);
    const data = await page({ category: 'security', actor: user });
    assert.equal(data.rows[0].ip_address, '203.0.113.42');
    assert.equal(data.rows[0].user_agent, 'Chrome/123 Windows');
    assert.equal(data.rows[0].session_status, 'Active');
    assert(data.rows[0].time_in);
  });

  await t.test('stale sessions, heartbeat refresh, logout/timeout pairing and repeat endings', async () => {
    await db.query("UPDATE public.application_sessions SET last_seen_at=now()-INTERVAL '5 minutes' WHERE id=$1", [session]);
    await asUser(admin);
    assert.equal((await page({ category: 'security', actor: user })).rows[0].session_status, 'Unknown');
    await asUser(user);
    await db.query('SELECT public.heartbeat_application_session($1)', [session]);
    await db.query("SELECT public.end_application_session($1,'timeout')", [session]);
    await db.query("SELECT public.end_application_session($1,'logout')", [session]);
    await asUser(admin);
    const rows = (await page({ category: 'security', actor: user })).rows;
    const login = rows.find(row => row.action === 'Login');
    const end = rows.find(row => row.action === 'Session Timeout');
    assert.equal(rows.length, 2); assert.equal(login.time_out, end.time_out); assert.equal(end.time_in, null);
    assert(end.details.summary.includes('three minutes'));
  });

  await t.test('resume has no invented login timestamp; independent browsers have distinct sessions', async () => {
    await asUser(user);
    const resumed = randomUUID(), separate = randomUUID();
    await db.query('SELECT public.start_application_session($1,true)', [resumed]);
    await db.query('SELECT public.start_application_session($1,false)', [separate]);
    await asUser(admin);
    const rows = (await page({ category: 'security', actor: user })).rows;
    assert.equal(rows.find(row => row.application_session_id === resumed).time_in, null);
    assert.equal(rows.find(row => row.application_session_id === separate).session_status, 'Active');
  });

  await t.test('account changes aggregate without secrets or duplicate generic entries', async () => {
    await asUser(admin);
    const before = (await db.query('SELECT count(*)::INT AS n FROM public.audit_logs')).rows[0].n;
    await db.exec(`BEGIN;
      UPDATE public.users SET username='alex-updated', admin_permissions='["manage_registrations"]' WHERE id='${user}';
      UPDATE public.profiles SET first_name='Alexander' WHERE user_id='${user}';
      UPDATE auth.users SET encrypted_password='NEVER_LOG_HASH' WHERE id='${user}';
      COMMIT;`);
    assert.equal((await db.query('SELECT count(*)::INT AS n FROM public.audit_logs')).rows[0].n, before + 1);
    const row = (await db.query('SELECT * FROM public.audit_logs ORDER BY id DESC LIMIT 1')).rows[0];
    assert.equal(row.action, 'Password reset');
    assert.deepEqual(row.details.changed_fields, ['admin_permissions', 'first_name', 'password', 'username']);
    assert(!JSON.stringify(row.details).includes('NEVER_LOG_HASH'));
    assert.equal(row.application_session_id, null); // Spoofed other-user session header is ignored.
  });

  await t.test('full names, profiles with blank parts and legacy RPC compatibility', async () => {
    await asUser(admin);
    const data = await page({ search: 'Mars M. Cruz Jr.' });
    assert(data.rows.some(row => row.actor_full_name === 'Mars M. Cruz Jr.'));
    const legacy = await db.query('SELECT * FROM public.get_audit_logs(10)');
    assert(legacy.rows.length); assert('actor_username' in legacy.rows[0]); assert('actor_full_name' in legacy.rows[0]);
    await db.query("INSERT INTO public.profiles(user_id,first_name,last_name) VALUES($1,'Duplicate','Profile')", [other]);
  });

  await t.test('server pagination beyond 100, matching totals, filters and date bounds', async () => {
    await db.exec(`INSERT INTO public.audit_logs(actor_id,action,entity_type,created_at,ip_address)
      SELECT '${other}', 'Bulk test', 'user', '2026-10-19 10:00:00+00'::TIMESTAMPTZ + n * INTERVAL '1 second', '2001:db8::42'
      FROM generate_series(1,155) n;`);
    const first = await page({ action: 'Bulk test', actor: other, role: 'user', search: 'alex2', size: 50 });
    const last = await page({ action: 'Bulk test', actor: other, size: 50, page: 4 });
    assert.equal(first.total, 155); assert.equal(first.rows.length, 50); assert.equal(last.rows.length, 5);
    assert(first.rows[0].log_id > last.rows[0].log_id);
    assert.equal((await page({ action: 'Bulk test', from: '2026-10-19T00:00:00Z', to: '2026-10-20T00:00:00Z' })).total, 155);
    assert.equal((await page({ action: 'Bulk test', to: '2026-10-19T00:00:00Z' })).total, 0);
    await assert.rejects(page({ from: '2026-10-20T00:00:00Z', to: '2026-10-19T00:00:00Z' }), /Invalid log filters/);
    assert.equal((await page({ category: 'system' })).total, 0);
  });

  await t.test('system logs sanitize metadata, deletion requests stay categorized and invalid headers do not block actions', async () => {
    await asUser(admin);
    await db.query("SELECT public.record_system_log('update_my_profile','XX000')");
    const system = await page({ category: 'system' });
    assert.equal(system.total, 1); assert.equal(system.rows[0].details.code, 'XX000');
    await db.exec("INSERT INTO public.delete_requests(status) VALUES('pending')");
    assert.equal((await page({ action: 'Created deletion request' })).rows[0].module, 'Deletion Requests');
    await db.query("SELECT set_config('request.headers', '{', false)");
    await db.query("SELECT public.create_audit_log('Malformed request','test')");
    assert.equal((await page({ action: 'Malformed request' })).rows[0].ip_address, null);
  });

  await t.test('installation scripts embed the migration and preserve history and legacy execution grants', async () => {
    const allInOne = await readFile(new URL('../api/ALL_IN_ONE_SETUP.sql', import.meta.url), 'utf8');
    assert(auditSetup.includes(migration)); assert(allInOne.includes(migration));
    await db.exec('REVOKE ALL ON FUNCTION public.get_audit_logs(INTEGER) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.get_audit_logs(INTEGER) TO service_role WITH GRANT OPTION;');
    const oldAcl = (await db.query("SELECT proacl::TEXT AS acl, proowner FROM pg_proc WHERE oid='public.get_audit_logs(integer)'::regprocedure")).rows[0];
    const count = (await db.query('SELECT count(*)::INT AS n FROM public.audit_logs')).rows[0].n;
    await db.exec(auditSetup);
    const newAcl = (await db.query("SELECT proacl::TEXT AS acl, proowner FROM pg_proc WHERE oid='public.get_audit_logs(integer)'::regprocedure")).rows[0];
    assert.deepEqual(newAcl, oldAcl);
    assert.equal((await db.query('SELECT count(*)::INT AS n FROM public.audit_logs')).rows[0].n, count);
    assert.equal((await page({ action: 'Bulk test' })).total, 155);
  });

  await t.test('incremental All Logs migration preserves permissions and enables combined categories', async () => {
    const definition = migration.match(/CREATE OR REPLACE FUNCTION public\.get_activity_log_page\([\s\S]*?END; \$\$;/)[0];
    // Simulate an existing installation with the previous three-category RPC.
    await db.exec(definition.replace("('all', 'activity', 'security', 'system')", "('activity', 'security', 'system')")
      .replace("WHERE (p_category = 'all' OR l.category = p_category)", 'WHERE l.category = p_category'));
    await assert.rejects(page({ category: 'all' }), /Invalid log filters/);
    const signature = 'public.get_activity_log_page(text,text,uuid,text,text,timestamp with time zone,timestamp with time zone,integer,integer)';
    const before = (await db.query('SELECT proacl::TEXT AS acl, proowner FROM pg_proc WHERE oid=$1::regprocedure', [signature])).rows[0];
    const upgrade = await readFile(new URL('../api/migration_all_activity_logs.sql', import.meta.url), 'utf8');
    assert(upgrade.includes(definition));
    await db.exec(upgrade); await db.exec(upgrade);
    const after = (await db.query('SELECT proacl::TEXT AS acl, proowner FROM pg_proc WHERE oid=$1::regprocedure', [signature])).rows[0];
    assert.deepEqual(after, before);
    const fiveRowUpgrade = await readFile(new URL('../api/migration_logs_five_per_page.sql', import.meta.url), 'utf8');
    await db.exec(fiveRowUpgrade);
    const fiveRows = await page({ category: 'all', size: 5 });
    assert.equal(fiveRows.rows.length, 5);
    await db.exec(await readFile(new URL('../api/migration_logs_seven_per_page.sql', import.meta.url), 'utf8'));
    assert.equal((await page({ category: 'all', size: 7 })).rows.length, 7);
    await db.exec(await readFile(new URL('../api/migration_logs_eight_per_page.sql', import.meta.url), 'utf8'));
    assert.equal((await page({ category: 'all', size: 8 })).rows.length, 8);
    const defaults = (await db.query('SELECT public.get_activity_log_page() AS data')).rows[0].data;
    assert.equal(defaults.rows.length, 8);
    await db.exec(await readFile(new URL('../api/migration_unify_login_actions.sql', import.meta.url), 'utf8'));
    const loginRows = await page({ category: 'all', action: 'Login', size: 50 });
    const legacyLoginRows = await page({ category: 'all', action: 'Logged in', size: 50 });
    assert.equal(loginRows.total, legacyLoginRows.total);
    assert(loginRows.rows.every(row => row.action === 'Login'));
    assert(loginRows.rows.some(row => row.details.historical === true));
    assert(loginRows.rows.some(row => row.application_session_id));
    assert(loginRows.actions.includes('Login')); assert(!loginRows.actions.includes('Logged in'));
    assert.equal((await db.query("SELECT count(*)::INT AS n FROM public.audit_logs WHERE action='Logged in'")).rows[0].n, 1);
    const totals = await Promise.all(['activity', 'security', 'system'].map(category => page({ category })));
    assert.equal((await page({ category: 'all' })).total, totals.reduce((total, data) => total + data.total, 0));
    await asUser(user); await assert.rejects(page({ category: 'all' }), /Only superadmins/);
    await asUser(admin);
    await assert.rejects(page({ category: 'invalid' }), /Invalid log filters/);
  });

  await t.test('All Logs filters, options, chronological order, pagination and empty state', async () => {
    await db.exec(`INSERT INTO public.audit_logs(actor_id,action,entity_type,category,created_at)
      SELECT CASE c.category WHEN 'security' THEN '${admin}'::UUID WHEN 'system' THEN '${other}'::UUID ELSE '${user}'::UUID END,
        'Combined fixture', CASE WHEN c.category='security' THEN 'authentication' ELSE 'test' END,
        c.category, '2026-10-19T12:00:00Z'::TIMESTAMPTZ + n * INTERVAL '1 second'
      FROM generate_series(1,12) n CROSS JOIN (VALUES ('activity'),('security'),('system')) c(category);`);
    const combined = await page({ category: 'all', action: 'Combined fixture', size: 50 });
    assert.equal(combined.total, 36); assert.equal(combined.rows.length, 36);
    assert.deepEqual([...new Set(combined.rows.map(row => row.category))].sort(), ['activity', 'security', 'system']);
    for (let index = 1; index < combined.rows.length; index++) {
      const previous = combined.rows[index - 1], current = combined.rows[index];
      assert(previous.created_at > current.created_at || (previous.created_at === current.created_at && previous.log_id > current.log_id));
    }
    const first = await page({ category: 'all', action: 'Combined fixture', size: 10 });
    const second = await page({ category: 'all', action: 'Combined fixture', size: 10, page: 2 });
    assert.equal(first.total, 36); assert.equal(second.rows.length, 10);
    assert.equal(new Set([...first.rows, ...second.rows].map(row => row.log_id)).size, 20);
    assert.equal((await page({ category: 'all', action: 'Combined fixture', actor: admin })).total, 12);
    assert.equal((await page({ category: 'all', action: 'Combined fixture', role: 'user' })).total, 24);
    assert.equal((await page({ category: 'all', search: 'Combined fixture' })).total, 36);
    assert.equal((await page({ category: 'all', action: 'Combined fixture', from: '2026-10-19T12:00:00Z', to: '2026-10-19T12:00:02Z' })).total, 3);
    assert.equal((await page({ category: 'all', search: 'NO_MATCH_EXISTS' })).total, 0);
    assert.deepEqual((await page({ category: 'all', search: 'NO_MATCH_EXISTS' })).rows, []);
    for (const id of [admin, user, other]) assert(combined.actors.some(actor => actor.id === id));
    for (const action of ['Login', 'Bulk test', 'Operation failed']) assert(combined.actions.includes(action));
    assert(combined.roles.includes('user')); assert(combined.roles.includes('superadmin'));
    for (const category of ['activity', 'security', 'system']) {
      const separate = await page({ category, action: 'Combined fixture' });
      assert.equal(separate.total, 12); assert(separate.rows.every(row => row.category === category));
    }
  });
});
