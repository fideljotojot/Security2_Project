import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { actorName, browserAndOS, localDateBounds, logDescription, LOG_CATEGORIES } from '../src/utils/log-display.js';
import { createAuditedFetch, SESSION_STORAGE_KEY } from '../src/utils/audit-transport.js';

function storage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}

test('name fallbacks, browser detection and safe descriptions', () => {
  assert.equal(actorName({ actor_full_name: ' Alex M. Cruz Jr. ', actor_username: 'alex' }), 'Alex M. Cruz Jr.');
  assert.equal(actorName({ actor_full_name: ' ', actor_username: 'alex' }), 'alex');
  assert.equal(actorName({}), 'System');
  assert.equal(browserAndOS(null), '—');
  assert.equal(browserAndOS('Mozilla Windows Chrome/123 Safari/537 Edg/123'), 'Edge / Windows');
  assert.equal(browserAndOS('Mozilla Android Chrome/123 Safari/537'), 'Chrome / Android');
  assert.equal(browserAndOS('Mozilla iPhone AppleWebKit Version/17 Safari/604'), 'Safari / iOS');
  assert.equal(browserAndOS('custom-client'), 'Unknown / Unknown');
  const summary = logDescription({ action: 'Password reset', actor_username: 'admin', details: {
    target_username: 'alex', changed_fields: ['password'], encrypted_password: 'NEVER_DISPLAY',
  } });
  assert.equal(summary, 'Reset account password.');
  assert(!summary.includes('alex'));
  assert(!summary.includes('NEVER_DISPLAY'));
});

test('Details describes account, registration, deletion and authentication actions', () => {
  const cases = [
    ['Profile update', 'Updated profile information.'],
    ['Updated user', 'Updated account information.'],
    ['Changed admin privilege', 'Changed account role.'],
    ['Updated permissions', 'Updated account permissions.'],
    ['Password changed', 'Changed account password.'],
    ['Password reset', 'Reset account password.'],
    ['Signed up', 'Created an account.'], ['Deleted user', 'Deleted an account.'],
    ['Approved registration', 'Approved an account registration.'],
    ['Rejected registration', 'Rejected an account registration.'],
    ['Blocked user', 'Blocked an account.'], ['Unblocked user', 'Unblocked an account.'],
    ['Created deletion request', 'Submitted a deletion request.'],
    ['Approved deletion request', 'Approved a deletion request.'],
    ['Rejected deletion request', 'Rejected a deletion request.'],
    ['Removed deletion request', 'Removed a deletion request.'],
    ['Login', 'Logged in successfully.'], ['Logged in', 'Logged in successfully.'],
    ['Logout', 'Logged out.'], ['Logged out', 'Logged out.'],
    ['Session resumed', 'Resumed an existing session; original login time is unknown.'],
    ['Session Timeout', 'Session ended due to inactivity.'],
  ];
  for (const [action, expected] of cases) {
    assert.equal(logDescription({ action, actor_full_name: 'PERFORMER_NAME', actor_username: 'PERFORMER_USERNAME',
      entity_id: '00000000-0000-4000-8000-000000000001', details: {
        target_username: 'TARGET_USERNAME', username: 'TARGET_USERNAME',
        summary: 'UNSAFE_SUMMARY', operation: 'DATABASE_OPERATION', code: 'XX000', password: 'SECRET_VALUE',
      } }), expected, action);
  }
});

test('Details retains known changed field names and timeout duration without raw metadata', () => {
  assert.equal(logDescription({ action: 'Profile update', details: {
    changed_fields: ['first_name', 'email', 'first_name', 'encrypted_password', 'token', '__proto__', 'RAW_SECRET'],
    first_name: 'PRIVATE_VALUE', email: 'PRIVATE_EMAIL',
  } }), 'Updated profile fields: first name, email.');
  assert.equal(logDescription({ action: 'Updated user', details: { changed_fields: ['id_number', 'username'] } }),
    'Updated account fields: ID number, username.');
  assert.equal(logDescription({ action: 'Password reset', details: { changed_fields: ['password', 'email'] } }),
    'Reset account password. Also updated fields: email.');
  assert.equal(logDescription({ action: 'Session Timeout', details: {
    summary: 'PERSON_NAME: Session ended after three minutes of superadmin inactivity. SECRET_VALUE',
  } }), 'Session ended after three minutes of inactivity.');
  assert.equal(logDescription({ action: 'Session Timeout', details: {
    summary: 'Session expired after 5 minutes of inactivity',
  } }), 'Session ended after 5 minutes of inactivity.');
});

