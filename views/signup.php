<?php
// views/signup.php
?>
<form id="signup-form">
  <h1>Register</h1>

  <!-- Warning container for global messages -->
  <div id="password-strength-container" style="margin-bottom:1em;text-align:center;"></div>

  <div class="form-content" data-step="personal">
    <div class="header"><h3>Personal Details</h3></div>
    <hr>
    <div class="registration-box">
      <div class="form-group"><input type="text" id="fname" required><label for="fname">First Name:</label></div>
      <div class="form-group"><input type="text" id="mname" required><label for="mname">Middle Initial:</label></div>
      <div class="form-group"><input type="text" id="lname" required><label for="lname">Last Name:</label></div>
      <div class="form-group"><input type="text" id="suffix"><label for="suffix">Suffix:</label></div>
      <div class="form-group">
        <input type="email" id="email" required>
        <label for="email">Email:</label>
        <small id="email-warning" style="color:#b00020; font-size:0.9em; margin-left:1em;"></small>
      </div>
      <div class="form-group"><input type="date" id="birthdate" required><label for="birthdate">Birthdate:</label></div>
      <div class="form-group">
        <small id="age-warning" class="warning"></small>
        <input type="text" id="age" readonly required><label for="age">Age:</label>
      </div>
      <div class="form-group"><select id="sex"><option value="male">Male</option><option value="female">Female</option></select><label for="sex">Sex:</label></div>
    </div>
    <button type="button" class="btn" data-action="next">Next</button>
  </div>

  <div class="form-content" data-step="address" style="display:none">
    <div class="header"><h3>Address</h3></div>
    <hr>
    <div class="registration-box">
      <div class="form-group"><input type="text" id="purok" required><label for="purok">Purok:</label></div>
      <div class="form-group"><input type="text" id="barangay" required><label for="barangay">Barangay:</label></div>
      <div class="form-group"><input type="text" id="city" required><label for="city">City/Municipality:</label></div>
      <div class="form-group"><input type="text" id="province" required><label for="province">Province:</label></div>
      <div class="form-group"><input type="text" id="country" required><label for="country">Country:</label></div>
      <div class="form-group"><input type="text" id="zip" required><label for="zip">Zip Code:</label></div>
    </div>
    <div class="btn-container">
      <button type="button" class="btn" data-action="back">Back</button>
      <button type="button" class="btn" data-action="next">Next</button>
    </div>
  </div>

  <div class="form-content" data-step="login_details" style="display:none">
    <div class="header"><h3>Login Details</h3></div>
    <hr>
    <div class="registration-box">
      <div class="form-group"><input type="text" id="id" required><label for="id">ID No.</label></div>
      <div class="form-group"><input type="text" id="username" required><label for="username">Username:</label></div>
      <!-- Password input with strength meter -->
      <div class="form-group">
        <input type="password" id="password" required>
        <label for="password">Password:</label>
        <small id="password-strength" style="color:#333; font-size:0.9em; margin-left:1em;"></small>
      </div>
      <div class="form-group"><input type="password" id="repassword" required><label for="repassword">Re-enter Password:</label></div>
    </div>
    <div class="btn-container">
      <button type="button" class="btn" data-action="back">Back</button>
      <button type="button" class="btn" id="register-btn">Register</button>
    </div>
    <small id="signup-error" style="color:#b00020;display:none"></small>
  </div>
</form>

