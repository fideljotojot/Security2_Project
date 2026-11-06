import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createAccountHandler } from '../supabase/functions/create-account-with-email/handler.js';

const details = { idNumber: '2026-0001', username: 'test_user', password: 'Abc123!<&"', email: 'person@example.com', role: 'user', position: 'Staff' };

function server(options = {}) {
  const calls = [];
  const caller = {
    auth: { async getUser() { return options.unauthorized ? { error: {} } : { data: { user: { id: 'actor' } } }; } },
    from() { return { select() { return this; }, eq() { return this; }, async single() {
      return { data: { role: options.role || 'superadmin', registration_status: options.status || 'approved', is_locked_out: false } };
    } }; },
    async rpc(name, input) { calls.push(['profile', name, input]); return { data: !options.profileError, error: options.profileError }; },
  };
  const admin = { auth: { admin: {
    async createUser(input) { calls.push(['create', input]); return options.createError ? { error: options.createError } : { data: { user: { id: 'new-account' } } }; },
    async deleteUser(id) { calls.push(['delete', id]); return { error: options.deleteError }; },
  } } };
  const handler = createAccountHandler({
    env: name => options.missingConfig && name === 'SMTP_PASSWORD' ? '' : ({ SUPABASE_ANON_KEY: 'anon', SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_USERNAME: 'sender@gmail.com', SMTP_PASSWORD: 'test-app-password', SMTP_FROM: 'sender@gmail.com' }[name] || 'configured'),
    createClient: (_url, key, config) => { calls.push(['client', key, config]); return key === 'anon' ? caller : admin; },
    sendEmail: async (configuration, message) => {
      calls.push(['email', message, configuration]);
      if (options.emailThrows || options.emailError) throw new Error('private upstream error');
    },
  });
  const run = async (body = details, authorization = 'Bearer actor-token') => {
    const response = await handler(new Request('https://example.com/create-account-with-email', {
      method: 'POST', headers: { authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  };
  return { run, calls };
}

test('all account roles receive the exact initial credentials only after setup succeeds', async () => {
  for (const role of ['user', 'admin', 'superadmin']) {
    const { run, calls } = server();
    const result = await run({ ...details, role, email: ' PERSON@EXAMPLE.COM ' });
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    const created = calls.find(([name]) => name === 'create')[1];
    assert.equal(created.password, details.password);
    assert.equal(created.email, 'person@example.com');
    assert.equal(created.email_confirm, true);
    assert.equal(calls.find(([name]) => name === 'profile')[2].p_role, role);
    const email = calls.find(([name]) => name === 'email')[1];
    assert.deepEqual(email.to, ['person@example.com']);
    assert(email.text.includes(details.password));
    assert(email.text.includes(details.username));
    assert.match(email.html, /Abc123!&lt;&amp;&quot;/);
    assert.match(email.text, /OTP/);
    assert.equal(JSON.stringify(result.body).includes(details.password), false);
    assert(calls.findIndex(([name]) => name === 'profile') < calls.findIndex(([name]) => name === 'email'));
    assert.equal(calls.some(([name]) => name === 'delete'), false);
    assert.equal(calls.find(([name, key]) => name === 'client' && key === 'anon')[2].global.headers.Authorization, 'Bearer actor-token');
  }
});

test('email rejection and network failure remove only the new account and require email re-entry', async () => {
  for (const options of [{ emailError: true }, { emailThrows: true }]) {
    const { run, calls } = server(options);
    const { body } = await run();
    assert.equal(body.code, 'EMAIL_SEND_FAILED');
    assert.equal(body.rolledBack, true);
    assert.deepEqual(calls.filter(([name]) => name === 'delete'), [['delete', 'new-account']]);
    assert.match(body.error, /Re-enter the email/);
  }
});

test('setup rejection cleans Auth account without emailing; duplicate Auth accounts are never deleted', async () => {
  const setup = server({ profileError: { message: 'Superadmin limit reached' } });
  assert.equal((await setup.run()).body.code, 'ACCOUNT_SETUP_FAILED');
  assert.equal(setup.calls.some(([name]) => name === 'email'), false);
  assert.equal(setup.calls.some(([name]) => name === 'delete'), true);
  const duplicate = server({ createError: { message: 'Email already registered' } });
  assert.equal((await duplicate.run()).body.code, 'ACCOUNT_CREATE_FAILED');
  assert.equal(duplicate.calls.some(([name]) => ['delete', 'email', 'profile'].includes(name)), false);
});

test('cleanup failure identifies the remaining account without claiming rollback succeeded', async () => {
  const { run } = server({ emailError: true, deleteError: {} });
  const { body } = await run();
  assert.equal(body.code, 'CLEANUP_FAILED');
  assert.equal(body.accountId, 'new-account');
  assert.notEqual(body.rolledBack, true);
});

test('unauthorized, inactive, invalid, and unconfigured requests create nothing and send nothing', async () => {
  for (const options of [{ unauthorized: true }, { role: 'admin' }, { status: 'incomplete' }, { status: 'inactive' }, { missingConfig: true }]) {
    const { run, calls } = server(options);
    assert.notEqual((await run()).body.ok, true);
    assert.equal(calls.some(([name]) => name === 'create' || name === 'email'), false);
  }
  const invalid = server();
  assert.equal((await invalid.run({ ...details, email: 'invalid' })).body.code, 'INVALID_INPUT');
  assert.equal(invalid.calls.some(([name]) => name === 'create'), false);
});

async function formState(invoke) {
  let source = await readFile(new URL('../src/assets/JS/superadmin/users.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;\r?\n/gm, '').replace('export default', 'globalThis.component =');
  const context = { supabase: { functions: { invoke } } };
  vm.runInNewContext(source, context);
  const component = context.component;
  const state = component.data();
  for (const [name, fn] of Object.entries(component.methods)) state[name] = fn.bind(state);
  for (const name of ['canCreateAccount', 'superadminLimitReached']) Object.defineProperty(state, name, { get: () => component.computed[name].call(state) });
  state.fetchUsers = async () => {};
  state.$nextTick = async () => {};
  state.$refs = { createAccountEmail: { focus() { state.focusedEmail = true; } } };
  state.showAddModal = true;
  state.isCreateConfirmed = true;
  Object.assign(state.form, details);
  return state;
}

test('failed send keeps Add User open, focuses a cleared email, and requires confirmation again', async () => {
  let attempts = 0;
  const state = await formState(async () => {
    attempts++;
    return { data: { ok: false, code: 'EMAIL_SEND_FAILED', rolledBack: true } };
  });
  await state.registerUser();
  assert.equal(state.showAddModal, true);
  assert.equal(state.showNotificationModal, false);
  assert.equal(state.form.email, '');
  assert.equal(state.focusedEmail, true);
  assert.equal(state.form.username, details.username);
  assert.equal(state.form.password, details.password);
  assert.equal(state.isCreateConfirmed, false);
  assert.equal(state.canCreateAccount, false);
  state.form.email = 'corrected@example.com';
  state.warnings.email = [];
  await state.registerUser();
  assert.equal(state.showCreateConfirmation, true);
  assert.equal(attempts, 1);
});

test('cleanup and transport failures block resubmission; success clears passwords', async () => {
  for (const response of [{ data: { code: 'CLEANUP_FAILED', accountId: 'leftover', error: 'Cleanup failed' } }, { error: {} }]) {
    let attempts = 0;
    const state = await formState(async () => { attempts++; return response; });
    await state.registerUser();
    assert(state.createBlockedAccountId);
    assert.equal(state.canCreateAccount, false);
    await state.registerUser();
    assert.equal(attempts, 1);
  }
  const state = await formState(async (_name, input) => {
    assert.equal(input.body.password, details.password);
    return { data: { ok: true } };
  });
  await state.registerUser();
  assert.equal(state.showAddModal, false);
  assert.equal(state.showNotificationModal, true);
  assert.equal(state.form.password, '');
  assert.match(state.notificationTitle, /credentials email sent/);
});

test('repeat submissions are ignored while account creation is in progress', async () => {
  let finish;
  let attempts = 0;
  const state = await formState(() => { attempts++; return new Promise(resolve => { finish = resolve; }); });
  const pending = state.registerUser();
  await state.registerUser();
  assert.equal(attempts, 1);
  finish({ data: { ok: true } });
  await pending;
});

test('a missing mailer shows a setup error without pretending account cleanup failed', async () => {
  const state = await formState(async () => ({ error: { context: { status: 404, async json() { return { code: 'NOT_FOUND' }; } } } }));
  await state.registerUser();
  assert.equal(state.createBlockedAccountId, '');
  assert.equal(state.showNotificationModal, false);
  assert.equal(state.showAddModal, true);
  assert.equal(state.form.email, details.email);
  assert.match(state.errorMessage, /service is unavailable/);
  assert.match(state.errorMessage, /No account was created/);
});
