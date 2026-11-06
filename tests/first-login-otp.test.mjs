import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { parse, compileTemplate } from '@vue/compiler-sfc';

async function signupState(supabase) {
  let source = await readFile(new URL('../src/assets/JS/signup.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;\r?\n/gm, '').replace('export default', 'globalThis.component =');
  const context = { supabase, localStorage: { removeItem() {} }, setUserAuthenticated() {}, Date };
  vm.runInNewContext(source, context);
  const component = context.component;
  const state = component.data();
  state.$route = { name: 'complete-profile' };
  state.$router = { push(path) { state.destination = path; } };
  for (const [name, fn] of Object.entries(component.methods)) state[name] = fn.bind(state);
  for (const [name, fn] of Object.entries(component.computed)) Object.defineProperty(state, name, { get: () => fn.call(state) });
  return state;
}

function mockAuth({ verified = false, email = 'person@example.com', otpError = null, verifyError = null, returnedId = 'account' } = {}) {
  const calls = [];
  const client = {
    auth: {
      async getUser() { return { data: { user: { id: 'account', email } } }; },
      async signInWithOtp(input) { calls.push(['send', input]); return { error: otpError }; },
      async verifyOtp(input) { calls.push(['verify', input]); return { data: { user: { id: returnedId } }, error: verifyError }; },
      async signOut() { calls.push(['logout']); }
    },
    from() { return { select() { return this; }, eq() { return this; }, async single() {
      return { data: { id_number: '2026-0001', username: 'test_user', email, registration_status: 'incomplete' } };
    } }; },
    async rpc(name) { calls.push([name]); return { data: verified }; }
  };
  return { client, calls };
}

test('incomplete onboarding starts with OTP, retries delivery safely, and rejects invalid codes', async () => {
  const { client, calls } = mockAuth({ otpError: { message: 'Try again in 42 seconds' } });
  const state = await signupState(client);
  state.step = 'otp';
  await state.loadInitialAccount();
  assert.equal(state.step, 'otp');
  assert.equal(state.initialOtpVerified, false);
  assert.equal(calls.find(([name]) => name === 'send')[1].options.shouldCreateUser, false);
  assert.match(state.initialOtpError, /42 seconds/);
  await state.sendInitialOtp();
  assert.equal(calls.filter(([name]) => name === 'send').length, 1);
  state.initialOtp = '123';
  await state.register();
  assert.match(state.initialOtpError, /8-digit/);
  assert.equal(calls.filter(([name]) => name === 'verify').length, 0);
});

test('OTP unlocks only the original account and verified sessions survive reload', async () => {
  const mock = mockAuth({ verified: true });
  const state = await signupState(mock.client);
  await state.loadInitialAccount();
  assert.equal(state.step, 'personal');
  assert.equal(mock.calls.some(([name]) => name === 'send'), false);
  state.initialOtpVerified = false;
  state.initialOtp = '12345678';
  await state.verifyInitialOtp();
  assert.equal(state.initialOtpVerified, true);
  const other = mockAuth({ returnedId: 'other-account' });
  const wrong = await signupState(other.client);
  await wrong.loadInitialAccount();
  wrong.initialOtp = '12345678';
  await wrong.verifyInitialOtp();
  assert.equal(wrong.initialOtpVerified, false);
  assert.equal(wrong.destination, '/login');
  assert(other.calls.some(([name]) => name === 'logout'));
});

test('placeholder addresses block sending and explain administrator correction', async () => {
  const { client, calls } = mockAuth({ email: 'test_user@accounts.local' });
  const state = await signupState(client);
  await state.loadInitialAccount();
  assert.equal(state.initialOtpUnavailable, true);
  assert.match(state.initialOtpError, /administrator/);
  assert.equal(calls.some(([name]) => name === 'send'), false);
});

test('expired OTPs keep details locked and a new password session requires another OTP', async () => {
  const { client } = mockAuth({ verifyError: { message: 'Token has expired' } });
  const state = await signupState(client);
  state.step = 'otp';
  await state.loadInitialAccount();
  state.initialOtp = '12345678';
  await state.verifyInitialOtp();
  assert.equal(state.initialOtpVerified, false);
  assert.equal(state.step, 'otp');
  assert.match(state.initialOtpError, /expired/);
});

test('account creation requires a real delivery email before submission', async () => {
  let source = await readFile(new URL('../src/assets/JS/superadmin/users.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;\r?\n/gm, '').replaceAll('import.meta.env', '({})').replace('export default', 'globalThis.component =');
  const context = {};
  vm.runInNewContext(source, context);
  const component = context.component;
  const state = component.data();
  state.hasFieldWarnings = component.methods.hasFieldWarnings.bind(state);
  Object.assign(state.form, { idNumber: '2026-0001', username: 'test_user', password: 'Password123!', position: 'Staff' });
  const canCreate = () => component.computed.canCreateAccount.call(state);
  for (const email of ['', 'invalid', 'test_user@accounts.local']) {
    state.form.email = email;
    assert.equal(canCreate(), false);
  }
  state.form.email = 'person@example.com';
  assert.equal(canCreate(), true);
  state.warnings.email = ['This email is already registered'];
  assert.equal(canCreate(), false);
});

test('onboarding template hides all details until verified and locks the delivery email', async () => {
  const source = await readFile(new URL('../src/components/SignupForm.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const compiled = compileTemplate({ source: descriptor.template.content, filename: 'SignupForm.vue', id: 'otp' });
  assert.deepEqual(compiled.errors, []);
  assert.match(source, /<template v-if="!isCompletingProfile \|\| initialOtpVerified">/);
  assert.match(source, /:readonly="isCompletingProfile"/);
});

test('database rejects bypasses and accepts only matching OTP claims', async t => {
  assert(process.env.PGLITE_MODULE, 'Set PGLITE_MODULE to the PGlite entrypoint');
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE ROLE authenticated;
    CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
    CREATE FUNCTION public.gen_salt(TEXT) RETURNS TEXT LANGUAGE sql AS $$ SELECT 'salt' $$;
    CREATE FUNCTION public.crypt(TEXT,TEXT) RETURNS TEXT LANGUAGE sql AS $$ SELECT $1 $$;
    CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,email_change TEXT,encrypted_password TEXT,email_confirmed_at TIMESTAMPTZ);
    CREATE TABLE public.users(id UUID PRIMARY KEY,id_number TEXT,username TEXT,email TEXT,role TEXT,registration_status TEXT,is_locked_out BOOLEAN DEFAULT false);
    CREATE TABLE public.profiles(user_id UUID,first_name TEXT,middle_initial TEXT,last_name TEXT,suffix TEXT,birthdate DATE,age INT,sex TEXT,position TEXT);
    CREATE TABLE public.addresses(user_id UUID,purok TEXT,barangay TEXT,city TEXT,province TEXT,country TEXT,zip TEXT);
    CREATE TABLE public.user_security_questions(user_id UUID,question TEXT,answer_hash TEXT);
    INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-000000000001','person@example.com');
    INSERT INTO public.users VALUES ('00000000-0000-0000-0000-000000000001','2026-0001','test_user','person@example.com','user','incomplete',false);
    INSERT INTO public.profiles(user_id) SELECT id FROM public.users;
  `);
  const migration = await readFile(new URL('../api/migration_first_login_otp.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  const claims = async (amr, email = 'person@example.com') => db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: '00000000-0000-0000-0000-000000000001', email, amr })]);
  const verified = async () => (await db.query('SELECT public.initial_account_otp_verified() AS ok')).rows[0].ok;
  await claims([{ method: 'password', timestamp: 20 }]);
  assert.equal(await verified(), false);
  await assert.rejects(db.exec("UPDATE public.users SET registration_status='approved'"), /Verify your email OTP/);
  await assert.rejects(db.exec("UPDATE public.profiles SET first_name='Changed'"), /Verify your email OTP/);
  await assert.rejects(db.exec("INSERT INTO public.addresses(user_id) SELECT id FROM public.users"), /Verify your email OTP/);
  await assert.rejects(db.exec("UPDATE auth.users SET email='changed@example.com'"), /registered email/);
  await assert.rejects(db.exec("UPDATE auth.users SET encrypted_password='changed'"), /Verify your email OTP/);
  const completeArgs = [
    '00000000-0000-0000-0000-000000000001', '2026-0001', 'test_user', 'person@example.com',
    'Test', '', 'User', '', '2000-01-01', 26, 'male', '1', 'Barangay', 'City', 'Province', 'Country', '1234',
    'Q1', 'A1', 'Q2', 'A2', 'Q3', 'A3', 'new-password'
  ];
  const complete = args => db.query(`SELECT public.complete_initial_account(${args.map((_, i) => '$' + (i + 1)).join(',')})`, args);
  await assert.rejects(complete(completeArgs), /Verify your email OTP/);
  await claims([{ method: 'otp', timestamp: 10 }, { method: 'password', timestamp: 20 }]);
  assert.equal(await verified(), false);
  await claims([{ method: 'otp', timestamp: 30 }], 'other@example.com');
  assert.equal(await verified(), false);
  await claims([{ method: 'otp', timestamp: 30 }]);
  assert.equal(await verified(), true);
  await assert.rejects(db.exec("UPDATE public.users SET email='changed@example.com'"), /verified email/);
  await assert.rejects(complete(completeArgs.map((v,i) => i === 3 ? 'other@example.com' : v)), /verified email/);
  await assert.rejects(db.query('SELECT public.update_my_profile($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
    ['2026-0001', 'test_user', 'person@example.com', 'user', 'Test', '', 'User', '', null, null, null, null, null]), /onboarding/);
  await complete(completeArgs);
  assert.equal((await db.query('SELECT registration_status FROM public.users')).rows[0].registration_status, 'approved');
  assert.equal((await db.query('SELECT first_name FROM public.profiles')).rows[0].first_name, 'Test');
  await claims([{ method: 'password', timestamp: 40 }]);
  assert.equal(await verified(), false);
  await db.exec("UPDATE public.profiles SET first_name='Normal update'");
  // The same OTP gate and completion semantics apply to every account role.
  for (const role of ['admin', 'superadmin']) {
    await db.query("SELECT set_config('request.jwt.claims','{}',false)");
    await db.query("UPDATE public.users SET role=$1,registration_status='incomplete'", [role]);
    await claims([{ method: 'password', timestamp: 40 }]);
    await assert.rejects(complete(completeArgs), /Verify your email OTP/);
    await claims([{ method: 'otp', timestamp: 50 }]);
    await complete(completeArgs);
    assert.equal((await db.query('SELECT registration_status FROM public.users')).rows[0].registration_status,
      role === 'superadmin' ? 'inactive' : 'approved');
  }
});
