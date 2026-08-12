
export default {
  data() {
    return {
      step: 'personal',
      ageWarning: '',
      warnings: {},
      passwordStrengthScore: 0,
      showPassword: false,
      showRePassword: false,
      successMessage: '',
      form: {
        id: '',
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
        question1: '',
        answer1: '',
        question2: '',
        answer2: '',
        question3: '',
        answer3: ''
      },
      questionList: [
        {choice: 'What is your favorite color?', value: 'What is your favorite color?'},
        {choice: 'What is your favorite place?', value: 'What is your favorite place?'},
        {choice:'What was the name of your first pet?', value: 'What was the name of your first pet?'},
        {choice: 'What is your favorite movie or TV show?', value: 'What is your favorite movie or TV show?'},
        {choice: 'What is your favorite book?', value: 'What is your favorite book?'},
      ],
    }
  },
  computed: {
    steps() {
      return [
        { id: 'personal', label: 'Personal Details' },
        { id: 'login_details', label: 'Address & Login' },
        { id: 'questions', label: 'Questions' }
      ];
    },
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
    },
    // whether required fields for each step are filled
    canProceedPersonal() {
      // require firstName, lastName, birthdate and email to be non-empty and have no warnings
      const f = this.form;
      const filled = Boolean(f.firstName && String(f.firstName).trim() && f.lastName && String(f.lastName).trim() && f.birthdate && f.email && String(f.email).trim());
      if (!filled) return false;
      // check field-specific warnings (use input ids)
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
        f.id && String(f.id).trim() &&
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
      // Combine address and login validations
      const addressValid = this.canProceedAddress;
      const loginValid = this.canProceedLogin;
      return addressValid && loginValid;
    },
    canProceedQuestions() {
      const f = this.form;
      const filled = (
        f.question1 && f.answer1.trim() &&
        f.question2 && f.answer2.trim() &&
        f.question3 && f.answer3.trim()
      );
      if (!filled) return false;
      return !this.hasFieldWarnings(['answer1', 'answer2', 'answer3']);
    },
    canSubmitRegister() {
      // Combine all step validations
      return (
        this.canProceedPersonal &&
        this.canProceedLoginDetails &&
        this.canProceedQuestions
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
    },

  },

  methods: {
    isStepCompleted(stepId) {
      const stepOrder = ['personal', 'login_details', 'questions'];
      const currentIndex = stepOrder.indexOf(this.step);
      const stepIndex = stepOrder.indexOf(stepId);
      return stepIndex < currentIndex;
    },
    // returns true if any of the provided field ids have warnings
    hasFieldWarnings(fieldIds) {
      for (const id of fieldIds) {
        const v = this.warnings && this.warnings[id];
        if (!v) continue;
        if (Array.isArray(v) && v.length) return true;
        if (typeof v === 'string' && String(v).trim()) return true;
      }
      return false;
    },
    // Utility validators
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

    // Wrapper to keep existing calculateAge behavior triggered from template
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
      if (isNaN(age) || age < 0) messages.push('Invalid age input');
      this.warnings['birthdate'] = messages;
      const ageMsgs = [];
      if (isNaN(age) || age < 0) ageMsgs.push('Birthday must not be in the future');
      else if (age < 18) ageMsgs.push('Age is below 18 years old');
      this.warnings['age'] = ageMsgs;
    },

    calculateAge() {
      const dob = this.form.birthdate;
      this.ageWarning = '';
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
      if (isNaN(age) || age < 0) {
        this.ageWarning = 'Age is invalid';
      } else if (age < 18) {
        this.ageWarning = 'Age is below 18 years old';
      }
      // mirror to central warnings array
      const ageMsgs = [];
      if (isNaN(age) || age < 0) ageMsgs.push('Age is invalid');
      else if (age < 18) ageMsgs.push('Age is below 18 years old');
      this.warnings['age'] = ageMsgs;
    },

    validateName(evt) {
      const value = (evt && evt.target && evt.target.value) ? evt.target.value : this.form.firstName || this.form.lastName || '';
      const id = (evt && evt.target && evt.target.id) ? evt.target.id : 'fname';
      let messages = [];
      if (this.allCaps(value)) messages.push('All capatalized name is not allowed!');
      if (this.containsNum(value) || this.containsSymbol(value)) messages.push('Invalid name input');
      if (value.length > 0 && !this.wordsCapitalized(value)) messages.push('First letter of each word in your name must be capitalized');
      if (this.hasThreeSameConsecutiveLetters(value)) messages.push('Three consecutive same letters are not allowed!');
      if (this.hasDoubleSpaces(value)) messages.push('Double spaces are not allowed!');
      if (this.hasThreeConsecutiveSpaces(value)) messages.push('Three consecutive spaces are not allowed!');
      this.warnings[id] = messages;
    },

    validateMname(evt) {
      const input = evt.target;
      const id = input.id;
      const value = input.value;
      let messages = [];
      if (value.length > 2) messages.push('Input too long!');
      if (value.length > 0 && !this.wordsCapitalized(value)) messages.push('First letter of each word in your middle name must be capitalized');
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
      if (value.length > 0 && !this.wordsCapitalized(value)) messages.push('First letter of each word in your suffix must be capitalized!');
      if (/^[a-zA-Z.]+$/.test(value) === false && value.length > 0) messages.push('Invalid suffix input');
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
      return messages; // Ensure this returns an array
    },

    validateStreet(evt) {
      const input = evt.target;
      const id = input.id;
      const value = input.value;
      let messages = [];

      // Special validation for purok field
      if (id === 'purok' && input.value.length > 0) {
        // Accept formats like: "P-1", "Purok 2", "P 3A", or plain numbers "12"/"12A"
        const allowedChars = /^[A-Za-z0-9\s\-.]+$/;
        const patterns = [
          /^(?:P(?:urok)?)[\s\-.]*\d{1,3}[A-Za-z]?$/i, // P, Purok prefix
          /^\d{1,3}[A-Za-z]?$/ // plain number or number+suffix
        ];
        if (!allowedChars.test(value)) {
          messages.push('Invalid characters in purok. Only letters, numbers, spaces, dashes and dots are allowed.');
        } else if (!patterns.some(p => p.test(value))) {
          messages.push('Purok must be like "P-1", "Purok 2", or a plain number (e.g. "5" or "12A").');
        }
        // Generic checks (skip strict capitalization for purok)
        if (this.hasDoubleSpaces(value)) messages.push('Double spaces are not allowed!');
        if (this.hasThreeSameConsecutiveLetters(value) || this.hasThreeConsecutiveSpaces(value)) messages.push('Three consecutive inputs not allowed!');
      } else {
        // Use general address validation for other street fields
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
      // Allow dashes in barangay names (like Caloc-an), only flag digit-dash-letter pattern
      // if (this.numDashLetter(input.value)) messages.push('Invalid Input!!');
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

      // Apply most validateAddress rules except strict capitalization for provinces
      if (this.allCaps(value)) messages.push('All caps not allowed!');
      if (this.hasDoubleSpaces(value)) messages.push('Double spaces are not allowed!');
      if (this.hasThreeSameConsecutiveLetters(value) || this.hasThreeConsecutiveSpaces(value)) messages.push('Three consecutive inputs not allowed!');

      // Custom capitalization check for provinces
      const words = value.trim().split(/\s+/);
      const allowedLowercase = ['del', 'de', 'da', 'ng', 'sa', 'ni', 'kay'];
      let hasCapitalizationError = false;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word.length > 0) {
          // First word must be capitalized, others can be lowercase if they're in the allowed list
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
      this.warnings[id] = messages.join('! ');
    },

    validatePassword(evt) {
      const input = evt.target;
      const id = input.id;
      const value = input.value;
      let messages = [];
      if (!input.value) { this.warnings[id] = []; return; }

      // Strength checks
      const hasUpper = /[A-Z]/.test(value);
      const hasLower = /[a-z]/.test(value);
      const hasNumber = /\d/.test(value);
      const hasSymbol = /[^A-Za-z0-9]/.test(value);
      const isLong = value.length >= 8;

      // Compute strength score
      let score = 0;
      if (isLong) score++;
      if (hasUpper && hasLower) score++;
      if (hasNumber) score++;
      if (hasSymbol) score++;
      this.passwordStrengthScore = score >= 4 ? 3 : score <= 1 ? 1 : 2; // Normalize to 1–3

      // Validation messages
      if (!isLong) messages.push('Password must be at least 8 characters long');
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

    validateAnswer(evt) {
      const value = evt.target.value.trim();
      const id = evt.target.id;
      let messages = [];
      if (!value) messages.push('Answer cannot be empty.');
      if (value.length < 2) messages.push('Answer too short.');
      if (this.hasDoubleSpaces(evt.target.value)) messages.push('Double spaces are not allowed!');
      if (this.containsSymbol(value)) messages.push('Avoid using special symbols.');
      this.warnings[id] = messages;
    },

    // keep your existing validateUniqueField method as-is
    validateUniqueField(evt, type) {
      const input = evt.target;
      const id = input.id;
      const value = input.value.trim();
      let messages = [];

      if (!value) {
        this.warnings[id] = [];
        return;
      }

      // LOCAL VALIDATION
      if (id === 'user_id' && !/^\d{4}-\d{4}$/.test(value)) messages.push('ID must be in the format 0000-0000!');
      if (type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) messages.push('Invalid email format');
      }
      if (type === 'username') {
        const usernameRegex = /^[a-z]+_[a-z]+$/;
        if (value.length < 5) messages.push('Username must be at least 5 characters long');
        if (value.length > 20) messages.push('Username cannot exceed 20 characters');
        if (!usernameRegex.test(value)) messages.push('Username must be "a-z_a-z" format');
      }

      // DATABASE CHECK
      fetch('http://localhost/Security2.0/api/check_existing.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value })
      })
        .then(res => res.json())
        .then(data => {
          if (data.exists) {
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

    async register() {
      // Basic client-side validation
      if (!this.form.username || !this.form.email || !this.form.password) {
        alert('Please fill username, email and password');
        return;
      }
      if (this.form.password !== this.form.repassword) {
        alert('Passwords do not match');
        return;
      }

      const payload = {
        id: this.form.id,
        username: this.form.username,
          email: this.form.email,
        password: this.form.password,
        profile: {
          firstName: this.form.firstName,
          middleInitial: this.form.middleInitial,
          lastName: this.form.lastName,
          suffix: this.form.suffix,
          birthdate: this.form.birthdate,
          age: this.form.age,
          sex: this.form.sex
        },
        address: {
          purok: this.form.purok,
          barangay: this.form.barangay,
          city: this.form.city,
          province: this.form.province,
          country: this.form.country,
          zip: this.form.zip
        },
        security: [
          { question: this.form.question1, answer: this.form.answer1 },
          { question: this.form.question2, answer: this.form.answer2 },
          { question: this.form.question3, answer: this.form.answer3 }
        ]
      };

      try {
        // Use explicit Apache URL so the request reaches XAMPP even when dev server (Vite) is running on a different origin
        const endpoint = 'http://localhost/Security2.0/api/register.php';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        // Try to parse JSON (backend returns JSON). If parsing fails, read text for debugging.
        let data;
        try {
          data = await res.json();
        } catch (e) {
          const text = await res.text();
          console.error('Non-JSON response from register endpoint:', text, e);
          alert('Server returned unexpected response. See console for details.');
          return;
        }
        console.log('Register response', res.status, data);
        if (!res.ok) {
          alert(data.error || 'Registration failed');
          return;
        }
        // success
        this.successMessage = 'Registration successful! Redirecting to login...';
        setTimeout(() => {
          this.$router.push('/login');
        }, 2000);
      } catch (err) {
        console.error(err);
        alert('Network or server error');
      }
    }
  }
}
