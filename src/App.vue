<script>
import { setLockoutState } from './router.js';
import { setUserAuthenticated } from './router.js';
import { supabase } from './utils/supabase.js';

export default {
  data() {
    return {
      page: 'home',
      lockoutActive: false,
      currentUserRole: 'user',
      idleWarningVisible: false,
      idleSecondsRemaining: 30,
      idleTimer: null,
      lastActivityAt: 0,
      lastActivityHandledAt: 0,
      idleActivityEvents: ['mousemove', 'keydown', 'touchstart', 'touchmove', 'click', 'pointerdown', 'scroll']
    }
  },
  async mounted() {
    await this.syncCurrentUserRole();
    this.syncSuperadminIdleLogout();
    // Check for persisted lockout state
    this.checkPersistedLockout();
    // Set up event listeners for browser back button and reload
    this.setupLockoutProtection();
  },
  watch: {
    lockoutActive() {
      // Persist lockout state
      if (this.lockoutActive) {
        sessionStorage.setItem('lockoutActive', 'true');
      } else {
        sessionStorage.removeItem('lockoutActive');
      }
      this.setupLockoutProtection();
    },
    async '$route'(to) {
      await this.syncCurrentUserRole();
      // Re-setup protection when route changes
      if (to.name === 'login' && this.lockoutActive) {
        this.setupLockoutProtection();
      }
      this.syncSuperadminIdleLogout();
    }
  },
  methods: {
    async syncCurrentUserRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        this.currentUserRole = 'user';
        this.syncSuperadminIdleLogout();
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error || !data?.role) return;

      this.currentUserRole = data.role;
      this.syncSuperadminIdleLogout();
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...storedUser, role: data.role }));
      } catch {
        // The server response remains the source of truth for navigation.
      }
    },
    async logout() {
      this.stopSuperadminIdleLogout();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.rpc('deactivate_superadmin_on_logout');
        await supabase.rpc('create_audit_log', {
          p_action: 'Logged out',
          p_entity_type: 'authentication',
          p_entity_id: session.user.id,
          p_details: {}
        });
      }
      await supabase.auth.signOut();
      localStorage.removeItem('user');
      this.currentUserRole = 'user';
      setUserAuthenticated(false);
      this.$router.push('/login');
    },
    isSuperadminRoute() {
      return ['superadmin', 'superadmin-users', 'superadmin-registrations', 'superadmin-activity-logs'].includes(this.$route.name);
    },
    syncSuperadminIdleLogout() {
      if (this.currentUserRole === 'superadmin' && this.isSuperadminRoute()) {
        this.startSuperadminIdleLogout();
      } else {
        this.stopSuperadminIdleLogout();
      }
    },
    startSuperadminIdleLogout() {
      if (this.idleTimer) return;
      this.lastActivityAt = Date.now();
      this.lastActivityHandledAt = 0;
      this.idleWarningVisible = false;
      this.idleActivityEvents.forEach((eventName) => window.addEventListener(eventName, this.handleSuperadminActivity, { passive: true }));
      this.idleTimer = window.setInterval(this.checkSuperadminIdleTimeout, 1000);
    },
    stopSuperadminIdleLogout() {
      if (this.idleTimer) {
        window.clearInterval(this.idleTimer);
        this.idleTimer = null;
      }
      this.idleActivityEvents.forEach((eventName) => window.removeEventListener(eventName, this.handleSuperadminActivity));
      this.idleWarningVisible = false;
      this.idleSecondsRemaining = 30;
    },
    handleSuperadminActivity() {
      const now = Date.now();
      if (now - this.lastActivityHandledAt < 500) return;
      this.lastActivityHandledAt = now;
      this.lastActivityAt = now;
      this.idleWarningVisible = false;
      this.idleSecondsRemaining = 30;
    },
    checkSuperadminIdleTimeout() {
      const idleSeconds = Math.floor((Date.now() - this.lastActivityAt) / 1000);
      if (idleSeconds >= 180) {
        this.logout();
        return;
      }
      if (idleSeconds >= 150) {
        this.idleWarningVisible = true;
        this.idleSecondsRemaining = Math.max(1, 180 - idleSeconds);
      }
    },
    checkPersistedLockout() {
      // Check if lockout was active before page reload
      const persisted = sessionStorage.getItem('lockoutActive');
      if (persisted === 'true' && this.$route.name === 'login') {
        this.lockoutActive = true;
        setLockoutState(true);
      }
    },
    handleLockoutChanged(isActive) {
      this.lockoutActive = isActive;
      // Update global lockout state for router
      setLockoutState(isActive);
    },
    setupLockoutProtection() {
      // Remove existing listeners if any
      window.removeEventListener('popstate', this.preventBack);
      window.removeEventListener('keydown', this.preventKeyboardShortcuts);
      document.removeEventListener('keydown', this.preventKeyboardShortcuts);

      if (this.lockoutActive && this.$route.name === 'login') {
        // Store lockout state in sessionStorage (will persist even if page reloads)
        sessionStorage.setItem('lockoutActive', 'true');

        // Prevent browser back button
        window.addEventListener('popstate', this.preventBack, true);

        // Prevent keyboard shortcuts (F5, Ctrl+R, Ctrl+Shift+R, etc.)
        // Use capture phase and add to both window and document
        window.addEventListener('keydown', this.preventKeyboardShortcuts, true);
        document.addEventListener('keydown', this.preventKeyboardShortcuts, true);
        document.body.addEventListener('keydown', this.preventKeyboardShortcuts, true);

        // Push current state to prevent back/forward navigation
        window.history.pushState(null, null, window.location.href);

        // Also push a state to prevent forward navigation
        window.history.pushState(null, null, window.location.href);
      }
    },
    preventBack(event) {
      if (this.lockoutActive && this.$route.name === 'login') {
        // Push state again to prevent navigation
        window.history.pushState(null, null, window.location.href);
        event.preventDefault();
        return false;
      }
    },
    preventKeyboardShortcuts(event) {
      if (this.lockoutActive && this.$route.name === 'login') {
        // Prevent F5 (reload)
        if (event.key === 'F5' || event.keyCode === 116) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }

        // Prevent Ctrl+R or Cmd+R (reload) - case insensitive
        if ((event.ctrlKey || event.metaKey) && (event.key === 'r' || event.key === 'R' || event.keyCode === 82)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }

        // Prevent Ctrl+Shift+R or Cmd+Shift+R (hard reload)
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'R' || event.key === 'r' || event.keyCode === 82)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }

        // Prevent Ctrl+F5 (hard reload)
        if (event.ctrlKey && (event.key === 'F5' || event.keyCode === 116)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }

        // Prevent Alt+Left Arrow (back navigation in some browsers)
        if (event.altKey && event.key === 'ArrowLeft') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }

        // Prevent Backspace key (can trigger back navigation in some browsers)
        if (event.key === 'Backspace' && !event.target.matches('input, textarea, [contenteditable="true"]')) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }
      }
    },
    preventNavigationIfLocked(event) {
      if (this.lockoutActive && this.$route.name === 'login') {
        event.preventDefault();
        return false;
      }
    }
  },
  beforeUnmount() {
    this.stopSuperadminIdleLogout();
    // Clean up event listeners
    window.removeEventListener('popstate', this.preventBack);
    window.removeEventListener('keydown', this.preventKeyboardShortcuts, true);
    document.removeEventListener('keydown', this.preventKeyboardShortcuts, true);
    document.body.removeEventListener('keydown', this.preventKeyboardShortcuts, true);
  }
}
</script>

