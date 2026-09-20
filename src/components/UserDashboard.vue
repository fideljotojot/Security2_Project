<template>
  <main class="dashboard-shell">
    <section class="dashboard-intro" aria-labelledby="dashboard-title">
      <div>
        <p class="eyebrow">CSUCC STUDENT DASHBOARD</p>
        <h1 id="dashboard-title">Find your<br /><em>instructor.</em></h1>
        <p class="intro-copy">Use the active instructor directory to quickly find the faculty member connected to your
          class or course.</p>
      </div>
      <div class="date-note"><span class="pulse"></span><span>Student portal<br /><strong>Ready to help</strong></span>
      </div>
    </section>
    <section class="search-panel" aria-labelledby="search-title">
      <div class="search-panel-copy">
        <p class="panel-index">DIRECTORY SEARCH / 01</p>
        <h2 id="search-title">Search the<br /><span>faculty directory.</span></h2>
        <p>Find an active instructor by first name, last name, or full name.</p>
      </div>
      <div class="search-column">
      <form class="directory-search" @submit.prevent="searchInstructors"><label for="instructor-search">Search instructors</label>
        <div class="search-input-wrap"><span class="search-icon" aria-hidden="true"></span><input id="instructor-search"
            v-model="search" @input="handleSearchInput" type="search" placeholder="Try an instructor name" autocomplete="off" /><button type="submit" :disabled="loading">{{ loading ? 'Searching' : 'Search' }} <span
              aria-hidden="true">-&gt;</span></button></div>
        <p v-if="searchError" class="directory-message error-message">{{ searchError }}</p>
      </form>
      <div v-if="searched" class="instructor-results" aria-live="polite">
        <div class="results-heading"><span>SEARCH RESULTS</span><strong>{{ instructors.length }} {{ instructors.length === 1 ? 'match' : 'matches' }}</strong></div>
        <p v-if="!instructors.length && !searchError" class="directory-message">No active instructors found. Try another name.</p>
        <div v-for="(instructor, index) in instructors" :key="instructor.user_id" class="instructor-result">
          <span class="result-index">0{{ index + 1 }}</span>
          <span class="result-name"><strong>{{ [instructor.first_name, instructor.last_name].filter(Boolean).join(' ') }}</strong><small>{{ instructor.position || 'Instructor' }}</small></span>
          <span class="active-status"><span class="status-dot" aria-hidden="true"></span>Active</span>
        </div>
      </div>
      </div>
      <div class="index-motif" aria-hidden="true">
        <span>A</span><span>B</span><span>C</span><span>D</span><span>...</span></div>
    </section>
    <section class="dashboard-lower" aria-label="Directory information">
      <div class="stats-grid">
        <article class="stat-card"><span class="stat-number">01</span><strong>Search by name</strong>
          <p>Use a first name, last name, or full name to find a match.</p>
        </article>
        <article class="stat-card accent"><span class="stat-number">02</span><strong>Active faculty only</strong>
          <p>Results include approved, active instructors in the directory.</p>
        </article>
        <article class="stat-card"><span class="stat-number">03</span><strong>Clear results</strong>
          <p>Names are listed consistently so you can identify the right instructor.</p>
        </article>
      </div>
      <aside class="help-card">
        <p class="panel-index">QUICK GUIDE</p>
        <h2>Start with a name,<br /><em>find your match.</em></h2>
        <p>Search results are ordered by last name and show each instructor's current position.</p><a
          href="#instructor-search">How to search <span aria-hidden="true">-&gt;</span></a>
      </aside>
    </section>
  </main>
</template>
<script>
import { supabase } from '@/utils/supabase.js';

export default {
  name: 'UserDashboard',
  data: () => ({ search: '', instructors: [], searched: false, searchError: '', loading: false }),
  methods: {
    handleSearchInput() {
      if (this.search.trim()) return;

      this.instructors = [];
      this.searched = false;
      this.searchError = '';
    },
    async searchInstructors() {
      this.searchError = '';
      this.searched = true;
      this.loading = true;
      const { data, error } = await supabase.rpc('search_active_instructors', { p_search: this.search.trim() });
      this.loading = false;
      if (error) {
        this.instructors = [];
        this.searchError = 'Unable to load instructors.';
      } else {
        this.instructors = data || [];
      }
    }
  }
}
</script>
<style src="../assets/CSS/landing_page.css" scoped></style>
