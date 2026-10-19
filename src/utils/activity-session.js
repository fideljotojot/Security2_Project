import { supabase } from './supabase.js';
import { readTrackingSession, SESSION_STORAGE_KEY } from './audit-transport.js';

let starting = null;
let ending = null;
let endingLocally = false;

function saveSession(value) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
}

export async function startTrackingSession(userId, { login = false } = {}) {
  if (endingLocally) return null;
  if (starting) return starting;
  const start = async () => {
    let tracking = readTrackingSession();
    if (tracking?.ending && tracking.userId === userId && !login) return null;
    if (login || !tracking?.id || tracking.userId !== userId) {
      tracking = { id: crypto.randomUUID(), userId, pendingLogin: login };
      saveSession(tracking);
    }
    const { data, error } = await supabase.rpc('start_application_session', {
      p_session_id: tracking.id, p_resumed: !tracking.pendingLogin,
    }).abortSignal(AbortSignal.timeout(4000));
    if (error) return null;
    if (readTrackingSession()?.id !== tracking.id) return null;
    saveSession({ ...tracking, pendingLogin: false });
    return data;
  };
  starting = (navigator.locks ? navigator.locks.request('application-session-start', start) : start())
    .catch(() => null).finally(() => { starting = null; });
  return starting;
}

export async function heartbeatTrackingSession(userId) {
  if (endingLocally) return;
  const tracking = readTrackingSession();
  if (tracking?.ending) return;
  if (!tracking?.id || tracking.userId !== userId || tracking.pendingLogin) {
    await startTrackingSession(userId);
  }
  const current = readTrackingSession();
  if (current?.userId === userId && current.id) {
    try { await supabase.rpc('heartbeat_application_session', { p_session_id: current.id }).abortSignal(AbortSignal.timeout(4000)); }
    catch { /* The transport records unexpected errors; heartbeat is best effort. */ }
  }
}

export function endTrackingSession(reason = 'logout') {
  if (ending) return ending;
  endingLocally = true;
  ending = (async () => {
    try {
      if (starting) await starting;
      const tracking = readTrackingSession();
      if (tracking?.id) saveSession({ ...tracking, ending: true });
      if (tracking?.id) await supabase.rpc('end_application_session', {
        p_session_id: tracking.id, p_reason: reason,
      }).abortSignal(AbortSignal.timeout(4000));
    } catch { /* Logout must continue even if recording is unavailable. */ }
    finally {
      ending = null;
    }
  })();
  return ending;
}

export function resetTrackingLifecycle() { endingLocally = false; }