test('system descriptions omit operation codes and unknown actions become sentences', () => {
  assert.equal(logDescription({ category: 'system', action: 'Operation failed', details: {
    operation: 'update_my_profile', code: 'XX000', summary: 'PERSON_NAME: SECRET_VALUE',
  } }), 'An unexpected application operation failed.');
  assert.equal(logDescription({ action: 'exported report', details: { summary: 'DO_NOT_RENDER' } }), 'Exported report.');
  assert.equal(logDescription({ action: 'Exported report.' }), 'Exported report.');
  assert.equal(logDescription({ action: '', details: null }), 'Recorded an activity.');
});

test('inclusive local dates use next local midnight and reject reversed ranges', () => {
  const result = localDateBounds('2026-10-19', '2026-10-19');
  assert.equal(result.from, new Date(2026, 9, 19).toISOString());
  assert.equal(result.to, new Date(2026, 9, 20).toISOString());
  assert.throws(() => localDateBounds('2026-10-20', '2026-10-19'), /From date/);
  assert.throws(() => localDateBounds('invalid', ''), /valid date/);
  assert.throws(() => localDateBounds('2026-02-31', ''), /valid date/);
  assert.deepEqual(localDateBounds('', ''), { from: null, to: null });
});

async function pageHarness(rpc, timers = { setTimeout, clearTimeout }) {
  let source = await readFile(new URL('../src/assets/JS/superadmin/activity-logs.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;\r?\n/gm, '').replace('export default', 'globalThis.component =');
  const context = { supabase: { rpc }, LOG_CATEGORIES, actorName, browserAndOS, localDateBounds, logDescription, ...timers };
  vm.runInNewContext(source, context);
  const component = context.component;
  const state = component.data();
  for (const [name, method] of Object.entries(component.methods)) state[name] = method.bind(state);
  for (const [name, getter] of Object.entries(component.computed)) Object.defineProperty(state, name, { get: () => getter.call(state) });
  Object.defineProperty(state, 'unmount', { value: () => component.beforeUnmount.call(state) });
  return state;
}

test('server pagination, immediate filter application and category reset without performer filtering', async () => {
  const calls = [];
  const state = await pageHarness(async (name, args) => {
    calls.push({ name, args });
    return { data: { rows: [{ log_id: 151 }], total: 151, actors: [
      { id: 'one', name: 'Alex Cruz', username: 'alex1' }, { id: 'two', name: 'Alex Cruz', username: 'alex2' },
    ], actions: ['Profile update'], roles: ['user'] } };
  });
  await state.loadLogs();
  assert.equal(state.category, 'all');
  assert.equal(calls[0].args.p_category, 'all');
  assert.equal(state.categories[0].value, 'all');
  assert.equal(state.pageCount, 19);
  assert.equal(calls[0].args.p_page_size, 8);
  state.draft.search = 'alex2';
  await state.loadLogs();
  assert.equal(calls.at(-1).args.p_search, '');
  state.applyFilters();
  assert.equal(calls.at(-1).args.p_search, 'alex2');
  assert.equal(calls.at(-1).args.p_actor, null);
  await new Promise(resolve => setImmediate(resolve));
  state.goToPage(16);
  assert.equal(calls.at(-1).args.p_page, 16);
  await new Promise(resolve => setImmediate(resolve));
  state.draft.from = '2026-10-20'; state.draft.to = '2026-10-19';
  const count = calls.length;
  state.applyFilters();
  assert(state.validationMessage); assert.equal(calls.length, count);
  state.category = 'system'; state.changeCategory();
  assert.equal(calls.at(-1).args.p_category, 'system');
  assert.equal(calls.at(-1).args.p_search, '');
  assert.equal(calls.at(-1).args.p_page, 1);
  state.category = 'all'; state.changeCategory();
  assert.equal(calls.at(-1).args.p_category, 'all');
  assert.equal(calls.at(-1).args.p_page, 1);
});

function fakeClock() {
  let now = 0, nextId = 0;
  const pending = new Map();
  return {
    setTimeout(callback, delay) { const id = ++nextId; pending.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { pending.delete(id); },
    tick(duration) {
      now += duration;
      for (const [id, timer] of pending) if (timer.at <= now) { pending.delete(id); timer.callback(); }
    },
  };
}

test('search waits 300 ms, resets its delay while typing, and Enter applies immediately', async () => {
  const calls = [], clock = fakeClock();
  const state = await pageHarness(async (_name, args) => { calls.push(args); return { data: { rows: [], total: 0 } }; }, clock);
  state.draft.search = 'a'; state.scheduleSearch(); clock.tick(200);
  state.draft.search = 'alex'; state.scheduleSearch(); clock.tick(299);
  assert.equal(calls.length, 0);
  clock.tick(1);
  assert.equal(calls.length, 1); assert.equal(calls[0].p_search, 'alex');
  state.draft.search = 'alex2'; state.scheduleSearch();
  state.applyFilters(); // Search's Enter handler.
  assert.equal(calls.length, 2); assert.equal(calls[1].p_search, 'alex2');
  clock.tick(300); assert.equal(calls.length, 2);
});

test('other selections, Clear, category changes and unmount cancel pending searches', async () => {
  const calls = [], clock = fakeClock();
  const state = await pageHarness(async (_name, args) => { calls.push(args); return { data: { rows: [], total: 0 } }; }, clock);
  state.draft.search = 'alex'; state.scheduleSearch(); state.currentPage = 3;
  state.draft.role = 'admin'; state.loading = true; state.applyFilters();
  assert.equal(calls.length, 1); assert.equal(calls[0].p_role, 'admin'); assert.equal(calls[0].p_page, 1);
  clock.tick(300); assert.equal(calls.length, 1);
  state.draft.search = 'discard'; state.scheduleSearch(); state.clearFilters();
  assert.equal(calls.at(-1).p_search, '');
  clock.tick(300); assert.equal(calls.length, 2);
  state.draft.search = 'discard again'; state.scheduleSearch(); state.category = 'security'; state.changeCategory();
  clock.tick(300); assert.equal(calls.length, 3); assert.equal(calls.at(-1).p_category, 'security');
  state.draft.search = 'unmounted'; state.scheduleSearch(); state.unmount();
  clock.tick(300); assert.equal(calls.length, 3);
});

test('date validation keeps the last valid results and correction applies immediately', async () => {
  const calls = [], clock = fakeClock();
  const state = await pageHarness(async (_name, args) => { calls.push(args); return { data: { rows: [{ log_id: 1 }], total: 1 } }; }, clock);
  await state.loadLogs();
  const previous = state.logs, previousFilters = state.applied;
  state.draft.from = '2026-10-20'; state.draft.to = '2026-10-19';
  state.scheduleSearch(); state.applyFilters(); clock.tick(300);
  assert.equal(calls.length, 1); assert.equal(state.logs, previous); assert.equal(state.applied, previousFilters);
  assert(state.validationMessage);
  state.draft.to = '2026-10-20'; state.applyFilters();
  assert.equal(calls.length, 2); assert.equal(state.validationMessage, '');
  assert.equal(calls[1].p_to, new Date(2026, 9, 21).toISOString());
});

test('late network responses do not replace a newer category', async () => {
  const pending = [];
  const state = await pageHarness(() => new Promise(resolve => pending.push(resolve)));
  const first = state.loadLogs();
  state.category = 'security';
  const second = state.loadLogs();
  pending[1]({ data: { rows: [{ log_id: 2 }], total: 1 } }); await second;
  pending[0]({ data: { rows: [{ log_id: 1 }], total: 1 } }); await first;
  assert.equal(state.logs[0].log_id, 2);
  assert.equal(state.loading, false);
});

test('actual Vue template renders categorized headers, session status, errors and empty states', async () => {
  const file = await readFile(new URL('../src/components/superadmin/ActivityLogs.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(file);
  const compiled = compileTemplate({ source: descriptor.template.content, filename: 'ActivityLogs.vue',
    id: 'test-activity-logs', ssr: true, ssrCssVars: [] });
  assert.equal(compiled.errors.length, 0);
  const code = compiled.code.replace(/from "([^"]+)"/g, (_all, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
  const { ssrRender } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const state = await pageHarness(async () => ({ data: { rows: [], total: 0 } }));
  const render = async () => renderToString(createSSRApp({ ssrRender, data: () => ({ ...state,
    categoryLabel: state.categoryLabel, pageCount: state.pageCount,
    pageStart: state.pageStart, pageEnd: state.pageEnd, visiblePages: state.visiblePages,
  }) }));
  let html = await render();
  assert(html.includes('<th class="log-col-category">Category</th>'));
  assert(html.includes('No logs match your current filters.'));
  state.category = 'activity';
  html = await render();
  assert(!html.includes('>Apply</button>'));
  assert(html.includes('<h2 id="logs-heading">Logs</h2><div class="logs-header-actions">'));
  assert.match(html, /class="logs-header-actions"><button[^>]*>Clear<\/button><button[^>]*>Refresh<\/button><\/div>/);
  assert(!html.includes('logs-subtitle'));
  assert(html.includes('filter-container logs-primary-filters'));
  assert(html.includes('class="searchbar"')); assert(html.includes('class="dropdown"'));
  assert(!html.includes('Filter logs by performer')); assert(!html.includes('All performers'));
  for (const label of ['Search logs', 'Log type', 'Filter logs by role', 'Filter logs by action']) {
    assert(html.includes(`aria-label="${label}"`));
  }
  assert(html.includes('logs-date-filters')); assert(html.includes('logs-clear-button'));
  assert.match(html, /class="logs-date-filters">[\s\S]*?<\/div><\/div><\/form>/);
  assert(html.includes('No activity logs match'));
  assert(html.includes('Date &amp; Time'));
  state.draft.search = 'Alex';
  html = await render();
  assert(html.includes('class="search-clear"')); assert(html.includes('aria-label="Clear search"'));
  state.category = 'security'; state.total = 1;
  state.logs = [{ log_id: 1, actor_full_name: 'Alex Cruz', actor_role: 'user', action: 'Login',
    session_status: 'Unknown', user_agent: null, details: {}, created_at: '2026-10-19T00:00:00Z' }];
  html = await render();
  assert(html.includes('<th class="log-col-date">Time In</th><th class="log-col-date">Time Out</th>'));
  assert(html.includes('Unknown')); assert(html.includes('Alex Cruz'));
  state.category = 'all'; state.total = 3;
  state.logs = ['activity', 'security', 'system'].map((category, index) => ({
    log_id: index + 1, category, action: 'Example action', details: {}, created_at: '2026-10-19T00:00:00Z',
  }));
  html = await render();
  assert(html.includes('<th class="log-col-category">Category</th>')); assert(html.includes('Date &amp; Time'));
  assert(!html.includes('<th class="log-col-date">Time In</th>')); assert(!html.includes('<th class="log-col-date">Time Out</th>'));
  for (const label of ['Activity Logs', 'Login &amp; Security Logs', 'System Logs']) assert(html.includes(`<td class="log-col-category" data-label="Category" role="cell">${label}</td>`));
  assert(html.includes('logs-table-container')); assert(!html.includes('logs-table-scroll'));
  for (const label of ['User ID', 'Performed By', 'Role', 'Category', 'Module', 'Action', 'Browser / OS', 'Date &amp; Time', 'IP Address', 'Details']) {
    assert(html.includes(`data-label="${label}"`));
  }
  state.logs = []; state.total = 0; html = await render();
  assert(html.includes('colspan="10"')); assert(html.includes('No logs match your current filters.'));
  state.category = 'security';
  state.loading = true;
  html = await render(); assert(html.includes('Loading login &amp; security logs'));
  state.loading = false; state.errorMessage = 'Offline';
  html = await render(); assert(html.includes('role="alert"')); assert(html.includes('Use Refresh to try again.'));
});

test('error transport excludes secrets, expected failures and recursive reports', async () => {
  globalThis.localStorage = storage();
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id: randomUUID(), userId: 'user' }));
  const calls = [];
  let status = 500, code = 'XX000';
  const auditedFetch = createAuditedFetch('https://example.supabase.co', async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ code, message: 'sensitive internal error' }), { status });
  });
  await auditedFetch('https://example.supabase.co/rest/v1/rpc/update_my_profile', {
    method: 'POST', headers: { authorization: 'Bearer secret' }, body: JSON.stringify({ p_password: 'NEVER_LOG' }),
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.headers.get('x-app-session-id'), JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)).id);
  assert.deepEqual(JSON.parse(calls[1].init.body), { p_operation: 'update_my_profile', p_code: 'XX000' });
  assert(!calls[1].init.body.includes('NEVER_LOG'));
  assert(!calls[1].init.body.includes('sensitive internal error'));
  status = 400; code = 'P0001'; calls.length = 0;
  await auditedFetch('https://example.supabase.co/rest/v1/rpc/update_my_profile', { headers: { authorization: 'Bearer secret' } });
  assert.equal(calls.length, 1);
  status = 500; calls.length = 0;
  await auditedFetch('https://example.supabase.co/rest/v1/rpc/record_system_log', {});
  assert.equal(calls.length, 1);
  delete globalThis.localStorage;
});

