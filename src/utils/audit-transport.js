export const SESSION_STORAGE_KEY = 'applicationSession';

export function readTrackingSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null'); }
  catch { return null; }
}

const accountOperations = new Set([
  'get_all_users', 'get_admin_users', 'get_my_profile', 'get_user_for_edit',
  'get_full_user_for_admin_edit', 'get_pending_registrations', 'get_delete_requests',
  'admin_update_user_status', 'restore_blocked_account', 'replace_inactive_superadmin_backup',
  'set_user_role', 'update_user_profile', 'update_my_profile', 'update_full_user_by_admin',
  'create_initial_account', 'complete_initial_account', 'create_user_profile',
  'generate_next_id_number', 'check_user_exists',
  'delete_user_account', 'create_delete_request', 'review_delete_request', 'update_registration_status',
  'activate_superadmin_on_login', 'deactivate_superadmin_on_logout',
  'start_application_session', 'heartbeat_application_session', 'end_application_session',
]);

// Uses raw fetch for error reporting so failures cannot recursively log themselves.
export function createAuditedFetch(baseUrl, rawFetch = (...args) => fetch(...args)) {
  const base = new URL(baseUrl);
  return async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.origin !== base.origin || !url.pathname.startsWith('/rest/v1/')) return rawFetch(input, init);
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    const tracking = readTrackingSession();
    if (tracking?.id) headers.set('x-app-session-id', tracking.id);
    const operation = url.pathname.split('/rpc/')[1];
    const report = async code => {
      if (!accountOperations.has(operation) || !tracking?.userId || !headers.has('authorization')) return;
      try {
        const reportHeaders = new Headers(headers);
        reportHeaders.set('content-type', 'application/json');
        await rawFetch(new URL('/rest/v1/rpc/record_system_log', base), {
          method: 'POST', headers: reportHeaders,
          body: JSON.stringify({ p_operation: operation, p_code: code }),
          signal: AbortSignal.timeout(3000),
        });
      } catch { /* Error reporting must not change the original outcome. */ }
    };
    try {
      const response = await rawFetch(input, { ...init, headers });
      if (!response.ok && accountOperations.has(operation)) {
        const error = await response.clone().json().catch(() => ({}));
        // Expected validation, permission and business-rule failures are not system errors.
        if (response.status >= 500 || (!['P0001', '42501'].includes(error.code)
          && !/^(22|23)/.test(error.code || '') && response.status !== 401 && response.status !== 403)) {
          await report(/^[A-Z0-9_]{1,32}$/.test(error.code || '') ? error.code : `HTTP_${response.status}`);
        }
      }
      return response;
    } catch (error) {
      await report('NETWORK_ERROR');
      throw error;
    }
  };
}
