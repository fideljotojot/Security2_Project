<template>
  <form action="" method="POST" @submit.prevent="login" style="padding: 1em 3em .8em;">
    <h1>Login</h1>

    <!-- central warning container (shows all current field messages) -->
    <div class="warning-container" v-if="allWarnings.length">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      <ul>
        <li v-for="(msg, idx) in allWarnings" :key="idx" class="warning">{{ msg }}</li>
      </ul>
    </div>

    <div class="form-content">
      <div class="form-group">
        <input type="text" v-model="username" id="username" name="username">
        <label for="username">Username:</label>
      </div>
      <div class="form-group password-group">
        <input
          :type="showPassword ? 'text' : 'password'"
          v-model="password"
          id="password"
          name="password"
          :disabled="lockoutActive"
        >
        <label for="password">Password:</label>
        <span class="toggle-password" @click="togglePassword">
          <!-- Show -->

          <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" />
          </svg>

          <!-- Hide -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
            <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
            <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
            <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
          </svg>

        </span>
      </div>
    </div>
    <div class="btn-container" style="margin-top: .4em;">
        <button class="btn mb-4" type="submit" :disabled="lockoutActive">
          {{ lockoutActive ? `Try again in ${lockoutTimeRemaining}s` : "LOGIN" }}
        </button>
    </div>

    <a v-if="consecutiveError >= 2"
      @click="!lockoutActive && handleForgotPassword()"
      :class="{ disabled: lockoutActive }"
    >Forgot Password</a>
  </form>
</template>

<script>
import { setCanAccessForgotPassword } from '../router.js';
import loginLogic from '../assets/JS/login.js';

export default {
  ...loginLogic,
  methods: {
    ...loginLogic.methods,
    handleForgotPassword() {
      setCanAccessForgotPassword(true);
      this.$router.push('/forgot');
    }
  },
  emits: ['lockout-changed']
}
</script>

<style src="../assets/CSS/login.css"></style>
