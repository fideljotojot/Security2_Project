<template>
  <h1>Change Password</h1>
  <hr>

    <div
      class="warning-container"
      v-if="allWarnings.length || error || success"
      :class="{
        'warning-success': success,
        'warning-error': error,
        'warning-default': allWarnings.length && !error && !success
      }"
    >
      <svg v-if="success"  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6" :class="{'warning-success': success}"
      >
        <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd"/>
      </svg>

      <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>
      </svg>

      <ul>
        <p v-if="warnings.idNumber && warnings.idNumber.length" class="warning">
          {{ warnings.idNumber[0] }}
        </p>
        <li v-for="(msg, i) in allWarnings" :key="i" class="warning">{{ msg }}</li>
        <li v-if="error" class="warning">{{ error }}</li>
        <li v-if="success" class="success">{{ success }}</li>
      </ul>

  </div>

  <div v-if="newPassword" class="password-strength-container">
    <p class="strength-text">{{ passwordStrengthLabel }}</p>
    <div class="strength-bar-background">
      <div class="strength-bar-fill" :class="passwordStrengthClass" :style="{ width: strengthWidth }"></div>
    </div>
  </div>

  <!-- New Password -->
  <div class="form-group password-group">
    <input
      :type="showNewPassword ? 'text' : 'password'"
      id="newPassword"
      v-model.trim="newPassword"
      required
      placeholder="Enter new password"
       @input="validatePassword"
    />
    <label for="newPassword">New Password</label>


    <span class="toggle-password" @click="togglePassword('new')">
      <!-- Show -->
      <svg
        v-if="!showNewPassword"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="eye-icon"
      >
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path
          fill-rule="evenodd"
          d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
          clip-rule="evenodd"
        />
      </svg>

      <!-- Hide -->
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="eye-icon"
      >
        <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
        <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
        <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
      </svg>
    </span>
  </div>

  <!-- Confirm Password -->
  <div class="form-group password-group">
    <input
      :type="showConfirmPassword ? 'text' : 'password'"
      id="confirmPassword"
      v-model.trim="confirmPassword"
      required
      placeholder="Confirm new password"
      @input="validateConfirmPassword"
    />
    <label for="confirmPassword">Confirm New Password</label>
    <span class="toggle-password" @click="togglePassword('confirm')">
      <!-- Show -->
      <svg
        v-if="!showConfirmPassword"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="eye-icon"
      >
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path
          fill-rule="evenodd"
          d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
          clip-rule="evenodd"
        />
      </svg>

      <!-- Hide -->
      <svg
        v-if="showConfirmPassword"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="eye-icon"
      >
        <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
        <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
        <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
      </svg>
    </span>
  </div>
</template>

<script>
import changePasswordLogic from '../assets/JS/changepassword.js';

export default changePasswordLogic;
</script>

<style src="../assets/CSS/change_password.css" scoped></style>