async function sessionHarness(rpc, sharedStorage = storage()) {
  let source = await readFile(new URL('../src/utils/activity-session.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  source += '\nglobalThis.api = { startTrackingSession, heartbeatTrackingSession, endTrackingSession, resetTrackingLifecycle };';
  const context = {
    localStorage: sharedStorage, SESSION_STORAGE_KEY, crypto: { randomUUID }, AbortSignal,
    navigator: { locks: { request: (_name, callback) => callback() } },
    readTrackingSession: () => JSON.parse(sharedStorage.getItem(SESSION_STORAGE_KEY) || 'null'),
    supabase: { rpc: (...args) => {
      const result = Promise.resolve().then(() => rpc(...args));
      result.abortSignal = () => result;
      return result;
    } },
  };
  vm.runInNewContext(source, context);
  return { api: context.api, storage: sharedStorage };
}

test('session start retries are idempotent, resume shares IDs, and logout is deduplicated', async () => {
  const calls = [], rows = new Map();
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === 'start_application_session') rows.set(args.p_session_id, true);
    return { data: name === 'start_application_session' ? args.p_session_id : true };
  };
  const { api, storage: shared } = await sessionHarness(rpc);
  const [one, two] = await Promise.all([api.startTrackingSession('user', { login: true }), api.startTrackingSession('user', { login: true })]);
  assert.equal(one, two); assert.equal(rows.size, 1);
  const secondTab = await sessionHarness(rpc, shared);
  assert.equal(await secondTab.api.startTrackingSession('user'), one);
  assert.equal(rows.size, 1);
  assert.equal(calls.at(-1).args.p_resumed, true);
  await api.heartbeatTrackingSession('user');
  assert.equal(calls.at(-1).name, 'heartbeat_application_session');
  await Promise.all([api.endTrackingSession('timeout'), api.endTrackingSession('timeout')]);
  assert.equal(calls.filter(call => call.name === 'end_application_session').length, 1);
  assert.equal(calls.at(-1).args.p_reason, 'timeout');
  const count = calls.length;
  await secondTab.api.heartbeatTrackingSession('user');
  assert.equal(calls.length, count);
});

