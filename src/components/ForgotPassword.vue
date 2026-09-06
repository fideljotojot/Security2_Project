<template>
    <form @submit.prevent="submitReset">
      <div class="form-content" v-if="step === 1">
        <h1>Forgot Password</h1>
        <div class="header">
          <h3>Account Detail</h3>
        </div>
        <hr>
        <div class="registration-box">
          <div class="form-group">
            <div class="form-group">
              <span class="field-warning" v-if="getWarning('idNumber')">{{ getWarning('idNumber') }}</span>
              <input type="text" v-model="idNumber" id="idNumber" name="idNumber" @input="validateIdNumber">
              <label for="idNumber">ID Number:</label>
            </div>
          </div>
        </div>
      </div>

      <div class="form-content" v-if="step === 2">
        <h1>Forgot Password</h1>
        <div class="account-info" v-if="username && userId">
          <p><strong>Username:</strong> {{ username }}</p>
          <p><strong>ID:</strong> {{ userId }}</p>
        </div>
        <div class="header">
          <h3>Authentication Questions</h3>
        </div>
        <hr>
        <!-- central warning container (shows general/server errors only) -->
        <div class="warning-container" v-if="warnings.server && warnings.server.length">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <ul>
            <li v-for="(msg, idx) in warnings.server" :key="idx" class="warning">{{ msg }}</li>
          </ul>
        </div>
        <div class="registration-box">
          <div class="form-group">
            <div class="form-group">
              <span class="field-warning" v-if="getWarning('answer1')">{{ getWarning('answer1') }}</span>
              <div class="password-input-wrapper answer-input-wrapper">
                <input :type="showAnswer1 ? 'text' : 'password'" id="answer1" v-model="form.answer1" required @input="validateAnswer" autocomplete="off">
                <button type="button" class="answer-toggle eye-icon"
                  :aria-label="showAnswer1 ? 'Hide answer 1' : 'Show answer 1'" @click="showAnswer1 = !showAnswer1">
                  <svg v-if="!showAnswer1" xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    <path fill-rule="evenodd"
                      d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
                      clip-rule="evenodd" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                    fill="currentColor" class="size-6 eye-icon">
                    <path
                      d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                    <path
                      d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                    <path
                      d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
                  </svg>
                </button>
              </div>
              <label for="answer1" class="question-label">Answer 1: <span>*</span></label>
            </div>

            <div class="form-group">
              <input type="text" id="question1" v-model="form.question1" disabled class="question-display" />
              <label for="question1" class="question-label">Question 1: <span>*</span></label>
            </div>
          </div>

          <div class="form-group">
            <div class="form-group">
              <span class="field-warning" v-if="getWarning('answer2')">{{ getWarning('answer2') }}</span>
              <div class="password-input-wrapper answer-input-wrapper">
                <input :type="showAnswer2 ? 'text' : 'password'" id="answer2" v-model="form.answer2" required @input="validateAnswer" autocomplete="off">
                <button type="button" class="answer-toggle eye-icon"
                  :aria-label="showAnswer2 ? 'Hide answer 2' : 'Show answer 2'" @click="showAnswer2 = !showAnswer2">
                  <svg v-if="!showAnswer2" xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    <path fill-rule="evenodd"
                      d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
                      clip-rule="evenodd" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                    fill="currentColor" class="size-6 eye-icon">
                    <path
                      d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                    <path
                      d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                    <path
                      d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
                  </svg>
                </button>
              </div>
              <label for="answer2" class="question-label">Answer 2: <span>*</span></label>
            </div>

            <div class="form-group">
              <input type="text" id="question2" v-model="form.question2" disabled class="question-display" />
              <label for="question2" class="question-label">Question 2: <span>*</span></label>
            </div>
          </div>
            <div class="form-group">
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('answer3')">{{ getWarning('answer3') }}</span>
                <div class="password-input-wrapper answer-input-wrapper">
                  <input :type="showAnswer3 ? 'text' : 'password'" id="answer3" v-model="form.answer3" required @input="validateAnswer" autocomplete="off">
                  <button type="button" class="answer-toggle eye-icon"
                    :aria-label="showAnswer3 ? 'Hide answer 3' : 'Show answer 3'" @click="showAnswer3 = !showAnswer3">
                    <svg v-if="!showAnswer3" xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
                      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                      <path fill-rule="evenodd"
                        d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
                        clip-rule="evenodd" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                      fill="currentColor" class="size-6 eye-icon">
                      <path
                        d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                      <path
                        d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                      <path
                        d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
                    </svg>
                  </button>
                </div>
                <label for="answer3" class="question-label">Answer 3: <span>*</span></label>
              </div>

              <div class="form-group">
                <input type="text" id="question3" v-model="form.question3" disabled class="question-display" />
                <label for="question3" class="question-label">Question 3: <span>*</span></label>
              </div>
            </div>
        </div>
      </div>

      <div class="form-content" v-if="step === 3">
        <ChangePassword :id-number="idNumber" ref="changePasswordComponent"/>
      </div>

      <div class="btn-container" v-if="step === 1">
        <button type="button" @click="$router.push('/login')" class="btn">Back</button>
        <button type="button"
          @click="() => { if (validateIdNumber()) fetchQuestions(); }"
          class="btn"
          :disabled="!isIdValid">
          Next
        </button>
      </div>

      <div class="btn-container" v-if="step === 2">
        <button type="button" @click="resetQuestionsAndBack" class="btn">Back</button>
        <button type="submit"
          @click="goToStep3"
          class="btn"
          :disabled="!isStep2Valid || isStep2Loading"
        >
          Next
        </button>
      </div>

      <div class="btn-container" v-if="step === 3">
        <button type="button" @click="step = 2" class="btn">Back</button>
        <button type="button" @click="handleChangePassword" class="btn">Change Password</button>
      </div>
    </form>
</template>

<script>
import forgotPasswordLogic from '../assets/JS/forgotpassword.js';

export default forgotPasswordLogic;
</script>

<style src="../assets/CSS/forgot_password.css" scoped></style>
