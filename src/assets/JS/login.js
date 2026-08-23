import { setUserAuthenticated } from '../../router.js';
import { supabase } from '../../utils/supabase.js';

export default {
  data(){
    return {
      warnings: {},
      consecutiveError: 0,
      page: 'login',
      username: '',
      password: '',
      lockoutActive: false,
      lockoutTimeRemaining: 0,
      lockoutTimer: null,
      showPassword: false,
    }
  },
  provide() {
    return {
      getLockoutState: () => ({
        lockoutActive: this.lockoutActive,
        lockoutTimeRemaining: this.lockoutTimeRemaining
      })
    }
  },
  watch: {
    lockoutActive(newVal) {
      // Emit event to parent when lockout state changes
      this.$emit('lockout-changed', newVal);
    }
  },
  computed: {
    allWarnings() {
      // flatten arrays and return non-empty trimmed messages
      const vals = Object.values(this.warnings || {});
      const flat = [];
      for (const v of vals) {
        if (Array.isArray(v)) {
          for (const m of v) {
            if (m && String(m).trim()) flat.push(String(m).trim());
          }
        } else if (v && String(v).trim()) {
          flat.push(String(v).trim());
        }
      }
      return flat;
    }
  },
  mounted() {
    // Restore lockout state if page was reloaded during lockout
    this.restoreLockoutState();
    if (this.$route.query.blocked === 'true') {
      this.warnings.general = ["Your account is blocked. Please contact the administrator."];
    }
  },
  methods: {
    getWarning(id) {
      const w = this.warnings[id];
      if (!w) return '';
      if (Array.isArray(w)) return w[0] || '';
      return w;
    },
    togglePassword() {
      this.showPassword = !this.showPassword;
    },
    restoreLockoutState() {
      // Check if lockout was active before reload
      const lockoutEndTime = sessionStorage.getItem('lockoutEndTime');
      if (lockoutEndTime) {
        const now = Date.now();
        const endTime = parseInt(lockoutEndTime, 10);
        const remaining = Math.ceil((endTime - now) / 1000);

        if (remaining > 0) {
          // Lockout is still active - restore it
          this.lockoutActive = true;
          this.lockoutTimeRemaining = remaining;

          // Restart the timer
          if (this.lockoutTimer) {
            clearInterval(this.lockoutTimer);
          }

          this.lockoutTimer = setInterval(() => {
            this.lockoutTimeRemaining--;
            if (this.lockoutTimeRemaining <= 0) {
              clearInterval(this.lockoutTimer);
              this.lockoutActive = false;
              sessionStorage.removeItem('lockoutEndTime');
            }
          }, 1000);
        } else {
          // Lockout has expired
          sessionStorage.removeItem('lockoutEndTime');
          this.lockoutActive = false;
        }
      }
    },
    startLockout(seconds) {
      this.lockoutActive = true;
      this.lockoutTimeRemaining = seconds;

      // Store lockout end time in sessionStorage so it persists across reloads
      const endTime = Date.now() + (seconds * 1000);
      sessionStorage.setItem('lockoutEndTime', endTime.toString());

      // Clear any existing timer
      if (this.lockoutTimer) {
        clearInterval(this.lockoutTimer);
      }

      this.lockoutTimer = setInterval(() => {
        this.lockoutTimeRemaining--;
        if (this.lockoutTimeRemaining <= 0) {
          clearInterval(this.lockoutTimer);
          this.lockoutActive = false;
          sessionStorage.removeItem('lockoutEndTime');
        }
      }, 1000);
    },
    disableButton() {
      if (this.consecutiveError % 3 === 0) {
        let lockoutTime = 15; // first 3 errors
        if (this.consecutiveError === 6) lockoutTime = 30;
        else if (this.consecutiveError >= 9) lockoutTime = 60;
        this.startLockout(lockoutTime);
      }
},
    async login() {
      this.warnings = {};
      const username = this.username.trim();
      const password = this.password.trim();

      if (!username || !password) {
        this.warnings.general = ["Please enter both username and password."];
        return;
      }

      try {
        // 1. Resolve email by username using Supabase RPC
        const { data: email, error: emailError } = await supabase.rpc('get_email_by_username', { p_username: username });

        if (emailError) {
          console.error(emailError);
          this.warnings.general = ["Server database error."];
          return;
        }

        if (!email) {
          this.consecutiveError++;
          this.warnings.username = ["Username does not exist."];
          this.disableButton();
          return;
        }

        // 2. Authenticate with Supabase Auth using email and password
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          this.consecutiveError++;
          const errMsg = error.message ? error.message.toLowerCase() : '';
          if (errMsg.includes('email not confirmed')) {
            this.warnings.general = ["Please confirm your email before logging in."];
          } else if (error.status === 400 || errMsg.includes('invalid login credentials')) {
            this.warnings.password = ["Incorrect password."];
          } else {
            this.warnings.general = [error.message || "Login failed."];
          }
          this.disableButton();
          return;
        }

        // Retrieve the user's application ID, role, and lockout status from the public.users table.
        const { data: userData, error: userLookupError } = await supabase
          .from('users')
          .select('id_number, role, is_locked_out, registration_status')
          .eq('id', data.user.id)
          .single();

        if (userLookupError || !userData) {
          console.error(userLookupError);
          await supabase.auth.signOut();
          this.warnings.general = ["Unable to retrieve your account role."];
          return;
        }

        if (userData.is_locked_out) {
          await supabase.auth.signOut();
          this.warnings.general = ["Your account is blocked. Please contact the administrator."];
          return;
        }

        if (userData.registration_status !== 'approved') {
          await supabase.auth.signOut();
          localStorage.removeItem("user");
          isUserAuthenticated = false;
          this.warnings.general = [userData.registration_status === 'blocked'
            ? 'Your registration has been blocked.'
            : 'Your registration is still pending approval.'];
          return;
        }

        const { id_number: idNumber, role } = userData;
        const roleRoutes = {
          user: '/dashboard',
          admin: '/admin',
          superadmin: '/superadmin'
        };
        const destination = roleRoutes[role];

        if (!destination) {
          await supabase.auth.signOut();
          this.warnings.general = ["Your account has an invalid role."];
          return;
        }

        // success
        const loggedInUser = {
          id: idNumber,
          uuid: data.user.id,
          username: username,
          email: email,
          role
        };
        localStorage.setItem("user", JSON.stringify(loggedInUser));
        setUserAuthenticated(true);
        this.$router.push(destination);
        this.consecutiveError = 0;

      } catch (error) {
        console.error(error);
        this.warnings.general = ["Network or server error occurred."];
      }
    },
  }
}
