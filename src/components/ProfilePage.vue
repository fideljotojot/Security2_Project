<template>
  <main class="profile-page">
    <div class="profile-shell">
      <header class="page-intro">
        <p class="eyebrow">Account settings</p>
        <h1>My profile</h1>
        <p class="intro-copy">Keep your personal and employment details current across the CSUCC portal.</p>
      </header>
      <div class="profile-layout">
        <aside class="identity-card">
          <div class="accent-leaf"></div>
          <div class="identity-content">
            <div class="monogram">{{ (form.first_name || 'M').charAt(0) }}{{ (form.last_name || 'P').charAt(0) }}</div>
            <span class="status-badge"><span class="status-dot"></span> Active account</span>
            <h2>{{ [form.first_name, form.last_name].filter(Boolean).join(' ') || 'My profile' }}</h2>
            <p class="identity-role">{{ form.position || 'CSUCC staff member' }}</p>
            <dl class="identity-meta">
              <div>
                <dt>ID Number</dt>
                <dd>{{ form.id_number || '&mdash;' }}</dd>
              </div>
              <div>
                <dt>Account role</dt>
                <dd class="identity-role">{{ form.role || '&mdash;' }}</dd>
              </div>
            </dl>
            <p class="identity-note">A complete profile helps your colleagues and administrators keep records accurate.
            </p>
          </div>
        </aside>
        <section class="form-card">
          <div class="form-card-header">
            <div class="form-card-title">
              <p class="section-kicker">Profile details</p>
              <p class="required-note"><span>*</span> Required fields</p>
            </div><button v-if="!isEditing" type="button" class="edit-profile-button" @click="startEditing">Edit
              profile</button>
          </div>
          <form @submit.prevent="requestSave" class="profile-form">
            <div v-if="message" :class="['alert', { success: saved }]" role="status">{{ message }}</div>
            <fieldset>
              <legend>Personal information</legend>
              <div class="form-grid">
                <div class="form-group"><label>First name <span>*</span></label><input v-model="form.first_name"
                    :readonly="!isEditing" @input="validateName('first_name')" required><small
                    v-if="warnings.first_name" class="field-warning">{{ warnings.first_name }}</small></div>
                <div class="form-group"><label>Middle initial</label><input v-model="form.middle_initial"
                    :readonly="!isEditing" @input="validateMiddleInitial"><small v-if="warnings.middle_initial"
                    class="field-warning">{{ warnings.middle_initial }}</small></div>
                <div class="form-group"><label>Last name <span>*</span></label><input v-model="form.last_name"
                    :readonly="!isEditing" @input="validateName('last_name')" required><small v-if="warnings.last_name"
                    class="field-warning">{{ warnings.last_name }}</small></div>
                <div class="form-group"><label>Suffix</label>
                  <input v-model="form.suffix" name="profile_suffix_value" :readonly="!isEditing"
                    @input="validateSuffix">
                  <small v-if="warnings.suffix" class="field-warning">{{ warnings.suffix
                    }}</small>
                </div>
                <div class="form-group"><label>Birthdate</label><input v-model="form.birthdate" type="date"
                    :readonly="!isEditing" @input="validateBirthdate"><small v-if="warnings.birthdate"
                    class="field-warning">{{ warnings.birthdate }}</small></div>
                <div class="form-group"><label>Age</label><input v-model="form.age" type="number" readonly><small
                    v-if="warnings.age" class="field-warning">{{ warnings.age }}</small></div>
                <div class="form-group"><label>Sex</label><select v-model="form.sex" :disabled="!isEditing">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select></div>
              </div>
            </fieldset>
            <fieldset>
              <legend>Account details</legend>
              <div class="form-grid">
                <div class="form-group"><label>ID Number<span>*</span></label><input class="profile-readonly-field"
                    v-model="form.id_number" readonly required><small
                    v-if="warnings.id_number || uniqueErrors.id_number" class="field-warning">{{ warnings.id_number ||
                      uniqueErrors.id_number }}</small></div>
                <div class="form-group"><label>Username <span>*</span></label><input class="profile-readonly-field"
                    v-model="form.username" readonly required><small v-if="warnings.username || uniqueErrors.username"
                    class="field-warning">{{
                      warnings.username || uniqueErrors.username }}</small></div>
                <div class="form-group"><label>Email <span>*</span></label><input v-model="form.email" type="email"
                    :readonly="!isEditing" @input="validateEmail(); checkUnique('email', 'email')" required><small
                    v-if="warnings.email || uniqueErrors.email" class="field-warning">{{ warnings.email ||
                      uniqueErrors.email }}</small></div>
                <div class="form-group"><label>Role <span>*</span></label>
                  <input class="profile-readonly-field" :value="form.role" readonly required>
                </div>
                <div class="form-group"><label>Position <span>*</span></label>
                  <input class="profile-readonly-field" v-model="form.position" readonly required>
                </div>
              </div>
            </fieldset>
            <fieldset v-if="isEditing">
              <legend>Security</legend>
              <div class="form-grid">
                <div class="form-group"><label>New password <small>Optional &middot; minimum 8
                      characters</small></label>
                  <div class="password-input-wrapper"><input v-model="form.password"
                      :type="showNewPassword ? 'text' : 'password'" minlength="8" autocomplete="new-password"
                      @input="validatePassword"><button type="button" class="toggle-password eye-icon"
                      :aria-label="showNewPassword ? 'Hide password' : 'Show password'"
                      @click="showNewPassword = !showNewPassword"><i
                        :class="showNewPassword ? 'fi fi-br-eye-crossed' : 'fi fi-br-eye'"
                        aria-hidden="true"></i></button>
                  </div>

                  <div v-if="form.password" class="password-strength">
                    <p class="strength-text">{{ passwordStrengthLabel }}</p>
                    <div class="strength-bar" :class="passwordStrengthClass"></div>
                  </div>
                  <small v-if="warnings.password" class="field-warning">{{
                          warnings.password
                    }}</small>
                </div>
                <div class="form-group"><label>Confirm password</label>
                  <div class="password-input-wrapper"><input v-model="form.confirm_password"
                      :type="showConfirmPassword ? 'text' : 'password'" autocomplete="new-password"
                      @input="validateConfirmPassword"><button type="button" class="toggle-password eye-icon"
                      :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                      @click="showConfirmPassword = !showConfirmPassword"><i
                        :class="showConfirmPassword ? 'fi fi-br-eye-crossed' : 'fi fi-br-eye'"
                        aria-hidden="true"></i></button></div><small v-if="warnings.confirm_password"
                    class="field-warning">{{ warnings.confirm_password }}</small>
                </div>
              </div>
            </fieldset>
            <div v-if="isEditing" class="form-actions">
              <p class="save-hint">Password confirmation is required before saving.</p>
              <div class="profile-action-buttons"><button type="button" class="cancel-button"
                  @click="cancelEditing">Cancel</button><button type="submit" class="save-button"
                  :disabled="!canSaveProfile">{{ saving ? 'Saving...' : 'Save changes' }} <span>&rarr;</span></button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  </main>
</template>
<script src="../assets/JS/profile.js"></script>
<style src="../assets/CSS/profile.css" scoped></style>
