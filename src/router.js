import { createRouter, createWebHistory, RouterView } from 'vue-router';

import Home from './components/HomePage.vue';
import Dashboard from './components/UserDashboard.vue';
import ForgotPassword from './components/ForgotPassword.vue';
import SignupForm from './components/SignupForm.vue';
import LoginForm from './components/LoginForm.vue';

/* Superadmin */
import SuperAdminDashboard from './components/superadmin/SuperadminDashboard.vue';
import SuperAdminUsers from './components/superadmin/SuperadminUsers.vue';
import SuperadminRegistrations from './components/superadmin/RegistrationPage.vue';
import ActivityLogs from './components/superadmin/ActivityLogs.vue';

/* Admin */
import AdminDashboard from './components/admin/AdminDashboard.vue';
import AdminUsers from './components/admin/AdminUsers.vue';

import { supabase } from './utils/supabase.js';

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/login', name: 'login', component: LoginForm },
  { path: '/signup', name: 'signup', component: SignupForm },
  { path: '/dashboard', name: 'dashboard', component: Dashboard },
  { path: '/forgot', name: 'forgot', component: ForgotPassword },
  { path: '/superadmin', component: RouterView,
    children: [
      { path: '', name: 'superadmin', component: SuperAdminDashboard },
      { path: 'users', name: 'superadmin-users', component: SuperAdminUsers },
      { path: 'registrations', name: 'superadmin-registrations', component: SuperadminRegistrations }
      ,{ path: 'activity-logs', name: 'superadmin-activity-logs', component: ActivityLogs }
    ]},
  { path: '/admin', component: RouterView,
    children: [
      { path: '', name: 'admin', component: AdminDashboard },
      { path: 'users', name: 'admin-users', component: AdminUsers }
    ]
  }
];

// Use Vite's base (set in vite.config.js) for history so router works when app is served from /Security/
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// Store lockout state globally for router access
let globalLockoutActive = false;
// Track if user is authenticated (has active session)
let isUserAuthenticated = !!localStorage.getItem("user");
// Track if user accessed forgot password intentionally
let canAccessForgotPassword = false;

// Export functions to update auth state
export function setLockoutState(isActive) {
  globalLockoutActive = isActive;
}

export function setUserAuthenticated(authenticated) {
  isUserAuthenticated = authenticated;
}

export function setCanAccessForgotPassword(canAccess) {
  canAccessForgotPassword = canAccess;
}

// Route guard for login, dashboard, and forgot password
router.beforeEach(async (to, from, next) => {
  // If lockout is active and user tries to navigate away from login page, prevent it
  if (globalLockoutActive && from.name === 'login' && to.name !== 'login') {
    next(false); // Cancel navigation
    return;
  }

  const requiresAuth = !['home', 'login', 'signup', 'forgot'].includes(to.name);

  if (requiresAuth) {
    // 1. Check local authentication
    if (!isUserAuthenticated) {
      next({ name: 'login' });
      return;
    }

    // 2. Fetch latest session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      localStorage.removeItem("user");
      isUserAuthenticated = false;
      next({ name: 'login' });
      return;
    }

    // 3. Retrieve user database record to check lockout status and role
    const { data: userData, error } = await supabase
      .from('users')
      .select('role, is_locked_out, registration_status')
      .eq('id', session.user.id)
      .single();

    if (error || !userData) {
      await supabase.auth.signOut();
      localStorage.removeItem("user");
      isUserAuthenticated = false;
      next({ name: 'login' });
      return;
    }

    // 4. If user is locked out, sign out and redirect to login
    if (userData.is_locked_out || userData.registration_status !== 'approved') {
      await supabase.auth.signOut();
      localStorage.removeItem("user");
      isUserAuthenticated = false;
      next({ name: 'login', query: { blocked: 'true' } });
      return;
    }

    // 5. Role authorization checks
    if (to.name.startsWith('admin') && userData.role !== 'admin') {
      next({ name: 'dashboard' });
      return;
    }
    if (to.name.startsWith('superadmin') && userData.role !== 'superadmin') {
      next({ name: 'dashboard' });
      return;
    }
  }

  // Protect /forgot - only accessible if explicitly allowed (clicked "Forgot Password" button)
  if (to.name === 'forgot' && !canAccessForgotPassword) {
    next({ name: 'login' });
    return;
  }

  // Reset forgot password access flag when leaving /forgot
  if (from.name === 'forgot' && to.name !== 'forgot') {
    canAccessForgotPassword = false;
  }

  next();
});

// disable back button only when user is on login
router.afterEach((to) => {
  if (to.name === 'login') {
    history.pushState(null, document.title, location.href);
    window.onpopstate = () => {
      history.pushState(null, document.title, location.href);
    };
  } else {
    window.onpopstate = null;
  }
});

export default router;
