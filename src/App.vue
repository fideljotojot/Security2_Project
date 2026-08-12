<script>
import { setLockoutState } from './router.js';

export default {
  data() {
    return {
      page: 'home',
      lockoutActive: false
    }
  },
  mounted() {
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
    '$route'(to) {
      // Re-setup protection when route changes
      if (to.name === 'login' && this.lockoutActive) {
        this.setupLockoutProtection();
      }
    }
  },
  methods: {
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
    <!-- HEADER -->

    <header v-if="$route.name === 'login' || $route.name === 'forgot'" class="portal">
      <img src="./assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
      <div class="header-btn">
        <router-link to="/" @click="preventNavigationIfLocked" :class="{ 'disabled-link': lockoutActive && $route.name === 'login' }">
          <p class="dark-btn" :disabled="lockoutActive && $route.name === 'login'" :class="{ 'disabled-btn': lockoutActive && $route.name === 'login' }">Home</p>
        </router-link>
        <router-link to="/signup" @click="preventNavigationIfLocked" :class="{ 'disabled-link': lockoutActive && $route.name === 'login' }">
          <p :disabled="lockoutActive && $route.name === 'login'" :class="{ 'disabled-btn': lockoutActive && $route.name === 'login' }">Sign Up</p>
        </router-link>
      </div>
    </header>


    <header v-else-if="$route.name === 'signup'" class="portal">
      <img src="./assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
      <div class="header-btn">
        <router-link to="/"><p class="dark-btn">Home</p></router-link>
        <router-link to="/login"><p>Login</p></router-link>
      </div>
    </header>

    <header v-else-if="$route.name === 'home'">
      <img src="./assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
      <div class="header-btn">
        <router-link to="/login"><p class="dark-btn">Login</p></router-link>
        <router-link to="/signup"><p>Sign Up</p></router-link>
      </div>
    </header>

    <header v-else-if="$route.name === 'dashboard'">
      <img src="./assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
      <div class="header-btn">
        <router-link to="/login"><p>Logout</p></router-link>
      </div>
    </header>

    <main>
      <div class="page-container" v-if="$route.name === 'signup' || $route.name === 'login' || $route.name === 'forgot'">
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

      <div class="page-container" v-else-if="$route.name === 'dashboard'">
        <router-view></router-view>
      </div>

      <div class="page-container" v-else-if="$route.name === 'home'">
        <router-view></router-view>
      </div>
    </main>

    <!-- 🔹 FOOTER -->
    <footer>
      <p>&copy; 2025 CSUCC - All Rights Reserved</p>
    </footer>
  </div>
</template>

<style src="./assets/CSS/app.css" scoped></style>
