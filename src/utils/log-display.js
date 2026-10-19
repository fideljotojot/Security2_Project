export const LOG_CATEGORIES = [
  { value: 'all', label: 'All Logs' },
  { value: 'activity', label: 'Activity Logs' },
  { value: 'security', label: 'Login & Security Logs' },
  { value: 'system', label: 'System Logs' },
];

export function actorName(log) {
  return log.actor_full_name?.trim() || log.actor_username?.trim() || 'System';
}

export function browserAndOS(agent) {
  if (!agent) return '—';
  const browser = /Edg(?:e|A|iOS)?\//.test(agent) ? 'Edge'
    : /OPR\/|Opera/.test(agent) ? 'Opera'
      : /Firefox\/|FxiOS\//.test(agent) ? 'Firefox'
        : /Chrome\/|CriOS\//.test(agent) ? 'Chrome'
          : /Safari\//.test(agent) ? 'Safari' : 'Unknown';
  const os = /Android/.test(agent) ? 'Android' : /iPhone|iPad|iPod/.test(agent) ? 'iOS'
    : /Windows/.test(agent) ? 'Windows' : /Macintosh|Mac OS X/.test(agent) ? 'macOS'
      : /Linux/.test(agent) ? 'Linux' : 'Unknown';
  return `${browser} / ${os}`;
}

export function localDateBounds(from, to) {
  if (from && to && from > to) throw new Error('From date must be on or before To date.');
  const parse = value => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    const [year, month, day] = value.split('-').map(Number);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())
      || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new Error('Choose a valid date.');
    }
    return date;
  };
  const start = parse(from), end = parse(to);
  if (end) end.setDate(end.getDate() + 1);
  return { from: start?.toISOString() || null, to: end?.toISOString() || null };
}

const fieldLabels = {
  first_name: 'first name', middle_initial: 'middle initial', last_name: 'last name', suffix: 'suffix',
  birthdate: 'birthdate', age: 'age', sex: 'sex', position: 'position',
  purok: 'purok', barangay: 'barangay', city: 'city', province: 'province', country: 'country', zip: 'ZIP code',
  id_number: 'ID number', username: 'username', email: 'email', role: 'role',
  admin_permissions: 'permissions', registration_status: 'account status', is_locked_out: 'account access',
  password: 'password', profile: 'profile information', account: 'account information',
};

export function logDescription(log) {
  const details = log.details || {};
  const action = typeof log.action === 'string' ? log.action.trim() : '';
  const key = action.toLowerCase();
  // Use known field labels only; raw metadata and summaries may contain identities or secrets.
  const fields = Array.isArray(details.changed_fields)
    ? [...new Set(details.changed_fields.filter(field => Object.hasOwn(fieldLabels, field)))] : [];
  const changes = (description, excluded) => {
    const remaining = fields.filter(field => !excluded.includes(field)).map(field => fieldLabels[field]);
    return remaining.length ? `${description} Also updated fields: ${remaining.join(', ')}.` : description;
  };
  if (log.category === 'system' || key === 'operation failed') return 'An unexpected application operation failed.';
  switch (key) {
    case 'login': case 'logged in': return 'Logged in successfully.';
    case 'logout': case 'logged out': return 'Logged out.';
    case 'session resumed': return 'Resumed an existing session; original login time is unknown.';
    case 'session timeout': {
      const duration = typeof details.summary === 'string'
        ? details.summary.match(/after\s+((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+minutes?)\s+of\s+(?:superadmin\s+)?inactivity/i)?.[1] : null;
      return duration ? `Session ended after ${duration.toLowerCase()} of inactivity.` : 'Session ended due to inactivity.';
    }
    case 'profile update': case 'updated profile':
      return fields.length ? `Updated profile fields: ${fields.map(field => fieldLabels[field]).join(', ')}.` : 'Updated profile information.';
    case 'updated user':
      return fields.length ? `Updated account fields: ${fields.map(field => fieldLabels[field]).join(', ')}.` : 'Updated account information.';
    case 'changed admin privilege': return changes('Changed account role.', ['role']);
    case 'updated permissions': return changes('Updated account permissions.', ['admin_permissions']);
    case 'password changed': return changes('Changed account password.', ['password']);
    case 'password reset': return changes('Reset account password.', ['password']);
    case 'signed up': return 'Created an account.';
    case 'deleted user': return 'Deleted an account.';
    case 'approved registration': return 'Approved an account registration.';
    case 'rejected registration': return 'Rejected an account registration.';
    case 'blocked user': return 'Blocked an account.';
    case 'unblocked user': return 'Unblocked an account.';
    case 'created deletion request': return 'Submitted a deletion request.';
    case 'approved deletion request': return 'Approved a deletion request.';
    case 'rejected deletion request': return 'Rejected a deletion request.';
    case 'removed deletion request': return 'Removed a deletion request.';
    default: {
      if (!action) return 'Recorded an activity.';
      const sentence = action.charAt(0).toUpperCase() + action.slice(1);
      return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
    }
  }
}
