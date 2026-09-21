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
      showIdNumber: false,
      showOtp: false,
      showAnswer1: false,
      showAnswer2: false,
      showAnswer3: false,
      otp: '',
      recoveryEmail: '',
      otpSent: false,
      otpVerified: false,
      rateLimitSeconds: 0,
      rateLimitTimer: null,
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
        {choice: 'What is the name of the city where you were born?', value: 'What is the name of the city where you were born?'},
        {choice: 'What was your childhood nickname?', value: 'What was your childhood nickname?'},
        {choice: 'What is your favorite food?', value: 'What is your favorite food?'},
        {choice: 'What is your favorite game?', value: 'What is your favorite game?'},
      ],
      savedQuestions: [],
    };
  },
  computed: {
    maskedUsername() {
      const value = String(this.username || '');
      if (value.length <= 2) return value ? `${value[0]}*` : '';
      return `${value[0]}${'*'.repeat(value.length - 2)}${value[value.length - 1]}`;
    },
    maskedIdNumber() {
      const value = String(this.userId || '');
      if (!value) return '';

      const separatorIndex = value.indexOf('-');
      if (separatorIndex === -1) {
        return value.length <= 2
          ? `${value[0]}*`
          : `${value[0]}${'*'.repeat(value.length - 2)}${value[value.length - 1]}`;
      }

      const prefix = value.slice(0, separatorIndex);
      const suffix = value.slice(separatorIndex + 1);
      return `${prefix[0]}${'*'.repeat(Math.max(0, prefix.length - 1))}-${'*'.repeat(Math.max(0, suffix.length - 1))}${suffix.slice(-1)}`;
    },
    maskedRecoveryEmail() {
      const email = String(this.recoveryEmail || '').trim();
      const at = email.indexOf('@');
      if (at <= 0 || at === email.length - 1) return email;

      const local = email.slice(0, at);
      const domain = email.slice(at + 1);
      const visibleLocal = local.length <= 2 ? local[0] : local.slice(0, 2);
      const maskedLocal = `${visibleLocal}${'*'.repeat(Math.max(1, local.length - visibleLocal.length))}`;
      return `${maskedLocal}@${domain}`;
    },
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
      const message = Array.isArray(w) ? (w[0] || '') : w;

      if (id === 'idNumber' && this.rateLimitSeconds > 0 && /only request this after \d+ seconds?/i.test(message)) {
        return `For security purposes, you can only request this after ${this.rateLimitSeconds} seconds.`;
      }

      return message;
    },
    startRateLimitCountdown(seconds) {
      if (this.rateLimitTimer) clearInterval(this.rateLimitTimer);

      this.rateLimitSeconds = Math.max(0, Number.parseInt(seconds, 10) || 0);
      if (!this.rateLimitSeconds) return;

      this.rateLimitTimer = setInterval(() => {
        this.rateLimitSeconds -= 1;
        if (this.rateLimitSeconds <= 0) {
          clearInterval(this.rateLimitTimer);
          this.rateLimitTimer = null;
          this.rateLimitSeconds = 0;

          // The rate-limit message is no longer relevant once the user can retry.
          if (this.warnings.idNumber?.some?.((message) => /only request this after \d+ seconds?/i.test(message))) {
            this.warnings.idNumber = [];
          }
        }
      }, 1000);
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

    validateQuestion(evt) {
      this.warnings[evt.target.id] = evt.target.value
        ? []
        : ['Please select a question.'];
      const answerId = evt.target.id.replace('question', 'answer');
      this.warnings[answerId] = [];
      this.isStep2Loading = false;
    },

    async goToStep4() {
      this.isStep2Loading = true;
      this.warnings.server = [];
      this.warnings.otp = [];

      const selectedQuestions = [this.form.question1, this.form.question2, this.form.question3];
      const questionKeys = ['question1', 'question2', 'question3'];
      let invalidQuestion = false;

      ['answer1', 'answer2', 'answer3'].forEach((key) => {
        this.warnings[key] = [];
      });

      selectedQuestions.forEach((question, index) => {
        if (!question) {
          this.warnings[questionKeys[index]] = ['Please select a question.'];
          invalidQuestion = true;
        } else if (this.savedQuestions[index] !== question) {
          this.warnings[questionKeys[index]] = [`This must match the saved Question ${index + 1}.`];
          invalidQuestion = true;
        } else {
          this.warnings[questionKeys[index]] = [];
        }
      });

      if (new Set(selectedQuestions.filter(Boolean)).size !== selectedQuestions.filter(Boolean).length) {
        questionKeys.forEach((key) => {
          this.warnings[key] = ['Please choose different questions.'];
        });
        invalidQuestion = true;
      }

      const answers = [this.form.answer1, this.form.answer2, this.form.answer3];
      answers.forEach((answer, index) => {
        const key = `answer${index + 1}`;
        const value = String(answer || '').trim();
        this.warnings[key] = value ? [] : ['Answer is required.'];
        if (!value) invalidQuestion = true;
      });

      if (invalidQuestion) {
        for (let index = 0; index < 3; index += 1) {
          if (this.warnings[questionKeys[index]].length > 0 && answers[index]) {
            this.warnings[`answer${index + 1}`] = [
              `Answer ${index + 1} cannot be verified with the selected question.`
            ];
          } else if (this.warnings[questionKeys[index]].length === 0 && answers[index]) {
            const { data: answerMatches } = await supabase.rpc('verify_security_answer', {
              p_id_number: this.idNumber,
              p_question: selectedQuestions[index],
              p_answer: answers[index],
              p_position: index
            });
            if (!answerMatches) this.warnings[`answer${index + 1}`] = [`Answer ${index + 1} is incorrect.`];
          }
        }
        this.isStep2Loading = false;
        return;
      }

      try {
        const { data: matched, error } = await supabase.rpc('verify_security_answers_selected', {
          p_id_number: this.idNumber,
          p_question1: this.form.question1,
          p_question2: this.form.question2,
          p_question3: this.form.question3,
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
          const answerChecks = await Promise.all(
            selectedQuestions.map((question, index) => supabase.rpc('verify_security_answer', {
              p_id_number: this.idNumber,
              p_question: question,
              p_answer: answers[index],
              p_position: index
            }))
          );

          const correctAnswers = answerChecks.filter(({ data: answerMatches }) => answerMatches).length;

          if (correctAnswers >= 2) {
            this.warnings.answer1 = [];
            this.warnings.answer2 = [];
            this.warnings.answer3 = [];
            this.warnings.server = [];
            this.isStep2Loading = false;
            this.step = 4;
            return;
          }

          answerChecks.forEach(({ data: answerMatches, error: answerError }, index) => {
            const key = `answer${index + 1}`;
            this.warnings[key] = answerError || !answerMatches
              ? [`Answer ${index + 1} is incorrect.`]
              : [];
          });
          this.warnings.server = [];
          this.isStep2Loading = false;
          return;
        }

        this.warnings.server = [];
        this.step = 4;
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

      if (!this.otpVerified) {
        this.message = 'Verify the one-time PIN before changing your password.';
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

        const {
          data: { session },
          error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user?.id) {
          child.error = 'Your verification session expired. Please request a new OTP.';
          return;
        }

        if (String(session.user.email || '').trim().toLowerCase() !== this.recoveryEmail.trim().toLowerCase()) {
          child.error = 'The verified account does not match this ID number.';
          return;
        }

        const { error: resetError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (resetError) {
          child.error = resetError.message || 'Unable to change password.';
          return;
        }

        this.message = 'Password changed successfully.';

        child.success = "Successfully Changed Password";
        child.newPassword = "";
        child.confirmPassword = "";

        // End the recovery session so the next login explicitly uses the new password.
        await supabase.auth.signOut();

        // Reset form after success
        setTimeout(() => {
          this.step = 1;
          this.idNumber = '';
          this.warnings.idNumber = [];
          this.tempAnswers = { answer1: '', answer2: '', answer3: '' };
          this.otp = '';
          this.showIdNumber = false;
          this.showOtp = false;
          this.recoveryEmail = '';
          this.otpSent = false;
          this.otpVerified = false;
          this.$router.push("/login");
        }, 1500);

      } catch (err) {
        console.error(err);
        child.error = 'Unexpected error occurred while changing the password.';
      }
    },

    async submitReset() {
      if (this.step === 1) {
        if (this.validateIdNumber()) {
          await this.fetchQuestions();
        }
      } else if (this.step === 3) {
        if (!this.isStep2Loading) {
          await this.goToStep4();
        }
      } else if (this.step === 2) {
        await this.verifyOtp();
      } else if (this.step === 4) {
        await this.handleChangePassword();
      }
    },

    async verifyOtp() {
      this.warnings.server = [];
      this.warnings.otp = [];
      const token = this.otp.trim();

      if (!/^\d{8}$/.test(token)) {
        this.warnings.otp = ['Enter the 8-digit one-time PIN sent to your registered email.'];
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        email: this.recoveryEmail,
        token,
        type: 'email'
      });

      if (error) {
        this.warnings.otp = [error.message || 'Invalid or expired one-time PIN.'];
        return;
      }

      this.otpVerified = true;
      this.warnings.server = [];
      this.step = 3;
    },

    // Fetch security questions for the supplied id
    async fetchQuestions() {
      this.message = '';
      this.warnings.idNumber = [];
      this.rateLimitSeconds = 0;
      if (this.rateLimitTimer) {
        clearInterval(this.rateLimitTimer);
        this.rateLimitTimer = null;
      }

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
        this.savedQuestions = questions;
        const username = data[0].username;
        const userId = data[0].user_id;

        // Keep the complete registration question list in the dropdown.
        // The selected question is verified against this user's saved record
        // by verify_security_answers_selected.
        this.userId = this.idNumber;
        this.username = username;

        // Keep the questions blank so the user must select each one.
        this.form.question1 = '';
        this.form.question2 = '';
        this.form.question3 = '';
        this.questionsLoaded = true;
        this.message = '';
        const { data: recoveryStatus, error: statusError } = await supabase.rpc('get_recovery_account_status', {
          p_id_number: this.idNumber
        });

        if (statusError || !recoveryStatus?.ok) {
          this.warnings.idNumber = [
            recoveryStatus?.error || statusError?.message || 'Password recovery is unavailable for this account.'
          ];
          return;
        }

        const { data: recoveryEmail, error: emailError } = await supabase.rpc('get_recovery_email_by_id', {
          p_id_number: this.idNumber
        });

        if (emailError || !recoveryEmail) {
          this.warnings.idNumber = [emailError?.message || 'Unable to send a verification code.'];
          return;
        }

        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: recoveryEmail,
          options: {
            shouldCreateUser: false
          }
        });

        if (otpError) {
          const rateLimitMatch = (otpError.message || '').match(/(?:after|in) (\d+) seconds?/i);
          if (rateLimitMatch) this.startRateLimitCountdown(rateLimitMatch[1]);
          this.warnings.idNumber = [otpError.message || 'Unable to send a verification code.'];
          return;
        }

        this.recoveryEmail = recoveryEmail;
        this.otp = '';
        this.otpSent = true;
        this.otpVerified = false;
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
      this.otp = '';
      this.showIdNumber = false;
      this.showOtp = false;
      this.recoveryEmail = '';
      this.otpSent = false;
      this.otpVerified = false;
    }
  },
  beforeUnmount() {
    if (this.rateLimitTimer) clearInterval(this.rateLimitTimer);
  }
};