<template>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">

  <div id="app">
    <div v-if="idleWarningVisible" class="idle-warning" role="alertdialog" aria-live="assertive">
      <div class="idle-warning-card">
        <h2>Are you still there?</h2>
        <p>You will be logged out due to inactivity in <strong>{{ idleSecondsRemaining }}</strong> seconds.</p>
        <button type="button" @click="handleSuperadminActivity">Continue session</button>
      </div>
    </div>
    <!-- HEADER -->

    <header v-if="$route.name === 'login' || $route.name === 'forgot'" class="portal">
      <img src="./assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
      <div class="header-btn">
        <router-link to="/" @click="preventNavigationIfLocked"
          :class="{ 'disabled-link': lockoutActive && $route.name === 'login' }">
          <p class="dark-btn" :disabled="lockoutActive && $route.name === 'login'"
            :class="{ 'disabled-btn': lockoutActive && $route.name === 'login' }">Home</p>
        </router-link>
        <router-link to="/signup" @click="preventNavigationIfLocked"
          :class="{ 'disabled-link': lockoutActive && $route.name === 'login' }">
          <p :disabled="lockoutActive && $route.name === 'login'"
            :class="{ 'disabled-btn': lockoutActive && $route.name === 'login' }">Sign Up</p>
        </router-link>
      </div>
    </header>


    <header v-else-if="$route.name === 'signup' || $route.name === 'complete-profile'" class="portal">
      <img src="./assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
      <div class="header-btn">
        <router-link to="/">
          <p class="dark-btn">Home</p>
        </router-link>
        <router-link to="/login">
          <p>Login</p>
        </router-link>
      </div>
    </header>

    <header v-else-if="$route.name === 'home'">
      <img src="./assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
      <div class="header-btn">
        <router-link to="/login">
          <p class="dark-btn">Login</p>
        </router-link>
        <router-link to="/signup">
          <p>Sign Up</p>
        </router-link>
      </div>
    </header>

    <header v-else-if="($route.name === 'profile' && currentUserRole === 'superadmin') || ['superadmin', 'superadmin-users', 'superadmin-registrations', 'superadmin-activity-logs'].includes($route.name)">
      <img src="./assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
      <div class="header-btn">
        <router-link to="/superadmin">
          <p class="dark-btn">Dashboard</p>
        </router-link>
        <router-link to="/superadmin/users">
          <p>Accounts</p>
        </router-link>
        <router-link to="/superadmin/registrations">
          <p>Approval Requests</p>
        </router-link>
        <router-link to="/superadmin/activity-logs">
          <p>Logs</p>
        </router-link>
        <router-link to="/profile"><p>Profile</p></router-link>
        <router-link to="/login" @click.prevent="logout">
          <p>Logout</p>
        </router-link>
      </div>
    </header>

    <header v-else-if="($route.name === 'profile' && currentUserRole === 'admin') || ['admin', 'admin-users', 'admin-registrations'].includes($route.name)">
      <img src="./assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
      <div class="header-btn">
        <router-link to="/admin">
          <p class="dark-btn">Dashboard</p>
        </router-link>
        <router-link to="/admin/users">
          <p>Accounts</p>
        </router-link>
        <router-link to="/admin/registrations">
          <p>Approval Requests</p>
        </router-link>
        <router-link to="/profile"><p>Profile</p></router-link>
        <router-link to="/login" @click.prevent="logout">
          <p>Logout</p>
        </router-link>
      </div>
    </header>

    <header v-else-if="$route.name === 'dashboard' || ($route.name === 'profile' && !['admin', 'superadmin'].includes(currentUserRole))">
      <img src="./assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
      <div class="header-btn">
        <router-link to="/dashboard"><p class="dark-btn">Dashboard</p></router-link>
        <router-link to="/profile"><p>Profile</p></router-link>
        <router-link to="/login" @click.prevent="logout"><p>Logout</p></router-link>
      </div>
    </header>

    <main>
      <div class="page-container"
        v-if="$route.name === 'signup' || $route.name === 'complete-profile' || $route.name === 'login' || $route.name === 'forgot'">
        <div class="logo-container">
          <div class="mask">
            <img src="./assets/images/icon.png" alt="Logo">
          </div>
        </div>
        <div class="form-container">
          <div class="form-box">
            <router-view @lockout-changed="handleLockoutChanged"></router-view>
          </div>
        </div>
      </div>

      <div class="page-container"
        v-else-if="['dashboard', 'profile', 'admin', 'superadmin', 'admin-users', 'admin-registrations', 'superadmin-users', 'superadmin-registrations', 'superadmin-activity-logs'].includes($route.name)">
        <router-view></router-view>
      </div>

      <div class="page-container" v-else-if="$route.name === 'home'">
        <router-view></router-view>
      </div>

    </main>

    <!-- FOOTER -->
    <footer>
      <p>&copy; 2025 CSUCC - All Rights Reserved</p>
    </footer>
  </div>
</template>

<style src="./assets/CSS/app.css"></style>
<style>
.idle-warning {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.55);
}

.idle-warning-card {
  width: min(100%, 26rem);
  padding: 2rem;
  border-radius: 1rem;
  background: #fff;
  color: #172033;
  text-align: center;
  box-shadow: 0 1rem 3rem rgba(15, 23, 42, 0.25);
}

.idle-warning-card h2 {
  margin: 0 0 0.75rem;
}

.idle-warning-card p {
  margin: 0 0 1.5rem;
}

.idle-warning-card button {
  border: 0;
  border-radius: 0.5rem;
  padding: 0.7rem 1.1rem;
  background: #1d4ed8;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}
</style>
