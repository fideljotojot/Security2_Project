import { setUserAuthenticated } from '../../router.js';

export default {
  props: {
    idNumber: {
      type: String,
      required: false,
      default: ''
    }
  },
  data() {
    return {
      newPassword: "",
      confirmPassword: "",
      showNewPassword: false,
      showConfirmPassword: false,
      error: "",
      success: "",
      passwordStrengthScore: 0,
      warnings: {
        idNumber: [],
        newPassword: [],
        confirmPassword: [],
      },
    };
  },
  computed: {
    allWarnings() {
      const vals = Object.values(this.warnings || {});
      const flat = [];

      for (const v of vals) {
        if (Array.isArray(v)) {
          for (const msg of v) {
            if (msg && String(msg).trim()) flat.push(String(msg).trim());
          }
        } else if (v && String(v).trim()) {
          flat.push(String(v).trim());
        }
      }

      return flat;
    },

    strengthWidth() {
      if (!this.newPassword) return '0%';
      if (this.passwordStrengthScore <= 1) return '33%';
      if (this.passwordStrengthScore === 2) return '66%';
      return '100%';
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
    togglePassword(field) {
      if (field === "new") this.showNewPassword = !this.showNewPassword;
      if (field === "confirm") this.showConfirmPassword = !this.showConfirmPassword;
    },

    validatePassword(evt) {
      const input = evt.target;
      const value = input.value;
      let messages = [];

      if (!value) {
        this.warnings.newPassword = ["Password cannot be empty."];
        this.passwordStrengthScore = 0;
        return;
      }

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
      this.passwordStrengthScore = score >= 4 ? 3 : score <= 1 ? 1 : 2;

      // Validation messages
      if (!isLong) messages.push("Password must be at least 8 characters long");
      if (!hasUpper) messages.push("Password must include at least one uppercase letter");
      if (!hasLower) messages.push("Password must include at least one lowercase letter");
      if (!hasNumber) messages.push("Password must include at least one number");
      if (!hasSymbol) messages.push("Password must include at least one special symbol");

      this.warnings.newPassword = messages;
    },

    validateConfirmPassword() {
      let messages = [];
      if (this.confirmPassword && this.confirmPassword !== this.newPassword) {
        messages.push("Passwords do not match");
      }
      this.warnings.confirmPassword = messages;
    },
    async submitChange() {
      this.error = "";
      this.success = "";

      // Validate ID number format
      if (!this.idNumber || !/^\d{4}-\d{4}$/.test(this.idNumber.trim())) {
        this.warnings.idNumber = ["ID must be in the format 0000-0000!"];
        console.log('ID warning triggered', this.warnings.idNumber);
        return;
      } else {
        this.warnings.idNumber = [];
      }


      // Run validations
      this.validatePassword({ target: { value: this.newPassword } });
      this.validateConfirmPassword();

      if (
        (this.warnings.newPassword && this.warnings.newPassword.length) ||
        (this.warnings.confirmPassword && this.warnings.confirmPassword.length)
      ) {
        this.error;
        return;
      }
      try {
        const res = await fetch('http://localhost/Security2.0/api/reset_password.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_number: this.idNumber, new_password: this.newPassword }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          this.error = data.error || "Failed to change password.";
        } else {
          this.success = "Successfully Changed Password";
          this.newPassword = "";
          this.confirmPassword = "";
          setUserAuthenticated(false);
          setTimeout(() => {
            this.$router.push("/login"); // Redirect after a delay of 1 second
          }, 1000);
        }
      } catch {
        this.error = "Network error, please try again.";
      }
      console.log('Sending to backend:', {
        id_number: this.idNumber,
        new_password: this.newPassword
      });

    }

  },
};
