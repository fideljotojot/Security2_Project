<template>
  <form method="POST" @submit.prevent="register">
    <h1>Sign Up</h1>

    <div class="steps">
      <div class="step-indicator">
        <div
          v-for="(stepInfo, index) in steps"
          :key="stepInfo.id"
          class="step-item"
          :class="{
            'active': step === stepInfo.id,
            'completed': isStepCompleted(stepInfo.id)
          }"
        >
          <div class="step-number">{{ index + 1 }}</div>
          <div class="step-label">{{ stepInfo.label }}</div>
        </div>
      </div>
    </div>
      <!-- success message container -->
      <div class="success-container" v-if="successMessage">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <p>{{ successMessage }}</p>
      </div>

      <!-- central warning container (shows all current field messages) -->
      <div class="warning-container" v-if="allWarnings.length">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <ul>
          <li v-for="(msg, idx) in allWarnings" :key="idx" class="warning">{{ msg }}</li>
        </ul>
      </div>

    <div class="form-content" v-if="step === 'personal'">
      <div class="header">
        <h3>Personal Details</h3>
      </div>
      <hr>
      <div class="registration-box">
        <div class="form-group">
          <input type="text" id="fname" name="fname" v-model="form.firstName" required @input="validateName">
          <label for="fname">First Name: <span>*</span></label>
        </div>
        <div class="form-group">
          <input type="text" id="mname" name="mname" v-model="form.middleInitial" required @input="validateMname">
          <label for="mname">Middle Initial: <span class="optional">(Optional)</span></label>
        </div>
        <div class="form-group">
          <input type="text" id="lname" name="lname" v-model="form.lastName" required @input="validateName">
          <label for="lname">Last Name: <span>*</span></label>
        </div>
        <div class="form-group">
          <input type="text" id="suffix" name="suffix" placeholder="Jr, Sr, III, etc." v-model="form.suffix" @input="validateSuffix">
          <label for="suffix">Suffix: <span class="optional">(Optional)</span></label>
        </div>
        <div class="form-group">
          <input type="date" id="birthdate" name="birthdate" v-model="form.birthdate" required @input="onBirthInput">
          <label for="birthdate">Birthdate: <span>*</span></label>
        </div>
        <div class="form-group">
          <input type="number" id="age" name="age" v-model="form.age" required readonly>
          <label for="age">Age: <span>*</span></label>
        </div>
        <div class="form-group">
          <select name="sex" id="sex" v-model="form.sex" required>
              <option value="male">Male</option>
              <option value="female">Female</option>
          </select>
          <label for="mname">Sex: <span>*</span></label>
        </div>
        <div class="form-group">
          <input type="email" id="email" name="email" v-model="form.email" required @input="checkEmail">
          <label for="email">Email: <span>*</span></label>
        </div>
      </div>
      <button type="button" @click="step = 'login_details'" class="btn" :disabled="!canProceedPersonal">Next</button>
    </div>

    <div class="form-content" v-if="step === 'login_details'">
      <div class="header">
        <h3>Address & Login Details</h3>
      </div>
      <hr>
      <div class="registration-box">
        <!-- Address Fields -->
        <div class="form-group">
          <input type="text" id="purok" name="purok" v-model="form.purok" required @input="validateStreet">
          <label for="purok">Purok: <span>*</span></label>
        </div>
        <div class="form-group">
          <input type="text" id="barangay" name="barangay" v-model="form.barangay" required @input="validateBrgy">
          <label for="barangay">Barangay: <span>*</span></label>
        </div>
        <div class="form-group">
          <input type="text" id="city" name="city" v-model="form.city" required @input="validateCity">
          <label for="city">City/Municipality: <span>*</span></label>
        </div>
        <div class="form-group">
          <input type="text" id="province" name="province" v-model="form.province" required @input="validateProvince">
          <label for="province">Province: <span>*</span></label>
        </div>
        <div class="form-group">
          <input type="text" id="country" name="country" v-model="form.country" required @input="validateCountry">
          <label for="country">Country: <span>*</span></label>
        </div>
        <div class="form-group">
          <input type="number" id="zip" name="zip" v-model="form.zip" required @input="validateZipcode">
          <label for="zip">Zip Code: <span>*</span></label>
        </div>
        <!-- Login Details Fields -->
        <div class="form-group">
          <input type="text" id="user_id" name="user_id" v-model="form.id" required @input="checkID">
          <label for="id">ID No. <span>*</span></label>
        </div>
        <div class="form-group">
          <input type="text" id="username" name="username" v-model="form.username" required @input="checkUsername">
          <label for="username">Username: <span>*</span></label>
        </div>
        <div class="form-group">
          <input :type="showPassword ? 'text' : 'password'" id="password" name="password" v-model="form.password" required @input="validatePassword">
          <label for="password">Password: <span>*</span></label>

          <!-- Show/Hide Password Icon -->
          <svg v-if="!showPassword" @click="showPassword = !showPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" />
          </svg>
          <svg v-else @click="showPassword = !showPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
            <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
            <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
            <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
          </svg>

          <!-- Password Strength Display -->
          <div v-if="form.password" class="password-strength">
            <p class="strength-text">{{ passwordStrengthLabel }}</p>
            <div class="strength-bar" :class="passwordStrengthClass"></div>
          </div>
        </div>
        <div class="form-group">
          <input :type="showRePassword ? 'text' : 'password'" id="repassword" name="repassword" v-model="form.repassword" required @input="validateConfirmPassword">
          <label for="repassword">Re-enter Password: <span>*</span></label>

          <!-- Show/Hide Password Icon -->
          <svg v-if="!showRePassword" @click="showRePassword = !showRePassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" />
          </svg>
          <svg v-else @click="showRePassword = !showRePassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
            <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
            <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
            <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
          </svg>
        </div>
      </div>
      <div class="btn-container">
        <button type="button" @click="step = 'personal'" class="btn">Back</button>
        <button type="button" @click="step = 'questions'" class="btn" :disabled="!canProceedLoginDetails">Next</button>
      </div>
    </div>

    <div class="form-content" v-if="step === 'questions'">
      <div class="header">
        <h3>Authentication Questions</h3>
      </div>
      <hr>
      <div class="registration-box" style="display: flex; flex-direction: column; justify-content: center;">
        <div class="form-group">
          <div class="form-group">
            <input type="text" id="answer1" v-model="form.answer1" required @input="validateAnswer">
            <label for="answer1" class="question-label">Answer 1: <span>*</span></label>
          </div>

          <div class="form-group">
            <select id="question1" v-model="form.question1" required>
              <option disabled value="">-- Select a question --</option>
              <option
                v-for="(q, index) in questionList"
                :key="'q1-' + index"
                :value="q.choice"
                :disabled="[form.question2, form.question3].includes(q.choice)"
              >
                {{ q.choice }}
            </option>
            </select>
            <label for="question1" class="question-label">Question 1: <span>*</span></label>
          </div>
        </div>

        <div class="form-group">
          <div class="form-group">
            <input type="text" id="answer2" v-model="form.answer2" required @input="validateAnswer">
            <label for="answer2" class="question-label">Answer 2: <span>*</span></label>
          </div>

          <div class="form-group">
            <select id="question2" v-model="form.question2" required>
              <option disabled value="">-- Select a question --</option>
              <option
                  v-for="(q, index) in questionList"
                  :key="'q1-' + index"
                  :value="q.choice"
                  :disabled="[form.question1, form.question3].includes(q.choice)"
                >
                  {{ q.choice }}
              </option>
            </select>
            <label for="question2" class="question-label">Question 2: <span>*</span></label>
          </div>
        </div>

        <div class="form-group">
          <div class="form-group">
            <input type="text" id="answer3" v-model="form.answer3" required @input="validateAnswer">
            <label for="answer3" class="question-label">Answer 3: <span>*</span></label>
          </div>

          <div class="form-group">
            <select id="question3" v-model="form.question3" required>
              <option disabled value="">-- Select a question --</option>
              <option
                  v-for="(q, index) in questionList"
                  :key="'q1-' + index"
                  :value="q.choice"
                  :disabled="[form.question1, form.question2, form.question3].includes(q.choice)"
                >
                  {{ q.choice }}
              </option>
            </select>
            <label for="question3" class="question-label">Question 3: <span>*</span></label>
          </div>
        </div>
      </div>


      <div class="btn-container">
        <button type="button" @click="step = 'login_details'" class="btn">Back</button>
        <button type="submit" class="btn" :disabled="!canSubmitRegister">Register</button>
      </div>
    </div>
</form>
</template>

<script src="../assets/JS/signup.js"></script>

<style src="../assets/CSS/signup.css" scoped></style>
