<template>
  <main class="dashboard-shell">
    <section class="dashboard-intro" aria-labelledby="dashboard-title">
      <div>
        <p class="eyebrow">CSUCC STUDENT DIRECTORY</p>
        <h1 id="dashboard-title">Find the right<br /><em>instructor.</em></h1>
        <p class="intro-copy">Search the campus faculty directory and get the contact details you need to connect with
          your instructor.</p>
      </div>
      <div class="date-note"><span class="pulse"></span><span>Student portal<br /><strong>Ready to help</strong></span>
      </div>
    </section>
    <section class="search-panel" aria-labelledby="search-title">
      <div class="search-panel-copy">
        <p class="panel-index">DIRECTORY SEARCH / 01</p>
        <h2 id="search-title">Who are you<br /><span>looking for?</span></h2>
        <p>Search by instructor name, department, or course to quickly find the faculty member you need.</p>
      </div>
      <form class="directory-search" @submit.prevent><label for="instructor-search">Search instructors</label>
        <div class="search-input-wrap"><span class="search-icon" aria-hidden="true"></span><input id="instructor-search"
            type="search" placeholder="Try an instructor name or course" /><button type="submit">Search <span
              aria-hidden="true">-&gt;</span></button></div>
        <div class="filter-row"><label><span>Department</span><select>
              <option>All departments</option>
              <option>College of Education</option>
              <option>College of Information Technology</option>
            </select></label><label><span>Course</span><select>
              <option>All courses</option>
              <option>General Education</option>
              <option>Major subjects</option>
            </select></label></div>
      </form>
      <div class="index-motif" aria-hidden="true">
        <span>A</span><span>B</span><span>C</span><span>D</span><span>...</span></div>
    </section>
    <section class="dashboard-lower" aria-label="Directory information">
      <div class="stats-grid">
        <article class="stat-card"><span class="stat-number">01</span><strong>Faculty directory</strong>
          <p>Browse instructor profiles and details.</p>
        </article>
        <article class="stat-card accent"><span class="stat-number">02</span><strong>Department search</strong>
          <p>Explore faculty by academic area.</p>
        </article>
        <article class="stat-card"><span class="stat-number">03</span><strong>Student support</strong>
          <p>Find the right contact more easily.</p>
        </article>
      </div>
      <aside class="help-card">
        <p class="panel-index">QUICK GUIDE</p>
        <h2>Start with a name,<br /><em>or a course.</em></h2>
        <p>Use the filters to narrow your search and find the instructor connected to your class.</p><a
          href="#instructor-search">How to search <span aria-hidden="true">-&gt;</span></a>
      </aside>
    </section>
  </main>
</template>
<script>export default { name: 'UserDashboard' }</script>
<style src="../assets/CSS/landing_page.css" scoped></style>
