import ChangePassword from '../../components/ChangePassword.vue';
import { supabase } from '../../utils/supabase.js';

export default {
  components: {
    ChangePassword
  },
  data() {
    return {
      isStep2Loading: false,
      warnings: {},
      idNumber: '',
      message: '',
      userId: null,
      username: '',
      questionsLoaded: false,
      step: 1,
      tempAnswers: {
        answer1: '',
        answer2: '',
        answer3: ''
      },
      form: {
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
    };
  },
  computed: {
    isIdValid() {
      return (
        this.idNumber.trim() !== '' &&
        (!this.warnings.idNumber || this.warnings.idNumber.length === 0)
      );
    },
    allWarnings() {
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
    isStep2Valid() {
      const f = this.form;
      return (
        f.question1 && f.answer1.trim() &&
        f.question2 && f.answer2.trim() &&
        f.question3 && f.answer3.trim()
      );
    }
  },

  methods: {
    getWarning(id) {
      const w = this.warnings[id];
      if (!w) return '';
      if (Array.isArray(w)) return w[0] || '';
      return w;
    },
    containsSymbol(value) {
      return /[^a-zA-Z0-9\s]/.test(value);
    },

    validateIdNumber() {
      const value = this.idNumber.trim();
      const messages = [];

      if (!value) {
        messages.push('ID number cannot be empty.');
      } else if (!/^\d{4}-\d{4}$/.test(value)) {
        messages.push('ID must be in the format 0000-0000!');
      }

      this.warnings.idNumber = messages;
      return messages.length === 0;
    },

    validateAnswer(evt) {
      const value = evt.target.value.trim();
      const id = evt.target.id;
      let messages = [];
      if (!value) messages.push('Answer cannot be empty.');
      if (value.length < 2 && value.length != 1) messages.push('Answer too short.');
      if (this.containsSymbol(value)) messages.push('Avoid using special symbols.');
      this.warnings[id] = messages;
      this.isStep2Loading = false;
    },

    async goToStep3() {
      this.isStep2Loading = true;
      this.warnings.server = [];

      try {
        const { data: matched, error } = await supabase.rpc('verify_security_answers_only', {
          p_id_number: this.idNumber,
          p_ans1: this.form.answer1,
          p_ans2: this.form.answer2,
          p_ans3: this.form.answer3
        });

        if (error) {
          this.warnings.server = [error.message || 'Verification error.'];
          this.isStep2Loading = true;
          return;
        }

        if (!matched) {
          this.warnings.server = ['Your answers do not match our records.'];
          this.isStep2Loading = true;
          return;
        }

        // Store answers temporarily in memory to send during final reset in step 3
        this.tempAnswers = {
          answer1: this.form.answer1,
          answer2: this.form.answer2,
          answer3: this.form.answer3
        };

        this.form.answer1 = '';
        this.form.answer2 = '';
        this.form.answer3 = '';
        this.warnings.server = [];
        this.step = 3;
      } catch (err) {
        console.error(err);
        this.warnings.server = ['Network or database error occurred.'];
      } finally {
        if (!this.warnings.server.length) {
          this.isStep2Loading = false;
        }
      }
    },

    async handleChangePassword() {
      if (!this.validateIdNumber()) {
        this.message = 'Please enter a valid ID number in the format 0000-0000.';
        return;
      }

      const child = this.$refs.changePasswordComponent;
      if (!child || !child.submitChange) {
        this.message = 'Unable to change password: component not available.';
        return;
      }

      try {
        // 1. Get validated password from child component
        const validationResult = await child.submitChange();

        if (!validationResult || !validationResult.ok) {
          this.message = validationResult?.error || 'Failed to validate password.';
          return;
        }

        const newPassword = validationResult.newPassword;

        // 2. Call Supabase RPC to verify answers and reset password atomically
        const { data: resetResult, error: resetError } = await supabase.rpc('verify_and_reset_password', {
          p_id_number: this.idNumber,
          p_ans1: this.tempAnswers.answer1,
          p_ans2: this.tempAnswers.answer2,
          p_ans3: this.tempAnswers.answer3,
          p_new_password: newPassword
        });

        if (resetError) {
          this.message = resetError.message || 'Database error occurred.';
          return;
        }

        if (!resetResult || !resetResult.ok) {
          this.message = resetResult?.error || 'Failed to change password.';
          return;
        }

        this.message = resetResult.message || 'Password changed successfully.';
        
        child.success = "Successfully Changed Password";
        child.newPassword = "";
        child.confirmPassword = "";
        
        // Reset form after success
        setTimeout(() => {
          this.step = 1;
          this.idNumber = '';
          this.warnings.idNumber = [];
          this.tempAnswers = { answer1: '', answer2: '', answer3: '' };
          this.$router.push("/login");
        }, 1000);

      } catch (err) {
        console.error(err);
        this.message = 'Unexpected error occurred.';
      }
    },

    async submitReset() {
      if (this.step === 1) {
        if (this.validateIdNumber()) {
          await this.fetchQuestions();
        }
      } else if (this.step === 2) {
        if (this.isStep2Valid && !this.isStep2Loading) {
          await this.goToStep3();
        }
      } else if (this.step === 3) {
        await this.handleChangePassword();
      }
    },

    // Fetch security questions for the supplied id
    async fetchQuestions() {
      this.message = '';
      this.warnings.idNumber = [];

      if (!this.validateIdNumber()) {
        this.warnings.idNumber = ['Please enter your ID number in the format 0000-0000.'];
        return;
      }

      try {
        const { data, error } = await supabase.rpc('get_user_security_questions', { p_id_number: this.idNumber });

        if (error) {
          this.warnings.idNumber = [error.message || 'Database error occurred.'];
          return;
        }

        if (!data || data.length === 0) {
          this.warnings.idNumber = ['This ID number does not exist.'];
          return;
        }

        const questions = data.map(row => row.question);
        const username = data[0].username;
        const userId = data[0].user_id;

        this.questionList = questions.map(q => ({ choice: q, value: q }));
        this.userId = this.idNumber;
        this.username = username;

        this.form.question1 = questions[0] || '';
        this.form.question2 = questions[1] || '';
        this.form.question3 = questions[2] || '';
        this.questionsLoaded = true;
        this.message = '';
        this.step = 2;
      } catch (err) {
        console.error(err);
        this.warnings.idNumber = ['Network error while fetching questions.'];
      }
    },
    resetQuestionsAndBack() {
      this.questionsLoaded = false;
      this.form.question1 = '';
      this.form.question2 = '';
      this.form.question3 = '';
      this.username = '';
      this.userId = null;
      this.step = 1;
      this.tempAnswers = { answer1: '', answer2: '', answer3: '' };
    }
  }
};
