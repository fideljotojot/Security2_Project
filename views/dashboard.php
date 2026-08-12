<?php
// views/dashboard.php - converted from UserDashboard.vue
?>
<div class="dashboard">
  <h1>Dashboard</h1>
  <p id="welcome">Welcome!</p>
</div>

<script>
  (function(){
    const el = document.getElementById('welcome')
    const saved = localStorage.getItem('sessionUser')
    if (saved) {
      try {
        const user = JSON.parse(saved)
        el.textContent = `Welcome, ${user.firstName || ''} ${user.lastName || ''} (${user.username || ''})`
      } catch(_) { el.textContent = 'Welcome!'}
    }
  })()
</script>