test('session failures are best effort and resumed sessions do not claim a login', async () => {
  const calls = [];
  const { api } = await sessionHarness(async (name, args) => {
    calls.push({ name, args });
    if (name === 'end_application_session') throw new Error('offline');
    return { data: args.p_session_id };
  });
  await api.startTrackingSession('existing-user');
  assert.equal(calls[0].args.p_resumed, true);
  await assert.doesNotReject(api.endTrackingSession());
});

test('logout waits for an in-flight session start before closing it', async () => {
  const calls = [];
  let finishStart;
  const { api } = await sessionHarness((name, args) => {
    calls.push(name);
    if (name === 'start_application_session') return new Promise(resolve => { finishStart = () => resolve({ data: args.p_session_id }); });
    return { data: true };
  });
  const start = api.startTrackingSession('user', { login: true });
  await new Promise(resolve => setImmediate(resolve));
  const end = api.endTrackingSession();
  assert.equal(calls.length, 1);
  finishStart();
  await Promise.all([start, end]);
  assert.deepEqual(calls, ['start_application_session', 'end_application_session']);
});

test('App retains the three-minute superadmin timeout and logs out despite recording failure', async () => {
  const file = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const script = file.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*;\r?\n/gm, '').replace('export default', 'globalThis.component =');
  const calls = [];
  const context = { AbortSignal, localStorage: storage(), sessionStorage: storage(), SESSION_STORAGE_KEY,
    endTrackingSession: async reason => { calls.push(reason); throw new Error('Recording offline'); },
    setUserAuthenticated: value => calls.push(value), setLockoutState() {},
    supabase: { auth: { signOut: async options => { calls.push(options.scope); } } },
    window: { clearInterval() {}, removeEventListener() {} },
  };
  vm.runInNewContext(script, context);
  const component = context.component, state = component.data();
  for (const [name, method] of Object.entries(component.methods)) state[name] = method.bind(state);
  state.$router = { push: path => calls.push(path) };
  state.$route = { name: 'superadmin' };
  await state.logout('timeout');
  assert.deepEqual(calls, ['timeout', 'local', false, '/login']);
  assert.equal(state.loggingOut, false);
  let reason = null;
  state.logout = value => { reason = value; };
  state.lastActivityAt = Date.now() - 151000;
  state.checkSuperadminIdleTimeout();
  assert.equal(state.idleWarningVisible, true); assert.equal(reason, null);
  state.lastActivityAt = Date.now() - 181000;
  state.checkSuperadminIdleTimeout(); assert.equal(reason, 'timeout');
  state.currentUserRole = 'user';
  let started = false;
  state.startSuperadminIdleLogout = () => { started = true; };
  state.syncSuperadminIdleLogout(); assert.equal(started, false);
});
