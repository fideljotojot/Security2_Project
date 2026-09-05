<template>
  <main class="container" style="overflow: auto">

    <p v-if="errorMessage" class="alert-danger">{{ errorMessage }}</p>
    <div class="user-table">
      <div class="header-section">
        <h2>Pending Registrations</h2>
        <button type="button" @click="fetchRegistrations">Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID Number</th>
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
          <tr v-if="!isLoading && !registrations.length">
            <td colspan="5" class="empty-state">No pending registrations.</td>
          </tr>
        </tbody>
      </table>
      <div class="table-panel-footer"><span>Showing {{ pageStart(registrations) }}-{{ pageEnd(registrations) }} of {{
        registrations.length }} registrations</span>
        <div class="pagination"><button type="button" class="pagination-arrow" :disabled="registrationPage === 1"
            @click="registrationPage--">&lsaquo;</button><span class="pagination-label">Page</span><button
            v-for="page in pageNumbers(registrations)" :key="page" type="button" class="pagination-page"
            :class="{ active: registrationPage === page }" @click="registrationPage = page">{{ page }}</button><span
            class="pagination-total">of {{ pageCount(registrations) }}</span><button type="button"
            class="pagination-arrow" :disabled="registrationPage === pageCount(registrations)"
            @click="registrationPage++">&rsaquo;</button></div>
      </div>
    </div>

    <div class="user-table" style="margin-top:1.5rem">
      <div class="header-section">
        <h2>Deletion Requests</h2><button type="button" @click="fetchDeleteRequests">Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Account</th>
            <th>Reason</th>
            <th>Requested</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in paginatedDeleteRequests" :key="request.request_id">
            <td>{{ request.id_number }}</td>
            <td>{{ request.username }} ({{ request.email }})</td>
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
          <tr v-if="!deleteRequests.length">
            <td colspan="5">No pending deletion requests.</td>
          </tr>
        </tbody>
      </table>
      <div class="table-panel-footer"><span>Showing {{ pageStart(deleteRequests) }}-{{ pageEnd(deleteRequests) }} of {{
        deleteRequests.length }} requests</span>
        <div class="pagination"><button type="button" class="pagination-arrow" :disabled="deletePage === 1"
            @click="deletePage--">&lsaquo;</button><span class="pagination-label">Page</span><button
            v-for="page in pageNumbers(deleteRequests)" :key="page" type="button" class="pagination-page"
            :class="{ active: deletePage === page }" @click="deletePage = page">{{ page }}</button><span
            class="pagination-total">of {{ pageCount(deleteRequests) }}</span><button type="button"
            class="pagination-arrow" :disabled="deletePage === pageCount(deleteRequests)"
            @click="deletePage++">&rsaquo;</button></div>
      </div>
    </div>
  </main>
</template>

<script src="@/assets/JS/superadmin/registrations.js"></script>
<style src="@/assets/CSS/superadmin.css"></style>
