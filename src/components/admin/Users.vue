<template>
  <main class="container">
    <div class="user-table">
      <div class="header-section table-panel-header">
        <h2>Users</h2>
      </div>
      <div class="filter-container">
        <div class="searchbar"><input v-model="search" type="search" placeholder="Search by ID, username, or email"
            aria-label="Search users"><button v-if="search" type="button" class="search-clear" @click="search = ''"
            aria-label="Clear search"><i class="fi fi-br-cross-small"></i></button><i v-else class="fi fi-br-search"
            aria-hidden="true"></i></div>
        <div class="dropdown"><select v-model="status" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select><select v-model="selectedRole" aria-label="Filter by role">
            <option value="all">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select><select v-model="sortOrder" aria-label="Sort ID number">
            <option value="">Sort by default</option>
            <option value="ascending">ID: Ascending</option>
            <option value="descending">ID: Descending</option>
          </select></div>
      </div>
      <p v-if="message" class="alert-danger">{{ message }}</p>
      <table>
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in paginatedUsers" :key="user.user_id">
            <td>{{ user.id_number }}</td>
            <td>{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td style="text-transform: capitalize;">{{ user.role }}</td>
            <td style="text-transform: capitalize;">{{ userStatus(user) }}</td>
            <td class="actions-container"><button class="edit-btn" @click="edit(user)" title="Edit user"><i
                  class="fi fi-br-edit"></i></button><button v-if="userStatus(user) === 'pending'" class="unlock-btn"
                @click="setStatus(user, 'approved')" title="Approve user"><i
                  class="fi fi-rc-check-circle"></i></button><button v-if="userStatus(user) !== 'blocked'"
                class="block-action-btn" @click="setStatus(user, 'blocked')" title="Block user"><i
                  class="fi fi-br-user-forbidden"></i></button><button v-else class="unlock-btn"
                @click="setStatus(user, 'approved')" title="Unblock user"><i
                  class="fi fi-br-user-check"></i></button><button class="delete-btn" @click="requestDelete(user)"
                title="Request deletion"><i class="fi fi-br-trash"></i></button></td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="6" class="empty-state">No users found.</td>
          </tr>
        </tbody>
      </table>
      <div class="table-panel-footer"><span>Showing {{ pageStart }}-{{ pageEnd }} of {{ filtered.length }} users</span>
        <div class="pagination"><button type="button" class="pagination-arrow" :disabled="currentPage === 1"
            @click="currentPage--">&lsaquo;</button><span class="pagination-label">Page</span><button
            v-for="page in pageNumbers" :key="page" type="button" class="pagination-page"
            :class="{ active: currentPage === page }" @click="currentPage = page">{{ page }}</button><span
            class="pagination-total">of {{ pageCount }}</span><button type="button" class="pagination-arrow"
            :disabled="currentPage === pageCount" @click="currentPage++">&rsaquo;</button></div>
      </div>
    </div>
    <div v-if="editing" class="modal-overlay">
      <div class="modal-card admin-edit-modal">
        <h3 class="header-h3 edit-modal-title">Edit User/Admin</h3>
        <div class="step-header-container">
          <h3 class="step-title">{{ editStep === 'personal' ? 'Personal Details' : 'Address & Login Details' }}</h3>
          <div class="steps">
            <div class="step-indicator">
              <div :class="['step-item', { active: editStep === 'personal', completed: editStep === 'account' }]"
                @click="editStep = 'personal'">
                <div class="step-number">1</div>
                <div class="step-label">Personal Details</div>
              </div>
              <div :class="['step-item', { active: editStep === 'account' }]" @click="editStep = 'account'">
                <div class="step-number">2</div>
                <div class="step-label">Address & Login</div>
              </div>
            </div>
          </div>
        </div>
        <hr class="step-divider">
        <div v-if="editStep === 'personal'" class="form-grid admin-edit-grid">
          <div class="form-group"><label for="admin-edit-first">First Name: <span>*</span></label><input
              id="admin-edit-first" v-model="editForm.first_name"></div>
          <div class="form-group"><label for="admin-edit-middle">Middle Initial: <span>(Optional)</span></label><input
              id="admin-edit-middle" v-model="editForm.middle_initial"></div>
          <div class="form-group"><label for="admin-edit-last">Last Name: <span>*</span></label><input
              id="admin-edit-last" v-model="editForm.last_name"></div>
          <div class="form-group"><label for="admin-edit-suffix">Suffix: <span>(Optional)</span></label><input
              id="admin-edit-suffix" v-model="editForm.suffix"></div>
          <div class="form-group"><label for="admin-edit-birthdate">Birthdate: <span>*</span></label><input
              id="admin-edit-birthdate" type="date" v-model="editForm.birthdate"></div>
          <div class="form-group"><label for="admin-edit-age">Age: <span>*</span></label><input id="admin-edit-age"
              type="number" v-model="editForm.age"></div>
          <div class="form-group"><label for="admin-edit-sex">Sex: <span>*</span></label><select id="admin-edit-sex"
              v-model="editForm.sex">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select></div>
          <div class="form-group"><label for="admin-edit-email">Email: <span>*</span></label><input
              id="admin-edit-email" v-model="editForm.email"></div>
        </div>
        <div v-else class="form-grid admin-edit-grid">
          <div class="form-group"><label for="admin-edit-purok">Purok: <span>*</span></label><input
              id="admin-edit-purok" v-model="editForm.purok"></div>
          <div class="form-group"><label for="admin-edit-barangay">Barangay: <span>*</span></label><input
              id="admin-edit-barangay" v-model="editForm.barangay"></div>
          <div class="form-group"><label for="admin-edit-city">City/Municipality: <span>*</span></label><input
              id="admin-edit-city" v-model="editForm.city"></div>
          <div class="form-group"><label for="admin-edit-province">Province: <span>*</span></label><input
              id="admin-edit-province" v-model="editForm.province"></div>
          <div class="form-group"><label for="admin-edit-country">Country: <span>*</span></label><input
              id="admin-edit-country" v-model="editForm.country"></div>
          <div class="form-group"><label for="admin-edit-zip">Zip Code: <span>*</span></label><input id="admin-edit-zip"
              v-model="editForm.zip"></div>
          <div class="form-group"><label for="admin-edit-id">Employee No. <span>*</span></label><input
              id="admin-edit-id" v-model="editForm.id_number"></div>
          <div class="form-group"><label for="admin-edit-username">Username: <span>*</span></label><input
              id="admin-edit-username" v-model="editForm.username"></div>
          <div class="form-group"><label for="admin-edit-role">Role: <span>*</span></label><select id="admin-edit-role"
              v-model="editForm.role">
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option v-if="editing.role === 'superadmin'" value="superadmin">Superadmin</option>
            </select></div>
          <div class="form-group"><label for="admin-edit-password">Password: <span>(Leave blank to keep
                current)</span></label><input id="admin-edit-password" type="password" v-model="editForm.password">
          </div>
          <div class="form-group"><label for="admin-edit-repassword">Re-enter Password:</label><input
              id="admin-edit-repassword" type="password" v-model="editForm.repassword"></div>
        </div>
        <div class="btn-container"><button v-if="editStep === 'personal'" class="btn btn-secondary"
            @click="editing = null">Cancel</button><button v-if="editStep === 'account'" type="button"
            class="btn btn-secondary" @click="previousEditStep">Back</button><button v-if="editStep === 'personal'"
            type="button" class="btn btn-primary" @click="nextEditStep">Next</button><button v-else
            class="btn btn-primary" @click="saveEdit">Save</button></div>
      </div>
    </div>
    <div v-if="deleteTarget" class="modal-overlay">
      <div class="notification-card">
        <h3>Request account deletion</h3>
        <p>Superadmin review is required for {{ deleteTarget.username }}.</p><textarea v-model="deleteReason" rows="4"
          placeholder="Reason for deletion (required)"></textarea>
        <div class="btn-container"><button class="btn btn-secondary" @click="deleteTarget = null">Cancel</button><button
            class="btn btn-primary" :disabled="!deleteReason.trim()" @click="submitDelete">Send request</button></div>
      </div>
    </div>
  </main>
</template>
<script src="@/assets/JS/admin/users.js"></script>
<style src="@/assets/CSS/superadmin.css"></style>
