<template>
  <main class="container activity-logs-page">
    <section class="user-table" aria-labelledby="logs-heading">
      <div class="header-section table-panel-header">
        <h2 id="logs-heading">Logs</h2>
        <div class="logs-header-actions">
          <button class="logs-clear-button" type="button" @click="clearFilters">Clear</button>
          <button type="button" @click="applyFilters">Refresh</button>
        </div>
      </div>
      <form class="logs-filter-form" @submit.prevent="applyFilters">
        <div class="filter-container logs-primary-filters">
          <div class="searchbar">
            <input v-model="draft.search" type="search" placeholder="Search name, username, action, or details"
              aria-label="Search logs" @input="scheduleSearch" @keydown.enter.prevent="applyFilters">
            <button v-if="draft.search" class="search-clear" type="button" aria-label="Clear search" title="Clear search"
              @click="draft.search = ''; applyFilters()"><i class="fi fi-br-cross-small" aria-hidden="true"></i></button>
            <i v-else class="fi fi-br-search" aria-hidden="true"></i>
          </div>
          <div class="dropdown">
            <select v-model="category" aria-label="Log type" @change="changeCategory">
              <option v-for="item in categories" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
            <select v-model="draft.role" aria-label="Filter logs by role" @change="applyFilters">
              <option value="">All roles</option><option v-for="role in options.roles" :key="role" :value="role">{{ role }}</option>
            </select>
            <select v-model="draft.action" aria-label="Filter logs by action" @change="applyFilters">
              <option value="">All actions</option><option v-for="action in options.actions" :key="action" :value="action">{{ action }}</option>
            </select>
          </div>
          <div class="logs-date-filters">
            <label>From date<input v-model="draft.from" type="date" @change="applyFilters"></label>
            <label>To date<input v-model="draft.to" type="date" @change="applyFilters"></label>
          </div>
        </div>
      </form>
      <p v-if="validationMessage" class="alert-danger" role="alert">{{ validationMessage }}</p>
      <p v-if="errorMessage" class="alert-danger" role="alert">{{ errorMessage }}</p>
      <div class="logs-table-scroll" :aria-busy="loading" tabindex="0" :aria-label="categoryLabel">
        <table class="categorized-logs-table">
          <thead><tr>
              <th>User ID</th><th>Performed By</th><th>Role</th><th v-if="category === 'all'">Category</th><th>Module</th><th>Action</th><th>Browser / OS</th>
              <template v-if="category === 'security'"><th>Time In</th><th>Time Out</th></template>
              <th v-else>Date &amp; Time</th><th>IP Address</th><th>Details</th>
            </tr></thead>
          <tbody>
            <tr v-if="loading"><td :colspan="category === 'security' || category === 'all' ? 10 : 9" class="empty-state" role="status">Loading {{ categoryLabel.toLowerCase() }}…</td></tr>
            <tr v-else-if="errorMessage"><td :colspan="category === 'security' || category === 'all' ? 10 : 9" class="empty-state">Unable to display logs. Use Refresh to try again.</td></tr>
            <template v-else>
              <tr v-for="log in logs" :key="log.log_id">
                <td>{{ log.actor_id_number || '—' }}</td><td>{{ actorName(log) }}</td>
                <td><span class="log-badge log-badge-neutral">{{ log.actor_role || 'System' }}</span></td>
                <td v-if="category === 'all'">{{ categoryName(log.category) }}</td>
                <td>{{ log.module || '—' }}</td>
                <td><span class="log-badge" :class="actionClass(log.action)">{{ log.action }}</span></td>
                <td>{{ browserAndOS(log.user_agent) }}</td>
                <template v-if="category === 'security'">
                  <td>{{ formatDate(log.time_in) }}</td>
                  <td><template v-if="log.time_out">{{ formatDate(log.time_out) }}</template>
                    <span v-else-if="log.session_status" class="log-badge" :class="log.session_status === 'Active' ? 'log-badge-success' : 'log-badge-neutral'">{{ log.session_status }}</span>
                    <template v-else>—</template></td>
                </template>
                <td v-else>{{ formatDate(log.created_at) }}</td>
                <td><code>{{ log.ip_address || '—' }}</code></td><td class="log-description">{{ logDescription(log) }}</td>
              </tr>
              <tr v-if="!logs.length"><td :colspan="category === 'security' || category === 'all' ? 10 : 9" class="empty-state">
                  No {{ category === 'all' ? 'logs' : categoryLabel.toLowerCase() }} match your current filters.
                </td></tr>
            </template>
          </tbody>
        </table>
      </div>
      <div class="table-panel-footer logs-footer">
        <span role="status">Showing {{ pageStart }}–{{ pageEnd }} of {{ total }} entries</span>
        <label class="logs-page-size">Show<select v-model.number="pageSize" @change="changePageSize">
            <option :value="10">10</option><option :value="25">25</option><option :value="50">50</option>
          </select>per page</label>
        <nav class="pagination" aria-label="Log pages">
          <button type="button" :disabled="loading || currentPage === 1" @click="goToPage(currentPage - 1)">‹ Prev</button>
          <template v-for="(page, index) in visiblePages" :key="page">
            <span v-if="index && page - visiblePages[index - 1] > 1" aria-hidden="true">…</span>
            <button type="button" class="pagination-page" :class="{ active: currentPage === page }" :aria-current="currentPage === page ? 'page' : undefined" :disabled="loading" @click="goToPage(page)">{{ page }}</button>
          </template>
          <button type="button" :disabled="loading || currentPage === pageCount" @click="goToPage(currentPage + 1)">Next ›</button>
        </nav>
      </div>
    </section>
  </main>
</template>
<script src="@/assets/JS/superadmin/activity-logs.js"></script>
<style src="@/assets/CSS/superadmin.css"></style>
