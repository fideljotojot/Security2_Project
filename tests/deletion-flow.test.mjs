import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { logDescription } from '../src/utils/log-display.js';

async function harness(role) {
  let source = await readFile(new URL(`../src/assets/JS/${role}/users.js`, import.meta.url), 'utf8');
  source = source.replace(/^import .*;\r?\n/gm, '').replace('export default', 'globalThis.component =');
  const calls = []; let correct = false;
  const context = { supabase: {
    auth: { getUser: async () => ({ data: { user: { email: 'reviewer@example.invalid' } } }),
      signInWithPassword: async () => ({ error: correct ? null : new Error('Wrong password') }) },
    rpc: async (name,args) => { calls.push({ name,args }); return { data: 1, error: null }; }
  } };
  source = source.replaceAll('import.meta.env', '({})');
  vm.runInNewContext(source, context);
  const state = context.component.data();
  for (const [key,fn] of Object.entries(context.component.methods)) state[key] = fn.bind(state);
  state.fetchUsers = async () => {};
  return { state, calls, allow: () => { correct = true; } };
}
for (const role of ['admin','superadmin']) test(`${role} reason then password, retry, success and cancellation`, async () => {
  const { state:s,calls,allow } = await harness(role);
  const target = { user_id:'target', role:'user', username:'Target' };
  const admin = role === 'admin';
  if (admin) s.requestDelete(target); else await s.deleteUser(target);
  s.deleteReason = '  ';
  if (admin) s.submitDelete(); else s.beginDeleteConfirmation();
  assert(!s.showDeletePasswordModal && !s.showDeleteModal);
  s.deleteReason = '  Duplicate account  ';
  if (admin) s.submitDelete(); else s.beginDeleteConfirmation();
  assert(admin ? s.showDeletePasswordModal : s.showDeleteModal);
  s.deletePassword = 'wrong';
  if (admin) await s.confirmDeleteRequest(); else await s.confirmDeleteUser();
  assert.equal(calls.length,0); assert(s.deleteError.includes('password'));
  assert.equal(s.deleteReason,'  Duplicate account  ');
  assert(admin ? s.showDeletePasswordModal : s.showDeleteModal);
  allow(); s.deletePassword = 'correct';
  if (admin) await s.confirmDeleteRequest(); else await s.confirmDeleteUser();
  assert.equal(calls.length,1); assert.equal(calls[0].name,'create_delete_request');
  assert.equal(calls[0].args.p_reason,'Duplicate account');
  assert.equal(s.deletePassword,''); assert.equal(s.deleteReason,'');
  if (admin) { s.requestDelete(target); s.cancelDelete(); assert.equal(s.deleteTarget,null); }
  else { await s.deleteUser(target); s.closeDeleteModal(); assert.equal(s.pendingDeleteUser,null); }
  assert.equal(calls.length,1);
});
test('deletion descriptions include only explicit string reasons', () => {
  for (const action of ['Deleted user','Created deletion request','Approved deletion request','Rejected deletion request','Removed deletion request']) {
    const base = logDescription({ action });
    assert.equal(logDescription({ action,details:{ reason:'  Duplicate account  ' } }),base+' Reason: Duplicate account');
    assert.equal(logDescription({ action,details:{ reason:{ secret:true } } }),base);
    assert.equal(logDescription({ action,details:{ reason:'  ' } }),base);
  }
});

test('removed accounts use the target role and retain reasons', () => {
  for (const [role,label] of [['admin','an admin'],['user','a user'],['superadmin','a superadmin']]) {
    assert.equal(logDescription({ action:'Removed deletion request', actor_role:'superadmin', details:{target_role:role, reason:'Dropped'} }),
      'Removed '+label+'. Reason: Dropped');
  }
  for (const role of [undefined,null,'unknown','__proto__',{},['admin']]) {
    assert.equal(logDescription({ action:'Removed deletion request', details:{target_role:role} }), 'Removed an account.');
  }
});
