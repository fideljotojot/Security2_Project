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
            </div>
          </div>
          <form @submit.prevent="save" class="profile-form">
            <div v-if="message" :class="['alert', { success: saved }]" role="status">{{ message }}</div>
            <fieldset>
              <legend>Personal information</legend>
              <div class="form-grid">
                <div class="form-group"><label>First name <span>*</span></label><input v-model="form.first_name"
                    required></div>
                <div class="form-group"><label>Middle initial</label><input v-model="form.middle_initial"></div>
                <div class="form-group"><label>Last name <span>*</span></label><input v-model="form.last_name" required>
                </div>
                <div class="form-group"><label>Suffix</label><input v-model="form.suffix"></div>
                <div class="form-group"><label>Birthdate</label><input v-model="form.birthdate" type="date"></div>
                <div class="form-group"><label>Age</label><input v-model="form.age" type="number"></div>
                <div class="form-group"><label>Sex</label><select v-model="form.sex">
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select></div>
              </div>
            </fieldset>
            <fieldset>
              <legend>Account details</legend>
              <div class="form-grid">
                <div class="form-group"><label>ID Number<span>*</span></label><input v-model="form.id_number" required>
                </div>
                <div class="form-group"><label>Username <span>*</span></label><input v-model="form.username" required>
                </div>
                <div class="form-group"><label>Email <span>*</span></label><input v-model="form.email" type="email"
                    required></div>
                <div class="form-group"><label>Role</label><input class="readonly-field" :value="form.role" readonly>
                </div>
                <div class="form-group"><label>Position</label><input v-model="form.position"></div>
              </div>
            </fieldset>
            <fieldset>
              <legend>Security</legend>
              <div class="form-grid">
                <div class="form-group full-width"><label>New password <small>Optional &middot; minimum 8
                      characters</small></label><input v-model="form.password" type="password" minlength="8"></div>
              </div>
            </fieldset>
            <div class="form-actions">
              <p class="save-hint">Changes are saved securely to your account.</p><button class="save-button"
                :disabled="saving">{{ saving ? 'Saving...' : 'Save changes' }} <span>&rarr;</span></button>
            </div>
          </form>
        </section>
      </div>
    </div>
  </main>
</template>
<script>
import { supabase } from '@/utils/supabase.js';
export default { data: () => ({ form: {}, saving: false, saved: false, message: '' }), async mounted() { const { data, error } = await supabase.rpc('get_my_profile'); if (error) this.message = error.message; else this.form = { ...data, password: '' } }, methods: { async save() { this.saving = true; this.saved = false; const { password, ...profile } = this.form; const { error } = await supabase.rpc('update_my_profile', { ...Object.fromEntries(Object.entries(profile).map(([key, value]) => [`p_${key}`, value || null])), p_password: password || null }); this.saving = false; if (error) this.message = error.message; else { this.saved = true; this.message = 'Profile updated successfully.' } } } };
</script>
<style src="../assets/CSS/profile.css" scoped></style>
