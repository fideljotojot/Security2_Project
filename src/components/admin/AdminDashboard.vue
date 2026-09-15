<template>
  <main class="admin-dashboard">
    <section class="admin-dashboard-hero">
      <div>
        <p class="admin-eyebrow">ADMINISTRATION</p>
        <h1>Admin Dashboard</h1>
        <p>Monitor accounts, review registrations, and keep daily operations moving.</p>
      </div>
      <i class="fi fi-rr-user-shield admin-hero-icon" aria-hidden="true"></i>
    </section>

    <p v-if="errorMessage" class="admin-dashboard-error">{{ errorMessage }}</p>

    <section class="admin-stats" aria-label="Account overview">
      <article v-for="card in cards" :key="card.label" class="admin-stat-card">
        <i :class="['admin-stat-icon', card.color, card.icon]" aria-hidden="true"></i>
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
        <router-link :to="card.to">{{ card.link }} <span aria-hidden="true">→</span></router-link>
      </article>
    </section>

    <section class="admin-dashboard-lower">
      <div class="admin-dashboard-panel">
        <p class="admin-eyebrow">WORKSPACE</p>
        <h2>Manage the essentials.</h2>
        <p>Use the tools below to keep account information accurate and registration requests up to date.</p>
        <div class="admin-dashboard-actions">
          <router-link to="/admin/users">
            <i class="fi fi-rr-users-gear" aria-hidden="true"></i>
            <span><b>User management</b><small>Search, review, and manage accounts</small></span>
            <span aria-hidden="true">→</span>
          </router-link>
          <router-link to="/admin/registrations">
            <i class="fi fi-rr-clipboard-check" aria-hidden="true"></i>
            <span><b>Registration requests</b><small>Approve or reject pending registrations</small></span>
            <span aria-hidden="true">→</span>
          </router-link>
        </div>
      </div>

      <aside class="admin-security-panel">
        <div class="admin-security-heading">
          <div><i class="fi fi-rr-shield-check" aria-hidden="true"></i><h3>Admin controls</h3></div>
          <span>Protected</span>
        </div>
        <p>Your access is limited to the administrative tools assigned to your account.</p>
        <ul>
          <li><i class="fi fi-rr-check" aria-hidden="true"></i><span><b>Permission-aware actions</b><small>Available controls follow your assigned privileges</small></span></li>
          <li><i class="fi fi-rr-check" aria-hidden="true"></i><span><b>Protected updates</b><small>Sensitive account changes require confirmation</small></span></li>
          <li><i class="fi fi-rr-check" aria-hidden="true"></i><span><b>Approval workflow</b><small>Registration decisions are recorded securely</small></span></li>
        </ul>
      </aside>
    </section>
  </main>
</template>

<script>
import { supabase } from '@/utils/supabase.js';

export default {
  name: 'AdminDashboard',
  data: () => ({
    stats: { users: '—', registrations: '—', active: '—' },
    errorMessage: ''
  }),
  computed: {
    cards() {
      return [
        { label: 'Total accounts', value: this.stats.users, icon: 'fi-rr-users', color: 'green', to: '/admin/users', link: 'View users' },
        { label: 'Pending registrations', value: this.stats.registrations, icon: 'fi-rr-time-fast', color: 'amber', to: '/admin/registrations', link: 'Review requests' },
        { label: 'Active accounts', value: this.stats.active, icon: 'fi-rr-user-check', color: 'mint', to: '/admin/users', link: 'View status' }
      ];
    }
  },
  async mounted() {
    const [usersResult, registrationsResult] = await Promise.all([
      supabase.rpc('get_admin_users'),
      supabase.rpc('get_pending_registrations')
    ]);
    if (usersResult.error || registrationsResult.error) {
      this.errorMessage = 'Unable to load the admin overview.';
      return;
    }
    const users = usersResult.data || [];
    this.stats = {
      users: users.length,
      registrations: (registrationsResult.data || []).length,
      active: users.filter(user => user.registration_status !== 'pending' && !user.is_locked_out && user.registration_status !== 'blocked').length
    };
  }
};
</script>

<style src="@/assets/CSS/admin-dashboard.css"></style>
