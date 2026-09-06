<template>
  <main class="container" style="overflow: auto">

    <p v-if="errorMessage" class="alert-danger">{{ errorMessage }}</p>
    <div class="user-table">
      <div class="header-section">
        <h2>Pending Registrations</h2>
        <button type="button" @click="fetchRegistrations">Refresh</button>
      </div>
      <div class="filter-container">
        <div class="searchbar"><input v-model="registrationSearch" type="search" placeholder="Search username or email" aria-label="Search pending registrations"><i class="fi fi-br-search" aria-hidden="true"></i></div>
        <div class="dropdown"><select v-model="registrationIdSort" aria-label="Sort by Employee ID"><option value="">Sort by Employee ID</option><option value="ascending">Ascending order</option><option value="descending">Descending order</option></select><select v-model="selectedRegistrationTime" aria-label="Filter registrations by time"><option value="all">All time</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option></select></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee Number</th>
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
              <button type="button" class="block-action-btn reject-btn" title="Reject registration" aria-label="Reject registration"
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
      <div class="table-panel-footer"><span>Showing {{ pageStart(filteredRegistrations) }}-{{ pageEnd(filteredRegistrations) }} of {{
        filteredRegistrations.length }} registrations</span>
        <div class="pagination"><button type="button" class="pagination-arrow" :disabled="registrationPage === 1"
            @click="registrationPage--">&lsaquo;</button><span class="pagination-label">Page</span><button
            v-for="page in pageNumbers(filteredRegistrations)" :key="page" type="button" class="pagination-page"
            :class="{ active: registrationPage === page }" @click="registrationPage = page">{{ page }}</button><span
            class="pagination-total">of {{ pageCount(filteredRegistrations) }}</span><button type="button"
            class="pagination-arrow" :disabled="registrationPage === pageCount(filteredRegistrations)"
            @click="registrationPage++">&rsaquo;</button></div>
      </div>
    </div>

    <div class="user-table" style="margin-top:1.5rem">
      <div class="header-section">
        <h2>Deletion Requests</h2><button type="button" @click="fetchDeleteRequests">Refresh</button>
      </div>
      <div class="filter-container">
        <div class="searchbar"><input v-model="deleteSearch" type="search" placeholder="Search username or email" aria-label="Search deletion requests"><i class="fi fi-br-search" aria-hidden="true"></i></div>
        <div class="dropdown"><select v-model="deleteIdSort" aria-label="Sort by Employee ID"><option value="">Sort by Employee ID</option><option value="ascending">Ascending order</option><option value="descending">Descending order</option></select><select v-model="selectedDeleteTime" aria-label="Filter deletion requests by time"><option value="all">All time</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option></select></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Full Name</th>
            <th>Username</th>
            <th>Email</th>
            <th>Birthdate</th>
            <th>Age</th>
            <th>Sex</th>
            <th>Address</th>
            <th>Zip Code</th>
            <th>Reason</th>
            <th>Requested</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in paginatedDeleteRequests" :key="request.request_id">
            <td>{{ request.id_number }}</td>
            <td>{{ [request.first_name, request.middle_initial, request.last_name, request.suffix].filter(Boolean).join(' ') }}</td>
            <td>{{ request.username }}</td>
            <td>{{ request.email }}</td>
            <td>{{ request.birthdate }}</td>
            <td>{{ request.age }}</td>
            <td>{{ request.sex }}</td>
            <td>
              {{ [request.purok, request.barangay, request.city, request.province, request.country].filter(Boolean).join(', ') }}
            </td>
            <td>{{ request.zip }}</td>
            <td>{{ request.reason }}</td>
            <td>{{ formatDate(request.created_at) }}</td>
            <td class="registration-actions">
              <button type="button" class="unlock-btn" title="Approve deletion" aria-label="Approve deletion"
                :disabled="isUpdating" @click="reviewDelete(request, true)">
                <i class="fi fi-rc-check-circle" aria-hidden="true"></i>
              </button>
              <button type="button" class="block-action-btn reject-btn" title="Reject deletion" aria-label="Reject deletion"
                :disabled="isUpdating" @click="reviewDelete(request, false)">
                <i class="fi fi-br-cross-circle" aria-hidden="true"></i>
              </button>
            </td>
          </tr>
          <tr v-if="!filteredDeleteRequests.length">
            <td colspan="12">No pending deletion requests.</td>
          </tr>
        </tbody>
      </table>
      <div class="table-panel-footer"><span>Showing {{ pageStart(filteredDeleteRequests) }}-{{ pageEnd(filteredDeleteRequests) }} of {{
        filteredDeleteRequests.length }} requests</span>
        <div class="pagination"><button type="button" class="pagination-arrow" :disabled="deletePage === 1"
            @click="deletePage--">&lsaquo;</button><span class="pagination-label">Page</span><button
            v-for="page in pageNumbers(filteredDeleteRequests)" :key="page" type="button" class="pagination-page"
            :class="{ active: deletePage === page }" @click="deletePage = page">{{ page }}</button><span
            class="pagination-total">of {{ pageCount(filteredDeleteRequests) }}</span><button type="button"
            class="pagination-arrow" :disabled="deletePage === pageCount(filteredDeleteRequests)"
            @click="deletePage++">&rsaquo;</button></div>
      </div>
    </div>
  </main>
</template>

<script src="@/assets/JS/superadmin/registrations.js"></script>
<style src="@/assets/CSS/superadmin.css"></style>
