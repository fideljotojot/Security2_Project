<template>
  <main class="container" style="overflow: auto">
    <p v-if="errorMessage" class="alert-danger">{{ errorMessage }}</p>
    <div class="user-table">
      <div class="header-section">
        <h2>Pending Registrations</h2>
        <button type="button" @click="fetchRegistrations">Refresh</button>
      </div>
      <div class="filter-container">
        <div class="searchbar">
          <input v-model="search" type="search" placeholder="Search by Employee ID, username, or email" aria-label="Search pending registrations">
          <button v-if="search" type="button" class="search-clear" @click="search = ''" aria-label="Clear search">
            <i class="fi fi-br-cross-small"></i>
          </button>
          <i v-else class="fi fi-br-search" aria-hidden="true"></i>
        </div>
        <div class="dropdown">
          <select v-model="idSort" aria-label="Sort by Employee ID">
            <option value="">Sort by Employee ID</option>
            <option value="ascending">Ascending order</option>
            <option value="descending">Descending order</option>
          </select>
          <select v-model="timeFilter" aria-label="Filter registrations by time">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Registered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="registration in paginatedRegistrations" :key="registration.user_id">
            <td>{{ registration.id_number }}</td>
            <td>{{ registration.username }}</td>
            <td>{{ registration.email }}</td>
            <td>{{ formatDate(registration.created_at) }}</td>
            <td class="registration-actions">
              <button type="button" class="unlock-btn" title="Approve registration" aria-label="Approve registration"
                :disabled="isUpdating" @click="updateStatus(registration, 'approved')">
                <i class="fi fi-rc-check-circle" aria-hidden="true"></i>
              </button>
              <button type="button" class="block-action-btn reject-btn" title="Block registration" aria-label="Block registration"
                :disabled="isUpdating" @click="updateStatus(registration, 'blocked')">
                <i class="fi fi-br-cross-circle" aria-hidden="true"></i>
              </button>
            </td>
          </tr>
          <tr v-if="!isLoading && !filteredRegistrations.length">
            <td colspan="5" class="empty-state">No pending registrations.</td>
          </tr>
        </tbody>
      </table>
      <div class="table-panel-footer">
        <span>Showing {{ pageStart }}-{{ pageEnd }} of {{ filteredRegistrations.length }} registrations</span>
        <div class="pagination">
          <button type="button" class="pagination-arrow" :disabled="page === 1" @click="page--">&lsaquo;</button>
          <span class="pagination-label">Page</span>
          <button v-for="number in pageNumbers" :key="number" type="button" class="pagination-page"
            :class="{ active: page === number }" @click="page = number">{{ number }}</button>
          <span class="pagination-total">of {{ pageCount }}</span>
          <button type="button" class="pagination-arrow" :disabled="page === pageCount" @click="page++">&rsaquo;</button>
        </div>
      </div>
    </div>
  </main>
</template>

<script src="@/assets/JS/admin/registrations.js"></script>
<style src="@/assets/CSS/superadmin.css"></style>
