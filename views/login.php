<?php
// views/login.php - converted from LoginForm.vue
?>
<form id="login-form" method="POST">
  <h1>Login</h1>
  <div class="form-content">
    <div class="form-group">
      <input type="text" id="username" name="username" required>
      <label for="username">Username:</label>
    </div>
    <div class="form-group">
      <input type="password" id="password" name="password" required>
      <label for="password">Password:</label>
    </div>
    <div class="btn-container">
      <button class="btn mb-4" type="submit" id="login-button">Login</button>
    </div>
    <small id="login-error" style="color:#b00020;display:none"></small>
  </div>
</form>

<script>
(function(){
  const form = document.getElementById('login-form')
  const errorEl = document.getElementById('login-error')
  const button = document.getElementById('login-button')

  form.addEventListener('submit', async function(e){
    e.preventDefault()
    errorEl.style.display = 'none'
    button.disabled = true
    const username = document.getElementById('username').value.trim()
    const password = document.getElementById('password').value
    try {
      const res = await fetch('/api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Login failed')
      }
      // Save session to localStorage to mimic SPA behavior
      localStorage.setItem('sessionUser', JSON.stringify(data.user))
      // Redirect to dashboard
      window.location.href = '?page=dashboard'
    } catch (err) {
      errorEl.textContent = err.message
      errorEl.style.display = 'block'
    } finally {
      button.disabled = false
    }
  })
})()
</script>

<link rel="stylesheet" href="src/assets/CSS/login.css">
