<template>
  <main class="container">
    <div class="user-table">
      <div class="header-section table-panel-header">
        <h2>Users</h2>
        <button @click="openAddModal">
          <i><i class="fi fi-br-add"></i></i>
          Add User
        </button>
      </div>
      <div class="filter-container">
        <div class="searchbar">
          <input type="search" name="searchbar" id="searchbar" placeholder="Search by ID, username, or email"
            v-model="searchQuery" aria-label="Search users">
          <button v-if="searchQuery" type="button" class="search-clear" @click="searchQuery = ''"
            aria-label="Clear search" title="Clear search">
            <i class="fi fi-br-cross-small" aria-hidden="true"></i>
          </button>
          <i v-else class="fi fi-br-search" aria-hidden="true"></i>
        </div>
        <div class="dropdown">
          <select name="user-role" id="user-role" v-model="selectedRole">
            <option value="all">All</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>

          <select name="user-status" id="user-status" v-model="selectedStatus">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>

          <select name="id-sort" id="id-sort" v-model="sortOrder" aria-label="Sort ID number">
            <option value="">Sort by default</option>
            <option value="ascending">ID: Ascending</option>
            <option value="descending">ID: Descending</option>
          </select>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID Number</th>
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
            <td>{{ user.is_locked_out ? 'Blocked' : 'Active' }}</td>
            <td>
              <button @click="openEditModal(user)" class="edit-btn" title="Edit user" aria-label="Edit user">
                <i class="fi fi-br-edit"></i>
              </button>
              <button @click="toggleLockout(user)" class="lock-btn" :title="user.is_locked_out ? 'Unblock' : 'Block'">
                <i :class="user.is_locked_out ? 'fi fi-br-user-check' : 'fi fi-br-user-forbidden'"></i>
              </button>
            </td>
          </tr>
          <tr v-if="filteredUsers.length === 0">
            <td colspan="6">No users match the selected filters.</td>
          </tr>
        </tbody>
      </table>
      <div class="table-panel-footer">
        <span v-if="filteredUsers.length">Showing {{ pageStart }}-{{ pageEnd }} of {{ filteredUsers.length }}
          users
        </span>
        <span v-else>Showing 0 of 0 users</span>
        <div class="pagination" aria-label="User table pagination">
          <button type="button" class="pagination-arrow" :disabled="currentPage === 1" @click="currentPage--"
            aria-label="Previous page" title="Previous page">&lsaquo;
          </button>
          <span class="pagination-label">Page</span>
          <button v-for="page in pageNumbers" :key="page" type="button" class="pagination-page"
            :class="{ active: currentPage === page }" :aria-current="currentPage === page ? 'page' : undefined"
            :aria-label="`Go to page ${page}`" @click="currentPage = page">{{ page }}
          </button>
          <span class="pagination-total">of {{ pageCount }}</span>
          <button type="button" class="pagination-arrow" :disabled="currentPage === pageCount" @click="currentPage++"
            aria-label="Next page" title="Next page">&rsaquo;
          </button>
        </div>
      </div>
    </div>

    <!-- Add/Edit User Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeAddModal">
      <div class="modal-card">
        <h3 class="header-h3">{{ isEditing ? 'Edit User/Admin' : 'Add New User/Admin' }}</h3>

        <!-- Dynamic Step Header & Indicator Side by Side -->
        <div class="step-header-container">
          <h3 class="step-title">{{ step === 'personal' ? 'Personal Details' : 'Address & Login Details' }}
          </h3>
          <div class="steps">
            <div class="step-indicator">
              <div v-for="(stepInfo, index) in steps" :key="stepInfo.id" class="step-item" :class="{
                'active': step === stepInfo.id,
                'completed': isStepCompleted(stepInfo.id)
              }">
                <div class="step-number">{{ index + 1 }}</div>
                <div class="step-label">{{ stepInfo.label }}</div>
              </div>
            </div>
          </div>
        </div>
        <hr class="step-divider">

        <div v-if="errorMessage" class="alert-danger">
          {{ errorMessage }}
        </div>

        <form @submit.prevent="registerUser" class="modal-form">

          <!-- Step 1: Personal Details -->
          <div class="form-content" v-if="step === 'personal'">
            <div class="registration-box">
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('fname')">{{ getWarning('fname') }}</span>
                <input type="text" id="fname" v-model="form.firstName" required @input="validateName">
                <label for="fname">First Name: <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('mname')">{{ getWarning('mname') }}</span>
                <input type="text" id="mname" v-model="form.middleInitial" @input="validateMname">
                <label for="mname">Middle Initial: <span class="optional">(Optional)</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('lname')">{{ getWarning('lname') }}</span>
                <input type="text" id="lname" v-model="form.lastName" required @input="validateName">
                <label for="lname">Last Name: <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('suffix')">{{ getWarning('suffix')
                  }}</span>
                <input type="text" id="suffix" placeholder="Jr, Sr, III, etc." v-model="form.suffix"
                  @input="validateSuffix">
                <label for="suffix">Suffix: <span class="optional">(Optional)</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('birthdate')">{{ getWarning('birthdate')
                  }}</span>
                <input type="date" id="birthdate" v-model="form.birthdate" required @input="onBirthInput">
                <label for="birthdate">Birthdate: <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('age')">{{ getWarning('age') }}</span>
                <input type="number" id="age" v-model="form.age" required readonly>
                <label for="age">Age: <span>*</span></label>
              </div>
              <div class="form-group">
                <select id="sex" v-model="form.sex" required>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <label for="sex">Sex: <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('email')">{{ getWarning('email') }}</span>
                <input type="email" id="email" v-model="form.email" required @input="checkEmail">
                <label for="email">Email: <span>*</span></label>
              </div>
            </div>
            <div class="btn-container">
              <button type="button" @click="closeAddModal" class="btn btn-secondary">Cancel</button>
              <button type="button" @click="step = 'login_details'" class="btn"
                :disabled="!canProceedPersonal">Next</button>
            </div>
          </div>

          <!-- Step 2: Address & Login Details -->
          <div class="form-content" v-if="step === 'login_details'">

            <div class="registration-box">
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('purok')">{{ getWarning('purok') }}</span>
                <input type="text" id="purok" v-model="form.purok" required @input="validateStreet">
                <label for="purok">Purok: <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('barangay')">{{ getWarning('barangay')
                  }}</span>
                <input type="text" id="barangay" v-model="form.barangay" required @input="validateBrgy">
                <label for="barangay">Barangay: <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('city')">{{ getWarning('city') }}</span>
                <input type="text" id="city" v-model="form.city" required @input="validateCity">
                <label for="city">City/Municipality: <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('province')">{{ getWarning('province')
                  }}</span>
                <input type="text" id="province" v-model="form.province" required @input="validateProvince">
                <label for="province">Province: <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('country')">{{ getWarning('country')
                  }}</span>
                <input type="text" id="country" v-model="form.country" required @input="validateCountry">
                <label for="country">Country: <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('zip')">{{ getWarning('zip') }}</span>
                <input type="number" id="zip" v-model="form.zip" required @input="validateZipcode">
                <label for="zip">Zip Code: <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('user_id')">{{ getWarning('user_id')
                  }}</span>
                <input type="text" id="user_id" v-model="form.idNumber" required @input="checkID">
                <label for="user_id">ID No. <span>*</span></label>
              </div>
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('username')">{{ getWarning('username')
                  }}</span>
                <input type="text" id="username" v-model="form.username" required @input="checkUsername">
                <label for="username">Username: <span>*</span></label>
              </div>

              <!-- Role selection (exclusive to Superadmin Users UI) -->
              <div class="form-group">
                <select id="role" v-model="form.role" required>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
                <label for="role">Role: <span>*</span></label>
              </div>

              <!-- Password -->
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('password')">{{ getWarning('password')
                  }}</span>

                <div v-if="form.password" class="password-strength">
                  <p class="strength-text">{{ passwordStrengthLabel }}</p>
                  <div class="strength-bar" :class="passwordStrengthClass"></div>
                </div>

                <div class="password-input-wrapper">
                  <input :type="showPassword ? 'text' : 'password'" id="password" v-model="form.password"
                    :required="!isEditing" @input="validatePassword">
                  <svg v-if="!showPassword" @click="showPassword = !showPassword" xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    <path fill-rule="evenodd"
                      d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
                      clip-rule="evenodd" />
                  </svg>
                  <svg v-else @click="showPassword = !showPassword" xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
                    <path
                      d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                    <path
                      d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                    <path
                      d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
                  </svg>
                </div>
                <label for="password">Password: <span v-if="!isEditing">*</span><span v-else class="optional">(Leave
                    blank to keep current)</span></label>
              </div>

              <!-- Confirm Password -->
              <div class="form-group">
                <span class="field-warning" v-if="getWarning('repassword')">{{ getWarning('repassword')
                  }}</span>
                <div class="password-input-wrapper">
                  <input :type="showRePassword ? 'text' : 'password'" id="repassword" v-model="form.repassword"
                    :required="!isEditing && !!form.password" @input="validateConfirmPassword">
                  <svg v-if="!showRePassword" @click="showRePassword = !showRePassword"
                    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    <path fill-rule="evenodd"
                      d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
                      clip-rule="evenodd" />
                  </svg>
                  <svg v-else @click="showRePassword = !showRePassword" xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24" fill="currentColor" class="size-6 eye-icon">
                    <path
                      d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                    <path
                      d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                    <path
                      d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
                  </svg>
                </div>
                <label for="repassword">Re-enter Password: <span v-if="!isEditing">*</span></label>
              </div>
            </div>
            <div class="btn-container">
              <button type="button" @click="step = 'personal'" class="btn btn-secondary">Back</button>
              <button type="submit" class="btn btn-primary" :disabled="!canProceedLoginDetails || isSubmitting">
                {{ isSubmitting ? (isEditing ? 'Saving...' : 'Registering...') : (isEditing ? 'Save Changes' :
                  'Register') }}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>

    <!-- User added notification -->
    <div v-if="showNotificationModal" class="modal-overlay notification-overlay" @click.self="closeNotificationModal">
      <div class="notification-card" role="dialog" aria-modal="true" aria-labelledby="notification-title">
        <div class="notification-header">
          <div class="notification-icon" aria-hidden="true">
            <i class="fi fi-br-check"></i>
          </div>
          <h3 id="notification-title">{{ notificationTitle }}</h3>
        </div>
        <p>{{ notificationMessage }}</p>
        <button type="button" class="btn btn-primary" @click="closeNotificationModal">OK</button>
      </div>
    </div>
  </main>
</template>

<script src="@/assets/JS/superadmin/users.js">
</script>

<style src="@/assets/CSS/superadmin.css"></style>
