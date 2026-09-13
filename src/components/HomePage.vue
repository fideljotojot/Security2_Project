<template>
  <main class="home-container">
    <section class="hero-content" aria-labelledby="home-title">
      <div class="hero-copy">
        <p class="eyebrow">CARAGA STATE UNIVERSITY <span>&middot;</span> CABADBARAN CAMPUS</p>
        <h1 id="home-title">Find your instructor.<br /><em>Start learning.</em></h1>
        <p class="hero-description">A secure campus directory that helps CSUCC students quickly find their
          instructors, connect with the right academic support, and stay on track.</p>
        <div class="hero-actions">
          <router-link class="primary-action" to="/signup">Create an account <span
              aria-hidden="true">-&gt;</span></router-link>
          <router-link class="secondary-action" to="/login">Find an instructor</router-link>
        </div>
      </div>
      <div class="campus-signal" aria-label="Campus community highlights">
        <div class="signal-orbit orbit-one"></div>
        <div class="signal-orbit orbit-two"></div>
        <div class="signal-sun"></div>
        <div class="signal-leaf leaf-one"></div>
        <div class="signal-leaf leaf-two"></div>
        <div class="campus-card main-card">
          <p class="card-kicker">Student directory - 01</p>
          <h2>The right instructor<br /><span>is closer.</span></h2>
          <div class="card-footer"><span class="status-dot"></span>Search campus faculty with confidence</div>
        </div>
        <div class="campus-card marker-card marker-academic" aria-label="Academic learning marker"><span
            class="marker-icon marker-star" aria-hidden="true"></span><strong>Search</strong><small>by instructor</small>
        </div>
        <div class="campus-card marker-card marker-community" aria-label="Campus community marker"><span
            class="marker-icon marker-ring" aria-hidden="true"></span><strong>Connect</strong><small>with your faculty</small></div>
        <div class="signal-label">CSUCC<br /></div>
      </div>
    </section>
    <section class="trust-strip" aria-label="Instructor finder benefits">
      <div class="trust-item"><span class="trust-number">01</span>
        <div><strong>Easy to search</strong><small>Find instructors without the guesswork.</small></div>
      </div>
      <div class="trust-item"><span class="trust-number">02</span>
        <div><strong>Reliable details</strong><small>Access useful faculty information.</small></div>
      </div>
      <div class="trust-item"><span class="trust-number">03</span>
        <div><strong>Student support</strong><small>Reach the right instructor sooner.</small></div>
      </div>
    </section>
  </main>
</template>

<script>
export default { name: 'HomePage' }
</script>

<style src="../assets/CSS/home.css" scoped></style>
