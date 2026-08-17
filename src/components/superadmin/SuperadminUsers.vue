<template>
    <main class="container">
        <div class="header-section">
            <h2>Users</h2>
            <button @click="openAddModal">
                <i><i class="fi fi-br-add"></i></i>
                Add User
            </button>
        </div>
        <div class="user-table">
            <table>
                <thead>
                    <tr>
                        <th>ID Number</th>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="user in users" :key="user.user_id">
                        <td>{{ user.id_number }}</td>
                        <td>{{ user.full_name }}</td>
                        <td>{{ user.email }}</td>
                        <td>{{ user.role }}</td>
                        <td>{{ user.is_locked_out ? 'Blocked' : 'Active' }}</td>
                        <td>
                            <button @click="toggleLockout(user)" class="lock-btn" :title="user.is_locked_out ? 'Unblock' : 'Block'">
                                <i :class="user.is_locked_out ? 'fi fi-br-user-check' : 'fi fi-br-user-forbidden'"></i>
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Add User Modal -->
        <div v-if="showAddModal" class="modal-overlay" @click.self="closeAddModal">
            <div class="modal-card">
                <h3>Add New User/Admin</h3>
                
                <div v-if="errorMessage" class="alert-danger">
                    {{ errorMessage }}
                </div>
                
                <form @submit.prevent="registerUser" class="modal-form">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="modal-id">ID Number <span>*</span></label>
                            <input type="text" id="modal-id" v-model="form.idNumber" placeholder="0000-0000" required @input="validateIdNumber">
                            <span class="field-warning" v-if="warnings.idNumber">{{ warnings.idNumber }}</span>
                        </div>
                        <div class="form-group">
                            <label for="modal-username">Username <span>*</span></label>
                            <input type="text" id="modal-username" v-model="form.username" placeholder="first_last" required @input="validateUsername">
                            <span class="field-warning" v-if="warnings.username">{{ warnings.username }}</span>
                        </div>
                        <div class="form-group">
                            <label for="modal-fname">First Name <span>*</span></label>
                            <input type="text" id="modal-fname" v-model="form.firstName" required>
                        </div>
                        <div class="form-group">
                            <label for="modal-lname">Last Name <span>*</span></label>
                            <input type="text" id="modal-lname" v-model="form.lastName" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="modal-email">Email Address <span>*</span></label>
                            <input type="email" id="modal-email" v-model="form.email" required @input="validateEmail">
                            <span class="field-warning" v-if="warnings.email">{{ warnings.email }}</span>
                        </div>
                        <div class="form-group full-width">
                            <label for="modal-password">Password <span>*</span></label>
                            <input type="password" id="modal-password" v-model="form.password" required @input="validatePassword">
                            <span class="field-warning" v-if="warnings.password">{{ warnings.password }}</span>
                        </div>
                        <div class="form-group full-width">
                            <label for="modal-role">Role <span>*</span></label>
                            <select id="modal-role" v-model="form.role" required>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" @click="closeAddModal" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary" :disabled="!isFormValid || isSubmitting">
                            {{ isSubmitting ? 'Registering...' : 'Register' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </main>
</template>

<script src="@/assets/JS/superadmin/users.js">
</script>

<style src="@/assets/CSS/superadmin.css"></style>