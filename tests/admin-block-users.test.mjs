import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { parse, compileTemplate } from '@vue/compiler-sfc';

test('admins cannot block admin or superadmin targets through status or lockout writes', async t => {
  const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::UUID $$;
    CREATE TABLE public.users(id UUID PRIMARY KEY,role TEXT,registration_status TEXT,is_locked_out BOOLEAN DEFAULT false);
    INSERT INTO public.users(id,role,registration_status) VALUES
      ('00000000-0000-0000-0000-000000000001','admin','approved'),
      ('00000000-0000-0000-0000-000000000002','admin','approved'),
      ('00000000-0000-0000-0000-000000000003','user','approved'),
      ('00000000-0000-0000-0000-000000000004','superadmin','approved');`);
  const migration=await readFile(new URL('../api/migration_admin_block_users_only.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration);
  const asUser=async suffix=>db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",['00000000-0000-0000-0000-00000000000'+suffix]);
  await asUser(1);
  for(const suffix of [1,2,4]) {
    const id='00000000-0000-0000-0000-00000000000'+suffix;
    await assert.rejects(db.query("UPDATE public.users SET registration_status='blocked' WHERE id=$1",[id]),/only block user accounts/);
    await assert.rejects(db.query('UPDATE public.users SET is_locked_out=true WHERE id=$1',[id]),/only block user accounts/);
  }
  await db.exec("UPDATE public.users SET registration_status='blocked',is_locked_out=true WHERE role='user'");
  assert.equal((await db.query("SELECT registration_status FROM public.users WHERE role='user'")).rows[0].registration_status,'blocked');
  await asUser(4);
  await db.exec("UPDATE public.users SET registration_status='blocked',is_locked_out=true WHERE role='admin'");
  assert.equal((await db.query("SELECT count(*)::INT n FROM public.users WHERE role='admin' AND registration_status='blocked'")).rows[0].n,2);
  await asUser(1);
  await db.exec("UPDATE public.users SET registration_status='approved',is_locked_out=false WHERE role='admin'");
});

test('admin block handler rejects admin targets before password confirmation', async () => {
  let source=await readFile(new URL('../src/assets/JS/admin/users.js',import.meta.url),'utf8');
  source=source.replace(/^import .*;\r?\n/gm,'').replace('export default','globalThis.component =');
  const context={};vm.runInNewContext(source,context);
  const state=context.component.data();for(const [key,fn] of Object.entries(context.component.methods))state[key]=fn.bind(state);
  await state.setStatus({role:'admin',registration_status:'approved'},'blocked');
  assert.equal(state.message,'Admins can only block user accounts.');
  const filename='src/components/admin/AdminUsers.vue';const template=await readFile(new URL('../'+filename,import.meta.url),'utf8');
  const {descriptor,errors}=parse(template);assert.deepEqual(errors,[]);
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'admin-users'}).errors,[]);
});
