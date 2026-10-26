import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

test('two superadmin slots reserve incomplete accounts and reject additions without replacing accounts', async t => {
  assert(process.env.PGLITE_MODULE);
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
  const db = new PGlite(); t.after(()=>db.close());
  await db.exec(`CREATE TABLE public.users(id INTEGER PRIMARY KEY, role TEXT, registration_status TEXT);
    INSERT INTO public.users VALUES(1,'superadmin','approved'),(2,'superadmin','inactive'),
      (3,'admin','approved'),(4,'user','approved'),(5,'superadmin','blocked');`);
  const migration=await readFile(new URL('../api/migration_superadmin_slot_limit.sql',import.meta.url),'utf8');
  await db.exec(migration); await db.exec(migration);
  const snapshot = async ()=>(await db.query('SELECT * FROM public.users ORDER BY id')).rows;
  const before=await snapshot();
  await assert.rejects(db.query("INSERT INTO public.users VALUES(6,'superadmin','incomplete')"),/Superadmin limit reached/);
  await assert.rejects(db.query("UPDATE public.users SET role='superadmin' WHERE id=3"),/Superadmin limit reached/);
  await assert.rejects(db.query("UPDATE public.users SET registration_status='inactive' WHERE id=5"),/Superadmin limit reached/);
  assert.deepEqual(await snapshot(),before);
  await db.query("INSERT INTO public.users VALUES(7,'admin','incomplete'),(8,'user','incomplete')");
  await db.query("UPDATE public.users SET registration_status='blocked' WHERE id=2");
  await db.query("INSERT INTO public.users VALUES(6,'superadmin','incomplete')");
  await assert.rejects(db.query("UPDATE public.users SET role='superadmin' WHERE id=4"),/Superadmin limit reached/);
  await db.query("UPDATE public.users SET registration_status='inactive' WHERE id=6");
  await db.query("UPDATE public.users SET registration_status='inactive' WHERE id=1");
  await db.query("UPDATE public.users SET registration_status='approved' WHERE id=6");
  await db.exec("BEGIN; UPDATE public.users SET registration_status='blocked' WHERE id=1; UPDATE public.users SET registration_status='inactive' WHERE id=5; COMMIT;");
  assert.equal((await db.query("SELECT count(*)::INT n FROM public.users WHERE role='superadmin' AND registration_status IN ('approved','inactive','incomplete')")).rows[0].n,2);
  await db.query("UPDATE public.users SET role='admin' WHERE id=5");
  await db.query("UPDATE public.users SET role='superadmin',registration_status='inactive' WHERE id=3");
  assert.equal((await db.query("SELECT role FROM public.users WHERE id=3")).rows[0].role,'superadmin');
});

test('UI counts reserved slots and stops creation/promotion before authentication', async () => {
  let source=await readFile(new URL('../src/assets/JS/superadmin/users.js',import.meta.url),'utf8');
  source=source.replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.env','({})').replace('export default','globalThis.component =');
  const context={}; vm.runInNewContext(source,context);
  const component=context.component, state=component.data();
  for(const [name,fn] of Object.entries(component.methods)) state[name]=fn.bind(state);
  Object.defineProperty(state,'superadminLimitReached',{get:()=>component.computed.superadminLimitReached.call(state)});
  state.users=[{role:'superadmin',registration_status:'approved'},{role:'superadmin',registration_status:'inactive'}];
  assert(state.superadminLimitReached);
  state.form.role='superadmin'; await state.registerUser(); assert(state.errorMessage.includes('Superadmin limit reached'));
  state.privilegeUser={role:'user'};state.privilegeRole='superadmin';await state.updatePrivilege();assert.equal(state.notificationTitle,'Superadmin Limit Reached');
  state.users[1].registration_status='incomplete';assert(state.superadminLimitReached);
  state.users[1].registration_status='blocked';assert(!state.superadminLimitReached);
});
