import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase.js';

export default {
  name: 'SuperadminUsers',
  data() {
    return {
      users: [],
      showAddModal: false,
      showNotificationModal: false,
      addedUserRole: 'user',
      isSubmitting: false,
      errorMessage: '',
      step: 'personal',
      passwordStrengthScore: 0,
      showPassword: false,
      showRePassword: false,
      form: {
        idNumber: '',
        firstName: '',
        middleInitial: '',
        lastName: '',
        suffix: '',
        birthdate: '',
        age: '',
        sex: 'male',
        purok: '',
        barangay: '',
        city: '',
        province: '',
        country: '',
        zip: '',
        username: '',
        password: '',
        repassword: '',
        email: '',
        role: 'user'
      },
      warnings: {}
    };
  },
  computed: {
    steps() {
      return [
        { id: 'personal', label: 'Personal Details' },
        { id: 'login_details', label: 'Address & Login' }
      ];
    },
    // whether required fields for each step are filled
    canProceedPersonal() {
      const f = this.form;
      const filled = Boolean(f.firstName && String(f.firstName).trim() && f.lastName && String(f.lastName).trim() && f.birthdate && f.email && String(f.email).trim());
      if (!filled) return false;
      return !this.hasFieldWarnings(['fname','mname', 'lname', 'suffix', 'birthdate','email','age']);
    },
    canProceedAddress() {
      const f = this.form;
      const filled = Boolean(
        f.purok && String(f.purok).trim() &&
        f.barangay && String(f.barangay).trim() &&
        f.city && String(f.city).trim() &&
        f.province && String(f.province).trim() &&
        f.country && String(f.country).trim() &&
        f.zip && String(f.zip).trim()
      );
      if (!filled) return false;
      return !this.hasFieldWarnings(['purok','barangay','city','province','country','zip']);
    },
    canProceedLogin() {
      const f = this.form;
      const filled =
        f.idNumber && String(f.idNumber).trim() &&
        f.username && String(f.username).trim() &&
        f.password && String(f.password).trim() &&
        f.repassword && String(f.repassword).trim();

      if (!filled) return false;

      // Make sure passwords match and fields have no warnings
      if (f.password !== f.repassword) return false;

      // Check if there are any warnings for these fields
      return !this.hasFieldWarnings(['user_id', 'username', 'password', 'repassword']);
    },
    canProceedLoginDetails() {
      const addressValid = this.canProceedAddress;
      const loginValid = this.canProceedLogin;
      return addressValid && loginValid;
    },
    canSubmitRegister() {
      return (
        this.canProceedPersonal &&
        this.canProceedLoginDetails
      );
    },
    passwordStrengthClass() {
      if (this.passwordStrengthScore <= 1) return 'weak';
      if (this.passwordStrengthScore === 2) return 'medium';
      return 'strong';
    },
    passwordStrengthLabel() {
      if (this.passwordStrengthScore <= 1) return 'Weak Password';
      if (this.passwordStrengthScore === 2) return 'Medium Password';
      return 'Strong Password';
    }
  },
  mounted() {
    this.fetchUsers();
  },
  methods: {
    async fetchUsers() {
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
      this.step = 'personal';
      this.passwordStrengthScore = 0;
      this.showPassword = false;
      this.showRePassword = false;
      this.form = {
        idNumber: '',
        firstName: '',
        middleInitial: '',
        lastName: '',
        suffix: '',
        birthdate: '',
        age: '',
        sex: 'male',
        purok: '',
        barangay: '',
        city: '',
        province: '',
        country: '',
        zip: '',
        username: '',
        password: '',
        repassword: '',
        email: '',
        role: 'user'
      };
      this.warnings = {};
    },
    closeAddModal() {
      this.showAddModal = false;
      this.errorMessage = '';
    },
    closeNotificationModal() {
      this.showNotificationModal = false;
    },
    isStepCompleted(stepId) {
      const stepOrder = ['personal', 'login_details'];
      const currentIndex = stepOrder.indexOf(this.step);
      const stepIndex = stepOrder.indexOf(stepId);
      return stepIndex < currentIndex;
    },
    getWarning(id) {
      const w = this.warnings[id];
      if (!w) return '';
      if (Array.isArray(w)) return w[0] || '';
      return w;
    },
    hasFieldWarnings(fieldIds) {
      for (const id of fieldIds) {
        const v = this.warnings && this.warnings[id];
        if (!v) continue;
        if (Array.isArray(v) && v.length) return true;
        if (typeof v === 'string' && String(v).trim()) return true;
      }
      return false;
    },
    wordsCapitalized(value) {
      const words = value.trim().split(/\s+/);
      for (let word of words) {
        if (word.length > 0 && word[0] !== word[0].toUpperCase()) {
          return false;
        }
      }
      return true;
    },
    allCaps(value) {
      return value && value === value.toUpperCase() && /[A-Z]/.test(value);
    },
    allLows(value) {
      return value && value === value.toLowercase() && /[a-z]/.test(value);
    },
    containsNum(value){
      return /[0-9]/.test(value);
    },
    containsSymbol(value) {
      return /[^a-zA-Z0-9\s]/.test(value);
    },
    hasThreeConsecutiveSpaces(value) {
      return /\s{3,}/.test(value);
    },
    hasDoubleSpaces(value) {
      return /\s{2}/.test(value);
    },
    hasThreeSameConsecutiveLetters(value) {
      return /([a-zA-Z])\1\1/.test(value);
    },
    numisFollowedByAlphabet(value) {
      return /\d[a-zA-Z]/.test(value);
    },
    numDashLetter(value) {
      return /\d-[a-zA-Z]/.test(value);
    },
    onlyDashAllowed(value) {
      return /^[a-zA-Z0-9\s-]+$/.test(value);
    },
    onBirthInput() {
      this.calculateAge();
      let messages = [];
      const dob = this.form.birthdate;
      if (!dob) {
        this.warnings['birthdate'] = [];
        this.warnings['age'] = [];
        return;
      }
      const dobDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }
      if (isNaN(age) || age < 0) messages.push('Invalid birthday');
      this.warnings['birthdate'] = messages;
      const ageMsgs = [];
      if (isNaN(age) || age < 0) ageMsgs.push('Invalid age input');
      else if (age < 18) ageMsgs.push('Age is below 18 years old');
      this.warnings['age'] = ageMsgs;
    },
    calculateAge() {
      const dob = this.form.birthdate;
      if (!dob) {
        this.form.age = '';
        this.warnings['age'] = [];
        return;
      }
      const dobDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }
      this.form.age = age;
      const ageMsgs = [];
      if (isNaN(age) || age < 0) ageMsgs.push('Age is invalid');
      else if (age < 18) ageMsgs.push('Age is below 18 years old');
      this.warnings['age'] = ageMsgs;
    },
    validateName(evt) {
      const value = (evt && evt.target && evt.target.value) ? evt.target.value : this.form.firstName || this.form.lastName || '';
      const id = (evt && evt.target && evt.target.id) ? evt.target.id : 'fname';
      let messages = [];
      if (this.allCaps(value)) messages.push('All uppercased name is not allowed!');
      if (this.containsNum(value) || this.containsSymbol(value)) messages.push('Invalid name input');
      if (value.length > 0 && !this.wordsCapitalized(value)) messages.push('First letter of each word in your name must be capitalized');
      if (this.hasThreeSameConsecutiveLetters(value)) messages.push('Three consecutive same letters are not allowed');
      if (this.hasDoubleSpaces(value)) messages.push('Double spaces are not allowed');
      if (this.hasThreeConsecutiveSpaces(value)) messages.push('Three consecutive spaces are not allowed');
      this.warnings[id] = messages;
    },
    validateMname(evt) {
      const input = evt.target;
      const id = input.id;
      const value = input.value;
      let messages = [];
      if (value.length > 2) messages.push('Input too long!');
      if (value.length > 0 && !this.wordsCapitalized(value)) messages.push('First letter must be capitalized');
      if (/^[a-zA-Z.]+$/.test(value) === false && value.length > 0) messages.push('Invalid middle name input');
      if (this.hasThreeSameConsecutiveLetters(value) || this.hasThreeConsecutiveSpaces(value)) messages.push('Three consecutive inputs error');
      this.warnings[id] = messages;
    },
    validateSuffix(evt) {
      const input = evt.target;
      const id = input.id;
      const value = input.value;
      let messages = [];
      if (value.length > 3) messages.push('Input too long!');
      if (value.length > 0 && !this.wordsCapitalized(value)) messages.push('First letter of suffix must be capitalized!');
      if (this.hasThreeSameConsecutiveLetters(value)) messages.push('Three consecutive same letters are not allowed');
      this.warnings[id] = messages;
    },
    validateAddress(evt) {
      const input = evt.target;
      const value = input.value;
      let messages = [];
      if (!value) return messages;
      if (this.allCaps(value)) messages.push('All caps not allowed!');
      if (value.length > 0 && !this.wordsCapitalized(value)) messages.push('First letter of each word must be capitalized!');
      if (this.hasDoubleSpaces(value)) messages.push('Double spaces are not allowed!');
      if (this.hasThreeSameConsecutiveLetters(value) || this.hasThreeConsecutiveSpaces(value)) messages.push('Three consecutive inputs not allowed!');
      return messages;
    },
    validateStreet(evt) {
      const input = evt.target;
      const id = input.id;
      const value = input.value;
      let messages = [];

      if (id === 'purok' && input.value.length > 0) {
        const allowedChars = /^[A-Za-z0-9\s\-.]+$/;
        const patterns = [
          /^(?:P(?:urok)?)[\s\-.]*\d{1,3}[A-Za-z]?$/i,
          /^\d{1,3}[A-Za-z]?$/
        ];
        if (!allowedChars.test(value)) {
          messages.push('Invalid characters in purok. Only letters, numbers, spaces, dashes and dots are allowed.');
        } else if (!patterns.some(p => p.test(value))) {
          messages.push('Purok must be like "P-1", "Purok 2", or a plain number (e.g. "5" or "12A").');
        }
        if (this.hasDoubleSpaces(value)) messages.push('Double spaces are not allowed!');
        if (this.hasThreeSameConsecutiveLetters(value) || this.hasThreeConsecutiveSpaces(value)) messages.push('Three consecutive inputs not allowed!');
      } else {
        messages = this.validateAddress(evt);
        if (input.value.length > 0 && !this.onlyDashAllowed(input.value)) {
          messages.push('Invalid purok input');
        }
      }
      this.warnings[id] = messages;
    },
    validateBrgy(evt) {
      const input = evt.target;
      const id = input.id;
      let messages = this.validateAddress(evt);
      if (this.numisFollowedByAlphabet(input.value)) messages.push('Invalid Input!');
      if (/^[a-zA-Z0-9\s-]+$/.test(input.value) === false && input.value.length > 0) messages.push('Invalid Input!');
      this.warnings[id] = messages;
    },
    validateCity(evt) {
      const input = evt.target;
      const id = input.id;
      let messages = this.validateAddress(evt);
      if (this.containsNum(input.value)) messages.push('Invalid city input');
      if (this.containsSymbol(input.value)) messages.push('Invalid city input!');
      this.warnings[id] = messages;
    },
    validateProvince(evt) {
      const input = evt.target;
      const id = input.id;
      const value = input.value;
      let messages = [];

      if (!value) {
        this.warnings[id] = messages;
        return;
      }

      if (this.allCaps(value)) messages.push('All caps not allowed!');
      if (this.hasDoubleSpaces(value)) messages.push('Double spaces are not allowed!');
      if (this.hasThreeSameConsecutiveLetters(value) || this.hasThreeConsecutiveSpaces(value)) messages.push('Three consecutive inputs not allowed!');

      const words = value.trim().split(/\s+/);
      const allowedLowercase = ['del', 'de', 'da', 'ng', 'sa', 'ni', 'kay'];
      let hasCapitalizationError = false;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word.length > 0) {
          if (i === 0 && word[0] !== word[0].toUpperCase()) {
            hasCapitalizationError = true;
            break;
          } else if (i > 0 && !allowedLowercase.includes(word.toLowerCase()) && word[0] !== word[0].toUpperCase()) {
            hasCapitalizationError = true;
            break;
          }
        }
      }

      if (hasCapitalizationError) messages.push('First letter of each word must be capitalized!');
      if (this.containsNum(value) || this.containsSymbol(value)) messages.push('Invalid Input!');
      this.warnings[id] = messages;
    },
    validateCountry(evt) {
      const input = evt.target;
      const id = input.id;
      let messages = this.validateAddress(evt);
      if (this.containsNum(input.value) || this.containsSymbol(input.value)) messages.push('Invalid country input');
      this.warnings[id] = messages;
    },
    validateZipcode(evt) {
      const input = evt.target;
      const id = input.id;
      let messages = this.validateAddress(evt);
      const zipFormatRegex = /^\d{4}$/;
      if (!/[0-9]/.test(input.value)) messages.push('Invalid zipcode input');
      if (!zipFormatRegex.test(input.value)) messages.push('Zipcode must be 4 digits!');
      this.warnings[id] = messages;
    },
    validatePassword(evt) {
      const input = evt.target;
      const id = input.id;
      const value = input.value;
      let messages = [];
      if (!input.value) { this.warnings[id] = []; return; }

      const hasUpper = /[A-Z]/.test(value);
      const hasLower = /[a-z]/.test(value);
      const hasNumber = /\d/.test(value);
      const hasSymbol = /[^A-Za-z0-9]/.test(value);
      const isLong = value.length >= 8;

      let score = 0;
      if (isLong) score++;
      if (hasUpper && hasLower) score++;
      if (hasNumber) score++;
      if (hasSymbol) score++;
      this.passwordStrengthScore = score >= 4 ? 3 : score <= 1 ? 1 : 2;

      if (!isLong) messages.push('Password must be at least 8 characters');
      if (!hasUpper) messages.push('Password must include at least one uppercase letter');
      if (!hasLower) messages.push('Password must include at least one lowercase letter');
      if (!hasNumber) messages.push('Password must include at least one number');
      if (!hasSymbol) messages.push('Password must include at least one special symbol');

      this.warnings[id] = messages;
    },
    validateConfirmPassword(evt) {
      const input = evt.target;
      const id = input.id;
      let messages = [];
      if (this.form.password !== input.value) messages.push('Password do not match');
      this.warnings[id] = messages;
    },
    checkEmail(evt) {
      this.validateUniqueField(evt, 'email');
    },
    checkID(evt) {
      this.validateUniqueField(evt, 'id');
    },
    checkUsername(evt) {
      this.validateUniqueField(evt, 'username');
    },
    validateUniqueField(evt, type) {
      const input = evt.target;
      const id = input.id;
      const value = input.value.trim();
      let messages = [];

      if (!value) {
        this.warnings[id] = [];
        return;
      }

      if (id === 'user_id' && !/^\d{4}-\d{4}$/.test(value)) messages.push('ID must be 0000-0000 format!');
      if (type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) messages.push('Invalid email format');
      }
      if (type === 'username') {
        const usernameRegex = /^[a-z]+_[a-z]+$/;
        if (value.length < 5) messages.push('Username must be at least 5 characters.');
        if (value.length > 20) messages.push('Username cannot exceed 20 characters');
        if (!usernameRegex.test(value)) messages.push('Username must be "a-z_a-z" format');
      }

      supabase.rpc('check_user_exists', { p_type: type, p_value: value })
        .then(({ data: exists, error }) => {
          if (error) {
            console.error(`Supabase error checking ${type}:`, error);
            return;
          }
          if (exists) {
            if (type === 'id') messages.push('This ID already exists!');
            if (type === 'email') messages.push('This email is already registered');
            if (type === 'username') messages.push('This username already exists');
          }
          this.warnings = { ...this.warnings, [id]: messages };
        })
        .catch(err => {
          console.error(`Error checking ${type}:`, err);
        });
    },
    async registerUser() {
      if (!this.canSubmitRegister) return;
      this.isSubmitting = true;
      this.errorMessage = '';

      try {
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

        // 2. Call the create_user_profile RPC to insert profile and default security questions/selected role
        const { data: profileSuccess, error: profileError } = await supabase.rpc('create_user_profile', {
          p_user_id: authData.user.id,
          p_id_number: this.form.idNumber.trim(),
          p_username: this.form.username.trim(),
          p_email: this.form.email.trim(),
          p_first_name: this.form.firstName.trim(),
          p_middle_initial: this.form.middleInitial.trim(),
          p_last_name: this.form.lastName.trim(),
          p_suffix: this.form.suffix.trim(),
          p_birthdate: this.form.birthdate || null,
          p_age: this.form.age ? parseInt(this.form.age, 10) : null,
          p_sex: this.form.sex,
          p_purok: this.form.purok.trim(),
          p_barangay: this.form.barangay.trim(),
          p_city: this.form.city.trim(),
          p_province: this.form.province.trim(),
          p_country: this.form.country.trim(),
          p_zip: String(this.form.zip || '').trim(),
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

        // Accounts created directly by a superadmin do not need registration approval.
        const { error: statusError } = await supabase.rpc('update_registration_status', {
          p_user_id: authData.user.id,
          p_status: 'approved'
        });
        if (statusError) {
          console.error('User approval status error:', statusError);
          this.errorMessage = statusError.message || 'User was created but could not be approved.';
          this.isSubmitting = false;
          return;
        }

        // 4. Success - close modal, reload user list, and notify the superadmin
        this.showAddModal = false;
        await this.fetchUsers();
        this.addedUserRole = this.form.role;
        this.showNotificationModal = true;
      } catch (err) {
        console.error(err);
        this.errorMessage = 'An unexpected server or network error occurred.';
      } finally {
        this.isSubmitting = false;
      }
    }
  }
};
