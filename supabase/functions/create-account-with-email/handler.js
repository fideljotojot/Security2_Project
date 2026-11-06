import { smtpConfiguration } from './smtp.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-session-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const escapeHtml = value => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

// Dependencies are supplied by the Edge entrypoint so the complete flow can be
// tested without creating real accounts or sending credentials to real inboxes.
export function createAccountHandler({ createClient, env, sendEmail }) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'POST') return reply({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ ok: false, code: 'UNAUTHORIZED', error: 'Please sign in again.' }, 401);
    const url = env('SUPABASE_URL');
    const anonKey = env('SUPABASE_ANON_KEY');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const smtp = smtpConfiguration(env);
    if (!url || !anonKey || !serviceKey || !smtp || typeof sendEmail !== 'function') {
      return reply({ ok: false, code: 'EMAIL_UNAVAILABLE', error: 'The account mailer needs Gmail SMTP credentials and SSL port 465 configured on the server. No account was created.' }, 503);
    }

    let admin;
    let createdId;
    let stage = 'authorization';
    try {
      const headers = { Authorization: authorization };
      const tracking = request.headers.get('x-app-session-id');
      if (tracking) headers['x-app-session-id'] = tracking;
      const caller = createClient(url, anonKey, { global: { headers }, auth: { persistSession: false, autoRefreshToken: false } });
      const { data: identity, error: identityError } = await caller.auth.getUser();
      if (identityError || !identity?.user) return reply({ ok: false, code: 'UNAUTHORIZED', error: 'Please sign in again.' }, 401);
      const { data: viewer, error: viewerError } = await caller.from('users')
        .select('role, registration_status, is_locked_out').eq('id', identity.user.id).single();
      if (viewerError || viewer?.role !== 'superadmin' || viewer.registration_status !== 'approved' || viewer.is_locked_out) {
        return reply({ ok: false, code: 'FORBIDDEN', error: 'Only an active superadmin can create accounts.' }, 403);
      }

      stage = 'validation';
      let input;
      try { input = await request.json(); }
      catch { return reply({ ok: false, code: 'INVALID_INPUT', error: 'Invalid account details.' }, 400); }
      const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
      const username = typeof input?.username === 'string' ? input.username.trim() : '';
      const idNumber = typeof input?.idNumber === 'string' ? input.idNumber.trim() : '';
      // The password must be used exactly as entered, including spaces.
      const password = typeof input?.password === 'string' ? input.password : '';
      const role = input?.role;
      const position = input?.position;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120 || email.endsWith('@accounts.local') ||
          !/^[a-z]+_[a-z]+$/.test(username) || username.length < 5 || username.length > 20 ||
          !/^\d{4}-\d{4}$/.test(idNumber) || !['user', 'admin', 'superadmin'].includes(role) ||
          !(role === 'user' ? ['Student', 'Instructor', 'Staff'] : ['Instructor', 'Staff']).includes(position) ||
          password.length < 8 || password.length > 72 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
          !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return reply({ ok: false, code: 'INVALID_INPUT', error: 'Check the email, username, ID, role, position and password requirements.' }, 400);
      }

      // Only this client holds the service key, and it never leaves the server.
      admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      stage = 'auth';
      const { data: account, error: accountError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (accountError || !account?.user?.id) {
        return reply({ ok: false, code: 'ACCOUNT_CREATE_FAILED', error: 'Unable to create the account. Check whether the email is already registered.' }, 409);
      }
      createdId = account.user.id;
      stage = 'profile';
      // Keep the actor's JWT: the RPC still enforces its own permissions and
      // the database triggers still enforce the reserved superadmin slots.
      const { data: completed, error: profileError } = await caller.rpc('create_initial_account', {
        p_user_id: createdId, p_id_number: idNumber, p_username: username,
        p_email: email, p_role: role, p_position: position,
      });
      if (profileError || completed !== true) throw new Error('profile');

      stage = 'email';
      await sendEmail(smtp, {
          from: smtp.from, to: [email], subject: 'Your new account login details',
          text: `Your account has been created.\n\nUsername: ${username}\nInitial password: ${password}\n\nLog in with these details, verify the OTP sent to this email, and choose a new password when completing your personal details.`,
          html: `<h2>Your account is ready</h2><p>Use these details to log in:</p><p>Username: <strong>${escapeHtml(username)}</strong><br>Initial password: <strong style="white-space:pre-wrap">${escapeHtml(password)}</strong></p><p>After logging in, verify the OTP sent to this email, then choose a new password while completing your personal details.</p>`,
      });
      return reply({ ok: true, accountId: createdId });
    } catch {
      // Never return or log upstream errors, request bodies, or credentials.
      if (createdId && admin) {
        let removed = false;
        try {
          const { error } = await admin.auth.admin.deleteUser(createdId);
          removed = !error;
        } catch { /* Report an unresolved cleanup explicitly below. */ }
        if (!removed) return reply({ ok: false, code: 'CLEANUP_FAILED', accountId: createdId,
          error: `Account cleanup failed. Resolve account ${createdId} before submitting again.` }, 500);
        if (stage === 'email') return reply({ ok: false, code: 'EMAIL_SEND_FAILED', rolledBack: true,
          error: 'Credentials email could not be sent. Re-enter the email address and try again.' }, 502);
        return reply({ ok: false, code: 'ACCOUNT_SETUP_FAILED', rolledBack: true,
          error: 'Account setup failed and the new account was removed. Check for duplicate details or occupied superadmin slots.' }, 409);
      }
      return reply({ ok: false, code: 'REQUEST_FAILED', error: 'Unable to process account creation. Check the account records before retrying.' }, 500);
    }
  };
}
