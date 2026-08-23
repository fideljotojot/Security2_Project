<template>
  <main class="container">
    <div class="header-section">
      <h2>Pending Registrations</h2>
      <button type="button" @click="fetchRegistrations">Refresh</button>
    </div>

    <p v-if="errorMessage" class="alert-danger">{{ errorMessage }}</p>
    <div class="user-table">
      <table>
        <thead><tr><th>ID Number</th><th>Username</th><th>Email</th><th>Registered</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="registration in registrations" :key="registration.user_id">
            <td>{{ registration.id_number }}</td>
            <td>{{ registration.username }}</td>
            <td>{{ registration.email }}</td>
            <td>{{ formatDate(registration.created_at) }}</td>
            <td class="registration-actions">
              <button type="button" class="approve-btn" :disabled="isUpdating" @click="updateStatus(registration, 'approved')">Accept</button>
              <button type="button" class="block-btn" :disabled="isUpdating" @click="updateStatus(registration, 'blocked')">Block</button>
            </td>
          </tr>
          <tr v-if="!isLoading && !registrations.length"><td colspan="5" class="empty-state">No pending registrations.</td></tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<script src="@/assets/JS/superadmin/registrations.js"></script>
<style src="@/assets/CSS/superadmin.css"></style>
