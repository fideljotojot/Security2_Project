import { createRouter, createWebHistory } from 'vue-router';

import Home from './components/HomePage.vue';
import Dashboard from './components/UserDashboard.vue';
import ForgotPassword from './components/ForgotPassword.vue';
import SignupForm from './components/SignupForm.vue';
import LoginForm from './components/LoginForm.vue';

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/login', name: 'login', component: LoginForm },
  { path: '/signup', name: 'signup', component: SignupForm },
  { path: '/dashboard', name: 'dashboard', component: Dashboard },
  { path: '/forgot', name: 'forgot', component: ForgotPassword }
];

// Use Vite's base (set in vite.config.js) for history so router works when app is served from /Security/
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// Store lockout state globally for router access
let globalLockoutActive = false;
// Track if user is authenticated (has active session)
let isUserAuthenticated = false;
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
router.beforeEach((to, from, next) => {
  // If lockout is active and user tries to navigate away from login page, prevent it
  if (globalLockoutActive && from.name === 'login' && to.name !== 'login') {
    next(false); // Cancel navigation
    return;
  }

  // Protect /dashboard - only accessible if authenticated
  if (to.name === 'dashboard' && !isUserAuthenticated) {
    next({ name: 'login' });
    return;
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
