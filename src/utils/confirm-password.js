import { supabase } from '@/utils/supabase.js';

export async function confirmCurrentPassword(message) {
  const password = await new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay password-confirm-overlay';
    overlay.innerHTML = `<div class="notification-card" role="dialog" aria-modal="true">
      <div class="notification-header"><div class="notification-icon delete-modal-icon" aria-hidden="true"><i class="fi fi-br-lock"></i></div><h3>CONFIRM ACTION</h3></div><p>${message || 'Enter your password to continue:'}</p>
      <div class="password-input-wrapper delete-password-wrapper"><input class="delete-password-input" type="password" placeholder="Password" autocomplete="current-password"><button type="button" class="toggle-password" aria-label="Show password"><i class="fi fi-br-eye"></i></button></div>
      <div class="btn-container"><button type="button" class="btn btn-secondary password-cancel">Cancel</button><button type="button" class="btn btn-primary delete-confirm-button password-submit">Continue</button></div>
    </div>`;
    const input = overlay.querySelector('input');
    const finish = (value) => { overlay.remove(); resolve(value); };
    overlay.querySelector('.password-cancel').onclick = () => finish('');
    overlay.querySelector('.password-submit').onclick = () => finish(input.value);
    input.addEventListener('keyup', event => { if (event.key === 'Enter') finish(input.value); });
    overlay.querySelector('.toggle-password').onclick = event => {
      const button = event.currentTarget;
      input.type = input.type === 'password' ? 'text' : 'password';
      button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
    };
    document.body.appendChild(overlay);
    input.focus();
  });
  if (!password) return false;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) return false;
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (error) { window.alert('Incorrect password. The action was cancelled.'); return false; }
  return true;
}
