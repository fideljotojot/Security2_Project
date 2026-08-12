<?php
// app.php - simple PHP entry converted from App.vue
// Usage: open this file through a PHP server, e.g. php -S localhost:8000

// whitelist of pages to avoid file inclusion issues
$pages = ['home' => 'views/home.php', 'login' => 'views/login.php', 'signup' => 'views/signup.php', 'dashboard' => 'views/dashboard.php'];
$page = 'home';
if (isset($_GET['page']) && array_key_exists($_GET['page'], $pages)) {
  $page = $_GET['page'];
}
?>
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>FindMyProf</title>
    <link rel="icon" href="public/favicon.ico">
    <?php
    // Attempt to load Vite dev server assets when available (DEV) otherwise use built assets (PROD)
    $viteDev = @file_get_contents('http://localhost:5173/favicon.ico'); // small probe
    if ($viteDev !== false) {
      // Vite dev server likely running
      echo "    <script type=\"module\" src=\"http://localhost:5173/@vite/client\"></script>\n";
      echo "    <script type=\"module\" src=\"http://localhost:5173/src/main.js\"></script>\n";
    } else {
      // Production / built fallback - include static CSS/JS if present
      if (file_exists(__DIR__ . '/dist/assets/main.css')) {
        echo '    <link rel="stylesheet" href="/dist/assets/main.css">\n';
      } else {
        // also include source CSS as a minimal fallback
        echo '    <link rel="stylesheet" href="src/assets/main.css">\n';
      }
      if (file_exists(__DIR__ . '/dist/assets/main.js')) {
        echo '    <script type="module" src="/dist/assets/main.js"></script>\n';
      } else {
        // no built JS available; still include source main for non-module fallback
        echo '    <script type="module" src="src/main.js"></script>\n';
      }
    }
    ?>
    <style>
      /* Basic styles ported from App.vue scoped styles */
      body, html, #app { height: 100%; margin: 0; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif }
      #app { min-height: 100vh; display:flex; flex-direction:column; background-image: linear-gradient(rgba(0,0,0,0.4),rgba(0,0,0,0.4)), url('src/assets/images/background.jpg'); background-size:cover }
      header { display:flex; justify-content:flex-end; align-items:center; padding:1em; background-color:#008000 }
      .portal { background-color: #bcf9bc86 }
      header img { height:3em; position:absolute; left:1em; border-radius:50%; object-fit:cover }
      header .header-btn { display:flex; gap:1em }
      header .header-btn button { padding:.6em .8em; border:none; border-radius:1em; text-transform:uppercase; font-weight:600 }
      .dark-btn { background-color:#625b71; color:#fff }
      main { flex:1; display:flex }
      .page-container { display:flex; width:100%; justify-content:center; align-items:center; padding:0 }
      .logo-container { flex:1; display:flex; justify-content:center }
      .logo-container img { margin:auto; width:30em }
      .form-container { flex:1; display:flex; justify-content:center; align-items:center; height:90%; border-left:1px solid grey }
      .form-box { width:fit-content; height:fit-content; padding:1em 2.5em 2em; border-radius:1em; background:rgba(255,255,255,0.8); backdrop-filter:blur(10px); box-shadow:0 8px 32px rgba(0,0,0,0.2) }
      footer { color:#716C6C; margin-top:auto; text-align:center; background-color:#ADEDAD; padding:.5em; font-size:.8em }
    </style>
  </head>
  <body>
    <div id="app">
      <?php if ($page === 'signup' || $page === 'login' || $page === 'home'): ?>
        <header class="<?= $page === 'signup' || $page === 'login' ? 'portal' : '' ?>">
          <img src="src/assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
          <div class="header-btn">
            <?php if ($page !== 'home'): ?>
              <button onclick="window.location='?page=home'" class="dark-btn">Home</button>
            <?php endif; ?>
            <?php if ($page === 'signup'): ?>
              <button onclick="window.location='?page=login'">Login</button>
            <?php elseif ($page === 'login'): ?>
              <button onclick="window.location='?page=signup'">Sign Up</button>
            <?php else: ?>
              <button onclick="window.location='?page=login'" class="dark-btn">Login</button>
              <button onclick="window.location='?page=signup'">Sign Up</button>
            <?php endif; ?>
          </div>
        </header>
      <?php elseif ($page === 'dashboard'): ?>
        <header>
          <img src="src/assets/images/Caraga_State_University_-_Cabadbaran_Campus_logo_(Reduced).png" alt="Logo">
          <div class="header-btn">
            <button id="logout-btn">Logout</button>
          </div>
        </header>
      <?php endif; ?>

      <main>
        <div class="page-container">
          <?php if ($page === 'signup' || $page === 'login'): ?>
            <div class="logo-container"><img src="src/assets/images/findmyprof-3.png" alt="Logo"></div>
            <div class="form-container"><div class="form-box"><?php include $pages[$page]; ?></div></div>
          <?php elseif ($page === 'dashboard'): ?>
            <div class="page-container"><?php include $pages[$page]; ?></div>
          <?php else: ?>
            <div class="page-container"><?php include $pages['home']; ?></div>
          <?php endif; ?>
        </div>
      </main>

      <footer>
        <p>&copy; 2025 www.handy.com - All Rights Reserved</p>
      </footer>
    </div>

    <script>
      // logout handler
      document.getElementById('logout-btn')?.addEventListener('click', function(){
        localStorage.removeItem('sessionUser');
        window.location.href = '?page=login';
      })
    </script>
  </body>
  </html>
