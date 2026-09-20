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
        <div class="dropdown">
          <select v-model="status" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="inactive">Inactive</option>
            <option value="incomplete">Incomplete</option>
          </select>
          <select v-model="selectedRole" aria-label="Filter by role">
            <option value="all">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select><select v-model="selectedPosition" aria-label="Filter by position">
            <option value="all">All Positions</option>
            <option value="Staff">Staff</option>
            <option value="Instructor">Instructor</option>
            <option value="Student">Student</option>
          </select><select v-model="sortOrder" aria-label="Sort ID number">
            <option value="">Sort by ID</option>
            <option value="ascending">Ascending order</option>
            <option value="descending">Descending order</option>
          </select>
        </div>
      </div>
      <p v-if="message" class="alert-danger">{{ message }}</p>
      <table>
        <thead>
          <tr>
            <th>ID Number</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Position</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in paginatedUsers" :key="user.user_id">
            <td>{{ user.id_number }}</td>
            <td>{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td><span class="value-badge" :class="`role-${String(user.role || 'unknown').toLowerCase()}`">{{ user.role
                }}</span></td>
            <td><span class="value-badge" :class="`position-${String(user.position || 'unknown').toLowerCase()}`">{{
              user.position || '-' }}</span></td>
            <td><span class="value-badge" :class="`status-${String(userStatus(user) || 'unknown').toLowerCase()}`">{{
                userStatus(user) }}</span></td>
            <td class="actions-container">
              <div class="actions-menu"><button type="button" class="actions-menu-trigger"
                  @click="toggleActionsMenu(user.user_id)" :aria-expanded="openActionsUserId === user.user_id"
                  aria-haspopup="menu" aria-label="More actions"><span aria-hidden="true">•••</span></button>
                <div v-if="openActionsUserId === user.user_id" class="actions-menu-dropdown" role="menu"><button
                    type="button" role="menuitem" @click="runAction(() => view(user))">View</button><button
                    type="button" role="menuitem" @click="runAction(() => edit(user))"
                    :disabled="['pending', 'incomplete', 'blocked'].includes(userStatus(user)) || !hasPermission(user, 'manage_account_info')">Edit</button><button
                    type="button" role="menuitem"
                    @click="runAction(() => setStatus(user, userStatus(user) === 'blocked' ? 'approved' : 'blocked'))"
                    :disabled="['pending', 'incomplete'].includes(userStatus(user)) || user.user_id === currentUserId || !hasPermission(user, 'block_accounts')">{{
                      userStatus(user) === 'blocked' ? 'Unblock' : 'Block' }}</button><button type="button"
                    role="menuitem" @click="runAction(() => requestDelete(user))"
                    :disabled="userStatus(user) === 'pending' || user.user_id === currentUserId || !hasPermission(user, 'delete_accounts')">Delete</button>
                </div>
              </div><!--
                aria-label="View user"><i class="fi fi-br-eye"></i></button><button class="edit-btn" @click="edit(user)"
                :disabled="userStatus(user) === 'pending' || userStatus(user) === 'blocked' || !hasPermission(user, 'manage_account_info')"
                :title="userStatus(user) === 'blocked' ? 'Cannot edit blocked users' : 'Edit user'"><i class="fi fi-br-edit"></i></button><button v-if="userStatus(user) !== 'blocked'"
                class="block-action-btn"
                :disabled="userStatus(user) === 'pending' || user.user_id === currentUserId || !hasPermission(user, 'block_accounts')"
                @click="setStatus(user, 'blocked')" title="Block user"><i
                  class="fi fi-br-user-forbidden"></i></button><button v-else class="unlock-btn"
                :disabled="userStatus(user) === 'pending' || user.user_id === currentUserId || !hasPermission(user, 'block_accounts')"
                @click="setStatus(user, 'approved')" title="Unblock user"><i
                  class="fi fi-br-user-check"></i></button><button class="delete-btn" @click="requestDelete(user)"
                :disabled="userStatus(user) === 'pending' || user.user_id === currentUserId || !hasPermission(user, 'delete_accounts')"
                :title="hasPermission(user, 'delete_accounts') ? 'Request deletion' : 'Deletion privilege disabled'">
                <i class="fi fi-br-trash"></i></button>-->
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="7" class="empty-state">No users found.</td>
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
      <div class="modal-card admin-edit-modal" :class="{ 'user-details-view': viewing }">
        <h3 class="header-h3 edit-modal-title">{{ viewing ? 'View Account' : 'Edit Account' }}</h3>
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
              id="admin-edit-first" v-model="editForm.first_name" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-middle">Middle Initial: <span>(Optional)</span></label><input
              id="admin-edit-middle" v-model="editForm.middle_initial" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-last">Last Name: <span>*</span></label><input
              id="admin-edit-last" v-model="editForm.last_name" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-suffix">Suffix: <span>(Optional)</span></label><input
              id="admin-edit-suffix" v-model="editForm.suffix" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-birthdate">Birthdate: <span>*</span></label><input
              id="admin-edit-birthdate" type="date" v-model="editForm.birthdate" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-age">Age: <span>*</span></label><input id="admin-edit-age"
              type="number" v-model="editForm.age" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-sex">Sex: <span>*</span></label><select id="admin-edit-sex"
              v-model="editForm.sex" :disabled="viewing">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select></div>
          <div class="form-group"><label for="admin-edit-email">Email: <span>*</span></label><input
              id="admin-edit-email" v-model="editForm.email" :readonly="viewing"></div>
        </div>
        <div v-else class="form-grid admin-edit-grid">
          <div class="form-group"><label for="admin-edit-purok">Purok: <span>*</span></label><input
              id="admin-edit-purok" v-model="editForm.purok" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-barangay">Barangay: <span>*</span></label><input
              id="admin-edit-barangay" v-model="editForm.barangay" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-city">City/Municipality: <span>*</span></label><input
              id="admin-edit-city" v-model="editForm.city" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-province">Province: <span>*</span></label><input
              id="admin-edit-province" v-model="editForm.province" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-country">Country: <span>*</span></label><input
              id="admin-edit-country" v-model="editForm.country" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-zip">Zip Code: <span>*</span></label><input id="admin-edit-zip"
              v-model="editForm.zip" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-id">ID No. <span>*</span></label><input
              id="admin-edit-id" v-model="editForm.id_number" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-username">Username: <span>*</span></label><input
              id="admin-edit-username" v-model="editForm.username" :readonly="viewing"></div>
          <div class="form-group"><label for="admin-edit-role">Role: <span>*</span></label><select id="admin-edit-role"
              v-model="editForm.role" :disabled="viewing" @change="normalizePosition">
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option v-if="editing.role === 'superadmin'" value="superadmin">Superadmin</option>
            </select></div>
          <div class="form-group"><label for="admin-edit-position">Position:
              <span>*</span></label><select id="admin-edit-position" v-model="editForm.position" :disabled="viewing"
              @change="validatePosition">
              <option value="Instructor">Instructor</option>
              <option value="Staff">Staff</option>
              <option v-if="editForm.role === 'user'" value="Student">Student</option>
            </select></div>
          <div v-if="!viewing" class="form-group"><label for="admin-edit-password">Password: <span>(Leave blank to keep
                current)</span></label><input id="admin-edit-password" type="password" v-model="editForm.password"
              :disabled="!hasPermission(editing, 'reset_passwords')">
          </div>
          <div v-if="!viewing" class="form-group"><label for="admin-edit-repassword">Re-enter Password:</label><input
              id="admin-edit-repassword" type="password" v-model="editForm.repassword"
              :disabled="!hasPermission(editing, 'reset_passwords')"></div>
        </div>
        <div class="btn-container"><button v-if="editStep === 'personal'" class="btn btn-secondary"
            @click="editing = null">{{ viewing ? 'Close' : 'Cancel' }}</button><button v-if="editStep === 'account'"
            type="button" class="btn btn-secondary" @click="previousEditStep">Back</button><button
            v-if="editStep === 'personal'" type="button" class="btn btn-primary"
            @click="nextEditStep">Next</button><button v-else v-show="!viewing" class="btn btn-primary"
            @click="beginSaveEdit">Save</button><button v-if="viewing && editStep === 'account'" type="button"
            class="btn btn-primary" @click="editing = null">Close</button></div>
      </div>
    </div>
    <div v-if="deleteTarget" class="modal-overlay">
      <div class="notification-card delete-request-card">
        <h3>Request account deletion</h3>
        <p>Superadmin review is required for {{ deleteTarget.username }}.</p><textarea v-model="deleteReason" rows="4"
          class="delete-reason-input" placeholder="Reason for deletion (required)"></textarea>
        <div class="btn-container"><button class="btn btn-secondary" @click="deleteTarget = null">Cancel</button><button
            class="btn btn-primary" @click="submitDelete">Send request</button></div>
      </div>
    </div>
    <div v-if="showPasswordModal" class="modal-overlay" @click.self="closePasswordModal">
      <div class="notification-card" role="dialog" aria-modal="true">
        <div class="notification-header">
          <div class="notification-icon delete-modal-icon" aria-hidden="true"><i class="fi fi-br-lock"></i></div>
          <h3>CONFIRM ACTION</h3>
        </div>
        <p>Enter your password to save these account changes.</p>
        <div class="password-input-wrapper delete-password-wrapper">
          <input v-model="confirmationPassword" :type="showConfirmationPassword ? 'text' : 'password'"
            class="delete-password-input" placeholder="Password" autocomplete="current-password"
            @keyup.enter="confirmSaveEdit">
          <button type="button" class="toggle-password" @click="showConfirmationPassword = !showConfirmationPassword"
            :aria-label="showConfirmationPassword ? 'Hide password' : 'Show password'"><i
              :class="showConfirmationPassword ? 'fi fi-br-eye-crossed' : 'fi fi-br-eye'"></i></button>
        </div>
        <div class="btn-container">
          <button class="btn btn-secondary" @click="closePasswordModal">
            Cancel
          </button>
          <button class="btn btn-primary delete-confirm-button"
            :disabled="!confirmationPassword || isConfirmingPassword" @click="confirmSaveEdit">{{ isConfirmingPassword ?
              'Checking...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
    <div v-if="notificationMessage" class="modal-overlay" @click.self="notificationMessage = ''">
      <div
        :class="['notification-card', 'request-success-card', { 'request-error-card': notificationType === 'error' }]"
        role="dialog" aria-modal="true">
        <div class="notification-header">
          <div class="notification-icon" aria-hidden="true"><i
              :class="notificationType === 'error' ? 'fi fi-br-cross-circle' : 'fi fi-br-check'"></i></div>
          <h3>{{ notificationTitle }}</h3>
        </div>
        <p>{{ notificationMessage }}</p>
        <div class="btn-container"><button type="button"
            :class="['btn', 'btn-primary', { 'request-error-button': notificationType === 'error' }]"
            @click="notificationMessage = ''">Close</button></div>
      </div>
    </div>
  </main>
</template>
<script src="@/assets/JS/admin/users.js"></script>
<style src="@/assets/CSS/superadmin.css"></style>
