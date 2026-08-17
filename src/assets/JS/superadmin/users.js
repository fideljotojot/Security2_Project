import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase.js';

export default {
  name: 'SuperadminUsers',
  data() {
    return {
      users: [],
      showAddModal: false,
      isSubmitting: false,
      errorMessage: '',
      form: {
        idNumber: '',
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'user'
      },
      warnings: {
        idNumber: '',
        username: '',
        email: '',
        password: ''
      }
    };
  },
  computed: {
    isFormValid() {
      const f = this.form;
      const filled = f.idNumber && f.username && f.firstName && f.lastName && f.email && f.password && f.role;
      const noWarnings = !this.warnings.idNumber && !this.warnings.username && !this.warnings.email && !this.warnings.password;
      return filled && noWarnings;
    }
  },
  mounted() {
    this.fetchUsers();
  },
  methods: {
    async fetchUsers() {
      // Call the RPC function that joins the tables and bypasses RLS securely
      const { data, error } = await supabase.rpc('get_all_users');
      if (error) {
        console.error('Error fetching users:', error);
      } else {
        this.users = data;
      }
    },
    async toggleLockout(user) {
      const targetState = !user.is_locked_out;
      
      const { error } = await supabase
        .from('users')
        .update({ is_locked_out: targetState })
        .eq('id', user.user_id);

      if (error) {
        console.error('Error updating lockout state:', error);
      } else {
        user.is_locked_out = targetState;
      }
    },
    openAddModal() {
      this.showAddModal = true;
      this.errorMessage = '';
      this.form = {
        idNumber: '',
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'user'
      };
      this.warnings = {
        idNumber: '',
        username: '',
        email: '',
        password: ''
      };
    },
    closeAddModal() {
      this.showAddModal = false;
      this.errorMessage = '';
    },
    validateIdNumber() {
      const value = this.form.idNumber.trim();
      if (!value) {
        this.warnings.idNumber = '';
      } else if (!/^\d{4}-\d{4}$/.test(value)) {
        this.warnings.idNumber = 'ID must be in 0000-0000 format.';
      } else {
        this.warnings.idNumber = '';
        this.checkUniqueness('id', value, 'idNumber');
      }
    },
    validateUsername() {
      const value = this.form.username.trim();
      if (!value) {
        this.warnings.username = '';
      } else if (!/^[a-z]+_[a-z]+$/.test(value)) {
        this.warnings.username = 'Username must be in "first_last" (lowercase) format.';
      } else {
        this.warnings.username = '';
        this.checkUniqueness('username', value, 'username');
      }
    },
    validateEmail() {
      const value = this.form.email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value) {
        this.warnings.email = '';
      } else if (!emailRegex.test(value)) {
        this.warnings.email = 'Invalid email address format.';
      } else {
        this.warnings.email = '';
        this.checkUniqueness('email', value, 'email');
      }
    },
    validatePassword() {
      const value = this.form.password;
      if (!value) {
        this.warnings.password = '';
      } else if (value.length < 8) {
        this.warnings.password = 'Password must be at least 8 characters long.';
      } else {
        this.warnings.password = '';
      }
    },
    async checkUniqueness(type, value, fieldName) {
      try {
        const { data: exists, error } = await supabase.rpc('check_user_exists', { p_type: type, p_value: value });
        if (!error && exists) {
          this.warnings[fieldName] = `This ${type === 'id' ? 'ID Number' : type} is already taken.`;
        }
      } catch (err) {
        console.error('Error checking uniqueness:', err);
      }
    },
    async registerUser() {
      if (!this.isFormValid) return;
      this.isSubmitting = true;
      this.errorMessage = '';

      try {
        // Instantiate a separate Supabase client with auth session persistence disabled
        // to avoid logging out the current active superadmin session.
        const tempClient = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          {
            auth: { persistSession: false }
          }
        );

        // 1. Sign up the user in Supabase Auth
        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: this.form.email.trim(),
          password: this.form.password
        });

        if (authError) {
          this.errorMessage = authError.message || 'Registration failed.';
          this.isSubmitting = false;
          return;
        }

        if (!authData?.user) {
          this.errorMessage = 'Failed to retrieve user information after signup.';
          this.isSubmitting = false;
          return;
        }

        // 2. Call the create_user_profile RPC to insert profile, default questions, and selected role
        const { data: profileSuccess, error: profileError } = await supabase.rpc('create_user_profile', {
          p_user_id: authData.user.id,
          p_id_number: this.form.idNumber.trim(),
          p_username: this.form.username.trim(),
          p_email: this.form.email.trim(),
          p_first_name: this.form.firstName.trim(),
          p_middle_initial: '',
          p_last_name: this.form.lastName.trim(),
          p_suffix: '',
          p_birthdate: null,
          p_age: null,
          p_sex: 'male',
          p_purok: '',
          p_barangay: '',
          p_city: '',
          p_province: '',
          p_country: '',
          p_zip: '',
          p_q1: 'What is your favorite color?',
          p_a1: 'default',
          p_q2: 'What is your favorite place?',
          p_a2: 'default',
          p_q3: 'What was the name of your first pet?',
          p_a3: 'default',
          p_role: this.form.role
        });

        if (profileError || !profileSuccess) {
          console.error('Profile creation error:', profileError);
          this.errorMessage = profileError?.message || 'Failed to create user database profiles.';
          this.isSubmitting = false;
          return;
        }

        // 4. Success - close modal and reload user list
        this.showAddModal = false;
        await this.fetchUsers();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'An unexpected server or network error occurred.';
      } finally {
        this.isSubmitting = false;
      }
    }
  }
};
