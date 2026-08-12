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

<style>
form {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
}

h1 {
  font-weight: bolder;
  text-transform: uppercase;
}

.form-content {
  width: 25em;
  height: 20em;
  gap: 1em;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #9b9b8cae;
  padding: 1em 2em;
  border-radius: 1em;
  margin: auto 0;
}

.form-group label {
  text-align: start;
  margin-left: 1em;
}

.form-group {
  display: flex;
  flex-direction: column-reverse;
  gap: .2em;
}

.form-group input, select {
  width: 100%;
  align-self: center;
  padding: .5em .5em .5em 1em;
  border-radius: 1em;
  border: 1px solid #111;
}

.btn-container {
  display: flex;
  gap: 1em;
  width: 100%;
  justify-content: center;
}

.btn {
  border-radius: .9em;
  padding: .8em 1.5em;
  border: none;
  background-color: #7D8D86;
  box-shadow: 1px 1px 1px #00000095;
  color: #F1F0E4;
  font-size: .9em;
}
</style>
