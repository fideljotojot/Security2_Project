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
              <option value="">All roles</option><option v-for="role in options.roles" :key="role" :value="role">{{ role.charAt(0).toUpperCase() + role.slice(1) }}</option>
            </select>
            <select v-model="draft.action" aria-label="Filter logs by action" @change="applyFilters">
              <option value="">All actions</option><option v-for="action in options.actions" :key="action" :value="action">{{ action }}</option>
            </select>
          </div>
          <div class="logs-date-filters">
            <label for="logs-from-date"><span>From date</span><input id="logs-from-date" v-model="draft.from" type="date" @change="applyFilters"></label>
            <label for="logs-to-date"><span>To date</span><input id="logs-to-date" v-model="draft.to" type="date" @change="applyFilters"></label>
          </div>
        </div>
      </form>
      <p v-if="validationMessage" class="alert-danger" role="alert">{{ validationMessage }}</p>
      <p v-if="errorMessage" class="alert-danger" role="alert">{{ errorMessage }}</p>
      <div class="logs-table-container" :aria-busy="loading" :aria-label="categoryLabel">
        <table class="categorized-logs-table" :class="{ 'logs-table-all': category === 'all', 'logs-table-security': category === 'security' }" role="table">
          <thead><tr>
              <th class="log-col-id">User ID</th><th class="log-col-performer">Performed By</th><th class="log-col-role">Role</th><th v-if="category === 'all'" class="log-col-category">Category</th><th class="log-col-module">Module</th><th class="log-col-action">Action</th><th class="log-col-browser">Browser / OS</th>
              <template v-if="category === 'security'"><th class="log-col-date">Time In</th><th class="log-col-date">Time Out</th></template>
              <th v-else class="log-col-date">Date &amp; Time</th><th class="log-col-ip">IP Address</th><th class="log-col-description">Details</th>
            </tr></thead>
          <tbody>
            <tr v-if="loading"><td :colspan="category === 'security' || category === 'all' ? 10 : 9" class="empty-state" role="status">Loading {{ categoryLabel.toLowerCase() }}…</td></tr>
            <tr v-else-if="errorMessage"><td :colspan="category === 'security' || category === 'all' ? 10 : 9" class="empty-state">Unable to display logs. Use Refresh to try again.</td></tr>
            <template v-else>
              <tr v-for="log in logs" :key="log.log_id" role="row">
                <td class="log-col-id" data-label="User ID" role="cell">{{ log.actor_id_number || '—' }}</td><td class="log-col-performer" data-label="Performed By" role="cell">{{ actorName(log) }}</td>
                <td class="log-col-role" data-label="Role" role="cell"><span class="log-badge log-badge-neutral">{{ log.actor_role ? log.actor_role.charAt(0).toUpperCase() + log.actor_role.slice(1) : 'System' }}</span></td>
                <td v-if="category === 'all'" class="log-col-category" data-label="Category" role="cell">{{ categoryName(log.category) }}</td>
                <td class="log-col-module" data-label="Module" role="cell">{{ log.module || '—' }}</td>
                <td class="log-col-action" data-label="Action" role="cell"><span class="log-badge" :class="actionClass(log.action)">{{ log.action }}</span></td>
                <td class="log-col-browser" data-label="Browser / OS" role="cell">{{ browserAndOS(log.user_agent) }}</td>
                <template v-if="category === 'security'">
                  <td class="log-col-date" data-label="Time In" role="cell">{{ formatDate(log.time_in) }}</td>
                  <td class="log-col-date" data-label="Time Out" role="cell"><template v-if="log.time_out">{{ formatDate(log.time_out) }}</template>
                    <span v-else-if="log.session_status" class="log-badge" :class="log.session_status === 'Active' ? 'log-badge-success' : 'log-badge-neutral'">{{ log.session_status }}</span>
                    <template v-else>—</template></td>
                </template>
                <td v-else class="log-col-date" data-label="Date &amp; Time" role="cell">{{ formatDate(log.created_at) }}</td>
                <td class="log-col-ip" data-label="IP Address" role="cell"><code>{{ log.ip_address || '—' }}</code></td><td class="log-description log-col-description" data-label="Details" role="cell">{{ logDescription(log) }}</td>
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
        <span class="logs-page-size">8 per page</span>
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