<script>
(function(){
  const steps = ['personal','address','login_details'];
  let idx = 0;
  const forms = steps.map(s => document.querySelector(`[data-step="${s}"]`));
  function show() {
    forms.forEach((el,i)=> el.style.display = i===idx? 'block':'none');
  }
  document.querySelectorAll('[data-action="next"]').forEach(b=>b.addEventListener('click', ()=>{ idx = Math.min(idx+1, steps.length-1); show(); }));
  document.querySelectorAll('[data-action="back"]').forEach(b=>b.addEventListener('click', ()=>{ idx = Math.max(idx-1,0); show(); }));

  // --- AGE CALCULATION ---
  document.getElementById('birthdate').addEventListener('input', function(){
    const dob = this.value;
    const ageEl = document.getElementById('age');
    const warn = document.getElementById('age-warning');
    if (!dob) { ageEl.value=''; warn.textContent=''; return; }
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear()-dobDate.getFullYear();
    const m = today.getMonth()-dobDate.getMonth();
    if (m<0 || (m===0 && today.getDate()<dobDate.getDate())) age--;
    ageEl.value = isNaN(age)?'':String(age);
    if (isNaN(age) || age<0) warn.textContent='Age is invalid!';
    else if (age<18) warn.textContent='Age is below 18 years old';
    else warn.textContent='';
  });

  // --- PASSWORD STRENGTH CHECKER ---
  const passwordInput = document.getElementById('password');
  const strengthText = document.getElementById('password-strength');
  passwordInput.addEventListener('input', function(){
    const val = passwordInput.value;
    let strength = 0;
    if (val.length >= 8) strength++;
    if (/[A-Z]/.test(val)) strength++;
    if (/[a-z]/.test(val)) strength++;
    if (/[0-9]/.test(val)) strength++;
    if (/[^A-Za-z0-9]/.test(val)) strength++;

    let text = '';
    let color = '#b00020';
    switch(strength){
      case 0:
      case 1: text = 'Weak'; color = '#b00020'; break;
      case 2: text = 'Fair'; color = '#e67e22'; break;
      case 3: text = 'Good'; color = '#f1c40f'; break;
      case 4: text = 'Strong'; color = '#2ecc71'; break;
      case 5: text = 'Very Strong'; color = '#27ae60'; break;
    }
    strengthText.textContent = text;
    strengthText.style.color = color;
  });

  // --- REGISTER ---
  document.getElementById('register-btn').addEventListener('click', async function(){
    const errorEl = document.getElementById('signup-error');
    errorEl.style.display='none';
    const password = document.getElementById('password').value;
    const repassword = document.getElementById('repassword').value;
    if (password !== repassword) { alert('Passwords do not match'); return; }

    const payload = {
      username: document.getElementById('username').value.trim(),
      email: document.getElementById('email').value.trim(),
      password,
      profile: {
        firstName: document.getElementById('fname').value,
        middleInitial: document.getElementById('mname').value,
        lastName: document.getElementById('lname').value,
        suffix: document.getElementById('suffix').value,
        birthdate: document.getElementById('birthdate').value || null,
        age: document.getElementById('age').value? Number(document.getElementById('age').value): null,
        sex: document.getElementById('sex').value
      },
      address: {
        purok: document.getElementById('purok').value,
        barangay: document.getElementById('barangay').value,
        city: document.getElementById('city').value,
        province: document.getElementById('province').value,
        country: document.getElementById('country').value,
        zip: document.getElementById('zip').value
      }
    };
    try {
      const res = await fetch('/api/register.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Registration failed');
      alert('Registration successful. You can now log in.');
      window.location.href = '?page=login';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });
})();
</script>

<style>
form { height: 100%; display:flex; flex-direction:column; align-items:center; gap:1em }
.form-content { width:100%; height:80%; gap:.5em; display:flex; flex-direction:column; align-items:center; justify-content:center; background-color:#9b9b8cae; padding:1.5em 2em; border-radius:1em; margin:auto }
.registration-box { display:grid; grid-template-columns: repeat(2, 1fr); gap:1em 1em .5em 1em; width:100% }
.form-group { display:flex; flex-direction:column-reverse; gap:.2em }
.form-group label { text-align:start; margin-left:1em }
.form-group input, select { width:90%; align-self:center; padding:.5em .5em .5em 1em; border-radius:1em; border:1px solid #111 }
.header { width:100%; text-align:start; margin-left:1em }
h3 { font-weight:600 }
h1 { font-weight:bolder; text-transform:uppercase }
hr { width:100% }
.btn-container { display:flex; gap:1em; width:100%; justify-content:center; margin-top:3em }
.btn { border-radius:.9em; padding:.8em 1.5em; border:none; background-color:#7D8D86; box-shadow:1px 1px 1px #00000095; color:#F1F0E4; font-size:.9em }
.form-content > .btn { align-self:center; margin-top:auto }
a { text-decoration:none; color:#F1F0E4 }
#password-strength { font-weight:bold; }
</style>
