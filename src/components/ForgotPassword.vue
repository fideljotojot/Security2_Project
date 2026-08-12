<template>
    <form @submit.prevent="submitReset">
      <div class="form-content" v-if="step === 1">
        <h1>Forgot Password</h1>
        <div class="header">
          <h3>Account Detail</h3>
        </div>
        <hr>
        <div class="warning-container" v-if="warnings.idNumber && warnings.idNumber.length">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <ul>
            <li v-for="(msg, idx) in warnings.idNumber" :key="idx" class="warning">{{ msg }}</li>
          </ul>
        </div>
        <div class="registration-box">
          <div class="form-group">
            <div class="form-group">
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
        <div class="warning-container" v-if="allWarnings.length">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <ul>
            <li v-for="(msg, idx) in allWarnings" :key="idx" class="warning">{{ msg }}</li>
          </ul>
        </div>
        <div class="registration-box">
          <div class="form-group">
            <div class="form-group">
              <input type="text" id="answer1" v-model="form.answer1" required @input="validateAnswer">
              <label for="answer1" class="question-label">Answer 1: <span>*</span></label>
            </div>

            <div class="form-group">
              <input type="text" id="question1" v-model="form.question1" disabled class="question-display" />
              <label for="question1" class="question-label">Question 1: <span>*</span></label>
            </div>
          </div>

          <div class="form-group">
            <div class="form-group">
              <input type="text" id="answer2" v-model="form.answer2" required @input="validateAnswer">
              <label for="answer2" class="question-label">Answer 2: <span>*</span></label>
            </div>

            <div class="form-group">
              <input type="text" id="question2" v-model="form.question2" disabled class="question-display" />
              <label for="question2" class="question-label">Question 2: <span>*</span></label>
            </div>
          </div>
            <div class="form-group">
              <div class="form-group">
                <input type="text" id="answer3" v-model="form.answer3" required @input="validateAnswer">
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
