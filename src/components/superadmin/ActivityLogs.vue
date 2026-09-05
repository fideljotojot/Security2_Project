<template>
  <main class="container">
    <div class="user-table">
      <div class="header-section table-panel-header">
        <h2>Activity Logs</h2><button type="button" @click="loadLogs">Refresh</button>
      </div>
      <div class="filter-container">
        <div class="searchbar"><input type="search" placeholder="Search actions, entities, or users"
            v-model="searchQuery" aria-label="Search activity logs"><button v-if="searchQuery" type="button"
            class="search-clear" @click="searchQuery = ''" aria-label="Clear search"><i
              class="fi fi-br-cross-small"></i></button><i v-else class="fi fi-br-search" aria-hidden="true"></i></div>
        <div class="dropdown"><select v-model="selectedActor" aria-label="Filter by performed by">
            <option value="all">All performers</option>
            <option v-for="actor in actors" :key="actor" :value="actor">{{ actor }}</option>
          </select><select v-model="selectedAction" aria-label="Filter by action">
            <option value="all">All actions</option>
            <option v-for="action in actions" :key="action" :value="action">{{ action }}</option>
          </select><select v-model="selectedTime" aria-label="Filter by time">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select></div>
      </div>
      <p v-if="errorMessage" class="alert-danger">{{ errorMessage }}</p>
      <table>
        <thead>
          <tr>
            <th class="activity-action-column">Action</th>
            <th class="activity-entity-column">Entity</th>
            <th class="activity-performer-column">Performed By</th>
            <th class="activity-date-column">Date & Time</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in paginatedLogs" :key="log.log_id">
            <td class="activity-action-column">{{ log.action }}</td>
            <td class="activity-entity-column">{{ log.entity_type }}<template v-if="log.entity_id"> #{{ log.entity_id }}</template>
            </td>
            <td class="activity-performer-column">{{ log.actor_username || 'System' }}</td>
            <td class="activity-date-column">{{ formatDate(log.created_at) }}</td>
          </tr>
          <tr v-if="!filteredLogs.length">
            <td colspan="4" class="empty-state">No matching activity logs.</td>
          </tr>
        </tbody>
      </table>
      <div class="table-panel-footer"><span>Showing {{ pageStart }}-{{ pageEnd }} of {{ filteredLogs.length }}
          logs</span>
        <div class="pagination"><button type="button" class="pagination-arrow" :disabled="currentPage === 1"
            @click="currentPage--">&lsaquo;</button><span class="pagination-label">Page</span><button
            v-for="page in pageCount" :key="page" type="button" class="pagination-page"
            :class="{ active: currentPage === page }" @click="currentPage = page">{{ page }}</button><span
            class="pagination-total">of {{ pageCount }}</span><button type="button" class="pagination-arrow"
            :disabled="currentPage === pageCount" @click="currentPage++">&rsaquo;</button></div>
      </div>
    </div>
  </main>
</template>
<script src="@/assets/JS/superadmin/activity-logs.js"></script>
<style src="@/assets/CSS/superadmin.css"></style>
